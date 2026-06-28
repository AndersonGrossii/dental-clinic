// ============================================
// Servicio de Reportes
// ============================================
import api from './api.service.js';

class ReportService {
  async getDashboard() {
    return await api.get('/reports/dashboard');
  }

  async getRevenue(startDate, endDate) {
    return await api.get('/reports/revenue', { start_date: startDate, end_date: endDate });
  }

  async getAppointments(startDate, endDate) {
    return await api.get('/reports/appointments', { start_date: startDate, end_date: endDate });
  }

  async getPatients(startDate, endDate) {
    return await api.get('/reports/patients', { start_date: startDate, end_date: endDate });
  }

  async getTreatments(startDate, endDate) {
    return await api.get('/reports/treatments', { start_date: startDate, end_date: endDate });
  }

  async exportCsv(type, startDate, endDate) {
    // Redirección directa para descarga
    const token = localStorage.getItem('token');
    window.open(`/api/v1/reports/export/${type}?start_date=${startDate}&end_date=${endDate}&token=${token}`);
  }
}

const reportService = new ReportService();
export default reportService;
