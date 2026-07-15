// ============================================
// Repositorio de Cotizaciones
// ============================================
import { query, transaction, scopeClinic, als } from '../database/pool.js';
import { BaseRepository } from './base.repository.js';

class QuotationRepository extends BaseRepository {
  constructor() {
    super('quotations');
  }

  async findAllWithDetails({ limit = 20, offset = 0, sortBy = 'q.created_at', sortOrder = 'DESC', filters = {} } = {}) {
    const conditions = ['q.deleted_at IS NULL'];
    const params = [];
    scopeClinic(conditions, params, 'q');
    let paramIndex = params.length + 1;

    if (filters.status) {
      conditions.push(`q.status = $${paramIndex}`);
      params.push(filters.status);
      paramIndex++;
    }

    if (filters.patient_id) {
      conditions.push(`q.patient_id = $${paramIndex}`);
      params.push(filters.patient_id);
      paramIndex++;
    }

    if (filters.date_from) {
      conditions.push(`q.quotation_date >= $${paramIndex}`);
      params.push(filters.date_from);
      paramIndex++;
    }

    if (filters.date_to) {
      conditions.push(`q.quotation_date <= $${paramIndex}`);
      params.push(filters.date_to);
      paramIndex++;
    }

    if (filters.search) {
      conditions.push(`(q.quote_number ILIKE $${paramIndex} OR p.first_name ILIKE $${paramIndex} OR p.last_name ILIKE $${paramIndex})`);
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const safeSortBy = /^[a-zA-Z_.]+$/.test(sortBy) ? sortBy : 'q.created_at';
    const safeSortOrder = sortOrder === 'ASC' ? 'ASC' : 'DESC';

    const countResult = await query(
      `SELECT COUNT(*) AS total
       FROM quotations q
       INNER JOIN patients p ON q.patient_id = p.id
       LEFT JOIN doctors d ON q.doctor_id = d.id
       LEFT JOIN users u ON d.user_id = u.id
       ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total, 10);

    const dataResult = await query(
      `SELECT q.*,
              CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
              p.dni AS patient_dni,
              CONCAT(u.first_name, ' ', u.last_name) AS doctor_name,
              inv.id AS invoice_id
       FROM quotations q
       INNER JOIN patients p ON q.patient_id = p.id
       LEFT JOIN doctors d ON q.doctor_id = d.id
       LEFT JOIN users u ON d.user_id = u.id
       LEFT JOIN invoices inv ON inv.quotation_id = q.id AND inv.deleted_at IS NULL
       ${whereClause}
       ORDER BY ${safeSortBy} ${safeSortOrder}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    return { rows: dataResult.rows, total };
  }

  async findByIdWithItems(id) {
    const conditions = ['q.deleted_at IS NULL'];
    const params = [];
    scopeClinic(conditions, params, 'q');
    const whereClause = `WHERE ${conditions.join(' AND ')} AND q.id = $${params.length + 1}`;
    params.push(id);

    const quotationResult = await query(
      `SELECT q.*,
              CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
              p.dni AS patient_dni,
              p.email AS patient_email,
              p.phone AS patient_phone,
              CONCAT(u.first_name, ' ', u.last_name) AS doctor_name
       FROM quotations q
       INNER JOIN patients p ON q.patient_id = p.id
       LEFT JOIN doctors d ON q.doctor_id = d.id
       LEFT JOIN users u ON d.user_id = u.id
       ${whereClause}`,
      params
    );

    if (quotationResult.rows.length === 0) return null;

    const itemConditions = ['qi.quotation_id = $1'];
    const itemParams = [id];
    scopeClinic(itemConditions, itemParams, 'qi');

    const itemsResult = await query(
      `SELECT qi.*,
              t.name AS treatment_name,
              t.code AS treatment_code
       FROM quotation_items qi
       LEFT JOIN treatments t ON qi.treatment_id = t.id
       WHERE ${itemConditions.join(' AND ')}
       ORDER BY qi.id ASC`,
      itemParams
    );

    return {
      ...quotationResult.rows[0],
      items: itemsResult.rows,
    };
  }

  async generateNumber() {
    const store = als.getStore();
    let clinicSuffix = '';
    if (store?.clinicId) {
      const codeResult = await query('SELECT code FROM clinics WHERE id = $1', [store.clinicId]);
      if (codeResult.rows.length > 0) {
        clinicSuffix = '-' + codeResult.rows[0].code;
      }
    }
    const result = await query("SELECT nextval('quotation_number_seq') AS seq");
    const seq = result.rows[0].seq.toString().padStart(4, '0');
    return `COT-${seq}${clinicSuffix}`;
  }

  async createWithItems(quotationData, items) {
    return transaction(async (client) => {
      const store = als.getStore();
      const clinicId = store?.clinicId;
      const dataWithClinic = { ...quotationData, clinic_id: clinicId };

      const quotationKeys = Object.keys(dataWithClinic);
      const quotationValues = Object.values(dataWithClinic);
      const quotationPlaceholders = quotationKeys.map((_, i) => `$${i + 1}`);

      const quotationResult = await client.query(
        `INSERT INTO quotations (${quotationKeys.join(', ')})
         VALUES (${quotationPlaceholders.join(', ')})
         RETURNING *`,
        quotationValues
      );

      const quotation = quotationResult.rows[0];
      const insertedItems = [];

      for (const item of items) {
        const clinicId = store?.clinicId;
      const itemResult = await client.query(
          `INSERT INTO quotation_items (quotation_id, treatment_id, description, quantity, unit_price, discount, total${clinicId ? ', clinic_id' : ''})
           VALUES ($1, $2, $3, $4, $5, $6, $7${clinicId ? ', $8' : ''})
           RETURNING *`,
          clinicId
            ? [quotation.id, item.treatment_id || null, item.description, item.quantity, item.unit_price, item.discount || 0, item.total, clinicId]
            : [quotation.id, item.treatment_id || null, item.description, item.quantity, item.unit_price, item.discount || 0, item.total]
        );
        insertedItems.push(itemResult.rows[0]);
      }

      return { ...quotation, items: insertedItems };
    });
  }

  async updateWithItems(id, quotationData, items) {
    return transaction(async (client) => {
      const store = als.getStore();
      const clinicId = store?.clinicId;

      const keys = Object.keys(quotationData);
      const values = Object.values(quotationData);
      const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');

      const conditions = [`id = $${keys.length + 1}`, 'deleted_at IS NULL'];
      const updateParams = [...values, id];
      if (clinicId) {
        conditions.push(`clinic_id = $${updateParams.length + 1}`);
        updateParams.push(clinicId);
      }

      const quotationResult = await client.query(
        `UPDATE quotations
         SET ${setClause}, updated_at = NOW()
         WHERE ${conditions.join(' AND ')}
         RETURNING *`,
        updateParams
      );

      if (quotationResult.rows.length === 0) return null;

      const delConditions = ['quotation_id = $1'];
      const delParams = [id];
      if (clinicId) {
        delConditions.push(`clinic_id = $${delParams.length + 1}`);
        delParams.push(clinicId);
      }
      await client.query(`DELETE FROM quotation_items WHERE ${delConditions.join(' AND ')}`, delParams);

      const insertedItems = [];
      for (const item of items) {
        const itemResult = await client.query(
          `INSERT INTO quotation_items (quotation_id, treatment_id, description, quantity, unit_price, discount, total${clinicId ? ', clinic_id' : ''})
           VALUES ($1, $2, $3, $4, $5, $6, $7${clinicId ? ', $8' : ''})
           RETURNING *`,
          clinicId
            ? [id, item.treatment_id || null, item.description, item.quantity, item.unit_price, item.discount || 0, item.total, clinicId]
            : [id, item.treatment_id || null, item.description, item.quantity, item.unit_price, item.discount || 0, item.total]
        );
        insertedItems.push(itemResult.rows[0]);
      }

      return { ...quotationResult.rows[0], items: insertedItems };
    });
  }
}

export default new QuotationRepository();
