// ============================================
// Servicio de Packs Promocionales
// ============================================
import api from './api.service.js';

class PromotionalPackService {
  async getAll(params = {}) {
    const res = await api.get('/promotional-packs', params);
    return res?.data || res || [];
  }

  async getById(id) {
    const res = await api.get(`/promotional-packs/${id}`);
    return res?.data || res;
  }

  async create(data) {
    const res = await api.post('/promotional-packs', data);
    return res?.data || res;
  }

  async update(id, data) {
    const res = await api.put(`/promotional-packs/${id}`, data);
    return res?.data || res;
  }

  async toggleStatus(id, isActive) {
    const res = await api.patch(`/promotional-packs/${id}/status`, { is_active: isActive });
    return res?.data || res;
  }

  async remove(id) {
    return await api.delete(`/promotional-packs/${id}`);
  }
}

const promotionalPackService = new PromotionalPackService();
export default promotionalPackService;
