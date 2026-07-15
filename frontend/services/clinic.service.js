// ============================================
// Servicio de Clínicas (Frontend)
// ============================================
import api from './api.service.js';

class ClinicService {
  async getAll() {
    return await api.get('/clinics');
  }
}

export default new ClinicService();
