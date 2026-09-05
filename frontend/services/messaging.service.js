// ============================================
// Servicio de Mensajería Frontend (WhatsApp & Omnichannel)
// ============================================
import apiService from './api.service.js';

class MessagingService {
  /**
   * Obtiene la lista de conversaciones filtradas.
   */
  async getConversations(params = {}) {
    return apiService.get('/messaging/conversations', params);
  }

  /**
   * Obtiene el detalle de una conversación.
   */
  async getConversation(id) {
    return apiService.get(`/messaging/conversations/${id}`);
  }

  /**
   * Obtiene los mensajes de una conversación.
   */
  async getMessages(id, params = {}) {
    return apiService.get(`/messaging/conversations/${id}/messages`, params);
  }

  /**
   * Envía un mensaje saliente a través de WhatsApp.
   */
  async sendMessage(id, payload) {
    return apiService.post(`/messaging/conversations/${id}/messages`, payload);
  }

  /**
   * Activa o desactiva la atención automatizada (Human Takeover).
   */
  async toggleAutomation(id, enabled) {
    return apiService.patch(`/messaging/conversations/${id}/automation`, {
      automation_enabled: enabled,
    });
  }

  /**
   * Cambia el estado de una conversación (OPEN, PENDING, CLOSED).
   */
  async updateStatus(id, status) {
    return apiService.patch(`/messaging/conversations/${id}/status`, { status });
  }

  /**
   * Vincula una conversación / contacto con un paciente del sistema.
   */
  async linkPatient(id, patientId) {
    return apiService.post(`/messaging/conversations/${id}/link-patient`, {
      patient_id: patientId,
    });
  }

  /**
   * Obtiene las plantillas de WhatsApp aprobadas.
   */
  async getTemplates() {
    return apiService.get('/messaging/templates');
  }

  /**
   * Obtiene estadísticas del centro de mensajería.
   */
  async getStats() {
    return apiService.get('/messaging/stats');
  }
}

export default new MessagingService();
