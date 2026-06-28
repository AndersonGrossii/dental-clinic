// ============================================
// Servicio de Citas
// ============================================
import api from './api.service.js';

class AppointmentService {
  async getAll(params = {}) {
    return await api.get('/appointments', params);
  }

  async getById(id) {
    return await api.get(`/appointments/${id}`);
  }

  async create(data) {
    return await api.post('/appointments', data);
  }

  async update(id, data) {
    return await api.put(`/appointments/${id}`, data);
  }

  async updateStatus(id, statusName, cancellationReason = null) {
    return await api.patch(`/appointments/${id}/status`, {
      status_name: statusName,
      cancellation_reason: cancellationReason,
    });
  }

  async remove(id) {
    return await api.delete(`/appointments/${id}`);
  }

  async getCalendar(startDate, endDate, doctorId = null) {
    const params = { start_date: startDate, end_date: endDate };
    if (doctorId) params.doctor_id = doctorId;
    return await api.get('/appointments/calendar', params);
  }

  async getToday(doctorId = null) {
    const params = {};
    if (doctorId) params.doctor_id = doctorId;
    return await api.get('/appointments/today', params);
  }
}

const appointmentService = new AppointmentService();
export default appointmentService;
