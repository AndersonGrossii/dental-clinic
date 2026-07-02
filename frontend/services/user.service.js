// ============================================
// Servicio de Gestión de Usuarios
// ============================================
import api from './api.service.js';

class UserService {
  async getAll(params = {}) {
    return await api.get('/users', params);
  }

  async getById(id) {
    return await api.get(`/users/${id}`);
  }

  async create(data) {
    return await api.post('/users', data);
  }

  async update(id, data) {
    return await api.put(`/users/${id}`, data);
  }

  async remove(id) {
    return await api.delete(`/users/${id}`);
  }

  async toggleStatus(id) {
    return await api.patch(`/users/${id}/toggle-status`);
  }

  async resetPassword(id, newPassword) {
    return await api.post(`/users/${id}/reset-password`, { newPassword });
  }
}

const userService = new UserService();
export default userService;
