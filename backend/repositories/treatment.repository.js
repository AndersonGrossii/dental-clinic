// ============================================
// Repositorio de Tratamientos — Operaciones de datos
// ============================================
import { query, scopeClinic, als } from '../database/pool.js';
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
  async findAllWithCategory({ limit = 100, offset = 0, sortBy = 't.name', sortOrder = 'ASC', filters = {} } = {}) {
    const conditions = ['t.deleted_at IS NULL'];
    const params = [];
    scopeClinic(conditions, params, 't');
    let paramIndex = params.length + 1;

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
    const conditions = ['pt.patient_id = $1', "pt.status = 'completado'", 'pt.deleted_at IS NULL'];
    const params = [patientId];
    scopeClinic(conditions, params, 'pt');

     const result = await query(
      `SELECT
         pt.id,
         pt.patient_id,
         pt.treatment_id,
         pt.doctor_id,
         pt.appointment_id,
         pt.tooth_number,
         pt.price,
         pt.tax_rate,
         pt.status,
         pt.notes,
         pt.start_date,
         pt.end_date,
         pt.created_at,
         pt.updated_at,
         pt.invoice_id,
         inv.invoice_number,
         inv.status AS invoice_status,
         inv.total AS invoice_total,
         inv.amount_paid AS invoice_amount_paid,
         inv.balance AS invoice_balance,
         t.name AS treatment_name,
         t.code AS treatment_code,
         tc.name AS category_name,
         tc.color AS category_color,
         CONCAT(u.first_name, ' ', u.last_name) AS doctor_name,
         d.specialty AS doctor_specialty,
         qi.id AS quotation_item_id,
         q.quote_number,
         (qi.id IS NOT NULL OR pt.notes ILIKE '%Presupuesto%') AS is_from_quotation,
         COALESCE(
           (
             SELECT json_agg(sub) FROM (
                SELECT
                  inv2.id,
                  inv2.invoice_number,
                  COALESCE(inv2.document_type, 'factura') AS document_type,
                  inv2.status,
                  inv2.total,
                  inv2.amount_paid,
                  inv2.balance,
                  inv2.created_at,
                  inv2.tax_rate,
                  SUM(ii.total) AS item_total
               FROM invoice_items ii
               JOIN invoices inv2 ON ii.invoice_id = inv2.id
               WHERE (ii.patient_treatment_id = pt.id
                      OR (pt.invoice_id = inv2.id AND ii.patient_treatment_id IS NULL AND ii.treatment_id = pt.treatment_id))
                 AND inv2.deleted_at IS NULL
                 AND inv2.status != 'cancelada'
               GROUP BY inv2.id
               ORDER BY inv2.created_at ASC
             ) sub
           ),
           '[]'::json
         ) AS linked_documents
       FROM patient_treatments pt
       INNER JOIN treatments t ON pt.treatment_id = t.id
       LEFT JOIN treatment_categories tc ON t.category_id = tc.id
       LEFT JOIN doctors d ON pt.doctor_id = d.id
       LEFT JOIN users u ON d.user_id = u.id
       LEFT JOIN invoices inv ON pt.invoice_id = inv.id
       LEFT JOIN quotation_items qi ON qi.patient_treatment_id = pt.id
       LEFT JOIN quotations q ON qi.quotation_id = q.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY pt.created_at DESC`,
      params
    );

    return result.rows.map(row => {
      const docs = Array.isArray(row.linked_documents) ? row.linked_documents : [];
      const uniqueDocs = docs.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

      const storedTaxRate = parseFloat(row.tax_rate || 0);
      const treatmentBasePrice = parseFloat(row.price || 0);
      const treatmentTaxAmount = parseFloat((treatmentBasePrice * (storedTaxRate / 100)).toFixed(2));
      const treatmentTaxedTotal = parseFloat((treatmentBasePrice + treatmentTaxAmount).toFixed(2));

      // Total pagado por los items pertenecientes a este tratamiento.
      // ii.total guarda el monto NETO por item; el bruto = neto * (1 + tasa_del_documento/100).
      const totalPaidGross = uniqueDocs.reduce((sum, d) => {
        const docTax = parseFloat(d.tax_rate || 0);
        const net = parseFloat(d.item_total || 0);
        const gross = docTax > 0 ? net * (1 + docTax / 100.0) : net;
        return sum + parseFloat(gross.toFixed(2));
      }, 0);
      const remaining = Math.max(0, parseFloat((treatmentTaxedTotal - totalPaidGross).toFixed(2)));

      let computedStatus = 'pendiente';
      if (remaining <= 0 && uniqueDocs.length > 0) {
        computedStatus = 'pagada';
      } else if (totalPaidGross > 0) {
        computedStatus = 'parcial';
      }

      const latestDoc = uniqueDocs.length > 0 ? uniqueDocs[uniqueDocs.length - 1] : null;

      return {
        ...row,
        tax_rate: storedTaxRate,
        taxed_total: treatmentTaxedTotal,
        linked_documents: uniqueDocs,
        total_paid_amount: totalPaidGross,
        remaining_balance: remaining,
        invoice_status: computedStatus,
        invoice_id: latestDoc ? latestDoc.id : row.invoice_id,
        invoice_number: latestDoc ? latestDoc.invoice_number : row.invoice_number,
        invoice_balance: remaining,
      };
    });
  }

  /**
   * Registra un tratamiento realizado a un paciente.
   * @param {object} data - Datos del tratamiento del paciente
   * @returns {Promise<object>}
   */
  async createPatientTreatment(data) {
    const keys = Object.keys(data);
    const values = Object.values(data);

    const store = als.getStore();
    const clinicId = store?.clinicId;
    if (clinicId) {
      keys.push('clinic_id');
      values.push(clinicId);
    }

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

    const conditions = [`id = $${keys.length + 1}`, 'deleted_at IS NULL'];
    const params = [...values, id];
    scopeClinic(conditions, params);

    const result = await query(
      `UPDATE patient_treatments
       SET ${setClause}, updated_at = NOW()
       WHERE ${conditions.join(' AND ')}
       RETURNING *`,
      params
    );
    return result.rows[0] || null;
  }

  /**
   * Busca un tratamiento de paciente por su ID.
   * @param {number} id - ID del registro patient_treatments
   * @returns {Promise<object|null>}
   */
  async findPatientTreatmentById(id) {
    const conditions = ['pt.id = $1', 'pt.deleted_at IS NULL'];
    const params = [id];
    scopeClinic(conditions, params, 'pt');

    const result = await query(
      `SELECT pt.*, inv.status AS invoice_status, inv.amount_paid AS invoice_amount_paid,
              qi.id AS quotation_item_id,
              (qi.id IS NOT NULL OR pt.notes ILIKE '%Presupuesto%') AS is_from_quotation
       FROM patient_treatments pt
       LEFT JOIN invoices inv ON pt.invoice_id = inv.id
       LEFT JOIN quotation_items qi ON qi.patient_treatment_id = pt.id
       WHERE ${conditions.join(' AND ')}`,
      params
    );
    return result.rows[0] || null;
  }

  /**
   * Elimina suavemente un tratamiento de paciente.
   * @param {number} id - ID del registro patient_treatments
   * @returns {Promise<object|null>}
   */
  async deletePatientTreatment(id) {
    const conditions = ['id = $1', 'deleted_at IS NULL'];
    const params = [id];
    scopeClinic(conditions, params);

    const result = await query(
      `UPDATE patient_treatments
       SET deleted_at = NOW(), updated_at = NOW()
       WHERE ${conditions.join(' AND ')}
       RETURNING *`,
      params
    );
    return result.rows[0] || null;
  }
}

export default new TreatmentRepository();
