// ============================================
// Servicio Frontend de Inteligencia Artificial & Automações
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
   * Actualiza una regla de automatización (activar/pausar, plantilla, horario).
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
   * Ejecuta el barrido de recall diario de pacientes (limpiezas y post-quirúrgicos).
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
   * Genera una explicación amable de un presupuesto para el paciente.
   */
  async explainQuotation(patientName, items, totalAmount, tone = 'friendly') {
    return api.post('/ai/explain-quotation', {
      patient_name: patientName,
      items,
      total_amount: totalAmount,
      tone,
    });
  }
}

export default new AIService();
