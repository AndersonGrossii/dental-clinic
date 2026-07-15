// ============================================
// Servicio de Configuración y Auditoría
// ============================================
import settingsRepository from '../repositories/settings.repository.js';
import { query, scopeClinic } from '../database/pool.js';
import { AppError } from '../utils/errors.js';
import { buildPaginationMeta } from '../utils/pagination.js';

class SettingsService {
  /**
   * Obtiene todas las configuraciones.
   */
  async getAll() {
    const conditions = [];
    const params = [];
    scopeClinic(conditions, params);
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await query(`SELECT * FROM settings ${whereClause} ORDER BY category, key`, params);
    return result.rows;
  }

  /**
   * Obtiene una configuración por su llave.
   */
  async getByKey(key) {
    const setting = await settingsRepository.getByKey(key);
    if (!setting) {
      throw new AppError(`Configuración para la llave '${key}' no encontrada`, 404);
    }
    return setting;
  }

  /**
   * Actualiza el valor de una configuración.
   */
  async update(key, value) {
    const setting = await settingsRepository.updateByKey(key, value);
    if (!setting) {
      throw new AppError(`Configuración para la llave '${key}' no encontrada`, 404);
    }
    return setting;
  }

  /**
   * Obtiene la información de la clínica.
   */
  async getClinicInfo(clinicId) {
    const info = await settingsRepository.getClinicInfo(clinicId);
    if (!info) {
      throw new AppError('Información de la clínica no configurada', 404);
    }
    return info;
  }

  /**
   * Actualiza la información de la clínica.
   */
  async updateClinicInfo(data) {
    const info = await settingsRepository.updateClinicInfo(data);
    if (!info) {
      throw new AppError('Error al actualizar la información de la clínica', 500);
    }
    return info;
  }

  /**
   * Obtiene el registro de auditoría con paginación y búsqueda.
   */
  async getAuditLogs({ page = 1, limit = 20, user_id, action, date_from, date_to } = {}) {
    const offset = (page - 1) * limit;
    const filters = { user_id, action, date_from, date_to };
    const { rows, total } = await settingsRepository.getAuditLogs({ limit, offset, filters });
    const pagination = buildPaginationMeta(total, page, limit);
    return { logs: rows, pagination };
  }
}

export default new SettingsService();
