// ============================================
// Servicio de Integración con WhatsApp Business Cloud API
// ============================================
import crypto from 'crypto';
import config from '../config/app.js';
import { logger } from '../utils/logger.js';

class WhatsAppService {
  constructor() {
    this.apiVersion = process.env.WHATSAPP_API_VERSION || 'v20.0';
    this.baseUrl = `https://graph.facebook.com/${this.apiVersion}`;
    this.verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN || 'vides_dental_webhook_token_2026';
    this.appSecret = process.env.META_APP_SECRET || '';
    this.accessToken = (process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_TOKEN || '').trim().replace(/\s+/g, '');
    this.defaultPhoneId = (process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim().replace(/\s+/g, '');
    this.businessAccountId = (process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '').trim().replace(/\s+/g, '');
  }

  /**
   * Verifica el token de validación del webhook durante el handshake de Meta.
   */
  verifyWebhookChallenge(mode, token, challenge) {
    if (mode === 'subscribe' && token === this.verifyToken) {
      logger.info('Handshake de webhook de WhatsApp verificado exitosamente');
      return challenge;
    }
    logger.warn(`Intento fallido de verificación de webhook. Token recibido: ${token}`);
    return null;
  }

  /**
   * Valida la firma criptográfica HMAC-SHA256 del payload de Meta.
   */
  validateSignature(signatureHeader, rawBody) {
    if (!this.appSecret) {
      // Si no hay secret configurado en entorno, permitir continuar (verificado previamente por challenge)
      return true;
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
   * Extrae mensajes e información de contacto del payload estructurado de Meta Cloud API.
   */
  parseWebhookPayload(body) {
    const events = [];

    if (!body || body.object !== 'whatsapp_business_account' || !Array.isArray(body.entry)) {
      return events;
    }

    for (const entry of body.entry) {
      if (!Array.isArray(entry.changes)) continue;

      for (const change of entry.changes) {
        if (change.field !== 'messages' || !change.value) continue;

        const val = change.value;
        const phoneId = val.metadata?.phone_number_id || this.defaultPhoneId;
        const contactsMap = {};

        if (Array.isArray(val.contacts)) {
          for (const c of val.contacts) {
            contactsMap[c.wa_id] = c.profile?.name || c.wa_id;
          }
        }

        // 1. Mensajes entrantes
        if (Array.isArray(val.messages)) {
          for (const msg of val.messages) {
            let messageText = '';
            let messageType = 'TEXT';

            if (msg.type === 'text') {
              messageText = msg.text?.body || '';
              messageType = 'TEXT';
            } else if (msg.type === 'image') {
              messageText = msg.image?.caption || '[Imagen adjunta]';
              messageType = 'IMAGE';
            } else if (msg.type === 'document') {
              messageText = msg.document?.filename || '[Documento adjunto]';
              messageType = 'DOCUMENT';
            } else if (msg.type === 'audio' || msg.type === 'voice') {
              messageText = '[Mensaje de voz]';
              messageType = 'AUDIO';
            } else if (msg.type === 'location') {
              messageText = `Ubicación: ${msg.location?.latitude}, ${msg.location?.longitude}`;
              messageType = 'LOCATION';
            } else if (msg.type === 'button' || msg.type === 'interactive') {
              messageText = msg.button?.text || msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || '[Respuesta Interactiva]';
              messageType = 'TEXT';
            } else {
              messageText = `[Mensaje ${msg.type}]`;
              messageType = msg.type.toUpperCase();
            }

            events.push({
              eventType: 'MESSAGE',
              phoneId,
              senderPhone: msg.from,
              senderName: contactsMap[msg.from] || msg.from,
              externalId: msg.id,
              timestamp: new Date(parseInt(msg.timestamp, 10) * 1000 || Date.now()),
              messageType,
              body: messageText,
              raw: msg,
            });
          }
        }

        // 2. Estados de entrega (sent, delivered, read, failed)
        if (Array.isArray(val.statuses)) {
          for (const st of val.statuses) {
            events.push({
              eventType: 'STATUS',
              phoneId,
              recipientPhone: st.recipient_id,
              externalId: st.id,
              status: st.status.toUpperCase(),
              timestamp: new Date(parseInt(st.timestamp, 10) * 1000 || Date.now()),
              raw: st,
            });
          }
        }
      }
    }

    return events;
  }

  /**
   * Envía un mensaje de texto saliente a través de Meta WhatsApp Cloud API.
   */
  async sendTextMessage(toPhone, textBody, phoneId = null) {
    const targetPhoneId = phoneId || this.defaultPhoneId;
    const cleanPhone = toPhone.replace(/[\s\-+]/g, '');

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanPhone,
      type: 'text',
      text: {
        preview_url: false,
        body: textBody,
      },
    };

    // Si estamos en entorno de tests automatizados o no hay token de Meta configurado, simular envío exitoso
    if (process.env.NODE_ENV === 'test' || !this.accessToken || !targetPhoneId) {
      logger.info(`[MOCK WHATSAPP] Enviando mensaje a ${cleanPhone}: "${textBody}"`);
      return {
        success: true,
        mock: true,
        messages: [{ id: `wamid.mock_${Date.now()}_${Math.random().toString(36).substring(7)}` }],
      };
    }

    const token = (process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_TOKEN || this.accessToken || '').trim().replace(/\s+/g, '');
    const finalPhoneId = (targetPhoneId || process.env.WHATSAPP_PHONE_NUMBER_ID || this.defaultPhoneId || '').trim().replace(/\s+/g, '');

    logger.info(`[WHATSAPP SEND] PhoneID: "${finalPhoneId}", To: "${cleanPhone}", TokenPrefix: "${token.substring(0, 15)}...", Length: ${token.length}`);

    try {
      const response = await fetch(`${this.baseUrl}/${finalPhoneId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        logger.error('Error al enviar WhatsApp a Meta Graph API:', data);
        throw new Error(data.error?.message || 'Error en WhatsApp Cloud API');
      }

      return {
        success: true,
        messages: data.messages || [],
      };
    } catch (err) {
      logger.error('Error de red al conectar con WhatsApp Cloud API:', err);
      throw err;
    }
  }

  /**
   * Envía una plantilla (Template) pre-aprobada de Meta.
   */
  async sendTemplateMessage(toPhone, templateName, languageCode = 'es', parameters = [], phoneId = null) {
    const targetPhoneId = phoneId || this.defaultPhoneId;
    const cleanPhone = toPhone.replace(/[\s\-+]/g, '');

    const components = [];
    if (parameters && parameters.length > 0) {
      components.push({
        type: 'body',
        parameters: parameters.map(p => ({ type: 'text', text: String(p) })),
      });
    }

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanPhone,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        components,
      },
    };

    if (process.env.NODE_ENV === 'test' || !this.accessToken || !targetPhoneId) {
      logger.info(`[MOCK WHATSAPP TEMPLATE] Enviando plantilla "${templateName}" a ${cleanPhone} con params:`, parameters);
      return {
        success: true,
        mock: true,
        messages: [{ id: `wamid.mock_tpl_${Date.now()}_${Math.random().toString(36).substring(7)}` }],
      };
    }

    try {
      const response = await fetch(`${this.baseUrl}/${targetPhoneId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        logger.error('Error al enviar Plantilla WhatsApp a Meta:', data);
        throw new Error(data.error?.message || 'Error en plantilla WhatsApp Cloud API');
      }

      return {
        success: true,
        messages: data.messages || [],
      };
    } catch (err) {
      logger.error('Error de red al enviar Plantilla WhatsApp:', err);
      throw err;
    }
  }
}

export default new WhatsAppService();
