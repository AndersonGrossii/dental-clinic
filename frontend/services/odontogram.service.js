// ============================================
// Servicio de Odontograma Clínico Frontend
// ============================================
import apiService from './api.service.js';

class OdontogramService {
  /**
   * Obtiene el odontograma completo del paciente.
   */
  async getPatientOdontogram(patientId) {
    return apiService.get(`/patients/${patientId}/odontogram`);
  }

  /**
   * Guarda un nuevo hallazgo o procedimiento en una pieza/superficie dental.
   */
  async saveEntry(patientId, data) {
    return apiService.post(`/patients/${patientId}/odontogram`, data);
  }

  /**
   * Actualiza una entrada existente del odontograma.
   */
  async updateEntry(entryId, data) {
    return apiService.put(`/patients/odontogram/${entryId}`, data);
  }

  /**
   * Elimina una entrada del odontograma.
   */
  async deleteEntry(entryId) {
    return apiService.delete(`/patients/odontogram/${entryId}`);
  }
}

export default new OdontogramService();
