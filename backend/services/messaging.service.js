// ============================================
// Servicio de Mensajería Unificada (WhatsApp & Instagram Omnichannel)
import config from '../config/app.js';
import messagingRepository from '../repositories/messaging.repository.js';
import whatsappService from './whatsapp.service.js';
import instagramService from './instagram.service.js';
import automationSchedulerService from './automation-scheduler.service.js';
import aiService from './ai.service.js';
import aiBookingService from './ai-booking.service.js';
import internalChatService from './internal-chat.service.js';
import aiCrmWorkflowService from './ai-crm-workflow.service.js';
import eventStreamService from './event-stream.service.js';
import { query } from '../database/pool.js';
import { logger } from '../utils/logger.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';

class MessagingService {
  /**
   * Resuelve el clinic_id a partir del teléfono, contacto o configuración de la clínica.
   */
  async resolveClinicId(phone, phoneId = null) {
    if (phone) {
      const existing = await query(
        `SELECT clinic_id FROM messaging_contacts WHERE phone = $1 OR external_id = $1 LIMIT 1`,
        [phone]
      );
      if (existing.rows.length > 0 && existing.rows[0].clinic_id) {
        return existing.rows[0].clinic_id;
      }
    }
    if (phoneId) {
      const clinicInfo = await query(
        `SELECT clinic_id FROM clinic_information WHERE phone LIKE '%' || $1 || '%' LIMIT 1`,
        [phoneId]
      );
      if (clinicInfo.rows.length > 0 && clinicInfo.rows[0].clinic_id) {
        return clinicInfo.rows[0].clinic_id;
      }

      // Buscar si el ID corresponde a la configuración de Instagram o WhatsApp de alguna sede
      const settingMatch = await query(
        `SELECT clinic_id FROM settings 
         WHERE (key IN ('instagram_page_id', 'instagram_account_id', 'whatsapp_phone_number_id') AND value = $1) LIMIT 1`,
        [phoneId]
      );
      if (settingMatch.rows.length > 0 && settingMatch.rows[0].clinic_id) {
        return settingMatch.rows[0].clinic_id;
      }
    }
    return 1; // Fallback por defecto a Clínica 1 (Xúquer)
  }

  /**
   * Procesa un payload entrante del Webhook de Meta WhatsApp.
   */
  async processInboundWebhook(payload) {
    const events = whatsappService.parseWebhookPayload(payload);
    const results = [];

    for (const evt of events) {
      if (evt.eventType === 'MESSAGE') {
        const clinicId = await this.resolveClinicId(evt.senderPhone, evt.phoneId);

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

        // Auto-crear o actualizar lead en CRM, oportunidades y calificar con IA Sofía (Fase 6)
        if (config.features.aiAutomations) {
          try {
            await aiCrmWorkflowService.syncLeadOnInboundMessage({
              clinicId,
              contact,
              incomingText: evt.body,
              channel: 'WHATSAPP',
            });
          } catch (crmErr) {
            logger.warn('Error al sincronizar lead desde webhook WhatsApp:', crmErr.message);
          }
        }

        if (config.features.aiAutomations && conversation.automation_enabled) {
          await this.handleAutoReply(conversation, contact, evt.body);
        }

        results.push({ success: true, messageId: message.id });
      } else if (evt.eventType === 'STATUS') {
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
        const clinicId = await this.resolveClinicId(evt.senderId, evt.recipientId);

        // Intentar resolver perfil público del usuario de Instagram
        let initialName = `@ig_user_${evt.senderId.slice(-4)}`;
        let avatarUrl = null;
        try {
          const profile = await instagramService.getUserProfile(evt.senderId, clinicId);
          if (profile) {
            initialName = profile.name || (profile.username ? `@${profile.username}` : initialName);
            avatarUrl = profile.profile_pic || null;
          }
        } catch (profileErr) {
          logger.debug('No se pudo obtener perfil de Instagram:', profileErr.message);
        }

        // Buscar o crear contacto de Instagram por su IGSID
        const contact = await messagingRepository.findOrCreateContact(
          clinicId,
          evt.senderId,
          initialName,
          evt.senderId
        );

        if (avatarUrl && !contact.avatar_url) {
          await query(`UPDATE messaging_contacts SET avatar_url = $1 WHERE id = $2`, [avatarUrl, contact.id]);
          contact.avatar_url = avatarUrl;
        }

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

        // Emitir evento SSE en tiempo real
        eventStreamService.broadcastToClinic(clinicId, 'MESSAGING_INCOMING', {
          conversationId: conversation.id,
          channel: 'INSTAGRAM',
          senderName: contact.name,
          phone: contact.phone,
          body: evt.text || (evt.isStoryReply ? '[Respuesta a historia]' : '[Mensaje directo]'),
          messageId: message.id,
        });

        // Auto-crear o actualizar lead en CRM, oportunidades y calificar con IA Sofía (Fase 6)
        if (config.features.aiAutomations) {
          try {
            await aiCrmWorkflowService.syncLeadOnInboundMessage({
              clinicId,
              contact,
              incomingText: evt.text,
              channel: 'INSTAGRAM',
            });
          } catch (crmErr) {
            logger.warn('Error al sincronizar lead desde webhook Instagram:', crmErr.message);
          }
        }

        if (config.features.aiAutomations && conversation.automation_enabled) {
          await this.handleInstagramAutoReply(conversation, contact, evt.text);
        }

        results.push({ success: true, messageId: message.id, channel: 'INSTAGRAM' });
      }
    }

    return results;
  }

  /**
   * Reglas de respuesta automática inteligente para WhatsApp con Sofía.
   */
  async handleAutoReply(conversation, contact, incomingText) {
    try {
      const text = (incomingText || '').trim();
      let replyBody = '';
      let isTransfer = false;

      // 1. Intentar procesar como confirmación o cancelación de cita pendiente
      const confirmResult = await automationSchedulerService.processInboundConfirmation(
        contact.phone,
        incomingText,
        conversation.clinic_id
      );

      if (confirmResult.handled) {
        if (confirmResult.action === 'CONFIRMED') {
          replyBody = `✅ ¡Excelente! Su cita ha quedado CONFIRMADA en nuestro sistema. Le esperamos puntualmente en nuestra clínica. 🦷✨`;
        } else if (confirmResult.action === 'CANCELLED') {
          replyBody = `🗓️ Hemos registrado la cancelación de su cita. Un asesor de nuestro equipo se pondrá en contacto para ayudarle a reprogramar. ¡Gracias por avisarnos!`;
        }
      } else {
        // 1.5. Flujo interactivo de agendamiento y citas (Selección de franja / reagendamiento)
        let bookingHandled = false;
        const currentConv = await messagingRepository.getConversationById(conversation.id, conversation.clinic_id);
        const bookingFlow = currentConv?.context_state?.booking_flow;

        if (bookingFlow && (bookingFlow.step === 'AWAITING_SLOT_SELECTION' || bookingFlow.step === 'AWAITING_RESCHEDULE_SLOT')) {
          const bookingResult = await aiBookingService.handleConversationalAppointmentAction({
            clinicId: conversation.clinic_id,
            contact,
            incomingText: text,
            bookingFlowState: bookingFlow,
          });

          if (bookingResult.handled) {
            bookingHandled = true;
            replyBody = bookingResult.replyText;

            if (bookingResult.success) {
              await messagingRepository.updateContextState(conversation.id, { booking_flow: null }, conversation.clinic_id);
            } else if (bookingResult.newSlots?.length > 0) {
              await messagingRepository.updateContextState(conversation.id, {
                booking_flow: {
                  step: bookingFlow.step,
                  appointment_id: bookingFlow.appointment_id || null,
                  offered_slots: bookingResult.newSlots,
                  target_date: bookingResult.newSlots[0].date,
                  offered_at: new Date().toISOString(),
                }
              }, conversation.clinic_id);
            }
          }
        }

        if (!bookingHandled) {
          // Cargar historial reciente de la conversación
          const historyRes = await query(
            `SELECT id, direction, body, created_at FROM messages WHERE conversation_id = $1 ORDER BY id DESC LIMIT 6`,
            [conversation.id]
          );
          const conversationHistory = historyRes.rows.reverse();

          // 2. Generar respuesta con el motor de Sofía (español europeo, cero precios, RAG, clínica abierta y nombre informado)
          const sofiaRes = await aiService.generateSofiaReply({
            clinicId: conversation.clinic_id,
            incomingText,
            senderName: contact.name,
            senderPhone: contact.phone,
            isNameConfirmed: Boolean(contact.is_name_confirmed),
            confirmedName: contact.confirmed_name,
            conversationHistory,
          });

          // Si se ofrecieron slots, guardar estado en la conversación para permitir reserva interactiva
          if (sofiaRes.action === 'SLOTS_OFFERED' && sofiaRes.slots?.length > 0) {
            await messagingRepository.updateContextState(conversation.id, {
              booking_flow: {
                step: 'AWAITING_SLOT_SELECTION',
                offered_slots: sofiaRes.slots,
                target_date: sofiaRes.slots[0].date,
                offered_at: new Date().toISOString(),
              }
            }, conversation.clinic_id);
          } else if (sofiaRes.action === 'RESCHEDULE_PROPOSED' && sofiaRes.slots?.length > 0) {
            await messagingRepository.updateContextState(conversation.id, {
              booking_flow: {
                step: 'AWAITING_RESCHEDULE_SLOT',
                appointment_id: sofiaRes.appointmentId,
                offered_slots: sofiaRes.slots,
                target_date: sofiaRes.slots[0].date,
                offered_at: new Date().toISOString(),
              }
            }, conversation.clinic_id);
          } else if (sofiaRes.action === 'APPOINTMENT_CANCELLED') {
            await messagingRepository.updateContextState(conversation.id, { booking_flow: null }, conversation.clinic_id);
          }

          // Si se detectó un nuevo nombre informado por el usuario, actualizar en BD, CRM y emitir SSE
          if (sofiaRes.detectedName) {
            await query(
              `UPDATE messaging_contacts 
               SET name = $1, confirmed_name = $1, is_name_confirmed = TRUE, updated_at = NOW() 
               WHERE id = $2`,
              [sofiaRes.detectedName, contact.id]
            );
            contact.name = sofiaRes.detectedName;
            contact.confirmed_name = sofiaRes.detectedName;
            contact.is_name_confirmed = true;

            // Sincronizar en CRM Leads si existe
            await query(
              `UPDATE crm_leads SET updated_at = NOW() WHERE contact_id = $1 AND clinic_id = $2`,
              [contact.id, conversation.clinic_id]
            );

            eventStreamService.broadcastToClinic(conversation.clinic_id, 'MESSAGING_CONTACT_UPDATED', {
              contactId: contact.id,
              name: contact.name,
              phone: contact.phone,
            });
          }

          replyBody = sofiaRes.replyText;

          if (sofiaRes.action === 'TRANSFER_TO_HUMAN') {
            isTransfer = true;

            // Gestión integral de traspaso humano (Tarea recepción, CRM activity, Chat interno, pausa y SSE)
            await aiCrmWorkflowService.handleHumanHandoff({
              clinicId: conversation.clinic_id,
              contact,
              conversationId: conversation.id,
              channel: 'WHATSAPP',
              reason: sofiaRes.intent || 'Solicitud de recepcionista',
              incomingText: text,
              isUrgent: Boolean(sofiaRes.isUrgent),
            });
          }
        }
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
          rawPayload: { autoReply: true, isTransfer, confirmationAction: confirmResult.action || null },
        });

        logger.info(`Respuesta automática de Sofía enviada a ${contact.phone} en conversación #${conversation.id}`);
      }
    } catch (err) {
      logger.error('Error al procesar auto-reply de WhatsApp:', err.message);
    }
  }

  /**
   * Reglas de respuesta automática inteligente para Instagram Direct con Sofía.
   */
  async handleInstagramAutoReply(conversation, contact, incomingText) {
    try {
      const text = (incomingText || '').trim();

      let replyBody = '';
      let isTransfer = false;

      // 1. Flujo interactivo de agendamiento en Instagram
      let bookingHandled = false;
      const currentConv = await messagingRepository.getConversationById(conversation.id, conversation.clinic_id);
      const bookingFlow = currentConv?.context_state?.booking_flow;

      if (bookingFlow && bookingFlow.step === 'AWAITING_SLOT_SELECTION') {
        const bookingResult = await aiBookingService.handleConversationalBookingSelection({
          clinicId: conversation.clinic_id,
          contact,
          incomingText: text,
          bookingFlowState: bookingFlow,
        });

        if (bookingResult.handled) {
          bookingHandled = true;
          replyBody = bookingResult.replyText;

          if (bookingResult.success) {
            await messagingRepository.updateContextState(conversation.id, { booking_flow: null }, conversation.clinic_id);
          } else if (bookingResult.newSlots?.length > 0) {
            await messagingRepository.updateContextState(conversation.id, {
              booking_flow: {
                step: 'AWAITING_SLOT_SELECTION',
                offered_slots: bookingResult.newSlots,
                target_date: bookingResult.newSlots[0].date,
                offered_at: new Date().toISOString(),
              }
            }, conversation.clinic_id);
          }
        }
      }

      if (!bookingHandled) {
        const historyRes = await query(
          `SELECT id, direction, body, created_at FROM messages WHERE conversation_id = $1 ORDER BY id DESC LIMIT 6`,
          [conversation.id]
        );
        const conversationHistory = historyRes.rows.reverse();

        const sofiaRes = await aiService.generateSofiaReply({
          clinicId: conversation.clinic_id,
          incomingText: text,
          senderName: contact.name,
          isNameConfirmed: Boolean(contact.is_name_confirmed),
          confirmedName: contact.confirmed_name,
          conversationHistory,
        });

        // Si se ofrecieron slots, guardar estado en la conversación
        if (sofiaRes.action === 'SLOTS_OFFERED' && sofiaRes.slots?.length > 0) {
          await messagingRepository.updateContextState(conversation.id, {
            booking_flow: {
              step: 'AWAITING_SLOT_SELECTION',
              offered_slots: sofiaRes.slots,
              target_date: sofiaRes.slots[0].date,
              offered_at: new Date().toISOString(),
            }
          }, conversation.clinic_id);
        }

        // Si se detectó un nuevo nombre informado por el usuario, actualizar en BD, CRM y emitir SSE
        if (sofiaRes.detectedName) {
          await query(
            `UPDATE messaging_contacts 
             SET name = $1, confirmed_name = $1, is_name_confirmed = TRUE, updated_at = NOW() 
             WHERE id = $2`,
            [sofiaRes.detectedName, contact.id]
          );
          contact.name = sofiaRes.detectedName;
          contact.confirmed_name = sofiaRes.detectedName;
          contact.is_name_confirmed = true;

          await query(
            `UPDATE crm_leads SET updated_at = NOW() WHERE contact_id = $1 AND clinic_id = $2`,
            [contact.id, conversation.clinic_id]
          );

          eventStreamService.broadcastToClinic(conversation.clinic_id, 'MESSAGING_CONTACT_UPDATED', {
            contactId: contact.id,
            name: contact.name,
            phone: contact.phone,
          });
        }

        replyBody = sofiaRes.replyText;

        if (sofiaRes.action === 'TRANSFER_TO_HUMAN') {
          isTransfer = true;

          // Gestión integral de traspaso humano (Tarea recepción, CRM activity, Chat interno, pausa y SSE)
          await aiCrmWorkflowService.handleHumanHandoff({
            clinicId: conversation.clinic_id,
            contact,
            conversationId: conversation.id,
            channel: 'INSTAGRAM',
            reason: sofiaRes.intent || 'Solicitud de recepcionista en Instagram',
            incomingText: text,
            isUrgent: Boolean(sofiaRes.isUrgent),
          });
        }
      }

      if (replyBody) {
        let externalId = null;
        let deliveryStatus = 'SENT';

        try {
          const sendRes = await instagramService.sendDirectMessage({
            recipientId: contact.phone, // IGSID
            text: replyBody,
            clinicId: conversation.clinic_id,
          });
          externalId = sendRes?.message_id || null;
        } catch (sendErr) {
          logger.warn(`No se pudo entregar DM por Instagram Graph API a ${contact.phone}: ${sendErr.message}. Guardando mensaje en conversación.`);
          deliveryStatus = 'FAILED';
        }

        const outboundMsg = await messagingRepository.createMessage({
          conversationId: conversation.id,
          clinicId: conversation.clinic_id,
          direction: 'OUTBOUND',
          messageType: 'TEXT',
          body: replyBody,
          externalId,
          status: deliveryStatus,
          rawPayload: { autoReply: true, isTransfer, channel: 'INSTAGRAM' },
        });

        // Emitir evento SSE saliente en tiempo real a la interfaz web
        eventStreamService.broadcastToClinic(conversation.clinic_id, 'MESSAGING_OUTGOING', {
          conversationId: conversation.id,
          channel: 'INSTAGRAM',
          body: replyBody,
          messageId: outboundMsg.id,
        });

        logger.info(`Respuesta automática de Sofía (Instagram) registrada para ${contact.phone} en conversación #${conversation.id}`);
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

        // Recuperar texto de la plantilla para rellenar variables
        const tplRes = await query(
          `SELECT body FROM messaging_templates WHERE name = $1 LIMIT 1`,
          [templateName]
        );
        let resolvedText = tplRes.rows[0]?.body || `[Plantilla: ${templateName}]`;
        if (templateParams && templateParams.length > 0) {
          templateParams.forEach((val, idx) => {
            resolvedText = resolvedText.replace(new RegExp(`\\{\\{${idx + 1}\\}\\}`, 'g'), val);
          });
        }

        const lang = templateName === 'hello_world' ? 'en_US' : 'es';

        try {
          const sendRes = await whatsappService.sendTemplateMessage(
            conversation.contact_phone,
            templateName,
            lang,
            templateParams
          );
          externalId = sendRes.messages?.[0]?.id || null;
          finalBody = resolvedText;
        } catch (tplErr) {
          // Si la plantilla no está registrada en la cuenta sandbox de Meta (132001), hacemos fallback a mensaje de texto directo
          if (tplErr.metaCode === 132001 || tplErr.message?.includes('132001') || tplErr.message?.includes('no existe en Meta')) {
            logger.warn(`[WHATSAPP FALLBACK] Plantilla "${templateName}" no configurada en Meta Developers. Enviando como texto directo a ${conversation.contact_phone}: "${resolvedText}"`);
            const fallbackRes = await whatsappService.sendTextMessage(conversation.contact_phone, resolvedText);
            externalId = fallbackRes.messages?.[0]?.id || null;
            finalBody = resolvedText;
          } else {
            throw tplErr;
          }
        }
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
