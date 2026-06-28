// ============================================
// Servicio de Tratamientos
// ============================================
import api from './api.service.js';

class TreatmentService {
  async getAll(params = {}) {
    return await api.get('/treatments', params);
  }

  async getById(id) {
    return await api.get(`/treatments/${id}`);
  }

  async create(data) {
    return await api.post('/treatments', data);
  }

  async update(id, data) {
    return await api.put(`/treatments/${id}`, data);
  }

  async remove(id) {
    return await api.delete(`/treatments/${id}`);
  }

  async getCategories() {
    return await api.get('/treatments/categories');
  }

  async createCategory(data) {
    return await api.post('/treatments/categories', data);
  }

  async getPatientTreatments(patientId) {
    return await api.get(`/treatments/patient/${patientId}`);
  }

  async addPatientTreatment(data) {
    return await api.post('/treatments/patient', data);
  }

  async updatePatientTreatment(id, data) {
    return await api.put(`/treatments/patient/${id}`, data);
  }
}

const treatmentService = new TreatmentService();
export default treatmentService;
