// ============================================
// Servicio de Facturas
// ============================================
import api from './api.service.js';

class InvoiceService {
  async getAll(params = {}) {
    return await api.get('/invoices', params);
  }

  async getById(id) {
    return await api.get(`/invoices/${id}`);
  }

  async create(data) {
    return await api.post('/invoices', data);
  }

  async update(id, data) {
    return await api.put(`/invoices/${id}`, data);
  }

  async remove(id) {
    return await api.delete(`/invoices/${id}`);
  }

  async createFromQuotation(quotationId) {
    return await api.post(`/invoices/from-quotation/${quotationId}`);
  }

  async getStats() {
    return await api.get('/invoices/stats');
  }
}

const invoiceService = new InvoiceService();
export default invoiceService;
