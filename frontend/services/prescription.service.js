import api from './api.service.js';

const PrescriptionService = {
  async getByPatient(patientId, params = {}) {
    const query = new URLSearchParams(params).toString();
    return api.get(`/patients/${patientId}/prescriptions${query ? '?' + query : ''}`);
  },

  async getById(id) {
    return api.get(`/prescriptions/${id}`);
  },

  async create(data) {
    return api.post('/prescriptions', data);
  },

  async remove(id) {
    return api.delete(`/prescriptions/${id}`);
  },
};

export default PrescriptionService;
