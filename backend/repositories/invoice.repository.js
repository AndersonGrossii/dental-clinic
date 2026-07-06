// ============================================
// Repositorio de Facturas
// ============================================
import { query, transaction } from '../database/pool.js';
import { BaseRepository } from './base.repository.js';

/**
 * Repositorio para operaciones de datos de facturas.
 * Extiende BaseRepository con consultas específicas de facturación.
 */
class InvoiceRepository extends BaseRepository {
  constructor() {
    super('invoices');
  }

  /**
   * Obtiene todas las facturas con datos de paciente y doctor.
   * Soporta filtros por estado, paciente y rango de fechas.
   * @param {object} options - Opciones de búsqueda y paginación
   * @returns {Promise<{ rows: Array, total: number }>}
   */
  async findAllWithDetails({ limit = 20, offset = 0, sortBy = 'i.created_at', sortOrder = 'DESC', filters = {} } = {}) {
    const conditions = ['i.deleted_at IS NULL'];
    const params = [];
    let paramIndex = 1;

    if (filters.status) {
      conditions.push(`i.status = $${paramIndex}`);
      params.push(filters.status);
      paramIndex++;
    }

    if (filters.patient_id) {
      conditions.push(`i.patient_id = $${paramIndex}`);
      params.push(filters.patient_id);
      paramIndex++;
    }

    if (filters.start_date) {
      conditions.push(`i.created_at >= $${paramIndex}`);
      params.push(filters.start_date);
      paramIndex++;
    }

    if (filters.end_date) {
      conditions.push(`i.created_at <= $${paramIndex}`);
      params.push(filters.end_date);
      paramIndex++;
    }

    if (filters.search) {
      conditions.push(`(i.invoice_number ILIKE $${paramIndex} OR p.first_name ILIKE $${paramIndex} OR p.last_name ILIKE $${paramIndex})`);
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const safeSortBy = /^[a-zA-Z_.]+$/.test(sortBy) ? sortBy : 'i.created_at';
    const safeSortOrder = sortOrder === 'ASC' ? 'ASC' : 'DESC';

    const countResult = await query(
      `SELECT COUNT(*) AS total
       FROM invoices i
       INNER JOIN patients p ON i.patient_id = p.id
       LEFT JOIN users u ON i.doctor_id = u.id
       ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total, 10);

    const dataResult = await query(
      `SELECT i.*,
              CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
              p.first_name AS patient_first_name,
              p.last_name AS patient_last_name,
              p.dni AS patient_dni,
              CONCAT(u.first_name, ' ', u.last_name) AS doctor_name,
              u.first_name AS doctor_first_name,
              u.last_name AS doctor_last_name
       FROM invoices i
       INNER JOIN patients p ON i.patient_id = p.id
       LEFT JOIN users u ON i.doctor_id = u.id
       ${whereClause}
       ORDER BY ${safeSortBy} ${safeSortOrder}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    return { rows: dataResult.rows, total };
  }

  /**
   * Obtiene una factura por ID con items, pagos, paciente y doctor.
   * @param {string|number} id - ID de la factura
   * @returns {Promise<object|null>}
   */
  async findByIdWithItems(id) {
    const invoiceResult = await query(
      `SELECT i.*,
              CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
              p.first_name AS patient_first_name,
              p.last_name AS patient_last_name,
              p.dni AS patient_dni,
              p.email AS patient_email,
              p.phone AS patient_phone,
              CONCAT(u.first_name, ' ', u.last_name) AS doctor_name,
              u.first_name AS doctor_first_name,
              u.last_name AS doctor_last_name
       FROM invoices i
       INNER JOIN patients p ON i.patient_id = p.id
       LEFT JOIN users u ON i.doctor_id = u.id
       WHERE i.id = $1 AND i.deleted_at IS NULL`,
      [id]
    );

    if (invoiceResult.rows.length === 0) return null;

    const itemsResult = await query(
      `SELECT ii.*,
              t.name AS treatment_name,
              t.code AS treatment_code
       FROM invoice_items ii
       LEFT JOIN treatments t ON ii.treatment_id = t.id
       WHERE ii.invoice_id = $1
       ORDER BY ii.id ASC`,
      [id]
    );

    const paymentsResult = await query(
      `SELECT pay.*,
              pm.name AS payment_method_name
       FROM payments pay
       LEFT JOIN payment_methods pm ON pay.payment_method_id = pm.id
       WHERE pay.invoice_id = $1 AND pay.deleted_at IS NULL
       ORDER BY pay.payment_date DESC`,
      [id]
    );

    return {
      ...invoiceResult.rows[0],
      items: itemsResult.rows,
      payments: paymentsResult.rows,
    };
  }

  /**
   * Genera un número de factura secuencial con formato FAC-XXXX.
   * @returns {Promise<string>}
   */
  async generateNumber() {
    const result = await query("SELECT nextval('invoice_number_seq') AS seq");
    const seq = result.rows[0].seq.toString().padStart(4, '0');
    return `FAC-${seq}`;
  }

  /**
   * Crea una factura con sus items dentro de una transacción.
   * @param {object} invoiceData - Datos de la factura
   * @param {Array} items - Array de items de la factura
   * @returns {Promise<object>} Factura creada con items
   */
  async createWithItems(invoiceData, items) {
    return transaction(async (client) => {
      const invoiceKeys = Object.keys(invoiceData);
      const invoiceValues = Object.values(invoiceData);
      const invoicePlaceholders = invoiceKeys.map((_, i) => `$${i + 1}`);

      const invoiceResult = await client.query(
        `INSERT INTO invoices (${invoiceKeys.join(', ')})
         VALUES (${invoicePlaceholders.join(', ')})
         RETURNING *`,
        invoiceValues
      );

      const invoice = invoiceResult.rows[0];
      const insertedItems = [];

      for (const item of items) {
        const itemResult = await client.query(
          `INSERT INTO invoice_items (invoice_id, treatment_id, description, quantity, unit_price, total, tooth_number)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [
            invoice.id,
            item.treatment_id || null,
            item.description,
            item.quantity,
            item.unit_price,
            item.subtotal,
            item.tooth_number || null,
          ]
        );
        insertedItems.push(itemResult.rows[0]);
      }

      return { ...invoice, items: insertedItems };
    });
  }

  /**
   * Recalcula el monto pagado de una factura a partir de la suma de pagos.
   * Actualiza el estado según corresponda: pendiente, parcial o pagada.
   * @param {string|number} invoiceId - ID de la factura
   * @returns {Promise<object>} Factura actualizada
   */
  async updateAmountPaid(invoiceId) {
    const sumResult = await query(
      `SELECT COALESCE(SUM(amount), 0) AS total_paid
       FROM payments
       WHERE invoice_id = $1 AND deleted_at IS NULL`,
      [invoiceId]
    );

    const totalPaid = parseFloat(sumResult.rows[0].total_paid);

    const invoiceResult = await query(
      'SELECT total FROM invoices WHERE id = $1 AND deleted_at IS NULL',
      [invoiceId]
    );

    if (invoiceResult.rows.length === 0) return null;

    const total = parseFloat(invoiceResult.rows[0].total);

    let status;
    if (totalPaid <= 0) {
      status = 'pendiente';
    } else if (totalPaid >= total) {
      status = 'pagada';
    } else {
      status = 'parcial';
    }

    const updateResult = await query(
      `UPDATE invoices
       SET amount_paid = $1, status = $2, updated_at = NOW()
       WHERE id = $3 AND deleted_at IS NULL
       RETURNING *`,
      [totalPaid, status, invoiceId]
    );

    return updateResult.rows[0] || null;
  }
}

export default new InvoiceRepository();
