// ============================================
// Servicio de Integración con Instagram Direct Messaging (Meta Graph API)
// ============================================
import crypto from 'crypto';
import config from '../config/app.js';
import { logger } from '../utils/logger.js';

class InstagramService {
  constructor() {
    this.apiVersion = process.env.INSTAGRAM_API_VERSION || 'v19.0';
    this.baseUrl = `https://graph.facebook.com/${this.apiVersion}`;
    this.verifyToken = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN || process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'vides_dental_webhook_token_2026';
    this.appSecret = process.env.META_APP_SECRET || '';
    this.accessToken = process.env.INSTAGRAM_ACCESS_TOKEN || '';
    this.pageId = process.env.INSTAGRAM_PAGE_ID || '';
  }

  /**
   * Verifica el handshake de suscripción al webhook de Instagram Graph API.
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
      if (config.app.env === 'development' || config.app.env === 'test') {
        return true;
      }
      return false;
    }

    if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
      return false;
    }

    const signature = signatureHeader.replace('sha256=', '');
    const hmac = crypto.createHmac('sha256', this.appSecret);
    const bodyStr = typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody);
    const expectedSignature = hmac.update(bodyStr).digest('hex');

    return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSignature, 'hex'));
  }

  /**
   * Extrae mensajes e información de interacción del webhook de Instagram.
   */
  parseWebhookPayload(body) {
    const events = [];

    if (!body || !Array.isArray(body.entry)) {
      return events;
    }

    for (const entry of body.entry) {
      // Instagram Direct envía mensajes en entry.messaging
      if (Array.isArray(entry.messaging)) {
        for (const msg of entry.messaging) {
          const senderId = msg.sender?.id;
          const recipientId = msg.recipient?.id;
          const messageObj = msg.message;

          if (messageObj && senderId) {
            events.push({
              type: 'MESSAGE',
              channel: 'INSTAGRAM',
              externalMessageId: messageObj.mid || `ig_msg_${Date.now()}`,
              senderId: String(senderId),
              recipientId: String(recipientId),
              text: messageObj.text || '',
              attachments: messageObj.attachments || [],
              isStoryReply: Boolean(messageObj.reply_to?.story),
              storyId: messageObj.reply_to?.story?.id || null,
              timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
              raw: msg,
            });
          }
        }
      }
    }

    return events;
  }

  /**
   * Envía un mensaje directo (DM) de texto a un usuario de Instagram.
   */
  async sendDirectMessage({ recipientId, text, clinicId = null }) {
    if (!this.accessToken) {
      // Modo Mock / Sandbox local para desarrollo y pruebas
      const mockId = `ig_mid.${Date.now()}_${Math.random().toString(36).substring(7)}`;
      logger.info(`[MOCK INSTAGRAM DM] Enviando mensaje a ${recipientId}: "${text}"`);
      return {
        recipient_id: recipientId,
        message_id: mockId,
        mock: true,
      };
    }

    const endpoint = `${this.baseUrl}/me/messages?access_token=${this.accessToken}`;
    const payload = {
      recipient: { id: recipientId },
      message: { text: text },
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
      logger.error('Error al enviar mensaje de Instagram vía Graph API:', data);
      throw new Error(data.error?.message || 'Error al comunicarse con Instagram Graph API');
    }

    return data;
  }

  /**
   * Envía un mensaje con imagen/adjunto por Instagram Direct.
   */
  async sendMediaMessage({ recipientId, mediaUrl, mediaType = 'image' }) {
    if (!this.accessToken) {
      const mockId = `ig_mid.${Date.now()}_media`;
      logger.info(`[MOCK INSTAGRAM MEDIA] Enviando ${mediaType} a ${recipientId}: ${mediaUrl}`);
      return {
        recipient_id: recipientId,
        message_id: mockId,
        mock: true,
      };
    }

    const endpoint = `${this.baseUrl}/me/messages?access_token=${this.accessToken}`;
    const payload = {
      recipient: { id: recipientId },
      message: {
        attachment: {
          type: mediaType,
          payload: { url: mediaUrl, is_reusable: true },
        },
      },
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
      logger.error('Error al enviar multimedia de Instagram:', data);
      throw new Error(data.error?.message || 'Error al enviar multimedia de Instagram');
    }

    return data;
  }
}

export default new InstagramService();
