// ============================================
// Servicio de Chat Interno del Personal
// ============================================
import internalChatRepository from '../repositories/internal-chat.repository.js';
import eventStreamService from './event-stream.service.js';
import { ValidationError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

class InternalChatService {
  /**
   * Obtiene mensajes del canal general de la clínica (solo del día actual).
   */
  async getGeneralMessages(clinicId, limit = 100) {
    return internalChatRepository.findGeneralMessages({ clinicId, limit });
  }

  /**
   * Obtiene mensajes directos 1 a 1 entre dos empleados (solo del día actual).
   */
  async getDirectMessages(clinicId, currentUserId, targetUserId, limit = 100) {
    if (!targetUserId) {
      throw new ValidationError('El destinatario (targetUserId) es obligatorio.');
    }
    return internalChatRepository.findDirectMessages({
      clinicId,
      userId1: currentUserId,
      userId2: parseInt(targetUserId, 10),
      limit,
    });
  }

  /**
   * Envía un mensaje (General o Directo) y notifica en tiempo real vía SSE.
   */
  async sendMessage({ clinicId, senderId, recipientId = null, message }) {
    if (!message || !message.trim()) {
      throw new ValidationError('El contenido del mensaje no puede estar vacío.');
    }

    const cleanMessage = message.trim();
    const targetRecipientId = recipientId ? parseInt(recipientId, 10) : null;

    if (targetRecipientId && targetRecipientId === senderId) {
      throw new ValidationError('No puedes enviarte un mensaje directo a ti mismo.');
    }

    const created = await internalChatRepository.createChatMessage({
      clinicId,
      senderId,
      recipientId: targetRecipientId,
      message: cleanMessage,
    });

    // Notificación en tiempo real vía Server-Sent Events (SSE)
    try {
      if (!targetRecipientId) {
        // Canal General: Difusión a toda la clínica
        eventStreamService.broadcastToClinic(clinicId, 'INTERNAL_CHAT_MESSAGE', {
          channel: 'general',
          message: created,
        });
      } else {
        // Mensaje Directo: Notificar al receptor y al emisor
        eventStreamService.sendToUser(clinicId, targetRecipientId, 'INTERNAL_CHAT_MESSAGE', {
          channel: 'direct',
          message: created,
        });
        eventStreamService.sendToUser(clinicId, senderId, 'INTERNAL_CHAT_MESSAGE', {
          channel: 'direct',
          message: created,
        });
      }
    } catch (err) {
      logger.error('Error al emitir evento SSE de chat interno:', err.message);
    }

    return created;
  }

  /**
   * Marca una conversación o canal como leído.
   */
  async markAsRead({ clinicId, userId, channel, senderId = null }) {
    if (channel === 'general') {
      await internalChatRepository.markGeneralAsRead({ clinicId, userId });
      return { success: true, channel: 'general' };
    }

    if (channel === 'direct' && senderId) {
      await internalChatRepository.markDirectAsRead({
        clinicId,
        recipientId: userId,
        senderId: parseInt(senderId, 10),
      });
      return { success: true, channel: 'direct', senderId };
    }

    return { success: false };
  }

  /**
   * Obtiene el balance de mensajes no leídos para el usuario.
   */
  async getUnreadCounts(clinicId, userId) {
    return internalChatRepository.getUnreadCounts({ clinicId, userId });
  }

  /**
   * Purgado de mensajes anteriores al día actual.
   */
  async purgeExpired() {
    return internalChatRepository.purgeExpiredMessages();
  }
}

export default new InternalChatService();
