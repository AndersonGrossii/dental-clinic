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

    const createdInvoice = await invoiceRepository.createWithItems(invoiceData, processedItems);

    // Auto-create an Accepted Treatment (quotation + quotation_items) for items with a treatment_id
    const treatmentItems = (createdInvoice.items || []).filter(item => item.treatment_id);
    if (treatmentItems.length > 0) {
      const quoteNumber = await quotationRepository.generateNumber();

      const quotationData = {
        quote_number: quoteNumber,
        patient_id: invoiceData.patient_id,
        doctor_id: invoiceData.doctor_id || null,
        quotation_date: new Date().toISOString().split('T')[0],
        subtotal: invoiceData.subtotal,
        tax_rate: invoiceData.tax_rate,
        tax_amount: invoiceData.tax_amount,
        discount_percentage: invoiceData.discount_percentage || 0,
        discount_amount: invoiceData.discount_amount || 0,
        total: invoiceData.total,
        status: 'aceptada',
        notes: `Generada automáticamente desde factura ${invoiceData.invoice_number}`,
        created_by: userId,
      };

      const quotationItems = treatmentItems.map(item => ({
        treatment_id: item.treatment_id,
        description: item.description,
        quantity: parseInt(item.quantity, 10) || 1,
        unit_price: parseFloat(item.unit_price),
        discount: 0,
        total: parseFloat(item.total || item.unit_price),
        status: 'aceptado',
      }));

      const createdQuotation = await quotationRepository.createWithItems(quotationData, quotationItems);

      // Link quotation_items to the invoice and set execution_status to 'pendiente'
      if (createdQuotation && createdQuotation.items) {
        for (const qItem of createdQuotation.items) {
          await quotationRepository.markItemsInvoiced([qItem.id], createdInvoice.id);
        }
      }

      // Link the invoice back to the quotation
      await invoiceRepository.update(createdInvoice.id, { quotation_id: createdQuotation.id });
      createdInvoice.quotation_id = createdQuotation.id;
    }

    return createdInvoice;
  }

  /**
   * Actualiza una factura existente y sincroniza sus cambios en cascada
   * (Historial Odontológico, Presupuestos Aceptados, Saldo del paciente).
   * @param {string|number} id - ID de la factura
   * @param {object} data - Datos a actualizar
   * @returns {Promise<object>} Factura actualizada
   */
  async update(id, data) {
    const existing = await invoiceRepository.findByIdWithItems(id);
    if (!existing) {
      throw new AppError('Factura no encontrada.', 404);
    }

    const updateFields = {};
    if (data.patient_id !== undefined) updateFields.patient_id = data.patient_id;
    if (data.doctor_id !== undefined) updateFields.doctor_id = data.doctor_id || null;
    if (data.due_date !== undefined) updateFields.due_date = data.due_date;
    if (data.created_at !== undefined || data.invoice_date !== undefined) {
      updateFields.created_at = data.created_at || data.invoice_date;
    }
    if (data.notes !== undefined) updateFields.notes = data.notes;
    if (data.status !== undefined) updateFields.status = data.status;
    if (data.tax_rate !== undefined) updateFields.tax_rate = parseFloat(data.tax_rate);
    if (data.discount !== undefined || data.discount_amount !== undefined) {
      updateFields.discount_amount = parseFloat(data.discount !== undefined ? data.discount : data.discount_amount);
    }
    if (data.discount_percentage !== undefined) {
      updateFields.discount_percentage = parseFloat(data.discount_percentage);
    }

    // Si se envían items, reemplazar e igualar totales
    if (Array.isArray(data.items) && data.items.length > 0) {
      const processedItems = data.items.map((item) => {
        const qty = parseInt(item.quantity || 1, 10);
        const unitPrice = parseFloat(item.unit_price || 0);
        return {
          treatment_id: item.treatment_id || null,
          description: item.description || 'Tratamiento Odontológico',
          quantity: qty,
          unit_price: unitPrice,
          subtotal: parseFloat((qty * unitPrice).toFixed(2)),
          tooth_number: item.tooth_number || null,
        };
      });

      await invoiceRepository.replaceInvoiceItems(id, processedItems);

      const subtotal = parseFloat(processedItems.reduce((acc, item) => acc + item.subtotal, 0).toFixed(2));
      updateFields.subtotal = subtotal;

      const taxRate = updateFields.tax_rate !== undefined ? updateFields.tax_rate : parseFloat(existing.tax_rate || 0);
      const discount = updateFields.discount_amount !== undefined ? updateFields.discount_amount : parseFloat(existing.discount_amount || 0);
      const taxable = Math.max(0, subtotal - discount);
      const taxAmount = parseFloat((taxable * (taxRate / 100)).toFixed(2));
      const total = parseFloat((taxable + taxAmount).toFixed(2));

      updateFields.tax_amount = taxAmount;
      updateFields.total = total;
    }

    if (Object.keys(updateFields).length > 0) {
      await invoiceRepository.update(id, updateFields);
    }

    // Sincronizar en cascada todas las tablas afectadas
    await this.syncInvoiceCascades(id);

    return invoiceRepository.findByIdWithItems(id);
  }

  /**
   * Sincroniza los datos de la factura con todas las partes afectadas del sistema:
   * 1. Recalcula pagos, saldo restante y estado.
   * 2. Actualiza / inserta / elimina registros de patient_treatments (Historial Odontológico).
   * 3. Sincroniza importes y cantidades en quotation_items y quotations (Presupuestos).
   * @param {string|number} invoiceId - ID de la factura
   */
  async syncInvoiceCascades(invoiceId) {
    const invoice = await invoiceRepository.findByIdWithItems(invoiceId);
    if (!invoice) return;

    // 1. Recalcular pagos y saldo
    const paymentsSum = (invoice.payments || []).reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
    const amountPaid = parseFloat(paymentsSum.toFixed(2));
    const total = parseFloat(invoice.total || 0);
    const balance = Math.max(0, parseFloat((total - amountPaid).toFixed(2)));

    let status = invoice.status;
    if (status !== 'cancelada') {
      if (amountPaid <= 0) status = 'pendiente';
      else if (amountPaid >= total && total > 0) status = 'pagada';
      else status = 'parcial';
    }

    await invoiceRepository.update(invoiceId, {
      amount_paid: amountPaid,
      balance,
      status,
    });

    // 2. Sincronizar Historial Odontológico (patient_treatments)
    const patientId = invoice.patient_id;
    const doctorId = invoice.doctor_id;
    const items = invoice.items || [];

    const existingPtRes = await query(
      `SELECT * FROM patient_treatments WHERE invoice_id = $1 AND deleted_at IS NULL`,
      [invoiceId]
    );
    const existingPtList = existingPtRes.rows;
    const matchedPtIds = new Set();

    for (const item of items) {
      let matchPt = null;
      if (item.treatment_id) {
        matchPt = existingPtList.find(pt => !matchedPtIds.has(pt.id) && Number(pt.treatment_id) === Number(item.treatment_id));
      }
      if (!matchPt && item.description) {
        matchPt = existingPtList.find(pt => !matchedPtIds.has(pt.id) && (pt.notes || '').includes(item.description));
      }

      const itemPrice = parseFloat(item.unit_price || 0);

      if (matchPt) {
        matchedPtIds.add(matchPt.id);
        await query(
          `UPDATE patient_treatments 
           SET price = $1, tooth_number = $2, doctor_id = $3, updated_at = NOW() 
           WHERE id = $4`,
          [itemPrice, item.tooth_number || null, doctorId || matchPt.doctor_id, matchPt.id]
        );
      } else if (item.treatment_id) {
        const newPt = await query(
          `INSERT INTO patient_treatments (patient_id, treatment_id, doctor_id, tooth_number, price, status, invoice_id, notes, clinic_id)
           VALUES ($1, $2, $3, $4, $5, 'completado', $6, $7, $8)
           RETURNING id`,
          [patientId, item.treatment_id, doctorId || null, item.tooth_number || null, itemPrice, invoiceId, `Factura #${invoice.invoice_number}`, invoice.clinic_id || null]
        );
        if (newPt.rows[0]) matchedPtIds.add(newPt.rows[0].id);
      }
    }

    // Soft-delete todos los tratamientos vinculados a esta factura que ya NO están en los items actualizados
    for (const pt of existingPtList) {
      if (!matchedPtIds.has(pt.id)) {
        await query(
          `UPDATE patient_treatments SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1`,
          [pt.id]
        );
      }
    }

    // 3. Sincronizar Presupuestos Aceptados (quotations & quotation_items)
    if (invoice.quotation_id) {
      const qRes = await quotationRepository.findByIdWithItems(invoice.quotation_id);
      if (qRes && qRes.items) {
        let qSubtotal = 0;
        for (const qItem of qRes.items) {
          const invItem = items.find(i => Number(i.treatment_id) === Number(qItem.treatment_id) || i.description === qItem.description);
          if (invItem) {
            const newPrice = parseFloat(invItem.unit_price || 0);
            const newQty = parseInt(invItem.quantity || 1, 10);
            const newTotal = parseFloat((newPrice * newQty).toFixed(2));
            await query(
              `UPDATE quotation_items SET unit_price = $1, quantity = $2, total = $3, invoice_id = $4 WHERE id = $5`,
              [newPrice, newQty, newTotal, invoiceId, qItem.id]
            );
            qSubtotal += newTotal;
          } else {
            // Si el ítem fue eliminado de la factura, desvincularlo de la factura en la cotización
            await query(
              `UPDATE quotation_items SET invoice_id = NULL WHERE id = $1`,
              [qItem.id]
            );
            qSubtotal += parseFloat(qItem.total || 0);
          }
        }

        const qTaxRate = parseFloat(qRes.tax_rate || 0);
        const qDiscPct = parseFloat(qRes.discount_percentage || 0);
        const qDiscAmount = parseFloat((qSubtotal * (qDiscPct / 100)).toFixed(2));
        const qTaxable = Math.max(0, qSubtotal - qDiscAmount);
        const qTaxAmount = parseFloat((qTaxable * (qTaxRate / 100)).toFixed(2));
        const qTotal = parseFloat((qTaxable + qTaxAmount).toFixed(2));

        await quotationRepository.update(qRes.id, {
          subtotal: qSubtotal,
          discount_amount: qDiscAmount,
          tax_amount: qTaxAmount,
          total: qTotal,
        });
      }
    }
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

    // Soft delete tratamientos creados desde esta factura
    await query(
      `UPDATE patient_treatments SET deleted_at = NOW(), updated_at = NOW() WHERE invoice_id = $1`,
      [id]
    );

    // Desvincular ítems de cotización
    await query(
      `UPDATE quotation_items SET invoice_id = NULL WHERE invoice_id = $1`,
      [id]
    );

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
