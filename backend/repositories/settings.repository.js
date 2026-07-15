// ============================================
// Repositorio de Configuraciones
// ============================================
import { query, scopeClinic, als } from '../database/pool.js';
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
    const conditions = ['key = $1'];
    const params = [key];
    scopeClinic(conditions, params);

    const result = await query(
      `SELECT * FROM settings WHERE ${conditions.join(' AND ')}`,
      params
    );
    return result.rows[0] || null;
  }

  /**
   * Obtiene todas las configuraciones de una categoría.
   * @param {string} category - Nombre de la categoría
   * @returns {Promise<Array>}
   */
  async getAllByCategory(category) {
    const conditions = ['category = $1'];
    const params = [category];
    scopeClinic(conditions, params);

    const result = await query(
      `SELECT * FROM settings WHERE ${conditions.join(' AND ')} ORDER BY key ASC`,
      params
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
    const conditions = ['key = $2'];
    const params = [value, key];
    scopeClinic(conditions, params);

    const result = await query(
      `UPDATE settings
       SET value = $1, updated_at = NOW()
       WHERE ${conditions.join(' AND ')}
       RETURNING *`,
      params
    );
    return result.rows[0] || null;
  }

  /**
   * Obtiene la información de la clínica.
   * @param {number} [clinicId] - Si se pasa, filtra por clinic_id; si no, usa el ALS store o retorna la primera fila
   * @returns {Promise<object|null>}
   */
  async getClinicInfo(clinicId) {
    const store = als.getStore();
    const activeClinicId = clinicId || store?.clinicId;
    const conditions = [];
    const params = [];
    if (activeClinicId) {
      conditions.push(`clinic_id = $1`);
      params.push(activeClinicId);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await query(
      `SELECT * FROM clinic_information ${where} ORDER BY id LIMIT 1`,
      params
    );
    return result.rows[0] || null;
  }

  /**
   * Actualiza la información de la clínica.
   * Si no existe un registro para la clínica activa, lo inserta.
   * @param {object} data - Datos de la clínica a actualizar
   * @returns {Promise<object|null>}
   */
  async updateClinicInfo(data) {
    const store = als.getStore();
    const clinicId = store?.clinicId;
    const keys = Object.keys(data);
    const values = Object.values(data);
    const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');

    let sql = `UPDATE clinic_information
       SET ${setClause}, updated_at = NOW()
       WHERE id = (SELECT id FROM clinic_information ORDER BY id LIMIT 1)`;
    const params = [...values];

    if (clinicId) {
      sql += ` AND clinic_id = $${params.length + 1}`;
      params.push(clinicId);
    }

    sql += ` RETURNING *`;

    const result = await query(sql, params);
    if (result.rows[0]) return result.rows[0];

    // No row existed for this clinic — insert one
    if (clinicId) {
      const cols = ['clinic_id', ...keys];
      const vals = [clinicId, ...values];
      const updateCols = keys.map(k => `${k} = EXCLUDED.${k}`).join(', ');
      const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
      const insertResult = await query(
        `INSERT INTO clinic_information (${cols.join(', ')})
         VALUES (${placeholders})
         ON CONFLICT ON CONSTRAINT uq_clinic_information_clinic_id
         DO UPDATE SET ${updateCols}, updated_at = NOW()
         RETURNING *`,
        vals
      );
      return insertResult.rows[0] || null;
    }

    return null;
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
