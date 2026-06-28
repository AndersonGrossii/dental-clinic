// ============================================
// Servicio de Configuración
// ============================================
import api from './api.service.js';

class SettingsService {
  async getAll() {
    return await api.get('/settings');
  }

  async update(key, value) {
    return await api.put(`/settings/${key}`, { value });
  }

  async getClinicInfo() {
    return await api.get('/settings/clinic');
  }

  async updateClinicInfo(data) {
    return await api.put('/settings/clinic', data);
  }

  async getAuditLogs(params = {}) {
    return await api.get('/settings/audit-logs', params);
  }
}

const settingsService = new SettingsService();
export default settingsService;
