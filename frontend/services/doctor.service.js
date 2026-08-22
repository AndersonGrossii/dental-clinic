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

  async getUnavailability(id, dateFrom, dateTo) {
    return await api.get(`/doctors/${id}/unavailability`, { date_from: dateFrom, date_to: dateTo });
  }

  async addUnavailability(id, data) {
    return await api.post(`/doctors/${id}/unavailability`, data);
  }

  async removeUnavailability(id, unavailId) {
    return await api.delete(`/doctors/${id}/unavailability/${unavailId}`);
  }

  async getWorkdays(id, dateFrom = null, dateTo = null) {
    const params = {};
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    return await api.get(`/doctors/${id}/workdays`, params);
  }

  async addWorkday(id, data) {
    return await api.post(`/doctors/${id}/workdays`, data);
  }

  async removeWorkday(id, workdayId) {
    return await api.delete(`/doctors/${id}/workdays/${workdayId}`);
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
