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

  async acceptAllItems(id) {
    return await api.post(`/quotations/${id}/accept-all`);
  }

  async updateItemStatus(itemId, status) {
    return await api.patch(`/quotations/items/${itemId}/status`, { status });
  }

  async updateItemsStatusBulk(id, items) {
    return await api.post(`/quotations/${id}/items-status`, { items });
  }

  async getAcceptedItemsByPatient(patientId) {
    return await api.get(`/quotations/patients/${patientId}/accepted-items`);
  }

  async updateExecutionStatus(itemId, executionStatus) {
    return await api.patch(`/quotations/items/${itemId}/execution-status`, { executionStatus });
  }
}

const quotationService = new QuotationService();
export default quotationService;
