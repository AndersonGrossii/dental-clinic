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
              COALESCE(dbt.total_debit, 0)  AS total_debit,
              COALESCE(crd.total_credit, 0) AS total_credit,
              COALESCE(crd.total_credit, 0) - COALESCE(dbt.total_debit, 0) AS balance,
              GREATEST(0, COALESCE(pc.available_credit, 0)) AS available_credit
       FROM patients p
       LEFT JOIN (
         SELECT patient_id,
                SUM(debit_amount) AS total_debit
         FROM (
           SELECT pt.patient_id,
                  pt.price AS debit_amount
           FROM patient_treatments pt
           WHERE pt.status = 'completado' AND pt.deleted_at IS NULL

           UNION ALL

           SELECT q.patient_id,
                  qi.total * (1 + COALESCE(q.tax_rate, 0) / 100) AS debit_amount
           FROM quotation_items qi
           JOIN quotations q ON qi.quotation_id = q.id
           WHERE q.deleted_at IS NULL
             AND q.status IN ('aceptada', 'completada', 'parcial')
             AND (qi.status = 'aceptado' OR (qi.status IS NULL AND q.status IN ('aceptada', 'completada')))
             AND qi.execution_status = 'realizado'
             AND qi.patient_treatment_id IS NULL
         ) all_debts
         GROUP BY patient_id
       ) dbt ON dbt.patient_id = p.id
       LEFT JOIN (
         SELECT COALESCE(pay.patient_id, i.patient_id) AS patient_id,
                SUM(pay.amount - COALESCE(pay.credit_used, 0)) AS total_credit
         FROM payments pay
         LEFT JOIN invoices i ON pay.invoice_id = i.id
         WHERE pay.deleted_at IS NULL
         GROUP BY COALESCE(pay.patient_id, i.patient_id)
       ) crd ON crd.patient_id = p.id
       LEFT JOIN (
         SELECT patient_id,
                GREATEST(0, SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END)) AS available_credit
         FROM patient_credits
         WHERE deleted_at IS NULL
         GROUP BY patient_id
       ) pc ON pc.patient_id = p.id
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
      `SELECT p.*,
              COALESCE(dbt.total_debit, 0)  AS total_debit,
              COALESCE(crd.total_credit, 0) AS total_credit,
              COALESCE(crd.total_credit, 0) - COALESCE(dbt.total_debit, 0) AS balance,
              GREATEST(0, COALESCE(pc.available_credit, 0)) AS available_credit
       FROM patients p
       LEFT JOIN (
         SELECT patient_id,
                SUM(debit_amount) AS total_debit
         FROM (
           SELECT pt.patient_id,
                  pt.price AS debit_amount
           FROM patient_treatments pt
           WHERE pt.status = 'completado' AND pt.deleted_at IS NULL

           UNION ALL

           SELECT q.patient_id,
                  qi.total * (1 + COALESCE(q.tax_rate, 0) / 100) AS debit_amount
            FROM quotation_items qi
            JOIN quotations q ON qi.quotation_id = q.id
            WHERE q.deleted_at IS NULL
              AND q.status IN ('aceptada', 'completada', 'parcial')
              AND (qi.status = 'aceptado' OR (qi.status IS NULL AND q.status IN ('aceptada', 'completada')))
              AND qi.execution_status = 'realizado'
              AND qi.patient_treatment_id IS NULL
         ) all_debts
         GROUP BY patient_id
       ) dbt ON dbt.patient_id = p.id
       LEFT JOIN (
         SELECT COALESCE(pay.patient_id, i.patient_id) AS patient_id,
                SUM(pay.amount - COALESCE(pay.credit_used, 0)) AS total_credit
         FROM payments pay
         LEFT JOIN invoices i ON pay.invoice_id = i.id
         WHERE pay.deleted_at IS NULL
         GROUP BY COALESCE(pay.patient_id, i.patient_id)
       ) crd ON crd.patient_id = p.id
       LEFT JOIN (
         SELECT patient_id,
                GREATEST(0, SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END)) AS available_credit
         FROM patient_credits
         WHERE deleted_at IS NULL
         GROUP BY patient_id
       ) pc ON pc.patient_id = p.id
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
              COALESCE(dbt.total_debit, 0)  AS total_debit,
              COALESCE(crd.total_credit, 0) AS total_credit,
              COALESCE(crd.total_credit, 0) - COALESCE(dbt.total_debit, 0) AS balance,
              GREATEST(0, COALESCE(pc.available_credit, 0)) AS available_credit,
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
                 SUM(debit_amount) AS total_debit
          FROM (
            SELECT pt.patient_id,
                   pt.price AS debit_amount
            FROM patient_treatments pt
            WHERE pt.status = 'completado' AND pt.deleted_at IS NULL

            UNION ALL

            SELECT q.patient_id,
                   qi.total * (1 + COALESCE(q.tax_rate, 0) / 100) AS debit_amount
            FROM quotation_items qi
            JOIN quotations q ON qi.quotation_id = q.id
            WHERE q.deleted_at IS NULL
              AND q.status IN ('aceptada', 'completada', 'parcial')
              AND (qi.status = 'aceptado' OR (qi.status IS NULL AND q.status IN ('aceptada', 'completada')))
              AND qi.execution_status = 'realizado'
              AND qi.patient_treatment_id IS NULL
          ) all_debts
          GROUP BY patient_id
        ) dbt ON dbt.patient_id = p.id
       LEFT JOIN (
         SELECT COALESCE(pay.patient_id, i.patient_id) AS patient_id,
                SUM(pay.amount - COALESCE(pay.credit_used, 0)) AS total_credit
         FROM payments pay
         LEFT JOIN invoices i ON pay.invoice_id = i.id
         WHERE pay.deleted_at IS NULL
         GROUP BY COALESCE(pay.patient_id, i.patient_id)
       ) crd ON crd.patient_id = p.id
       LEFT JOIN (
         SELECT patient_id,
                GREATEST(0, SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END)) AS available_credit
         FROM patient_credits
         WHERE deleted_at IS NULL
         GROUP BY patient_id
       ) pc ON pc.patient_id = p.id
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
              COALESCE(dh.treatment, '') AS procedure_name,
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
   * Agrega una entrada al historial dental (diario clínico).
   */
  async addDentalHistory({ patient_id, doctor_id, tooth_number, procedure_name, treatment, condition, notes }) {
    const clinicId = this.getClinicId();
    const procValue = treatment || procedure_name || 'Procedimiento Odontológico';
    const condValue = condition || procValue || 'Tratamiento Realizado';

    try {
      const result = await query(
        `INSERT INTO dental_history (patient_id, doctor_id, tooth_number, treatment, condition, notes${clinicId ? ', clinic_id' : ''})
         VALUES ($1, $2, $3, $4, $5, $6${clinicId ? ', $7' : ''})
         RETURNING *, treatment AS procedure_name`,
        clinicId
          ? [patient_id, doctor_id || null, tooth_number || null, procValue, condValue, notes || null, clinicId]
          : [patient_id, doctor_id || null, tooth_number || null, procValue, condValue, notes || null]
      );
      return result.rows[0];
    } catch (err) {
      if (err.message && err.message.includes('column "condition"')) {
        await query(`ALTER TABLE dental_history ADD COLUMN IF NOT EXISTS condition VARCHAR(255) DEFAULT 'Tratamiento Realizado'`).catch(() => {});
        return this.addDentalHistory({ patient_id, doctor_id, tooth_number, procedure_name, treatment, condition, notes });
      }
      if (err.message && err.message.includes('column "treatment"')) {
        await query(`ALTER TABLE dental_history ADD COLUMN IF NOT EXISTS treatment VARCHAR(255) DEFAULT 'Procedimiento Odontológico'`).catch(() => {});
        return this.addDentalHistory({ patient_id, doctor_id, tooth_number, procedure_name, treatment, condition, notes });
      }
      throw err;
    }
  }

  /**
   * Actualiza una entrada del historial dental.
   */
  async updateDentalHistory(id, { tooth_number, procedure_name, treatment, condition, notes, doctor_id } = {}) {
    const clinicId = this.getClinicId();
    const setClauses = ['updated_at = NOW()'];
    const params = [id];

    if (tooth_number !== undefined) {
      params.push(tooth_number || null);
      setClauses.push(`tooth_number = $${params.length}`);
    }

    const procValue = treatment || procedure_name;
    if (procValue !== undefined) {
      params.push(procValue);
      setClauses.push(`treatment = $${params.length}`);
    }

    const condValue = condition || procValue;
    if (condValue !== undefined) {
      params.push(condValue);
      setClauses.push(`condition = $${params.length}`);
    }

    if (notes !== undefined) {
      params.push(notes || null);
      setClauses.push(`notes = $${params.length}`);
    }

    if (doctor_id !== undefined) {
      params.push(doctor_id ? Number(doctor_id) : null);
      setClauses.push(`doctor_id = $${params.length}`);
    }

    const conditions = ['id = $1', 'deleted_at IS NULL'];
    if (clinicId) {
      conditions.push(`clinic_id = $${params.length + 1}`);
      params.push(clinicId);
    }

    const result = await query(
      `UPDATE dental_history
       SET ${setClauses.join(', ')}
       WHERE ${conditions.join(' AND ')}
       RETURNING *, treatment AS procedure_name`,
      params
    );
    return result.rows[0] || null;
  }

  /**
   * Elimina una entrada del historial dental (soft delete).
   */
  async deleteDentalHistory(id) {
    const clinicId = this.getClinicId();
    const conditions = ['id = $1'];
    const params = [id];
    if (clinicId) {
      conditions.push(`clinic_id = $${params.length + 1}`);
      params.push(clinicId);
    }
    await query(
      `UPDATE dental_history SET deleted_at = NOW() WHERE ${conditions.join(' AND ')}`,
      params
    );
    return true;
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
              a.reason, a.notes, a.cancellation_reason, a.is_first_visit, a.created_at,
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
    const conditions = ['pt.patient_id = $1'];
    const params = [patientId];
    if (clinicId) {
      conditions.push(`pt.clinic_id = $${params.length + 1}`);
      params.push(clinicId);
    }
    const where = conditions.join(' AND ');

    const countResult = await query(
      `SELECT COUNT(*) AS total FROM patient_treatments pt
       WHERE ${where} AND pt.deleted_at IS NULL`,
      params
    );
    const total = parseInt(countResult.rows[0].total, 10);

    const dataResult = await query(
      `SELECT pt.*, t.name AS treatment_name, t.code AS treatment_code,
              tc.name AS category_name, tc.color AS category_color,
              u.first_name AS doctor_name, u.last_name AS doctor_lastname
       FROM patient_treatments pt
       INNER JOIN treatments t ON t.id = pt.treatment_id
       LEFT JOIN treatment_categories tc ON t.category_id = tc.id
       LEFT JOIN doctors doc ON doc.id = pt.doctor_id
       LEFT JOIN users u ON u.id = doc.user_id
       WHERE ${where} AND pt.deleted_at IS NULL
       ORDER BY pt.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
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

  /**
   * Obtiene las imágenes y radiografías de un paciente.
   * @param {number} patientId
   * @param {object} filters
   * @returns {Promise<Array>}
   */
  async getImages(patientId, { category, toothNumber } = {}) {
    const conditions = ['pi.patient_id = $1', 'pi.deleted_at IS NULL'];
    const params = [patientId];
    scopeClinic(conditions, params, 'pi');

    if (category) {
      params.push(category);
      conditions.push(`pi.category = $${params.length}`);
    }
    if (toothNumber) {
      params.push(toothNumber);
      conditions.push(`pi.tooth_number = $${params.length}`);
    }

    const sql = `
      SELECT pi.*,
             u.first_name AS uploader_first_name,
             u.last_name AS uploader_last_name
      FROM patient_images pi
      LEFT JOIN users u ON u.id = pi.uploaded_by
      WHERE ${conditions.join(' AND ')}
      ORDER BY pi.created_at DESC
    `;
    const result = await query(sql, params);
    return result.rows;
  }

  /**
   * Obtiene una imagen por su ID y paciente.
   * @param {number} patientId
   * @param {number} imageId
   * @returns {Promise<object|null>}
   */
  async getImageById(patientId, imageId) {
    const conditions = ['pi.id = $1', 'pi.patient_id = $2', 'pi.deleted_at IS NULL'];
    const params = [imageId, patientId];
    scopeClinic(conditions, params, 'pi');

    const result = await query(
      `SELECT pi.* FROM patient_images pi WHERE ${conditions.join(' AND ')}`,
      params
    );
    return result.rows[0] || null;
  }

  /**
   * Agrega una nueva imagen o radiografía.
   * @param {object} data
   * @returns {Promise<object>}
   */
  async addImage(data) {
    const clinicId = this.getClinicId();
    const result = await query(
      `INSERT INTO patient_images
        (patient_id, file_name, original_name, file_path, file_size, mime_type, category, description, tooth_number, uploaded_by, clinic_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        data.patientId,
        data.fileName,
        data.originalName,
        data.filePath,
        data.fileSize,
        data.mimeType,
        data.category || 'radiografia',
        data.description || null,
        data.toothNumber || null,
        data.uploadedBy || null,
        clinicId || 1
      ]
    );
    return result.rows[0];
  }

  /**
   * Elimina una imagen (soft delete).
   * @param {number} patientId
   * @param {number} imageId
   * @returns {Promise<object|null>}
   */
  async deleteImage(patientId, imageId) {
    const conditions = ['id = $1', 'patient_id = $2', 'deleted_at IS NULL'];
    const params = [imageId, patientId];
    const clinicId = this.getClinicId();
    if (clinicId) {
      params.push(clinicId);
      conditions.push(`clinic_id = $${params.length}`);
    }

    const result = await query(
      `UPDATE patient_images SET deleted_at = NOW() WHERE ${conditions.join(' AND ')} RETURNING *`,
      params
    );
    return result.rows[0] || null;
  }

  /**
   * Obtiene los documentos clínicos de un paciente con paginación.
   * @param {number} patientId
   * @param {object} options
   * @returns {Promise<{ rows: Array, total: number }>}
   */
  async getDocuments(patientId, { category, limit = 20, offset = 0 } = {}) {
    const conditions = ['d.patient_id = $1', 'd.deleted_at IS NULL'];
    const params = [patientId];
    scopeClinic(conditions, params, 'd');

    if (category) {
      params.push(category);
      conditions.push(`d.category = $${params.length}`);
    }

    const countResult = await query(
      `SELECT COUNT(*) AS total FROM documents d WHERE ${conditions.join(' AND ')}`,
      params
    );
    const total = parseInt(countResult.rows[0].total, 10);

    const dataParams = [...params];
    dataParams.push(limit);
    const limitPlaceholder = `$${dataParams.length}`;
    dataParams.push(offset);
    const offsetPlaceholder = `$${dataParams.length}`;

    const dataResult = await query(
      `SELECT d.*,
              u.first_name AS uploader_first_name,
              u.last_name AS uploader_last_name
       FROM documents d
       LEFT JOIN users u ON u.id = d.uploaded_by
       WHERE ${conditions.join(' AND ')}
       ORDER BY d.created_at DESC
       LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`,
      dataParams
    );

    return { rows: dataResult.rows, total };
  }

  /**
   * Obtiene un documento por su ID y paciente.
   * @param {number} patientId
   * @param {number} docId
   * @returns {Promise<object|null>}
   */
  async getDocumentById(patientId, docId) {
    const conditions = ['d.id = $1', 'd.patient_id = $2', 'd.deleted_at IS NULL'];
    const params = [docId, patientId];
    scopeClinic(conditions, params, 'd');

    const result = await query(
      `SELECT d.* FROM documents d WHERE ${conditions.join(' AND ')}`,
      params
    );
    return result.rows[0] || null;
  }

  /**
   * Agrega un nuevo documento clínico.
   * @param {object} data
   * @returns {Promise<object>}
   */
  async addDocument(data) {
    const clinicId = this.getClinicId();
    const result = await query(
      `INSERT INTO documents
        (patient_id, file_name, original_name, file_path, file_size, mime_type, category, description, uploaded_by, clinic_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        data.patientId,
        data.fileName,
        data.originalName,
        data.filePath,
        data.fileSize,
        data.mimeType,
        data.category || 'otro',
        data.description || null,
        data.uploadedBy || null,
        clinicId || 1
      ]
    );
    return result.rows[0];
  }

  /**
   * Elimina un documento clínico (soft delete).
   * @param {number} patientId
   * @param {number} docId
   * @returns {Promise<object|null>}
   */
  async deleteDocument(patientId, docId) {
    const conditions = ['id = $1', 'patient_id = $2', 'deleted_at IS NULL'];
    const params = [docId, patientId];
    const clinicId = this.getClinicId();
    if (clinicId) {
      params.push(clinicId);
      conditions.push(`clinic_id = $${params.length}`);
    }

    const result = await query(
      `UPDATE documents SET deleted_at = NOW() WHERE ${conditions.join(' AND ')} RETURNING *`,
      params
    );
    return result.rows[0] || null;
  }
}

export default new PatientRepository();

