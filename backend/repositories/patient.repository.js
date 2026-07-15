// ============================================
// Repositorio de Pacientes
// ============================================
import { BaseRepository } from './base.repository.js';
import { query, scopeClinic } from '../database/pool.js';

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

    // Aplicar filtro por clínica
    scopeClinic(conditions, params, 'p');

    let paramIndex = params.length + 1;

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

    const conditions = ['p.deleted_at IS NULL'];
    const params = [];
    scopeClinic(conditions, params, 'p');

    const searchClause = `(
      p.first_name ILIKE $${params.length + 1}
      OR p.last_name ILIKE $${params.length + 1}
      OR CONCAT(p.first_name, ' ', p.last_name) ILIKE $${params.length + 1}
      OR p.dni ILIKE $${params.length + 1}
      OR p.phone ILIKE $${params.length + 1}
      OR p.mobile ILIKE $${params.length + 1}
      OR p.email ILIKE $${params.length + 1}
      OR p.custom_id ILIKE $${params.length + 1}
    )`;
    conditions.push(searchClause);
    params.push(searchPattern);

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await query(
      `SELECT COUNT(*) AS total FROM patients p ${whereClause}`,
      params
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
       ${whereClause}
       ORDER BY p.last_name ASC, p.first_name ASC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    return { rows: dataResult.rows, total };
  }

  /**
   * Obtiene un paciente con conteos de historial médico y dental.
   * @param {number} id - ID del paciente
   * @returns {Promise<object|null>}
   */
  async findWithHistory(id) {
    const conditions = ['p.id = $1', 'p.deleted_at IS NULL'];
    const params = [id];
    scopeClinic(conditions, params, 'p');
    const whereClause = `WHERE ${conditions.join(' AND ')}`;

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
       ${whereClause}`,
      params
    );

    return result.rows[0] || null;
  }

  /**
   * Obtiene estadísticas generales de pacientes.
   * @returns {Promise<object>}
   */
  async getStats() {
    const conditions = ['deleted_at IS NULL'];
    const params = [];
    scopeClinic(conditions, params);
    const clinicFilter = conditions.join(' AND ');

    const result = await query(
      `SELECT
         COUNT(*) FILTER (WHERE is_active = TRUE AND ${clinicFilter}) AS active_patients,
         COUNT(*) FILTER (WHERE ${clinicFilter}) AS total_patients,
         COUNT(*) FILTER (
           WHERE ${clinicFilter}
             AND created_at >= DATE_TRUNC('month', CURRENT_DATE)
         ) AS new_this_month,
         COUNT(*) FILTER (
           WHERE ${clinicFilter}
             AND created_at >= DATE_TRUNC('week', CURRENT_DATE)
         ) AS new_this_week
       FROM patients`,
      params
    );

    return result.rows[0];
  }

  /**
   * Obtiene el historial médico de un paciente.
   * @param {number} patientId
   * @returns {Promise<Array>}
   */
  async getMedicalHistory(patientId) {
    const clinicId = this.getClinicId();
    const conditions = ['mh.patient_id = $1'];
    const params = [patientId];
    if (clinicId) {
      conditions.push(`mh.clinic_id = $${params.length + 1}`);
      params.push(clinicId);
    }
    const result = await query(
      `SELECT mh.*, u.first_name AS created_by_name, u.last_name AS created_by_lastname
       FROM medical_history mh
       LEFT JOIN users u ON u.id = mh.created_by
       WHERE ${conditions.join(' AND ')} AND mh.deleted_at IS NULL
       ORDER BY mh.created_at DESC`,
      params
    );
    return result.rows;
  }

  /**
   * Obtiene el historial dental de un paciente.
   * @param {number} patientId
   * @returns {Promise<Array>}
   */
  async getDentalHistory(patientId) {
    const clinicId = this.getClinicId();
    const conditions = ['dh.patient_id = $1'];
    const params = [patientId];
    if (clinicId) {
      conditions.push(`dh.clinic_id = $${params.length + 1}`);
      params.push(clinicId);
    }
    const result = await query(
      `SELECT dh.*,
              doc.specialty,
              u.first_name AS doctor_name, u.last_name AS doctor_lastname
       FROM dental_history dh
       LEFT JOIN doctors doc ON doc.id = dh.doctor_id
       LEFT JOIN users u ON u.id = doc.user_id
       WHERE ${conditions.join(' AND ')} AND dh.deleted_at IS NULL
       ORDER BY dh.created_at DESC`,
      params
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
    const clinicId = this.getClinicId();
    const conditions = ['patient_id = $1'];
    const params = [patientId];
    if (clinicId) {
      conditions.push(`clinic_id = $${params.length + 1}`);
      params.push(clinicId);
    }
    const where = conditions.join(' AND ');

    const countResult = await query(
      `SELECT COUNT(*) AS total FROM appointments
       WHERE ${where} AND deleted_at IS NULL`,
      params
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
      clinicId
        ? [patientId, clinicId, limit, offset]
        : [patientId, limit, offset]
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
    const clinicId = this.getClinicId();
    const conditions = ['patient_id = $1'];
    const params = [patientId];
    if (clinicId) {
      conditions.push(`clinic_id = $${params.length + 1}`);
      params.push(clinicId);
    }
    const where = conditions.join(' AND ');

    const countResult = await query(
      `SELECT COUNT(*) AS total FROM treatments
       WHERE ${where} AND deleted_at IS NULL`,
      params
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
      clinicId
        ? [patientId, clinicId, limit, offset]
        : [patientId, limit, offset]
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
    const clinicId = this.getClinicId();
    const conditions = ['patient_id = $1'];
    const params = [patientId];
    if (clinicId) {
      conditions.push(`clinic_id = $${params.length + 1}`);
      params.push(clinicId);
    }
    const where = conditions.join(' AND ');

    const countResult = await query(
      `SELECT COUNT(*) AS total FROM patient_images
       WHERE ${where} AND deleted_at IS NULL`,
      params
    );
    const total = parseInt(countResult.rows[0].total, 10);

    const dataResult = await query(
      `SELECT pi.*, u.first_name AS uploaded_by_name, u.last_name AS uploaded_by_lastname
       FROM patient_images pi
       LEFT JOIN users u ON u.id = pi.uploaded_by
       WHERE pi.patient_id = $1 AND pi.deleted_at IS NULL
       ORDER BY pi.created_at DESC
       LIMIT $2 OFFSET $3`,
      clinicId
        ? [patientId, clinicId, limit, offset]
        : [patientId, limit, offset]
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
    const clinicId = this.getClinicId();
    const conditions = ['patient_id = $1'];
    const params = [patientId];
    if (clinicId) {
      conditions.push(`clinic_id = $${params.length + 1}`);
      params.push(clinicId);
    }
    const where = conditions.join(' AND ');

    const countResult = await query(
      `SELECT COUNT(*) AS total FROM invoices
       WHERE ${where} AND deleted_at IS NULL`,
      params
    );
    const total = parseInt(countResult.rows[0].total, 10);

    const dataResult = await query(
      `SELECT i.*
       FROM invoices i
       WHERE i.patient_id = $1 AND i.deleted_at IS NULL
       ORDER BY i.created_at DESC
       LIMIT $2 OFFSET $3`,
      clinicId
        ? [patientId, clinicId, limit, offset]
        : [patientId, limit, offset]
    );

    return { rows: dataResult.rows, total };
  }

  /**
   * Obtiene las notas de evolución clínica de un paciente.
   * @param {number} patientId
   * @returns {Promise<Array>}
   */
  async getNotes(patientId) {
    const clinicId = this.getClinicId();
    const conditions = ['n.patient_id = $1'];
    const params = [patientId];
    if (clinicId) {
      conditions.push(`n.clinic_id = $${params.length + 1}`);
      params.push(clinicId);
    }
    const result = await query(
      `SELECT n.*,
              u.first_name AS author_name, u.last_name AS author_lastname,
              r.name AS author_role
       FROM patient_notes n
       INNER JOIN users u ON u.id = n.user_id
       INNER JOIN roles r ON u.role_id = r.id
       WHERE ${conditions.join(' AND ')} AND n.deleted_at IS NULL
       ORDER BY n.created_at DESC`,
      params
    );
    return result.rows;
  }

  /**
   * Crea una nueva nota de evolución clínica para un paciente.
   * @param {number} patientId
   * @param {number} userId
   * @param {string} title
   * @param {string} content
   * @param {string} type
   * @returns {Promise<object>}
   */
  async createNote(patientId, userId, title, content, type = 'clinica') {
    const clinicId = this.getClinicId();
    const result = await query(
      `INSERT INTO patient_notes (patient_id, user_id, title, content, type${clinicId ? ', clinic_id' : ''})
       VALUES ($1, $2, $3, $4, $5${clinicId ? ', $6' : ''})
       RETURNING *`,
      clinicId
        ? [patientId, userId, title, content, type, clinicId]
        : [patientId, userId, title, content, type]
    );
    return result.rows[0];
  }
}

export default new PatientRepository();
