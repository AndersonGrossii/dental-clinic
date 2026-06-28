// ============================================
// Servicio de Cotizaciones
// ============================================
import quotationRepository from '../repositories/quotation.repository.js';
import { AppError } from '../utils/errors.js';

const round = (n) => parseFloat(n.toFixed(2));

function processItems(items) {
  return items.map((item) => ({
    ...item,
    subtotal: round(item.quantity * item.unit_price),
    total: round(item.quantity * item.unit_price * (1 - (item.discount || 0) / 100)),
  }));
}

function computeTotals(processedItems, discountPct, taxRate) {
  const subtotal = processedItems.reduce((acc, i) => acc + i.subtotal, 0);
  const discountAmount = round(subtotal * (discountPct || 0) / 100);
  const taxableAmount = subtotal - discountAmount;
  const taxAmount = round(taxableAmount * (taxRate || 0) / 100);
  const total = round(taxableAmount + taxAmount);
  return { subtotal: round(subtotal), discount_amount: discountAmount, tax_amount: taxAmount, total };
}

class QuotationService {
  async getAll(options) {
    return quotationRepository.findAllWithDetails(options);
  }

  async getById(id) {
    const quotation = await quotationRepository.findByIdWithItems(id);
    if (!quotation) {
      throw new AppError('Cotización no encontrada.', 404);
    }
    return quotation;
  }

  async create(data) {
    const { items, ...fields } = data;

    const processedItems = processItems(items);
    const discountPct = fields.discount_percentage || 0;
    const taxRate = fields.tax_rate || 0;
    const totals = computeTotals(processedItems, discountPct, taxRate);

    const quotationNumber = await quotationRepository.generateNumber();

    const quotationData = {
      quote_number: quotationNumber,
      patient_id: fields.patient_id,
      doctor_id: fields.doctor_id || null,
      quotation_date: fields.quotation_date || new Date().toISOString().split('T')[0],
      valid_until: fields.valid_until || null,
      subtotal: totals.subtotal,
      tax_rate: taxRate,
      tax_amount: totals.tax_amount,
      discount_percentage: discountPct,
      discount_amount: totals.discount_amount,
      total: totals.total,
      status: 'borrador',
      notes: fields.notes || null,
      created_by: fields.created_by,
    };

    return quotationRepository.createWithItems(quotationData, processedItems);
  }

  async update(id, data) {
    const existing = await quotationRepository.findById(id);
    if (!existing) {
      throw new AppError('Cotización no encontrada.', 404);
    }

    if (existing.status === 'aceptada') {
      throw new AppError('No se puede editar una cotización aceptada.', 400);
    }

    const quotationData = {};
    if (data.patient_id !== undefined) quotationData.patient_id = data.patient_id;
    if (data.doctor_id !== undefined) quotationData.doctor_id = data.doctor_id;
    if (data.quotation_date !== undefined) quotationData.quotation_date = data.quotation_date;
    if (data.valid_until !== undefined) quotationData.valid_until = data.valid_until;
    if (data.notes !== undefined) quotationData.notes = data.notes;

    if (data.items) {
      const processedItems = processItems(data.items);
      const discountPct = data.discount_percentage !== undefined ? data.discount_percentage : existing.discount_percentage;
      const taxRate = data.tax_rate !== undefined ? data.tax_rate : parseFloat(existing.tax_rate);
      const totals = computeTotals(processedItems, discountPct, taxRate);

      quotationData.subtotal = totals.subtotal;
      quotationData.tax_rate = taxRate;
      quotationData.tax_amount = totals.tax_amount;
      quotationData.discount_percentage = discountPct || 0;
      quotationData.discount_amount = totals.discount_amount;
      quotationData.total = totals.total;

      return quotationRepository.updateWithItems(id, quotationData, processedItems);
    }

    if (data.tax_rate !== undefined) quotationData.tax_rate = data.tax_rate;
    if (data.discount_percentage !== undefined) quotationData.discount_percentage = data.discount_percentage;

    if (Object.keys(quotationData).length === 0) {
      throw new AppError('No se proporcionaron datos para actualizar.', 400);
    }

    return quotationRepository.update(id, quotationData);
  }

  async delete(id) {
    const existing = await quotationRepository.findById(id);
    if (!existing) {
      throw new AppError('Cotización no encontrada.', 404);
    }

    const deleted = await quotationRepository.softDelete(id);
    if (!deleted) {
      throw new AppError('No se pudo eliminar la cotización.', 500);
    }
    return true;
  }

  async changeStatus(id, status) {
    const existing = await quotationRepository.findById(id);
    if (!existing) {
      throw new AppError('Cotización no encontrada.', 404);
    }

    const updated = await quotationRepository.update(id, { status });
    if (!updated) {
      throw new AppError('No se pudo actualizar el estado.', 500);
    }
    return updated;
  }

  async getByPatient(patientId) {
    return quotationRepository.findAllWithDetails({
      filters: { patient_id: patientId },
      limit: 100,
      offset: 0,
    });
  }
}

export default new QuotationService();
