// ============================================
// Servicio de Mensajería Unificada (WhatsApp & Instagram Omnichannel)
// ============================================
import messagingRepository from '../repositories/messaging.repository.js';
import whatsappService from './whatsapp.service.js';
import instagramService from './instagram.service.js';
import automationSchedulerService from './automation-scheduler.service.js';
import eventStreamService from './event-stream.service.js';
import { query } from '../database/pool.js';
import { logger } from '../utils/logger.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';

class MessagingService {
  /**
   * Procesa un payload entrante del Webhook de Meta WhatsApp.
   */
  async processInboundWebhook(payload) {
    const events = whatsappService.parseWebhookPayload(payload);
    const results = [];

    for (const evt of events) {
      if (evt.eventType === 'MESSAGE') {
        const clinicId = 1;

        const contact = await messagingRepository.findOrCreateContact(
          clinicId,
          evt.senderPhone,
          evt.senderName,
          evt.externalId
        );

        const conversation = await messagingRepository.findOrCreateConversation(
          clinicId,
          contact.id,
          'WHATSAPP'
        );

        const message = await messagingRepository.createMessage({
          conversationId: conversation.id,
          clinicId,
          direction: 'INBOUND',
          messageType: evt.messageType,
          body: evt.body,
          externalId: evt.externalId,
          status: 'DELIVERED',
          rawPayload: evt.raw,
        });

        // Emitir evento SSE en tiempo real
        eventStreamService.broadcastToClinic(clinicId, 'MESSAGING_INCOMING', {
          conversationId: conversation.id,
          channel: 'WHATSAPP',
          senderName: contact.name,
          phone: contact.phone,
          body: evt.body,
          messageId: message.id,
        });

        if (conversation.automation_enabled) {
          await this.handleAutoReply(conversation, contact, evt.body);
        }

        results.push({ success: true, messageId: message.id });
      }
 else if (evt.eventType === 'STATUS') {
        await query(
          `UPDATE messages SET status = $1, updated_at = NOW() WHERE external_id = $2`,
          [evt.status, evt.externalId]
        );
        results.push({ success: true, status: evt.status });
      }
    }

    return results;
  }

  /**
   * Procesa un payload entrante del Webhook de Instagram Direct.
   */
  async processInboundInstagramWebhook(payload) {
    const events = instagramService.parseWebhookPayload(payload);
    const results = [];

    for (const evt of events) {
      if (evt.type === 'MESSAGE') {
        const clinicId = 1;

        // Buscar o crear contacto de Instagram por su IGSID
        const contact = await messagingRepository.findOrCreateContact(
          clinicId,
          evt.senderId,
          `@ig_user_${evt.senderId.slice(-4)}`,
          evt.senderId
        );

        const conversation = await messagingRepository.findOrCreateConversation(
          clinicId,
          contact.id,
          'INSTAGRAM'
        );

        const message = await messagingRepository.createMessage({
          conversationId: conversation.id,
          clinicId,
          direction: 'INBOUND',
          messageType: 'TEXT',
          body: evt.text || (evt.isStoryReply ? '[Respuesta a historia de Instagram]' : '[Contenido multimedia]'),
          externalId: evt.externalMessageId,
          status: 'DELIVERED',
          rawPayload: { ...evt.raw, isStoryReply: evt.isStoryReply, storyId: evt.storyId },
        });

        if (conversation.automation_enabled) {
          await this.handleInstagramAutoReply(conversation, contact, evt.text);
        }

        results.push({ success: true, messageId: message.id, channel: 'INSTAGRAM' });
      }
    }

    return results;
  }

  /**
   * Reglas de respuesta automática para WhatsApp e integración con confirmación de citas.
   */
  async handleAutoReply(conversation, contact, incomingText) {
    try {
      const text = (incomingText || '').toLowerCase().trim();
      let replyBody = '';

      // 1. Intentar procesar como confirmación o cancelación de cita pendiente
      const confirmResult = await automationSchedulerService.processInboundConfirmation(
        contact.phone,
        incomingText,
        conversation.clinic_id
      );

      if (confirmResult.handled) {
        if (confirmResult.action === 'CONFIRMED') {
          replyBody = `✅ ¡Excelente! Su cita ha quedado CONFIRMADA en nuestro sistema. Le esperamos puntualmente en Clínica Vides Dental. 🦷✨`;
        } else if (confirmResult.action === 'CANCELLED') {
          replyBody = `🗓️ Hemos registrado la cancelación de su cita. Un asesor de nuestro equipo se pondrá en contacto para ayudarle a reprogramar. ¡Gracias por avisarnos!`;
        }
      } else {
        const contactFirstName = (contact.name || '').split(' ')[0] || 'Estimado/a';
        replyBody = `¡Hola ${contactFirstName}! Gracias por contactar a Clínica Vides Dental. 🦷✨\n\n¿En qué podemos ayudarte hoy?\n1️⃣ Agendar o consultar una cita\n2️⃣ Información sobre tratamientos\n3️⃣ Consultar presupuesto\n\nUn miembro de nuestro equipo te atenderá a la brevedad.`;
      }

      if (replyBody) {
        const sendRes = await whatsappService.sendTextMessage(contact.phone, replyBody);
        const externalId = sendRes.messages?.[0]?.id || null;

        await messagingRepository.createMessage({
          conversationId: conversation.id,
          clinicId: conversation.clinic_id,
          direction: 'OUTBOUND',
          messageType: 'TEXT',
          body: replyBody,
          externalId,
          status: 'SENT',
          rawPayload: { autoReply: true, confirmationAction: confirmResult.action || null },
        });

        logger.info(`Respuesta automática enviada a ${contact.phone} en conversación #${conversation.id}`);
      }
    } catch (err) {
      logger.error('Error al procesar auto-reply de WhatsApp:', err.message);
    }
  }

  /**
   * Reglas de respuesta automática para Instagram Direct.
   */
  async handleInstagramAutoReply(conversation, contact, incomingText) {
    try {
      const text = (incomingText || '').toLowerCase().trim();
      let replyBody = '';

      if (text.includes('hola') || text.includes('buenas') || text.includes('precio') || text.includes('cita') || text.includes('info')) {
        replyBody = `¡Hola! 🦷✨ Gracias por comunicarte con Clínica Vides Dental por Instagram.\n\n¿Te gustaría recibir información sobre nuestros tratamientos o agendar una cita de valoración? Un especialista de nuestro equipo te responderá enseguida.`;
      }

      if (replyBody) {
        const sendRes = await instagramService.sendDirectMessage({
          recipientId: contact.phone, // IGSID guardado en phone/externalId
          text: replyBody,
          clinicId: conversation.clinic_id,
        });

        await messagingRepository.createMessage({
          conversationId: conversation.id,
          clinicId: conversation.clinic_id,
          direction: 'OUTBOUND',
          messageType: 'TEXT',
          body: replyBody,
          externalId: sendRes.message_id || null,
          status: 'SENT',
          rawPayload: { autoReply: true, channel: 'INSTAGRAM' },
        });

        logger.info(`Respuesta automática de Instagram enviada a ${contact.phone} en conversación #${conversation.id}`);
      }
    } catch (err) {
      logger.error('Error al procesar auto-reply de Instagram:', err.message);
    }
  }

  /**
   * Envía un mensaje saliente manual o por plantilla (WhatsApp o Instagram).
   */
  async sendOutboundMessage({ conversationId, userId = null, messageType = 'TEXT', body = '', templateName = null, templateParams = [] }) {
    const conversation = await messagingRepository.getConversationById(conversationId);
    if (!conversation) {
      throw new NotFoundError('Conversación no encontrada');
    }

    let externalId = null;
    let finalBody = body;

    if (conversation.channel === 'INSTAGRAM') {
      // Envío por Instagram Direct
      if (!body || !body.trim()) {
        throw new ValidationError('El texto del mensaje directo de Instagram no puede estar vacío');
      }
      const sendRes = await instagramService.sendDirectMessage({
        recipientId: conversation.contact_phone,
        text: body.trim(),
        clinicId: conversation.clinic_id,
      });
      externalId = sendRes.message_id || null;
      finalBody = body.trim();
    } else {
      // Envío por WhatsApp
      if (messageType === 'TEMPLATE') {
        if (!templateName) {
          throw new ValidationError('El nombre de la plantilla es obligatorio');
        }
        const sendRes = await whatsappService.sendTemplateMessage(
          conversation.contact_phone,
          templateName,
          'es',
          templateParams
        );
        externalId = sendRes.messages?.[0]?.id || null;
        finalBody = `[Plantilla: ${templateName}] ${templateParams.join(', ')}`;
      } else {
        if (!body || !body.trim()) {
          throw new ValidationError('El texto del mensaje no puede estar vacío');
        }
        const sendRes = await whatsappService.sendTextMessage(conversation.contact_phone, body);
        externalId = sendRes.messages?.[0]?.id || null;
        finalBody = body.trim();
      }
    }

    // Registrar en base de datos
    const message = await messagingRepository.createMessage({
      conversationId: conversation.id,
      clinicId: conversation.clinic_id,
      direction: 'OUTBOUND',
      messageType,
      body: finalBody,
      externalId,
      status: 'SENT',
      rawPayload: { sentByUserId: userId, channel: conversation.channel },
    });

    // Desactivar el bot y activar atención humana al responder el staff
    if (conversation.automation_enabled) {
      await messagingRepository.setAutomationEnabled(conversation.id, false, conversation.clinic_id);
    }

    return message;
  }

  /**
   * Obtiene la lista de conversaciones.
   */
  async getConversations(filters) {
    return messagingRepository.getConversations(filters);
  }

  /**
   * Obtiene el detalle de una conversación y marca sus mensajes como leídos.
   */
  async getConversationDetail(id) {
    const conversation = await messagingRepository.getConversationById(id);
    if (!conversation) {
      throw new NotFoundError('Conversación no encontrada');
    }
    // Marcar como leída
    await messagingRepository.markConversationAsRead(id, conversation.clinic_id);
    return conversation;
  }

  /**
   * Obtiene el historial de mensajes de una conversación.
   */
  async getConversationMessages(id, options) {
    const conversation = await messagingRepository.getConversationById(id);
    if (!conversation) {
      throw new NotFoundError('Conversación no encontrada');
    }
    // Marcar como leída al abrir los mensajes
    await messagingRepository.markConversationAsRead(id, conversation.clinic_id);
    const messages = await messagingRepository.getMessagesByConversation(id, options);
    return {
      conversation,
      messages,
    };
  }

  /**
   * Cambia el estado de automatización (Human Takeover).
   */
  async toggleAutomation(conversationId, enabled) {
    const conversation = await messagingRepository.getConversationById(conversationId);
    if (!conversation) {
      throw new NotFoundError('Conversación no encontrada');
    }
    return messagingRepository.setAutomationEnabled(conversationId, enabled, conversation.clinic_id);
  }

  /**
   * Actualiza el estado de la conversación (OPEN, PENDING, CLOSED).
   */
  async updateStatus(conversationId, status) {
    const validStatuses = ['OPEN', 'PENDING', 'CLOSED'];
    if (!validStatuses.includes(status)) {
      throw new ValidationError(`Estado inválido. Debe ser uno de: ${validStatuses.join(', ')}`);
    }
    const conversation = await messagingRepository.getConversationById(conversationId);
    if (!conversation) {
      throw new NotFoundError('Conversación no encontrada');
    }
    return messagingRepository.setConversationStatus(conversationId, status, conversation.clinic_id);
  }

  /**
   * Vincula un contacto de mensajería con un expediente de paciente.
   */
  async linkPatient(conversationId, patientId) {
    const conversation = await messagingRepository.getConversationById(conversationId);
    if (!conversation) {
      throw new NotFoundError('Conversación no encontrada');
    }
    // Verificar que el paciente exista en la misma clínica
    const patientRes = await query(
      `SELECT id, first_name, last_name, custom_id FROM patients WHERE id = $1 AND deleted_at IS NULL`,
      [patientId]
    );
    if (patientRes.rows.length === 0) {
      throw new NotFoundError('Paciente no encontrado');
    }

    const updatedContact = await messagingRepository.linkContactToPatient(
      conversation.contact_id,
      patientId,
      conversation.clinic_id
    );

    return {
      conversationId: conversation.id,
      contact: updatedContact,
      patient: patientRes.rows[0],
    };
  }

  /**
   * Obtiene las plantillas activas.
   */
  async getTemplates() {
    return messagingRepository.getTemplates();
  }

  /**
   * Obtiene las estadísticas de mensajería.
   */
  async getStats() {
    return messagingRepository.getStats();
  }
}

export default new MessagingService();
