// ============================================
// Servicio de Doctores
// ============================================
import api from './api.service.js';

class DoctorService {
  async getAll() {
    return await api.get('/doctors');
  }

  async getById(id) {
    return await api.get(`/doctors/${id}`);
  }

  async getSchedule(id) {
    return await api.get(`/doctors/${id}/schedule`);
  }

  async updateSchedule(id, data) {
    return await api.put(`/doctors/${id}/schedule`, data);
  }

  async getAvailability(id, dateString) {
    return await api.get(`/doctors/${id}/availability`, { date: dateString });
  }

  async addUnavailability(id, data) {
    return await api.post(`/doctors/${id}/unavailability`, data);
  }

  async removeUnavailability(id, unavailId) {
    return await api.delete(`/doctors/${id}/unavailability/${unavailId}`);
  }

  async create(data) {
    return await api.post('/doctors', data);
  }

  async update(id, data) {
    return await api.put(`/doctors/${id}`, data);
  }

  async remove(id) {
    return await api.delete(`/doctors/${id}`);
  }
}

const doctorService = new DoctorService();
export default doctorService;
