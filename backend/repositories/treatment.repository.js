// ============================================
// Repositorio de Tratamientos — Operaciones de datos
// ============================================
import { query } from '../database/pool.js';
import { BaseRepository } from './base.repository.js';

/**
 * Repositorio para la gestión de tratamientos y categorías.
 * Extiende el repositorio base con consultas especializadas.
 */
class TreatmentRepository extends BaseRepository {
  constructor() {
    super('treatments');
  }

  /**
   * Obtiene todos los tratamientos con su categoría asociada.
   * Soporta filtros por categoría y estado activo.
   * @param {object} options - Opciones de paginación y filtros
   * @returns {Promise<{ rows: Array, total: number }>}
   */
  async findAllWithCategory({ limit = 20, offset = 0, sortBy = 't.name', sortOrder = 'ASC', filters = {} } = {}) {
    const conditions = ['t.deleted_at IS NULL'];
    const params = [];
    let paramIndex = 1;

    if (filters.category_id) {
      conditions.push(`t.category_id = $${paramIndex++}`);
      params.push(filters.category_id);
    }

    if (filters.is_active !== undefined && filters.is_active !== null) {
      conditions.push(`t.is_active = $${paramIndex++}`);
      params.push(filters.is_active);
    }

    if (filters.search) {
      conditions.push(`(t.name ILIKE $${paramIndex} OR t.code ILIKE $${paramIndex})`);
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const allowedSortFields = ['t.name', 't.default_price', 't.created_at', 'category_name', 't.code'];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 't.name';
    const safeSortOrder = sortOrder === 'ASC' ? 'ASC' : 'DESC';

    // Contar total
    const countResult = await query(
      `SELECT COUNT(*) AS total
       FROM treatments t
       ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total, 10);

    // Obtener datos con JOIN de categoría
    const dataResult = await query(
      `SELECT
         t.id,
         t.category_id,
         t.name,
         t.code,
         t.description,
         t.default_price,
         t.duration_minutes,
         t.is_active,
         t.created_at,
         t.updated_at,
         tc.name AS category_name,
         tc.color AS category_color,
         tc.icon AS category_icon
       FROM treatments t
       LEFT JOIN treatment_categories tc ON t.category_id = tc.id
       ${whereClause}
       ORDER BY ${safeSortBy} ${safeSortOrder}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    return { rows: dataResult.rows, total };
  }

  /**
   * Obtiene todas las categorías de tratamientos activas.
   * @returns {Promise<Array>}
   */
  async findCategories() {
    const result = await query(
      `SELECT
         id, name, description, color, icon, sort_order, is_active, created_at, updated_at
       FROM treatment_categories
       WHERE is_active = TRUE
       ORDER BY sort_order ASC, name ASC`
    );
    return result.rows;
  }

  /**
   * Crea una nueva categoría de tratamiento.
   * @param {object} data - Datos de la categoría
   * @returns {Promise<object>}
   */
  async createCategory(data) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, i) => `$${i + 1}`);

    const result = await query(
      `INSERT INTO treatment_categories (${keys.join(', ')})
       VALUES (${placeholders.join(', ')})
       RETURNING *`,
      values
    );
    return result.rows[0];
  }

  /**
   * Actualiza una categoría de tratamiento.
   * @param {number} id - ID de la categoría
   * @param {object} data - Datos a actualizar
   * @returns {Promise<object|null>}
   */
  async updateCategory(id, data) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');

    const result = await query(
      `UPDATE treatment_categories
       SET ${setClause}, updated_at = NOW()
       WHERE id = $${keys.length + 1}
       RETURNING *`,
      [...values, id]
    );
    return result.rows[0] || null;
  }

  /**
   * Obtiene los tratamientos realizados a un paciente.
   * Incluye datos del tratamiento, doctor y cita asociada.
   * @param {number} patientId - ID del paciente
   * @returns {Promise<Array>}
   */
  async getPatientTreatments(patientId) {
    const result = await query(
      `SELECT
         pt.id,
         pt.patient_id,
         pt.treatment_id,
         pt.doctor_id,
         pt.appointment_id,
         pt.tooth_number,
         pt.price,
         pt.status,
         pt.notes,
         pt.start_date,
         pt.end_date,
         pt.created_at,
         pt.updated_at,
         t.name AS treatment_name,
         t.code AS treatment_code,
         tc.name AS category_name,
         tc.color AS category_color,
         CONCAT(u.first_name, ' ', u.last_name) AS doctor_name,
         d.specialty AS doctor_specialty
       FROM patient_treatments pt
       INNER JOIN treatments t ON pt.treatment_id = t.id
       LEFT JOIN treatment_categories tc ON t.category_id = tc.id
       LEFT JOIN doctors d ON pt.doctor_id = d.id
       LEFT JOIN users u ON d.user_id = u.id
       WHERE pt.patient_id = $1 AND pt.deleted_at IS NULL
       ORDER BY pt.created_at DESC`,
      [patientId]
    );
    return result.rows;
  }

  /**
   * Registra un tratamiento realizado a un paciente.
   * @param {object} data - Datos del tratamiento del paciente
   * @returns {Promise<object>}
   */
  async createPatientTreatment(data) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, i) => `$${i + 1}`);

    const result = await query(
      `INSERT INTO patient_treatments (${keys.join(', ')})
       VALUES (${placeholders.join(', ')})
       RETURNING *`,
      values
    );
    return result.rows[0];
  }

  /**
   * Actualiza un tratamiento de paciente.
   * @param {number} id - ID del registro patient_treatments
   * @param {object} data - Datos a actualizar
   * @returns {Promise<object|null>}
   */
  async updatePatientTreatment(id, data) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');

    const result = await query(
      `UPDATE patient_treatments
       SET ${setClause}, updated_at = NOW()
       WHERE id = $${keys.length + 1} AND deleted_at IS NULL
       RETURNING *`,
      [...values, id]
    );
    return result.rows[0] || null;
  }
}

export default new TreatmentRepository();
