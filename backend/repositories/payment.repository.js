// ============================================
// Repositorio de Pagos
// ============================================
import { query } from '../database/pool.js';
import { BaseRepository } from './base.repository.js';

/**
 * Repositorio para operaciones de datos de pagos.
 * Extiende BaseRepository con consultas específicas de pagos.
 */
class PaymentRepository extends BaseRepository {
  constructor() {
    super('payments');
  }

  /**
   * Obtiene todos los pagos de una factura específica.
   * @param {string|number} invoiceId - ID de la factura
   * @returns {Promise<Array>}
   */
  async findByInvoice(invoiceId) {
    const result = await query(
      `SELECT pay.*,
              pm.name AS payment_method_name
       FROM payments pay
       LEFT JOIN payment_methods pm ON pay.payment_method_id = pm.id
       WHERE pay.invoice_id = $1 AND pay.deleted_at IS NULL
       ORDER BY pay.payment_date DESC`,
      [invoiceId]
    );
    return result.rows;
  }

  /**
   * Obtiene todos los pagos con datos de factura, paciente y método de pago.
   * @param {object} options - Opciones de búsqueda y paginación
   * @returns {Promise<{ rows: Array, total: number }>}
   */
  async findAllWithDetails({ limit = 20, offset = 0, sortBy = 'pay.created_at', sortOrder = 'DESC', filters = {} } = {}) {
    const conditions = ['pay.deleted_at IS NULL'];
    const params = [];
    let paramIndex = 1;

    if (filters.invoice_id) {
      conditions.push(`pay.invoice_id = $${paramIndex}`);
      params.push(filters.invoice_id);
      paramIndex++;
    }

    if (filters.payment_method_id) {
      conditions.push(`pay.payment_method_id = $${paramIndex}`);
      params.push(filters.payment_method_id);
      paramIndex++;
    }

    if (filters.start_date) {
      conditions.push(`pay.payment_date >= $${paramIndex}`);
      params.push(filters.start_date);
      paramIndex++;
    }

    if (filters.end_date) {
      conditions.push(`pay.payment_date <= $${paramIndex}`);
      params.push(filters.end_date);
      paramIndex++;
    }

    if (filters.search) {
      conditions.push(`(i.invoice_number ILIKE $${paramIndex} OR p.first_name ILIKE $${paramIndex} OR p.last_name ILIKE $${paramIndex})`);
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const safeSortBy = /^[a-zA-Z_.]+$/.test(sortBy) ? sortBy : 'pay.created_at';
    const safeSortOrder = sortOrder === 'ASC' ? 'ASC' : 'DESC';

    const countResult = await query(
      `SELECT COUNT(*) AS total
       FROM payments pay
       INNER JOIN invoices i ON pay.invoice_id = i.id
       INNER JOIN patients p ON i.patient_id = p.id
       LEFT JOIN payment_methods pm ON pay.payment_method_id = pm.id
       ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total, 10);

    const dataResult = await query(
      `SELECT pay.*,
              i.invoice_number,
              i.total AS invoice_total,
              p.first_name AS patient_first_name,
              p.last_name AS patient_last_name,
              p.dni AS patient_dni,
              pm.name AS payment_method_name
       FROM payments pay
       INNER JOIN invoices i ON pay.invoice_id = i.id
       INNER JOIN patients p ON i.patient_id = p.id
       LEFT JOIN payment_methods pm ON pay.payment_method_id = pm.id
       ${whereClause}
       ORDER BY ${safeSortBy} ${safeSortOrder}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    return { rows: dataResult.rows, total };
  }

  /**
   * Obtiene todos los métodos de pago activos.
   * @returns {Promise<Array>}
   */
  async getPaymentMethods() {
    const result = await query(
      `SELECT * FROM payment_methods
       WHERE is_active = true
       ORDER BY name ASC`
    );
    return result.rows;
  }

  /**
   * Calcula los ingresos totales en un rango de fechas.
   * @param {string} startDate - Fecha de inicio
   * @param {string} endDate - Fecha de fin
   * @returns {Promise<number>}
   */
  async getRevenueByDateRange(startDate, endDate) {
    const result = await query(
      `SELECT COALESCE(SUM(amount), 0) AS total_revenue
       FROM payments
       WHERE payment_date >= $1 AND payment_date <= $2
         AND deleted_at IS NULL`,
      [startDate, endDate]
    );
    return parseFloat(result.rows[0].total_revenue);
  }
}

export default new PaymentRepository();
