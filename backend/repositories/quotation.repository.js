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
        const itemStatus = item.status || 'pendiente';
        const itemResult = await client.query(
          `INSERT INTO quotation_items (quotation_id, treatment_id, description, quantity, unit_price, discount, total, status${clinicId ? ', clinic_id' : ''})
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8${clinicId ? ', $9' : ''})
           RETURNING *`,
          clinicId
            ? [quotation.id, item.treatment_id || null, item.description, item.quantity, item.unit_price, item.discount || 0, item.total, itemStatus, clinicId]
            : [quotation.id, item.treatment_id || null, item.description, item.quantity, item.unit_price, item.discount || 0, item.total, itemStatus]
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
        const itemStatus = item.status || 'pendiente';
        const itemResult = await client.query(
          `INSERT INTO quotation_items (quotation_id, treatment_id, description, quantity, unit_price, discount, total, status${clinicId ? ', clinic_id' : ''})
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8${clinicId ? ', $9' : ''})
           RETURNING *`,
          clinicId
            ? [id, item.treatment_id || null, item.description, item.quantity, item.unit_price, item.discount || 0, item.total, itemStatus, clinicId]
            : [id, item.treatment_id || null, item.description, item.quantity, item.unit_price, item.discount || 0, item.total, itemStatus]
        );
        insertedItems.push(itemResult.rows[0]);
      }

      return { ...quotationResult.rows[0], items: insertedItems };
    });
  }

  async findItemById(itemId) {
    const result = await query(
      `SELECT * FROM quotation_items WHERE id = $1`,
      [itemId]
    );
    return result.rows[0] || null;
  }

  async markItemsInvoiced(itemIds, invoiceId) {
    if (!Array.isArray(itemIds) || itemIds.length === 0) return;
    await query(
      `UPDATE quotation_items SET invoice_id = $1, status = 'aceptado' WHERE id = ANY($2::int[])`,
      [invoiceId, itemIds]
    );
  }

  async updateItemStatus(itemId, status) {
    const result = await query(
      `UPDATE quotation_items SET status = $1 WHERE id = $2 RETURNING *`,
      [status, itemId]
    );
    if (result.rows.length === 0) return null;
    const item = result.rows[0];
    await this.recalculateQuotationStatus(item.quotation_id);
    return item;
  }

  async acceptAllItems(quotationId) {
    return transaction(async (client) => {
      await client.query(
        `UPDATE quotation_items SET status = 'aceptado' WHERE quotation_id = $1`,
        [quotationId]
      );
      await client.query(
        `UPDATE quotations SET status = 'aceptada', updated_at = NOW() WHERE id = $1`,
        [quotationId]
      );
      return true;
    });
  }

  async updateItemsStatusBulk(quotationId, itemsStatusList) {
    return transaction(async (client) => {
      for (const { id, status } of itemsStatusList) {
        await client.query(
          `UPDATE quotation_items SET status = $1 WHERE id = $2 AND quotation_id = $3`,
          [status, id, quotationId]
        );
      }
      await this.recalculateQuotationStatus(quotationId, client);
      return true;
    });
  }

  async recalculateQuotationStatus(quotationId, dbClient = null) {
    const runQuery = dbClient ? dbClient.query.bind(dbClient) : query;
    const itemsResult = await runQuery(
      `SELECT status FROM quotation_items WHERE quotation_id = $1`,
      [quotationId]
    );

    if (itemsResult.rows.length === 0) return;

    const statuses = itemsResult.rows.map(r => r.status || 'pendiente');
    const allAccepted = statuses.every(s => s === 'aceptado');
    const allRejected = statuses.every(s => s === 'rechazado');
    const someAccepted = statuses.some(s => s === 'aceptado');

    let newStatus = 'enviada';
    if (allAccepted) {
      newStatus = 'aceptada';
    } else if (allRejected) {
      newStatus = 'rechazada';
    } else if (someAccepted) {
      newStatus = 'parcial';
    }

    await runQuery(
      `UPDATE quotations SET status = $1, updated_at = NOW() WHERE id = $2`,
      [newStatus, quotationId]
    );
  }

    async getAcceptedItemsByPatient(patientId) {
    const queryStr = `
      SELECT 
        qi.id,
        qi.description,
        qi.quantity,
        qi.unit_price,
        qi.total,
        qi.tooth_number,
        qi.execution_status,
        qi.created_at,
        q.quote_number,
        q.doctor_id,
        q.clinic_id,
        q.tax_rate AS quote_tax_rate,
        d.first_name AS doctor_first_name,
        d.last_name AS doctor_last_name,
        t.name AS catalog_treatment_name,
        false AS is_patient_treatment
      FROM quotation_items qi
      JOIN quotations q ON qi.quotation_id = q.id
      LEFT JOIN doctors doc ON q.doctor_id = doc.id
      LEFT JOIN users d ON doc.user_id = d.id
      LEFT JOIN treatments t ON qi.treatment_id = t.id
      WHERE q.patient_id = $1
        AND (qi.status = 'aceptado' OR q.status = 'aceptada')
        AND COALESCE(qi.execution_status, 'pendiente') != 'realizado'
        AND q.deleted_at IS NULL

      UNION ALL

      SELECT 
        pt.id,
        COALESCE(t.name, 'Tratamiento') AS description,
        1 AS quantity,
        pt.price AS unit_price,
        pt.price AS total,
        pt.tooth_number,
        CASE 
          WHEN pt.status = 'completado' THEN 'realizado'
          WHEN pt.status = 'en_progreso' THEN 'en_proceso'
          ELSE 'pendiente'
        END AS execution_status,
        pt.created_at,
        COALESCE(i.invoice_number, 'Cobro Directo') AS quote_number,
        pt.doctor_id,
        pt.clinic_id,
        COALESCE(pt.tax_rate, 0) AS quote_tax_rate,
        d.first_name AS doctor_first_name,
        d.last_name AS doctor_last_name,
        t.name AS catalog_treatment_name,
        true AS is_patient_treatment
      FROM patient_treatments pt
      LEFT JOIN treatments t ON pt.treatment_id = t.id
      LEFT JOIN invoices i ON pt.invoice_id = i.id
      LEFT JOIN doctors doc ON pt.doctor_id = doc.id
      LEFT JOIN users d ON doc.user_id = d.id
      WHERE pt.patient_id = $1
        AND pt.status IN ('pendiente', 'en_progreso')
        AND pt.deleted_at IS NULL

      ORDER BY created_at DESC
    `;
    const result = await query(queryStr, [patientId]);
    return result.rows;
  }

  async updateExecutionStatus(itemId, executionStatus, userId) {
    return transaction(async (client) => {
      const itemRes = await client.query(
        `SELECT qi.*, q.patient_id, q.doctor_id AS quote_doctor_id, q.tax_rate AS quote_tax_rate, 
                q.discount_percentage AS quote_discount_pct, q.discount_amount AS quote_discount_amt,
                q.quote_number, q.clinic_id
         FROM quotation_items qi
         JOIN quotations q ON qi.quotation_id = q.id
         WHERE qi.id = $1`,
        [itemId]
      );
      if (itemRes.rows.length === 0) return null;
      const item = itemRes.rows[0];

      let patientTreatmentId = item.patient_treatment_id;

      if (executionStatus !== 'realizado') {
        // Si el estado cambia de realizado a pendiente o en_proceso, DESHACER (soft delete) el registro en Historial Odontológico
        if (patientTreatmentId) {
          await client.query(
            `UPDATE patient_treatments SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1`,
            [patientTreatmentId]
          );
          patientTreatmentId = null;
        }

        // Si la factura asociada no tiene pagos, remover el ítem de la factura
        if (item.invoice_id) {
          const invCheck = await client.query(
            `SELECT id, amount_paid, tax_rate, discount_percentage FROM invoices WHERE id = $1 AND deleted_at IS NULL`,
            [item.invoice_id]
          );
          if (invCheck.rows.length > 0 && parseFloat(invCheck.rows[0].amount_paid || 0) === 0) {
            if (item.treatment_id) {
              await client.query(`DELETE FROM invoice_items WHERE invoice_id = $1 AND treatment_id = $2`, [item.invoice_id, item.treatment_id]);
            } else {
              await client.query(`DELETE FROM invoice_items WHERE invoice_id = $1 AND description = $2`, [item.invoice_id, item.description]);
            }

            const itemsRes = await client.query(`SELECT quantity, unit_price, discount FROM invoice_items WHERE invoice_id = $1`, [item.invoice_id]);
            if (itemsRes.rows.length === 0) {
              await client.query(`UPDATE invoices SET deleted_at = NOW() WHERE id = $1`, [item.invoice_id]);
              await client.query(`UPDATE quotation_items SET invoice_id = NULL WHERE id = $1`, [itemId]);
            } else {
              let sumSub = 0;
              for (const ii of itemsRes.rows) {
                sumSub += parseFloat(ii.quantity || 1) * parseFloat(ii.unit_price || 0) - parseFloat(ii.discount || 0);
              }
              const inv = invCheck.rows[0];
              const subtotal = Math.max(0, parseFloat(sumSub.toFixed(2)));
              const taxRate = parseFloat(inv.tax_rate || 0);
              const discountPct = parseFloat(inv.discount_percentage || 0);
              const discountAmount = parseFloat((subtotal * (discountPct / 100)).toFixed(2));
              const taxable = Math.max(0, subtotal - discountAmount);
              const taxAmount = parseFloat((taxable * (taxRate / 100)).toFixed(2));
              const total = parseFloat((taxable + taxAmount).toFixed(2));
              await client.query(
                `UPDATE invoices SET subtotal = $1, tax_amount = $2, discount_amount = $3, total = $4, balance = $4 WHERE id = $5`,
                [subtotal, taxAmount, discountAmount, total, item.invoice_id]
              );
            }
          }
        }
      } else if (executionStatus === 'realizado') {
        if (patientTreatmentId) {
          // Si ya existía un ID de tratamiento previamente soft-deleted, restaurarlo
          const quoteTaxRate = parseFloat(item.quote_tax_rate || 0);
          await client.query(
            `UPDATE patient_treatments SET deleted_at = NULL, tax_rate = $2, updated_at = NOW() WHERE id = $1`,
            [patientTreatmentId, quoteTaxRate]
          );
        } else {
          let treatmentId = item.treatment_id;

          if (treatmentId) {
            const checkT = await client.query(`SELECT id FROM treatments WHERE id = $1 AND deleted_at IS NULL`, [treatmentId]);
            if (checkT.rows.length === 0) {
              treatmentId = null;
            }
          }

          if (!treatmentId) {
            const existingT = await client.query(
              `SELECT id FROM treatments WHERE LOWER(name) = LOWER($1) AND deleted_at IS NULL LIMIT 1`,
              [item.description]
            );
            if (existingT.rows.length > 0) {
              treatmentId = existingT.rows[0].id;
            } else {
              const newT = await client.query(
                `INSERT INTO treatments (name, default_price, description${item.clinic_id ? ', clinic_id' : ''})
                 VALUES ($1, $2, $3${item.clinic_id ? ', $4' : ''})
                 RETURNING id`,
                item.clinic_id
                  ? [item.description, item.unit_price || item.total, `Tratamiento derivado de Presupuesto #${item.quote_number}`, item.clinic_id]
                  : [item.description, item.unit_price || item.total, `Tratamiento derivado de Presupuesto #${item.quote_number}`]
              );
              treatmentId = newT.rows[0].id;
            }
          }

          const notesText = `Proveniente de Presupuesto #${item.quote_number}`;

          if (treatmentId) {
            const quoteTaxRate = parseFloat(item.quote_tax_rate || 0);
            const ptRes = await client.query(
              `INSERT INTO patient_treatments 
                 (patient_id, treatment_id, doctor_id, tooth_number, price, tax_rate, status, notes, invoice_id, end_date, created_by${item.clinic_id ? ', clinic_id' : ''})
               VALUES 
                 ($1, $2, $3, $4, $5, $6, 'completado', $7, $8, NOW(), $9${item.clinic_id ? ', $10' : ''})
               RETURNING id`,
              item.clinic_id
                ? [item.patient_id, treatmentId, item.doctor_id || null, item.tooth_number || null, item.total, quoteTaxRate, notesText, item.invoice_id || null, userId || null, item.clinic_id]
                : [item.patient_id, treatmentId, item.doctor_id || null, item.tooth_number || null, item.total, quoteTaxRate, notesText, item.invoice_id || null, userId || null]
            );
            patientTreatmentId = ptRes.rows[0].id;

            // Registrar débito en patient_credits por la conclusión del tratamiento del presupuesto
            await client.query(
              `INSERT INTO patient_credits (patient_id, clinic_id, type, amount, source, invoice_id, notes, created_by)
               VALUES ($1, $2, 'debit', $3, 'payment_apply', $4, $5, $6)`,
              [item.patient_id, item.clinic_id || 1, item.total, item.invoice_id || null, `Consumo por tratamiento concluido de Presupuesto #${item.quote_number}`, userId || null]
            );
          }
        }
      }

      const updatedItemRes = await client.query(
        `UPDATE quotation_items 
         SET execution_status = $1, patient_treatment_id = $2 
         WHERE id = $3 
         RETURNING *`,
        [executionStatus, patientTreatmentId, itemId]
      );

      return updatedItemRes.rows[0];
    });
  }
}

export default new QuotationRepository();
