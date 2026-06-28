// ============================================
// Servicio de Pagos
// ============================================
import api from './api.service.js';

class PaymentService {
  async getAll(params = {}) {
    return await api.get('/payments', params);
  }

  async getByInvoice(invoiceId) {
    return await api.get(`/payments/invoice/${invoiceId}`);
  }

  async getMethods() {
    return await api.get('/payments/methods');
  }

  async create(data) {
    return await api.post('/payments', data);
  }

  async remove(id) {
    return await api.delete(`/payments/${id}`);
  }
}

const paymentService = new PaymentService();
export default paymentService;
