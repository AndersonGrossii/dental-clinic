// ============================================
// Servicio Frontend de Inteligencia Artificial & Automatizaciones
// ============================================
import api from './api.service.js';

class AIService {
  /**
   * Obtiene el briefing operativo matinal de la clínica.
   */
  async getBriefing() {
    return api.get('/ai/briefing');
  }

  /**
   * Obtiene las reglas de automatización configuradas.
   */
  async getRules() {
    return api.get('/ai/automations/rules');
  }

  /**
   * Actualiza una regla de automatización.
   */
  async updateRule(id, data) {
    return api.put(`/ai/automations/rules/${id}`, data);
  }

  /**
   * Ejecuta el escaneo de confirmaciones de citas para las próximas 24h.
   */
  async trigger24hConfirmations() {
    return api.post('/ai/automations/run-confirmations', {});
  }

  /**
   * Ejecuta el barrido de recall diario de pacientes.
   */
  async triggerRecallSweep() {
    return api.post('/ai/automations/run-recall', {});
  }

  /**
   * Obtiene el historial y estadísticas de automatizaciones ejecutadas.
   */
  async getAutomationStats() {
    return api.get('/ai/automations/stats');
  }

  /**
   * Genera una explicación pedagógica de un presupuesto para el paciente.
   */
  async explainQuotation(patientName, items, totalAmount, tone = 'friendly') {
    return api.post('/ai/explain-quotation', {
      patient_name: patientName,
      items,
      total_amount: totalAmount,
      tone,
    });
  }

  // ============================================
  // COLA DE SUPERVISIÓN HUMANA (HUMAN-IN-THE-LOOP)
  // ============================================

  async getApprovals(status = 'PENDING_APPROVAL') {
    return api.get(`/ai/approvals?status=${encodeURIComponent(status)}`);
  }

  async approveMessage(id) {
    return api.post(`/ai/approvals/${id}/approve`, {});
  }

  async editApprovalMessage(id, message) {
    return api.put(`/ai/approvals/${id}/edit`, { message });
  }

  async discardApprovalMessage(id) {
    return api.post(`/ai/approvals/${id}/discard`, {});
  }

  async triggerQuotationFollowupScan() {
    return api.post('/ai/approvals/scan-quotations', {});
  }

  // ============================================
  // COPILOT DE RECEPCIÓN & CRM
  // ============================================

  async suggestReply(conversationId) {
    return api.post('/ai/copilot/suggest-reply', { conversation_id: conversationId });
  }

  async summarizeConversation(conversationId) {
    return api.post('/ai/copilot/summarize-conversation', { conversation_id: conversationId });
  }

  async qualifyLead(leadId) {
    return api.post(`/ai/leads/${leadId}/qualify`, {});
  }

  // ============================================
  // BASE DE CONOCIMIENTO RAG
  // ============================================

  async getKnowledge() {
    return api.get('/ai/knowledge');
  }

  async createKnowledge(data) {
    return api.post('/ai/knowledge', data);
  }

  async updateKnowledge(id, data) {
    return api.put(`/ai/knowledge/${id}`, data);
  }

  async deleteKnowledge(id) {
    return api.delete(`/ai/knowledge/${id}`);
  }
}

export default new AIService();
