// ============================================
// Servicio Frontend de Chat Interno del Personal
// ============================================
import apiService from './api.service.js';

class InternalChatService {
  /**
   * Obtiene los mensajes del canal general de la clínica (últimas 48h).
   */
  async getGeneralMessages() {
    return apiService.get('/internal-chat/general');
  }

  /**
   * Obtiene los mensajes directos con un compañero específico (últimas 48h).
   */
  async getDirectMessages(userId) {
    return apiService.get(`/internal-chat/direct/${userId}`);
  }

  /**
   * Envía un mensaje (Canal General si recipient_id es null, o directo a userId).
   */
  async sendMessage(data) {
    return apiService.post('/internal-chat', data);
  }

  /**
   * Marca una conversación o canal como leído.
   */
  async markAsRead(data) {
    return apiService.post('/internal-chat/read', data);
  }

  /**
   * Consulta el número de mensajes no leídos del usuario.
   */
  async getUnreadCounts() {
    return apiService.get('/internal-chat/unread');
  }

  /**
   * Obtiene el listado de personal activo de la clínica.
   */
  async getStaff() {
    return apiService.get('/users/staff');
  }
}

export default new InternalChatService();
