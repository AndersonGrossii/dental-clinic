// ============================================
// Repositorio de Pacientes
// ============================================
import { BaseRepository } from './base.repository.js';
import { query } from '../database/pool.js';

/**
 * Repositorio para operaciones de datos de pacientes.
 * Extiende BaseRepository con métodos de búsqueda avanzada e historial.
 */
class PatientRepository extends BaseRepository {
  constructor() {
    super('patients');
  }

  /**
   * Sobrescribe findAll para incluir datos financieros agregados de facturas.
   * @param {object} options - { limit, offset, sortBy, sortOrder, filters }
   * @returns {Promise<{ rows: Array, total: number }>}
   */
  async findAll({ limit = 20, offset = 0, sortBy = 'created_at', sortOrder = 'DESC', filters = {} } = {}) {
    // Construir condiciones WHERE dinámicas con prefijo de alias
    const conditions = ['p.deleted_at IS NULL'];
    const params = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== '') {
        if (typeof value === 'string' && value.includes('%')) {
          conditions.push(`p.${key} ILIKE $${paramIndex}`);
        } else {
          conditions.push(`p.${key} = $${paramIndex}`);
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
      `SELECT COUNT(*) AS total FROM patients p ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total, 10);

    // Query para datos con agregación de facturas
    const dataResult = await query(
      `SELECT p.*,
              COALESCE(inv.total_debit, 0) AS total_debit,
              COALESCE(inv.total_credit, 0) AS total_credit,
              COALESCE(inv.balance, 0) AS balance
       FROM patients p
       LEFT JOIN (
         SELECT patient_id,
                COALESCE(SUM(total), 0) AS total_debit,
                COALESCE(SUM(amount_paid), 0) AS total_credit,
                COALESCE(SUM(total), 0) - COALESCE(SUM(amount_paid), 0) AS balance
         FROM invoices
         WHERE status != 'cancelada' AND deleted_at IS NULL
         GROUP BY patient_id
       ) inv ON inv.patient_id = p.id
       ${whereClause}
       ORDER BY ${safeSortBy} ${safeSortOrder}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    return { rows: dataResult.rows, total };
  }

  /**
   * Busca pacientes por término de búsqueda (nombre, DNI, teléfono, email).
   * @param {string} term - Término de búsqueda
   * @param {object} options - { limit, offset }
   * @returns {Promise<{ rows: Array, total: number }>}
   */
  async search(term, { limit = 20, offset = 0 } = {}) {
    const searchPattern = `%${term}%`;

    const countResult = await query(
      `SELECT COUNT(*) AS total FROM patients
       WHERE deleted_at IS NULL
         AND (
           first_name ILIKE $1
           OR last_name ILIKE $1
           OR CONCAT(first_name, ' ', last_name) ILIKE $1
           OR dni ILIKE $1
           OR phone ILIKE $1
           OR mobile ILIKE $1
           OR email ILIKE $1
           OR custom_id ILIKE $1
         )`,
      [searchPattern]
    );
    const total = parseInt(countResult.rows[0].total, 10);

    const dataResult = await query(
      `SELECT p.id, p.first_name, p.last_name, p.dni, p.phone, p.mobile, p.email,
              p.birth_date, p.gender, p.is_active, p.photo_url, p.created_at, p.custom_id,
              COALESCE(inv.total_debit, 0) AS total_debit,
              COALESCE(inv.total_credit, 0) AS total_credit,
              COALESCE(inv.balance, 0) AS balance
       FROM patients p
       LEFT JOIN (
         SELECT patient_id,
                COALESCE(SUM(total), 0) AS total_debit,
                COALESCE(SUM(amount_paid), 0) AS total_credit,
                COALESCE(SUM(total), 0) - COALESCE(SUM(amount_paid), 0) AS balance
         FROM invoices
         WHERE status != 'cancelada' AND deleted_at IS NULL
         GROUP BY patient_id
       ) inv ON inv.patient_id = p.id
       WHERE p.deleted_at IS NULL
         AND (
           p.first_name ILIKE $1
           OR p.last_name ILIKE $1
           OR CONCAT(p.first_name, ' ', p.last_name) ILIKE $1
           OR p.dni ILIKE $1
           OR p.phone ILIKE $1
           OR p.mobile ILIKE $1
           OR p.email ILIKE $1
           OR p.custom_id ILIKE $1
         )
       ORDER BY p.last_name ASC, p.first_name ASC
       LIMIT $2 OFFSET $3`,
      [searchPattern, limit, offset]
    );

    return { rows: dataResult.rows, total };
  }

  /**
   * Obtiene un paciente con conteos de historial médico y dental.
   * @param {number} id - ID del paciente
   * @returns {Promise<object|null>}
   */
  async findWithHistory(id) {
    const result = await query(
      `SELECT p.*,
              COALESCE(mh.medical_count, 0)::integer AS medical_history_count,
              COALESCE(dh.dental_count, 0)::integer AS dental_history_count,
              COALESCE(ap.appointment_count, 0)::integer AS appointment_count,
              COALESCE(pi.image_count, 0)::integer AS image_count,
              COALESCE(inv.total_debit, 0) AS total_debit,
              COALESCE(inv.total_credit, 0) AS total_credit,
              COALESCE(inv.balance, 0) AS balance,
              u.first_name AS created_by_name, u.last_name AS created_by_lastname
       FROM patients p
       LEFT JOIN (
         SELECT patient_id, COUNT(*) AS medical_count
         FROM medical_history
         WHERE deleted_at IS NULL
         GROUP BY patient_id
       ) mh ON mh.patient_id = p.id
       LEFT JOIN (
         SELECT patient_id, COUNT(*) AS dental_count
         FROM dental_history
         WHERE deleted_at IS NULL
         GROUP BY patient_id
       ) dh ON dh.patient_id = p.id
       LEFT JOIN (
         SELECT patient_id, COUNT(*) AS appointment_count
         FROM appointments
         WHERE deleted_at IS NULL
         GROUP BY patient_id
       ) ap ON ap.patient_id = p.id
       LEFT JOIN (
         SELECT patient_id, COUNT(*) AS image_count
         FROM patient_images
         WHERE deleted_at IS NULL
         GROUP BY patient_id
       ) pi ON pi.patient_id = p.id
       LEFT JOIN (
         SELECT patient_id,
                COALESCE(SUM(total), 0) AS total_debit,
                COALESCE(SUM(amount_paid), 0) AS total_credit,
                COALESCE(SUM(total), 0) - COALESCE(SUM(amount_paid), 0) AS balance
         FROM invoices
         WHERE status != 'cancelada' AND deleted_at IS NULL
         GROUP BY patient_id
       ) inv ON inv.patient_id = p.id
       LEFT JOIN users u ON u.id = p.created_by
       WHERE p.id = $1 AND p.deleted_at IS NULL`,
      [id]
    );

    return result.rows[0] || null;
  }

  /**
   * Obtiene estadísticas generales de pacientes.
   * @returns {Promise<object>}
   */
  async getStats() {
    const result = await query(
      `SELECT
         COUNT(*) FILTER (WHERE is_active = TRUE AND deleted_at IS NULL) AS active_patients,
         COUNT(*) FILTER (WHERE deleted_at IS NULL) AS total_patients,
         COUNT(*) FILTER (
           WHERE deleted_at IS NULL
             AND created_at >= DATE_TRUNC('month', CURRENT_DATE)
         ) AS new_this_month,
         COUNT(*) FILTER (
           WHERE deleted_at IS NULL
             AND created_at >= DATE_TRUNC('week', CURRENT_DATE)
         ) AS new_this_week
       FROM patients`
    );

    return result.rows[0];
  }

  /**
   * Obtiene el historial médico de un paciente.
   * @param {number} patientId
   * @returns {Promise<Array>}
   */
  async getMedicalHistory(patientId) {
    const result = await query(
      `SELECT mh.*, u.first_name AS created_by_name, u.last_name AS created_by_lastname
       FROM medical_history mh
       LEFT JOIN users u ON u.id = mh.created_by
       WHERE mh.patient_id = $1 AND mh.deleted_at IS NULL
       ORDER BY mh.created_at DESC`,
      [patientId]
    );
    return result.rows;
  }

  /**
   * Obtiene el historial dental de un paciente.
   * @param {number} patientId
   * @returns {Promise<Array>}
   */
  async getDentalHistory(patientId) {
    const result = await query(
      `SELECT dh.*,
              doc.specialty,
              u.first_name AS doctor_name, u.last_name AS doctor_lastname
       FROM dental_history dh
       LEFT JOIN doctors doc ON doc.id = dh.doctor_id
       LEFT JOIN users u ON u.id = doc.user_id
       WHERE dh.patient_id = $1 AND dh.deleted_at IS NULL
       ORDER BY dh.created_at DESC`,
      [patientId]
    );
    return result.rows;
  }

  /**
   * Obtiene las citas de un paciente.
   * @param {number} patientId
   * @param {object} options - { limit, offset }
   * @returns {Promise<{ rows: Array, total: number }>}
   */
  async getAppointments(patientId, { limit = 20, offset = 0 } = {}) {
    const countResult = await query(
      `SELECT COUNT(*) AS total FROM appointments
       WHERE patient_id = $1 AND deleted_at IS NULL`,
      [patientId]
    );
    const total = parseInt(countResult.rows[0].total, 10);

    const dataResult = await query(
      `SELECT a.id, a.appointment_date, a.start_time, a.end_time,
              a.reason, a.notes, a.is_first_visit, a.created_at,
              ast.name AS status_name, ast.label AS status_label, ast.color AS status_color,
              u.first_name AS doctor_name, u.last_name AS doctor_lastname,
              doc.specialty
       FROM appointments a
       INNER JOIN appointment_status ast ON ast.id = a.status_id
       INNER JOIN doctors doc ON doc.id = a.doctor_id
       INNER JOIN users u ON u.id = doc.user_id
       WHERE a.patient_id = $1 AND a.deleted_at IS NULL
       ORDER BY a.appointment_date DESC, a.start_time DESC
       LIMIT $2 OFFSET $3`,
      [patientId, limit, offset]
    );

    return { rows: dataResult.rows, total };
  }

  /**
   * Obtiene los tratamientos de un paciente.
   * @param {number} patientId
   * @param {object} options - { limit, offset }
   * @returns {Promise<{ rows: Array, total: number }>}
   */
  async getTreatments(patientId, { limit = 20, offset = 0 } = {}) {
    const countResult = await query(
      `SELECT COUNT(*) AS total FROM treatments
       WHERE patient_id = $1 AND deleted_at IS NULL`,
      [patientId]
    );
    const total = parseInt(countResult.rows[0].total, 10);

    const dataResult = await query(
      `SELECT t.*, u.first_name AS doctor_name, u.last_name AS doctor_lastname
       FROM treatments t
       LEFT JOIN doctors doc ON doc.id = t.doctor_id
       LEFT JOIN users u ON u.id = doc.user_id
       WHERE t.patient_id = $1 AND t.deleted_at IS NULL
       ORDER BY t.created_at DESC
       LIMIT $2 OFFSET $3`,
      [patientId, limit, offset]
    );

    return { rows: dataResult.rows, total };
  }

  /**
   * Obtiene las imágenes de un paciente.
   * @param {number} patientId
   * @param {object} options - { limit, offset }
   * @returns {Promise<{ rows: Array, total: number }>}
   */
  async getImages(patientId, { limit = 20, offset = 0 } = {}) {
    const countResult = await query(
      `SELECT COUNT(*) AS total FROM patient_images
       WHERE patient_id = $1 AND deleted_at IS NULL`,
      [patientId]
    );
    const total = parseInt(countResult.rows[0].total, 10);

    const dataResult = await query(
      `SELECT pi.*, u.first_name AS uploaded_by_name, u.last_name AS uploaded_by_lastname
       FROM patient_images pi
       LEFT JOIN users u ON u.id = pi.uploaded_by
       WHERE pi.patient_id = $1 AND pi.deleted_at IS NULL
       ORDER BY pi.created_at DESC
       LIMIT $2 OFFSET $3`,
      [patientId, limit, offset]
    );

    return { rows: dataResult.rows, total };
  }

  /**
   * Obtiene las facturas de un paciente.
   * @param {number} patientId
   * @param {object} options - { limit, offset }
   * @returns {Promise<{ rows: Array, total: number }>}
   */
  async getInvoices(patientId, { limit = 20, offset = 0 } = {}) {
    const countResult = await query(
      `SELECT COUNT(*) AS total FROM invoices
       WHERE patient_id = $1 AND deleted_at IS NULL`,
      [patientId]
    );
    const total = parseInt(countResult.rows[0].total, 10);

    const dataResult = await query(
      `SELECT i.*
       FROM invoices i
       WHERE i.patient_id = $1 AND i.deleted_at IS NULL
       ORDER BY i.created_at DESC
       LIMIT $2 OFFSET $3`,
      [patientId, limit, offset]
    );

    return { rows: dataResult.rows, total };
  }
}

export default new PatientRepository();
