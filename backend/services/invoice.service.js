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
  async createFromQuotation(quotationId, userId, selectedItemIds = null) {
    const quotation = await quotationRepository.findByIdWithItems(quotationId);
    if (!quotation) {
      throw new AppError('Cotización no encontrada.', 404);
    }

    let itemsToBill = quotation.items || [];
    if (Array.isArray(selectedItemIds) && selectedItemIds.length > 0) {
      const idSet = new Set(selectedItemIds.map(id => String(id)));
      itemsToBill = quotation.items.filter(item => idSet.has(String(item.id)));
    }

    if (itemsToBill.length === 0) {
      throw new AppError('Debe seleccionar al menos un ítem válido para facturar.', 400);
    }

    // Calcular subtotales y totales para los ítems seleccionados
    const subtotal = parseFloat(itemsToBill.reduce((acc, item) => acc + parseFloat(item.total || 0), 0).toFixed(2));
    const taxRate = parseFloat(quotation.tax_rate || 0);
    const discountPct = parseFloat(quotation.discount_percentage || 0);
    const discountAmount = parseFloat((subtotal * (discountPct / 100)).toFixed(2));
    const taxableAmount = subtotal - discountAmount;
    const taxAmount = parseFloat((taxableAmount * (taxRate / 100)).toFixed(2));
    const total = parseFloat((taxableAmount + taxAmount).toFixed(2));

    const invoiceNumber = await invoiceRepository.generateNumber();

    const isPartial = itemsToBill.length < (quotation.items || []).length;
    const invoiceData = {
      invoice_number: invoiceNumber,
      quotation_id: quotation.id,
      patient_id: quotation.patient_id,
      doctor_id: quotation.doctor_id,
      subtotal,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      discount_amount: discountAmount,
      discount_percentage: discountPct,
      total,
      balance: total,
      amount_paid: 0,
      status: 'pendiente',
      notes: `Generada desde cotización ${quotation.quote_number}${isPartial ? ' (Aceptación parcial de ítems)' : ''}`,
      created_by: userId,
    };

    const items = itemsToBill.map((item) => ({
      treatment_id: item.treatment_id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      subtotal: item.total,
    }));

    // Actualizar estado de cotización a 'aceptada' si estaba en borrador/enviada
    if (quotation.status !== 'aceptada') {
      await quotationRepository.update(quotation.id, { status: 'aceptada' });
    }

    const createdInvoice = await invoiceRepository.createWithItems(invoiceData, items);

    // Marcar ítems de la cotización como facturados (vinculados al ID de factura)
    const billedItemIds = itemsToBill.map(i => i.id);
    if (billedItemIds.length > 0) {
      await quotationRepository.markItemsInvoiced(billedItemIds, createdInvoice.id);
    }

    return createdInvoice;
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
