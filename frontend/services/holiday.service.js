// ============================================
// Servicio Frontend de Días Festivos y Bloqueos de Agenda
// ============================================
import apiService from './api.service.js';

class HolidayService {
  /**
   * Obtiene la lista de festivos (opcionalmente filtrada por date_from y date_to).
   */
  async getHolidays(params = {}) {
    return apiService.get('/holidays', params);
  }

  /**
   * Crea un nuevo día festivo en la clínica.
   */
  async createHoliday(data) {
    return apiService.post('/holidays', data);
  }

  /**
   * Elimina un día festivo por su ID.
   */
  async deleteHoliday(id) {
    return apiService.delete(`/holidays/${id}`);
  }

  /**
   * Carga o re-sincroniza los festivos oficiales de la Comunitat Valenciana y España para un año.
   */
  async seedOfficialHolidays(year) {
    return apiService.post('/holidays/seed', { year });
  }
}

export default new HolidayService();
