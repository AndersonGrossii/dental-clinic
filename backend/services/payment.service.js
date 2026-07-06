// ============================================
// Servicio de Pagos
// ============================================
import paymentRepository from '../repositories/payment.repository.js';
import invoiceRepository from '../repositories/invoice.repository.js';
import { AppError } from '../utils/errors.js';
import { buildPaginationMeta } from '../utils/pagination.js';
import { transaction } from '../database/pool.js';

class PaymentService {
  /**
   * Obtiene todos los pagos con filtros y paginación.
   */
  async getAll({ page = 1, limit = 20, invoice_id, date_from, date_to, search, payment_method_id } = {}) {
    const offset = (page - 1) * limit;
    const filters = { invoice_id, date_from, date_to, search, payment_method_id };
    const { rows, total } = await paymentRepository.findAllWithDetails({ limit, offset, filters });
    const pagination = buildPaginationMeta(total, page, limit);
    return { payments: rows, pagination };
  }

  /**
   * Obtiene los pagos de una factura específica.
   */
  async getByInvoice(invoiceId) {
    return await paymentRepository.findByInvoice(invoiceId);
  }

  /**
   * Obtiene todos los métodos de pago activos.
   */
  async getPaymentMethods() {
    return await paymentRepository.getPaymentMethods();
  }

  /**
   * Registra un pago para una factura.
   * Valida que el monto no exceda el saldo pendiente.
   * Actualiza el saldo y estado de la factura en una transacción.
   */
  async create(paymentData, userId) {
    const { invoice_id, payment_method_id, amount, reference_number, notes } = paymentData;

    if (!invoice_id || !payment_method_id || amount <= 0) {
      throw new AppError('Datos de pago inválidos o incompletos', 400);
    }

    return await transaction(async (client) => {
      // 1. Obtener la factura para validar el saldo
      const invoiceResult = await client.query(
        `SELECT id, total, amount_paid, balance, status FROM invoices WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
        [invoice_id]
      );
      const invoice = invoiceResult.rows[0];

      if (!invoice) {
        throw new AppError('Factura no encontrada', 404);
      }

      if (invoice.status === 'pagada' || invoice.balance <= 0) {
        throw new AppError('La factura ya se encuentra totalmente pagada', 400);
      }

      // Convertir a float para evitar problemas
      const balance = parseFloat(invoice.balance);
      const paymentAmount = parseFloat(amount);

      if (paymentAmount > balance + 0.01) { // Tolerancia pequeña para flotantes
        throw new AppError(`El monto del pago ($${paymentAmount}) excede el saldo pendiente ($${balance})`, 400);
      }

      // 2. Insertar el pago
      const paymentResult = await client.query(
        `INSERT INTO payments (invoice_id, payment_method_id, amount, reference_number, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [invoice_id, payment_method_id, paymentAmount, reference_number || null, notes || null, userId]
      );
      const payment = paymentResult.rows[0];

      // 3. Recalcular montos de la factura
      const newAmountPaid = parseFloat(invoice.amount_paid) + paymentAmount;
      const newBalance = Math.max(0, parseFloat(invoice.total) - newAmountPaid);
      
      let newStatus = 'parcial';
      if (newBalance <= 0) {
        newStatus = 'pagada';
      }

      await client.query(
        `UPDATE invoices
         SET amount_paid = $1, balance = $2, status = $3, updated_at = NOW()
         WHERE id = $4`,
        [newAmountPaid, newBalance, newStatus, invoice_id]
      );

      return payment;
    });
  }

  /**
   * Elimina un pago y actualiza el saldo de la factura.
   */
  async delete(id) {
    return await transaction(async (client) => {
      // 1. Obtener el pago
      const paymentResult = await client.query(
        `SELECT id, invoice_id, amount FROM payments WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
        [id]
      );
      const payment = paymentResult.rows[0];

      if (!payment) {
        throw new AppError('Pago no encontrado', 404);
      }

      // 2. Soft-delete del pago
      await client.query(
        `UPDATE payments SET deleted_at = NOW() WHERE id = $1`,
        [id]
      );

      // 3. Obtener la factura para actualizarla
      const invoiceResult = await client.query(
        `SELECT id, total, amount_paid FROM invoices WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
        [payment.invoice_id]
      );
      const invoice = invoiceResult.rows[0];

      if (invoice) {
        const newAmountPaid = Math.max(0, parseFloat(invoice.amount_paid) - parseFloat(payment.amount));
        const newBalance = parseFloat(invoice.total) - newAmountPaid;
        
        let newStatus = 'pendiente';
        if (newAmountPaid > 0 && newBalance > 0) {
          newStatus = 'parcial';
        } else if (newBalance <= 0) {
          newStatus = 'pagada';
        }

        await client.query(
          `UPDATE invoices
           SET amount_paid = $1, balance = $2, status = $3, updated_at = NOW()
           WHERE id = $4`,
          [newAmountPaid, newBalance, newStatus, invoice.id]
        );
      }

      return true;
    });
  }
}

export default new PaymentService();
