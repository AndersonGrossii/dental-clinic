// ============================================
// Servicio de Pacientes
// ============================================
import api from './api.service.js';

class PatientService {
  async getAll(params = {}) {
    return await api.get('/patients', params);
  }

  async getById(id) {
    return await api.get(`/patients/${id}`);
  }

  async create(data) {
    return await api.post('/patients', data);
  }

  async update(id, data) {
    return await api.put(`/patients/${id}`, data);
  }

  async remove(id) {
    return await api.delete(`/patients/${id}`);
  }

  async search(term) {
    return await api.get('/patients/search', { q: term });
  }

  async getHistory(id) {
    return await api.get(`/patients/${id}/history`);
  }
}

const patientService = new PatientService();
export default patientService;
