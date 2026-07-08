// ============================================
// Servicio de Pacientes
// ============================================
import api from './api.service.js';

class PatientService {
  async getAll(params = {}, options = {}) {
    return await api.get('/patients', params, options);
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

  async search(term, params = {}, options = {}) {
    return await api.get('/patients/search', { q: term, ...params }, options);
  }

  async getHistory(id) {
    return await api.get(`/patients/${id}/history`);
  }

  async getNotes(id) {
    return await api.get(`/patients/${id}/notes`);
  }

  async createNote(id, data) {
    return await api.post(`/patients/${id}/notes`, data);
  }
}

const patientService = new PatientService();
export default patientService;
