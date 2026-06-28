// ============================================
// Servicio de Notificaciones
// ============================================
import api from './api.service.js';

class NotificationService {
  async getAll(params = {}) {
    return await api.get('/notifications', params);
  }

  async getUnreadCount() {
    return await api.get('/notifications/unread-count');
  }

  async markAsRead(id) {
    return await api.patch(`/notifications/${id}/read`);
  }

  async markAllAsRead() {
    return await api.patch('/notifications/read-all');
  }
}

const notificationService = new NotificationService();
export default notificationService;
