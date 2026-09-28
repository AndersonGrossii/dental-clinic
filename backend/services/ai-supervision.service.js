// ============================================
// Servicio de Supervisión de Mensajes de IA (Human-in-the-Loop)
// Ningún mensaje de seguimiento comercial o de presupuesto se envía
// sin que la recepción o dirección lo apruebe expresamente.
// ============================================
import aiApprovalRepository from '../repositories/ai-approval.repository.js';
import whatsappService from './whatsapp.service.js';
import instagramService from './instagram.service.js';
import messagingRepository from '../repositories/messaging.repository.js';
import crmActivityRepository from '../repositories/crm-activity.repository.js';
import { logger } from '../utils/logger.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';

class AISupervisionService {
  /**
   * Obtiene la cola de mensajes pendientes para una clínica.
   */
  async getApprovals(clinicId, status = 'PENDING_APPROVAL') {
    return aiApprovalRepository.findByClinic(clinicId, status);
  }

  /**
   * Encola una propuesta de seguimiento de presupuesto para revisión humana.
   */
  async queueQuotationFollowup({ clinicId, patientId, quotationId, phone, patientName, suggestedMessage }) {
    if (!phone || !suggestedMessage) return null;

    const created = await aiApprovalRepository.create({
      clinicId,
      patientId,
      quotationId,
      channel: 'WHATSAPP',
      recipientPhone: phone,
      recipientName: patientName,
      actionType: 'QUOTATION_FOLLOWUP',
      suggestedMessage,
    });

    logger.info(`[AI_SUPERVISION] Propuesta de seguimiento #${created.id} encolada para supervisión humana (Presupuesto #${quotationId}).`);
    return created;
  }

  /**
   * Aprueba y envía un mensaje pendiente de la cola.
   */
  async approveAndSend(id, clinicId, userId) {
    const item = await aiApprovalRepository.findById(id, clinicId);
    if (!item) {
      throw new NotFoundError('Registro de supervisión no encontrado.');
    }

    if (item.status === 'SENT') {
      throw new ValidationError('Este mensaje ya ha sido enviado previamente.');
    }

    // 1. Enviar mensaje por el canal correspondiente
    let externalId = null;
    try {
      if (item.channel === 'INSTAGRAM') {
        const sendRes = await instagramService.sendDirectMessage({
          recipientId: item.recipient_phone,
          text: item.suggested_message,
          clinicId,
        });
        externalId = sendRes.message_id || null;
      } else {
        const sendRes = await whatsappService.sendTextMessage(item.recipient_phone, item.suggested_message);
        externalId = sendRes.messages?.[0]?.id || null;
      }
    } catch (err) {
      logger.error(`Error al enviar mensaje aprobado #${id}:`, err.message);
      throw new Error(`Fallo en el envío por ${item.channel}: ${err.message}`);
    }

    // 2. Marcar como SENT en ai_message_approvals
    const updated = await aiApprovalRepository.updateStatus(id, clinicId, 'SENT', userId);

    // 3. Registrar en crm_activities si hay paciente o lead vinculado
    try {
      await crmActivityRepository.create({
        clinicId,
        leadId: item.lead_id,
        patientId: item.patient_id,
        userId,
        activityType: 'AI_FOLLOWUP_SENT',
        title: 'Mensaje de seguimiento de presupuesto enviado (Supervisado)',
        description: item.suggested_message,
        actorType: 'human',
        metadata: { approvalId: id, quotationId: item.quotation_id, externalId },
      });
    } catch (actErr) {
      logger.warn('No se pudo registrar actividad CRM para la aprobación:', actErr.message);
    }

    logger.info(`[AI_SUPERVISION] Mensaje #${id} APROBADO y ENVIADO por usuario #${userId} a ${item.recipient_phone}.`);
    return updated;
  }

  /**
   * Modifica el texto de la propuesta antes de aprobarla.
   */
  async editMessage(id, clinicId, newMessage, userId) {
    if (!newMessage || !newMessage.trim()) {
      throw new ValidationError('El texto del mensaje no puede estar vacío.');
    }

    const updated = await aiApprovalRepository.updateSuggestedMessage(id, clinicId, newMessage.trim(), userId);
    if (!updated) {
      throw new NotFoundError('Registro de supervisión no encontrado.');
    }
    return updated;
  }

  /**
   * Descarta una propuesta para que no sea enviada.
   */
  async discard(id, clinicId, userId) {
    const updated = await aiApprovalRepository.updateStatus(id, clinicId, 'DISCARDED', userId);
    if (!updated) {
      throw new NotFoundError('Registro de supervisión no encontrado.');
    }
    logger.info(`[AI_SUPERVISION] Propuesta #${id} descartada por usuario #${userId}.`);
    return updated;
  }
}

export default new AISupervisionService();
