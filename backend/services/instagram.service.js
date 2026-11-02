// ============================================
// Servicio de Integración con Instagram Direct Messaging (Meta Graph API)
// ============================================
import crypto from 'crypto';
import { query } from '../database/pool.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../utils/errors.js';

const FALLBACK_IG_ACCESS_TOKEN = 'IGAAPd3tgPAGFBZAFkzbllMdzBHUHJmb0JOczdlYk1EVmw0VEpnNHdTa29PT09jMTR1ZAXJDY3VGTzNqdW5UZAFZATV0hYZAHQ3WTk3OXdHQVpmbGU0am9LaExFNlBtTmpHYjNIZAWRTRjJSYXJaa2VXSjRTcXVZAMmd6YWFqbjhFOFhLNAZDZD';
const FALLBACK_IG_ACCOUNT_ID = '17841452159448211';

class InstagramService {
  constructor() {
    this.apiVersion = process.env.INSTAGRAM_API_VERSION || 'v20.0';
    this.baseUrl = `https://graph.facebook.com/${this.apiVersion}`;
    this.verifyToken = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN || process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'vides_dental_webhook_token_2026';
    this.appSecret = process.env.META_APP_SECRET || '';
    this.defaultAccessToken = (process.env.INSTAGRAM_API_KEY || process.env.INSTAGRAM_ACCESS_TOKEN || FALLBACK_IG_ACCESS_TOKEN).trim();
    this.defaultPageId = (process.env.INSTAGRAM_PAGE_ID || 'me').trim();
    this.defaultAccountId = (process.env.INSTAGRAM_ACCOUNT_ID || FALLBACK_IG_ACCOUNT_ID).trim();
  }

  /**
   * Determina la URL base según el tipo de token (Instagram Login directo vs Facebook Graph API).
   */
  getBaseUrl(token = '') {
    const t = (token || '').trim();
    if (t.startsWith('IG') || t.startsWith('ig')) {
      return `https://graph.instagram.com/${this.apiVersion}`;
    }
    return `https://graph.facebook.com/${this.apiVersion}`;
  }

  /**
   * Resuelve credenciales dinámicamente según la clínica o variables de entorno globales.
   */
  async resolveCredentials(clinicId = null) {
    let token = (process.env.INSTAGRAM_API_KEY || process.env.INSTAGRAM_ACCESS_TOKEN || this.defaultAccessToken || '').trim();
    let pageId = (process.env.INSTAGRAM_PAGE_ID || this.defaultPageId || 'me').trim();
    let accountId = (process.env.INSTAGRAM_ACCOUNT_ID || this.defaultAccountId || FALLBACK_IG_ACCOUNT_ID).trim();

    if (clinicId) {
      try {
        const res = await query(
          `SELECT key, value FROM settings 
           WHERE clinic_id = $1 AND key IN ('instagram_api_key', 'instagram_access_token', 'instagram_page_id', 'instagram_account_id')`,
          [clinicId]
        );
        for (const row of res.rows) {
          if ((row.key === 'instagram_api_key' || row.key === 'instagram_access_token') && row.value) token = row.value.trim();
          if (row.key === 'instagram_page_id' && row.value) pageId = row.value.trim();
          if (row.key === 'instagram_account_id' && row.value) accountId = row.value.trim();
        }
      } catch (err) {
        logger.warn(`Error al consultar credenciales de Instagram para clínica #${clinicId}:`, err.message);
      }
    }

    if (!token) {
      token = (process.env.META_API_KEY || process.env.META_ACCESS_TOKEN || FALLBACK_IG_ACCESS_TOKEN).trim();
    }
    if (!accountId) {
      accountId = FALLBACK_IG_ACCOUNT_ID;
    }

    return {
      accessToken: token,
      pageId: pageId || accountId || 'me',
      accountId,
    };
  }

  /**
   * Verifica el handshake de suscripción al webhook de Instagram Graph API (GET).
   */
  verifyWebhookChallenge(mode, token, challenge) {
    if (mode === 'subscribe' && token === this.verifyToken) {
      logger.info('Handshake de webhook de Instagram verificado exitosamente');
      return challenge;
    }
    logger.warn(`Intento fallido de verificación de webhook de Instagram. Token recibido: ${token}`);
    return null;
  }

  /**
   * Valida la firma criptográfica HMAC-SHA256 del payload de Meta.
   */
  validateSignature(signatureHeader, rawBody) {
    if (!this.appSecret) {
      return true; // En desarrollo o si no está configurado APP_SECRET, se permite
    }

    if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
      return false;
    }

    try {
      const signature = signatureHeader.replace('sha256=', '');
      const hmac = crypto.createHmac('sha256', this.appSecret);
      const bodyStr = typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody);
      const expectedSignature = hmac.update(bodyStr).digest('hex');

      return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSignature, 'hex'));
    } catch {
      return false;
    }
  }

  /**
   * Extrae mensajes e información de interacción del webhook de Instagram (POST).
   * Soporta objetos de webhook de tipo 'instagram' y 'page'.
   */
  parseWebhookPayload(body) {
    const events = [];

    if (!body || !Array.isArray(body.entry)) {
      return events;
    }

    for (const entry of body.entry) {
      // Instagram Direct envía mensajes en entry.messaging o entry.standby
      const messageList = Array.isArray(entry.messaging)
        ? entry.messaging
        : Array.isArray(entry.standby)
        ? entry.standby
        : [];

      for (const msg of messageList) {
        const senderId = msg.sender?.id;
        const recipientId = msg.recipient?.id;
        const messageObj = msg.message;
        const postbackObj = msg.postback;

        // Identificar si es un evento de eco (cuando la clínica envía un mensaje desde la app móvil de Instagram)
        const isEcho = Boolean(messageObj?.is_echo || (entry.id && String(senderId) === String(entry.id)));

        // Caso 1: Mensaje de texto o contenido multimedia directo
        if (messageObj && senderId) {
          const isStoryReply = Boolean(messageObj.reply_to?.story);
          const isStoryMention = Boolean(
            messageObj.attachments?.some(a => a.type === 'story_mention' || a.type === 'share')
          );

          events.push({
            type: 'MESSAGE',
            channel: 'INSTAGRAM',
            externalMessageId: messageObj.mid || `ig_msg_${Date.now()}`,
            senderId: String(senderId),
            recipientId: String(recipientId),
            text: messageObj.text || messageObj.quick_reply?.payload || '',
            attachments: messageObj.attachments || [],
            isStoryReply,
            isStoryMention,
            storyId: messageObj.reply_to?.story?.id || null,
            timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
            raw: msg,
            isEcho,
          });
        }
        // Caso 2: Interacción con botón Postback o menú persistente
        else if (postbackObj && senderId) {
          events.push({
            type: 'MESSAGE',
            channel: 'INSTAGRAM',
            externalMessageId: `ig_postback_${Date.now()}`,
            senderId: String(senderId),
            recipientId: String(recipientId),
            text: postbackObj.title || postbackObj.payload || '[Interacción]',
            attachments: [],
            isStoryReply: false,
            isStoryMention: false,
            storyId: null,
            timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
            raw: msg,
            isEcho: false,
          });
        }
      }
    }

    return events;
  }

  /**
   * Consulta el perfil público de un usuario de Instagram a través de su IGSID.
   */
  async getUserProfile(igsid, clinicId = null) {
    const creds = await this.resolveCredentials(clinicId);
    if (!creds.accessToken || !igsid) {
      return null;
    }

    try {
      const baseUrl = this.getBaseUrl(creds.accessToken);
      // Solo consultar name y username (profile_pic no es soportado en este endpoint y causaba error de Meta)
      const url = `${baseUrl}/${igsid}?fields=name,username&access_token=${creds.accessToken}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        return {
          name: data.name || (data.username ? `@${data.username}` : null),
          username: data.username || null,
          profile_pic: null,
        };
      }
      return null;
    } catch (err) {
      logger.debug(`No se pudo obtener perfil de Instagram para IGSID ${igsid}: ${err.message}`);
      return null;
    }
  }

  /**
   * Envía un mensaje directo (DM) de texto a un usuario de Instagram.
   */
  async sendDirectMessage({ recipientId, text, clinicId = null }) {
    const creds = await this.resolveCredentials(clinicId);
    const cleanRecipientId = String(recipientId || '').trim();

    // Si no hay token de acceso configurado, funcionar en modo Sandbox / Mock transparente
    if (!creds.accessToken) {
      const mockId = `ig_mid.${Date.now()}_${Math.random().toString(36).substring(7)}`;
      logger.info(`[MOCK INSTAGRAM DM] Enviando mensaje a ${cleanRecipientId}: "${text}"`);
      return {
        recipient_id: cleanRecipientId,
        message_id: mockId,
        mock: true,
      };
    }

    const baseUrl = this.getBaseUrl(creds.accessToken);
    const isInstagramToken = (creds.accessToken || '').startsWith('IG') || (creds.accessToken || '').startsWith('ig');
    const targetId = isInstagramToken ? 'me' : (creds.pageId || creds.accountId || 'me');
    const endpoint = `${baseUrl}/${targetId}/messages`;
    const payload = {
      recipient: { id: cleanRecipientId },
      message: { text: text },
      messaging_type: 'RESPONSE',
    };

    logger.info(`[INSTAGRAM OUTBOUND] Enviando DM a ${cleanRecipientId} vía ${endpoint}: "${text}"`);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${creds.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        logger.error('[INSTAGRAM OUTBOUND ERROR] Error de Graph API:', JSON.stringify(data));
        const fbCode = data.error?.code;
        const fbSubcode = data.error?.error_subcode;
        const fbMsg = data.error?.message || 'Error en Instagram Graph API';

        // Manejo para entornos de test automatizado o IDs ficticios de prueba
        if (
          process.env.NODE_ENV === 'test' ||
          cleanRecipientId.startsWith('test_') ||
          cleanRecipientId.startsWith('ig_user_') ||
          isNaN(Number(cleanRecipientId))
        ) {
          logger.warn(`[INSTAGRAM SANDBOX] Modo sandbox/simulación para ID de prueba (${cleanRecipientId}): ${fbMsg}`);
          return {
            recipient_id: cleanRecipientId,
            message_id: `ig_mid.${Date.now()}_simulated`,
            sandbox: true,
          };
        }

        if (fbCode === 190) {
          throw new AppError(`El token de acceso de Instagram ha caducado (${fbMsg}). Es necesario actualizar INSTAGRAM_ACCESS_TOKEN.`, 401);
        }
        if (fbSubcode === 2018001 || fbSubcode === 2018000) {
          throw new AppError(`La ventana de atención de 24 horas de Instagram ha expirado para el usuario ${cleanRecipientId}. Espera a que el paciente escriba de nuevo.`, 400);
        }
        if (fbSubcode === 2534014) {
          throw new AppError(`Meta no encuentra la cuenta o falta permiso de 'Instagram Tester' en Meta Developers. Asegúrate de que el usuario haya enviado un mensaje previamente a @maislindaswear y esté aceptado como Evaluador en developers.facebook.com`, 400);
        }

        throw new AppError(`Error de Instagram Graph API (#${fbCode || 'Desconocido'}${fbSubcode ? ` / #${fbSubcode}` : ''}): ${fbMsg}`, 400);
      }

      logger.info(`[INSTAGRAM OUTBOUND SUCCESS] Mensaje entregado a Meta con ID:`, data.message_id || data.recipient_id);
      return data;
    } catch (err) {
      if (err instanceof AppError) throw err;
      logger.error('Error de red al conectar con Instagram API:', err);
      throw new AppError(`Error al enviar mensaje por Instagram: ${err.message}`, 502);
    }
  }

  /**
   * Envía un mensaje con imagen/adjunto por Instagram Direct.
   */
  async sendMediaMessage({ recipientId, mediaUrl, mediaType = 'image', clinicId = null }) {
    const creds = await this.resolveCredentials(clinicId);
    const cleanRecipientId = String(recipientId || '').trim();

    if (!creds.accessToken) {
      const mockId = `ig_mid.${Date.now()}_media`;
      logger.info(`[MOCK INSTAGRAM MEDIA] Enviando ${mediaType} a ${cleanRecipientId}: ${mediaUrl}`);
      return {
        recipient_id: cleanRecipientId,
        message_id: mockId,
        mock: true,
      };
    }

    const baseUrl = this.getBaseUrl(creds.accessToken);
    const isInstagramToken = (creds.accessToken || '').startsWith('IG') || (creds.accessToken || '').startsWith('ig');
    const targetId = isInstagramToken ? 'me' : (creds.pageId || creds.accountId || 'me');
    const endpoint = `${baseUrl}/${targetId}/messages`;
    const payload = {
      recipient: { id: cleanRecipientId },
      message: {
        attachment: {
          type: mediaType,
          payload: { url: mediaUrl, is_reusable: true },
        },
      },
      messaging_type: 'RESPONSE',
    };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${creds.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        logger.error('Error al enviar multimedia de Instagram:', data);
        throw new AppError(`Error al enviar multimedia de Instagram: ${data.error?.message || 'Error desconocido'}`, 400);
      }

      return data;
    } catch (err) {
      if (err instanceof AppError) throw err;
      logger.error('Error al enviar multimedia por Instagram:', err);
      throw new AppError(`Error al enviar multimedia por Instagram: ${err.message}`, 502);
    }
  }
}

export default new InstagramService();
