// ============================================
// Repositorio de Configuraciones
// ============================================
import { query } from '../database/pool.js';
import { BaseRepository } from './base.repository.js';

/**
 * Repositorio para operaciones de datos de configuraciones del sistema.
 * Extiende BaseRepository con consultas específicas de configuraciones.
 */
class SettingsRepository extends BaseRepository {
  constructor() {
    super('settings');
  }

  /**
   * Obtiene una configuración por su clave única.
   * @param {string} key - Clave de la configuración
   * @returns {Promise<object|null>}
   */
  async getByKey(key) {
    const result = await query(
      'SELECT * FROM settings WHERE key = $1',
      [key]
    );
    return result.rows[0] || null;
  }

  /**
   * Obtiene todas las configuraciones de una categoría.
   * @param {string} category - Nombre de la categoría
   * @returns {Promise<Array>}
   */
  async getAllByCategory(category) {
    const result = await query(
      'SELECT * FROM settings WHERE category = $1 ORDER BY key ASC',
      [category]
    );
    return result.rows;
  }

  /**
   * Actualiza el valor de una configuración por su clave.
   * @param {string} key - Clave de la configuración
   * @param {string} value - Nuevo valor
   * @returns {Promise<object|null>}
   */
  async updateByKey(key, value) {
    const result = await query(
      `UPDATE settings
       SET value = $1, updated_at = NOW()
       WHERE key = $2
       RETURNING *`,
      [value, key]
    );
    return result.rows[0] || null;
  }

  /**
   * Obtiene la información de la clínica.
   * @returns {Promise<object|null>}
   */
  async getClinicInfo() {
    const result = await query(
      'SELECT * FROM clinic_information ORDER BY id LIMIT 1'
    );
    return result.rows[0] || null;
  }

  /**
   * Actualiza la información de la clínica.
   * @param {object} data - Datos de la clínica a actualizar
   * @returns {Promise<object|null>}
   */
  async updateClinicInfo(data) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');

    const result = await query(
      `UPDATE clinic_information
       SET ${setClause}, updated_at = NOW()
       WHERE id = (SELECT id FROM clinic_information ORDER BY id LIMIT 1)
       RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  /**
   * Obtiene los registros de auditoría con paginación.
   * @param {object} options - Opciones de búsqueda y paginación
   * @returns {Promise<{ rows: Array, total: number }>}
   */
  async getAuditLogs({ limit = 20, offset = 0, sortBy = 'al.created_at', sortOrder = 'DESC', filters = {} } = {}) {
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (filters.user_id) {
      conditions.push(`al.user_id = $${paramIndex}`);
      params.push(filters.user_id);
      paramIndex++;
    }

    if (filters.action) {
      conditions.push(`al.action = $${paramIndex}`);
      params.push(filters.action);
      paramIndex++;
    }

    if (filters.table_name) {
      conditions.push(`al.table_name = $${paramIndex}`);
      params.push(filters.table_name);
      paramIndex++;
    }

    if (filters.start_date) {
      conditions.push(`al.created_at >= $${paramIndex}`);
      params.push(filters.start_date);
      paramIndex++;
    }

    if (filters.end_date) {
      conditions.push(`al.created_at <= $${paramIndex}`);
      params.push(filters.end_date);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const safeSortBy = /^[a-zA-Z_.]+$/.test(sortBy) ? sortBy : 'al.created_at';
    const safeSortOrder = sortOrder === 'ASC' ? 'ASC' : 'DESC';

    const countResult = await query(
      `SELECT COUNT(*) AS total
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
       ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total, 10);

    const dataResult = await query(
      `SELECT al.*,
              u.first_name AS user_first_name,
              u.last_name AS user_last_name,
              u.email AS user_email
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
       ${whereClause}
       ORDER BY ${safeSortBy} ${safeSortOrder}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    return { rows: dataResult.rows, total };
  }
}

export default new SettingsRepository();
