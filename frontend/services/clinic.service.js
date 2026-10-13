// ============================================
// Servicio de Clínicas (Frontend)
// ============================================
import api from './api.service.js';

class ClinicService {
  async getAll() {
    return await api.get('/clinics');
  }

  async getActiveConfig() {
    return await api.get('/clinics/active-config');
  }
}

export default new ClinicService();
