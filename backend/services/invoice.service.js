// ============================================
// Servicio de Facturas
// ============================================
import invoiceRepository from '../repositories/invoice.repository.js';
import quotationRepository from '../repositories/quotation.repository.js';
import { query, als } from '../database/pool.js';
import { AppError } from '../utils/errors.js';

/**
 * Servicio para la lógica de negocio de facturas.
 * Gestiona creación manual, desde cotización, y estadísticas de facturación.
 */
class InvoiceService {
  /**
   * Obtiene todas las facturas con paginación y filtros.
   * @param {object} options - { page, limit, sortBy, sortOrder, filters }
   * @returns {Promise<{ invoices: Array, pagination: object }>}
   */
  async getAll({ page = 1, limit = 20, sortBy = 'i.created_at', sortOrder = 'DESC', filters = {} } = {}) {
    const offset = (page - 1) * limit;
    const { rows, total } = await invoiceRepository.findAllWithDetails({
      limit,
      offset,
      sortBy,
      sortOrder,
      filters,
    });

    const totalPages = Math.ceil(total / limit);

    return {
      invoices: rows,
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  /**
   * Obtiene una factura por ID con todos sus detalles.
   * @param {string|number} id - ID de la factura
   * @returns {Promise<object>}
   * @throws {AppError} Si la factura no existe
   */
  async getById(id) {
    const invoice = await invoiceRepository.findByIdWithItems(id);
    if (!invoice) {
      throw new AppError('Factura no encontrada.', 404);
    }
    return invoice;
  }

  /**
   * Crea una nueva factura con cálculos automáticos.
   * @param {object} data - Datos de la factura incluyendo items
   * @param {number} userId - ID del usuario que crea la factura
   * @returns {Promise<object>} Factura creada
   */
  async create(data, userId) {
    const { items, ...invoiceFields } = data;

    // Calcular subtotales de cada item
    const processedItems = items.map((item) => ({
      ...item,
      subtotal: parseFloat((item.quantity * item.unit_price).toFixed(2)),
    }));

    // Calcular totales
    const subtotal = processedItems.reduce((acc, item) => acc + item.subtotal, 0);
    const taxRate = data.tax_rate || 0;
    const taxAmount = parseFloat((subtotal * taxRate / 100).toFixed(2));
    const discount = parseFloat(data.discount || 0);
    const total = parseFloat((subtotal + taxAmount - discount).toFixed(2));

    // Generar número de factura
    const invoiceNumber = await invoiceRepository.generateNumber();

    const invoiceData = {
      invoice_number: invoiceNumber,
      patient_id: invoiceFields.patient_id,
      doctor_id: invoiceFields.doctor_id || null,
      due_date: invoiceFields.due_date || null,
      subtotal,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      discount_amount: discount,
      discount_percentage: data.discount_percentage || 0,
      total,
      balance: total, // Set initial balance to the total invoice amount
      amount_paid: 0,
      status: 'pendiente',
      notes: invoiceFields.notes || null,
      created_by: userId,
    };

    if (invoiceFields.invoice_date) {
      invoiceData.created_at = invoiceFields.invoice_date;
    }

    return invoiceRepository.createWithItems(invoiceData, processedItems);
  }

  /**
   * Actualiza una factura existente.
   * Solo permite actualización de campos no calculados si no tiene pagos.
   * @param {string|number} id - ID de la factura
   * @param {object} data - Datos a actualizar
   * @returns {Promise<object>} Factura actualizada
   * @throws {AppError} Si la factura no existe o está pagada
   */
  async update(id, data) {
    const existing = await invoiceRepository.findByIdWithItems(id);
    if (!existing) {
      throw new AppError('Factura no encontrada.', 404);
    }

    if (existing.status === 'pagada') {
      throw new AppError('No se puede editar una factura completamente pagada.', 400);
    }

    const updateData = {};
    if (data.patient_id !== undefined) updateData.patient_id = data.patient_id;
    if (data.doctor_id !== undefined) updateData.doctor_id = data.doctor_id;
    if (data.due_date !== undefined) updateData.due_date = data.due_date;
    if (data.notes !== undefined) updateData.notes = data.notes;

    const updated = await invoiceRepository.update(id, updateData);
    if (!updated) {
      throw new AppError('No se pudo actualizar la factura.', 500);
    }
    return updated;
  }

  /**
   * Elimina una factura (soft delete).
   * @param {string|number} id - ID de la factura
   * @returns {Promise<boolean>}
   * @throws {AppError} Si la factura no existe o tiene pagos
   */
  async delete(id) {
    const existing = await invoiceRepository.findByIdWithItems(id);
    if (!existing) {
      throw new AppError('Factura no encontrada.', 404);
    }

    if (existing.payments && existing.payments.length > 0) {
      throw new AppError('No se puede eliminar una factura con pagos registrados.', 400);
    }

    const deleted = await invoiceRepository.softDelete(id);
    if (!deleted) {
      throw new AppError('No se pudo eliminar la factura.', 500);
    }
    return true;
  }

  /**
   * Crea una factura a partir de una cotización aceptada.
   * Copia items de la cotización a la nueva factura.
   * @param {string|number} quotationId - ID de la cotización
   * @param {number} userId - ID del usuario
   * @returns {Promise<object>} Factura creada
   * @throws {AppError} Si la cotización no existe o no está aceptada
   */
  async createFromQuotation(quotationId, userId) {
    const quotation = await quotationRepository.findByIdWithItems(quotationId);
    if (!quotation) {
      throw new AppError('Cotización no encontrada.', 404);
    }

    if (quotation.status !== 'aceptada') {
      throw new AppError('Solo se pueden facturar cotizaciones con estado "aceptada".', 400);
    }

    const invoiceNumber = await invoiceRepository.generateNumber();

    const invoiceData = {
      invoice_number: invoiceNumber,
      quotation_id: quotation.id,
      patient_id: quotation.patient_id,
      doctor_id: quotation.doctor_id,
      subtotal: quotation.subtotal,
      tax_rate: quotation.tax_rate,
      tax_amount: quotation.tax_amount,
      discount_amount: quotation.discount_amount || 0.00,
      discount_percentage: quotation.discount_percentage || 0.00,
      total: quotation.total,
      balance: quotation.total,
      amount_paid: 0,
      status: 'pendiente',
      notes: `Generada desde cotización ${quotation.quote_number}`,
      created_by: userId,
    };

    // Copiar items de la cotización
    const items = quotation.items.map((item) => ({
      treatment_id: item.treatment_id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      subtotal: item.total,
    }));

    return invoiceRepository.createWithItems(invoiceData, items);
  }

  /**
   * Obtiene todas las facturas de un paciente específico.
   * @param {string|number} patientId - ID del paciente
   * @returns {Promise<{ rows: Array, total: number }>}
   */
  async getByPatient(patientId) {
    return invoiceRepository.findAllWithDetails({
      filters: { patient_id: patientId },
      limit: 100,
      offset: 0,
    });
  }

  /**
   * Obtiene estadísticas generales de facturación.
   * @returns {Promise<object>} Conteo de pendientes, ingresos totales, etc.
   */
  getClinicCondition(alias = '') {
    const store = als.getStore();
    if (!store || !store.clinicId) return '';
    const prefix = alias ? `${alias}.` : '';
    return ` AND ${prefix}clinic_id = ${store.clinicId}`;
  }

  async getStats() {
    const pendingResult = await query(
      `SELECT COUNT(*) AS count
       FROM invoices
       WHERE status = 'pendiente' AND deleted_at IS NULL${this.getClinicCondition()}`
    );

    const partialResult = await query(
      `SELECT COUNT(*) AS count
       FROM invoices
       WHERE status = 'parcial' AND deleted_at IS NULL${this.getClinicCondition()}`
    );

    const revenueResult = await query(
      `SELECT COALESCE(SUM(amount_paid), 0) AS total_revenue
       FROM invoices
       WHERE deleted_at IS NULL${this.getClinicCondition()}`
    );

    const totalInvoicesResult = await query(
      `SELECT COUNT(*) AS count
       FROM invoices
       WHERE deleted_at IS NULL${this.getClinicCondition()}`
    );

    return {
      pending_count: parseInt(pendingResult.rows[0].count, 10),
      partial_count: parseInt(partialResult.rows[0].count, 10),
      total_invoices: parseInt(totalInvoicesResult.rows[0].count, 10),
      total_revenue: parseFloat(revenueResult.rows[0].total_revenue),
    };
  }
}

export default new InvoiceService();
