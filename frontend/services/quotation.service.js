// ============================================
// Servicio de Cotizaciones
// ============================================
import api from './api.service.js';

class QuotationService {
  async getAll(params = {}) {
    return await api.get('/quotations', params);
  }

  async getById(id) {
    return await api.get(`/quotations/${id}`);
  }

  async create(data) {
    return await api.post('/quotations', data);
  }

  async update(id, data) {
    return await api.put(`/quotations/${id}`, data);
  }

  async remove(id) {
    return await api.delete(`/quotations/${id}`);
  }

  async changeStatus(id, status) {
    return await api.patch(`/quotations/${id}/status`, { status });
  }
}

const quotationService = new QuotationService();
export default quotationService;
