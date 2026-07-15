// ============================================
// Repositorio Base — Operaciones CRUD genéricas
// ============================================
import { query, transaction, als } from '../database/pool.js';

/**
 * Clase base para repositorios.
 * Provee operaciones CRUD estándar con consultas parametrizadas.
 */
export class BaseRepository {
  /**
   * @param {string} tableName - Nombre de la tabla PostgreSQL
   */
  constructor(tableName) {
    this.tableName = tableName;
    this.excludedTables = ['roles', 'permissions', 'role_permissions', 'clinics', 'appointment_status', 'payment_methods', '_migrations', '_seeders'];
  }

  /**
   * Helper para verificar si la tabla debe ser aislada por clínica.
   */
  isClinicSpecific() {
    return !this.excludedTables.includes(this.tableName);
  }

  /**
   * Helper para obtener el clinicId del contexto.
   */
  getClinicId() {
    const store = als.getStore();
    return store ? store.clinicId : null;
  }

  /**
   * Busca un registro por ID.
   * @param {string|number} id
   * @returns {Promise<object|null>}
   */
  async findById(id) {
    let sql = `SELECT * FROM ${this.tableName} WHERE id = $1 AND deleted_at IS NULL`;
    const params = [id];

    if (this.isClinicSpecific()) {
      const clinicId = this.getClinicId();
      if (clinicId) {
        sql += ` AND clinic_id = $2`;
        params.push(clinicId);
      }
    }

    const result = await query(sql, params);
    return result.rows[0] || null;
  }

  /**
   * Busca todos los registros con paginación.
   * @param {object} options - { limit, offset, sortBy, sortOrder, filters }
   * @returns {Promise<{ rows: Array, total: number }>}
   */
  async findAll({ limit = 20, offset = 0, sortBy = 'created_at', sortOrder = 'DESC', filters = {} } = {}) {
    // Construir condiciones WHERE dinámicas
    const conditions = ['deleted_at IS NULL'];
    const params = [];

    // Aplicar scoping de clínica
    if (this.isClinicSpecific()) {
      const clinicId = this.getClinicId();
      if (clinicId) {
        conditions.push('clinic_id = $1');
        params.push(clinicId);
      }
    }

    let paramIndex = params.length + 1;

    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== '') {
        if (typeof value === 'string' && value.includes('%')) {
          conditions.push(`${key} ILIKE $${paramIndex}`);
        } else {
          conditions.push(`${key} = $${paramIndex}`);
        }
        params.push(value);
        paramIndex++;
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Validar sortBy contra inyección SQL (solo letras, guiones bajos, puntos)
    const safeSortBy = /^[a-zA-Z_.]+$/.test(sortBy) ? sortBy : 'created_at';
    const safeSortOrder = sortOrder === 'ASC' ? 'ASC' : 'DESC';

    // Query para total
    const countResult = await query(
      `SELECT COUNT(*) AS total FROM ${this.tableName} ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total, 10);

    // Query para datos
    const dataResult = await query(
      `SELECT * FROM ${this.tableName} ${whereClause}
       ORDER BY ${safeSortBy} ${safeSortOrder}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    return { rows: dataResult.rows, total };
  }

  /**
   * Crea un nuevo registro.
   * @param {object} data - Datos a insertar
   * @returns {Promise<object>} Registro creado
   */
  async create(data) {
    if (this.isClinicSpecific()) {
      const clinicId = this.getClinicId();
      if (clinicId && !data.clinic_id) {
        data.clinic_id = clinicId;
      }
    }

    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, i) => `$${i + 1}`);

    const result = await query(
      `INSERT INTO ${this.tableName} (${keys.join(', ')})
       VALUES (${placeholders.join(', ')})
       RETURNING *`,
      values
    );

    return result.rows[0];
  }

  /**
   * Actualiza un registro por ID.
   * @param {string|number} id
   * @param {object} data - Datos a actualizar
   * @returns {Promise<object|null>} Registro actualizado
   */
  async update(id, data) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');

    let sql = `UPDATE ${this.tableName} SET ${setClause}, updated_at = NOW() WHERE id = $${keys.length + 1} AND deleted_at IS NULL`;
    const params = [...values, id];

    if (this.isClinicSpecific()) {
      const clinicId = this.getClinicId();
      if (clinicId) {
        sql += ` AND clinic_id = $${keys.length + 2}`;
        params.push(clinicId);
      }
    }
    sql += ` RETURNING *`;

    const result = await query(sql, params);

    return result.rows[0] || null;
  }

  /**
   * Elimina un registro (soft delete).
   * @param {string|number} id
   * @returns {Promise<boolean>}
   */
  async softDelete(id) {
    let sql = `UPDATE ${this.tableName} SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL`;
    const params = [id];

    if (this.isClinicSpecific()) {
      const clinicId = this.getClinicId();
      if (clinicId) {
        sql += ` AND clinic_id = $2`;
        params.push(clinicId);
      }
    }

    const result = await query(sql, params);
    return result.rowCount > 0;
  }

  /**
   * Elimina un registro permanentemente.
   * @param {string|number} id
   * @returns {Promise<boolean>}
   */
  async hardDelete(id) {
    let sql = `DELETE FROM ${this.tableName} WHERE id = $1`;
    const params = [id];

    if (this.isClinicSpecific()) {
      const clinicId = this.getClinicId();
      if (clinicId) {
        sql += ` AND clinic_id = $2`;
        params.push(clinicId);
      }
    }

    const result = await query(sql, params);
    return result.rowCount > 0;
  }

  /**
   * Busca un registro por un campo específico.
   * @param {string} field - Nombre del campo
   * @param {any} value - Valor a buscar
   * @returns {Promise<object|null>}
   */
  async findByField(field, value) {
    const safeField = /^[a-zA-Z_]+$/.test(field) ? field : 'id';
    let sql = `SELECT * FROM ${this.tableName} WHERE ${safeField} = $1 AND deleted_at IS NULL`;
    const params = [value];

    if (this.isClinicSpecific()) {
      const clinicId = this.getClinicId();
      if (clinicId) {
        sql += ` AND clinic_id = $2`;
        params.push(clinicId);
      }
    }

    const result = await query(sql, params);
    return result.rows[0] || null;
  }

  /**
   * Cuenta registros con filtros opcionales.
   * @param {object} filters
   * @returns {Promise<number>}
   */
  async count(filters = {}) {
    const conditions = ['deleted_at IS NULL'];
    const params = [];

    if (this.isClinicSpecific()) {
      const clinicId = this.getClinicId();
      if (clinicId) {
        conditions.push('clinic_id = $1');
        params.push(clinicId);
      }
    }

    let paramIndex = params.length + 1;

    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null) {
        conditions.push(`${key} = $${paramIndex}`);
        params.push(value);
        paramIndex++;
      }
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    const result = await query(
      `SELECT COUNT(*) AS total FROM ${this.tableName} ${whereClause}`,
      params
    );

    return parseInt(result.rows[0].total, 10);
  }

  /**
   * Ejecuta una consulta SQL personalizada.
   * @param {string} sql
   * @param {Array} params
   * @returns {Promise<pg.QueryResult>}
   */
  async rawQuery(sql, params = []) {
    return query(sql, params);
  }

  /**
   * Ejecuta operaciones dentro de una transacción.
   * @param {Function} callback
   * @returns {Promise<any>}
   */
  async transaction(callback) {
    return transaction(callback);
  }
}
