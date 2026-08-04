// ============================================
// Servicio de Tratamientos — Lógica de negocio
// ============================================
import treatmentRepository from '../repositories/treatment.repository.js';
import invoiceRepository from '../repositories/invoice.repository.js';
import { AppError } from '../utils/errors.js';

/**
 * Servicio que encapsula la lógica de negocio para la gestión de tratamientos.
 */
class TreatmentService {
  /**
   * Obtiene todos los tratamientos con paginación y filtros.
   * @param {object} options - { limit, offset, sortBy, sortOrder, filters }
   * @returns {Promise<{ data: Array, total: number }>}
   */
  async getAll(options) {
    const { rows, total } = await treatmentRepository.findAllWithCategory(options);
    return { data: rows, total };
  }

  /**
   * Obtiene un tratamiento por ID.
   * @param {number} id - ID del tratamiento
   * @returns {Promise<object>}
   * @throws {AppError} Si el tratamiento no existe
   */
  async getById(id) {
    const treatment = await treatmentRepository.findById(id);
    if (!treatment) {
      throw new AppError('Tratamiento no encontrado.', 404);
    }
    return treatment;
  }

  /**
   * Crea un nuevo tratamiento.
   * @param {object} data - Datos del tratamiento
   * @returns {Promise<object>}
   * @throws {AppError} Si el código ya está en uso
   */
  async create(data) {
    // Verificar código único si se proporciona
    if (data.code) {
      const existing = await treatmentRepository.findByField('code', data.code);
      if (existing) {
        throw new AppError(`Ya existe un tratamiento con el código "${data.code}".`, 409);
      }
    }

    const treatmentData = {
      name: data.name,
      category_id: data.category_id || null,
      code: data.code || null,
      description: data.description || null,
      default_price: data.default_price,
      duration_minutes: data.duration_minutes || 30,
      is_active: data.is_active !== undefined ? data.is_active : true,
    };

    return treatmentRepository.create(treatmentData);
  }

  /**
   * Actualiza un tratamiento existente.
   * @param {number} id - ID del tratamiento
   * @param {object} data - Datos a actualizar
   * @returns {Promise<object>}
   * @throws {AppError} Si no existe o el código está duplicado
   */
  async update(id, data) {
    const existing = await treatmentRepository.findById(id);
    if (!existing) {
      throw new AppError('Tratamiento no encontrado.', 404);
    }

    // Verificar código único si se cambia
    if (data.code && data.code !== existing.code) {
      const duplicate = await treatmentRepository.findByField('code', data.code);
      if (duplicate) {
        throw new AppError(`Ya existe un tratamiento con el código "${data.code}".`, 409);
      }
    }

    const updateData = {};
    const allowedFields = [
      'name', 'category_id', 'code', 'description',
      'default_price', 'duration_minutes', 'is_active',
    ];
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        updateData[field] = data[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      throw new AppError('No se proporcionaron datos para actualizar.', 400);
    }

    return treatmentRepository.update(id, updateData);
  }

  /**
   * Elimina un tratamiento (soft delete).
   * @param {number} id - ID del tratamiento
   * @returns {Promise<boolean>}
   * @throws {AppError} Si no existe
   */
  async delete(id) {
    const existing = await treatmentRepository.findById(id);
    if (!existing) {
      throw new AppError('Tratamiento no encontrado.', 404);
    }

    const deleted = await treatmentRepository.softDelete(id);
    if (!deleted) {
      throw new AppError('No se pudo eliminar el tratamiento.', 500);
    }
    return true;
  }

  /**
   * Obtiene todas las categorías de tratamientos activas.
   * @returns {Promise<Array>}
   */
  async getCategories() {
    return treatmentRepository.findCategories();
  }

  /**
   * Crea una nueva categoría de tratamiento.
   * @param {object} data - Datos de la categoría
   * @returns {Promise<object>}
   */
  async createCategory(data) {
    const categoryData = {
      name: data.name,
      description: data.description || null,
      color: data.color || '#6366f1',
      icon: data.icon || null,
      sort_order: data.sort_order || 0,
    };
    return treatmentRepository.createCategory(categoryData);
  }

  /**
   * Actualiza una categoría de tratamiento.
   * @param {number} id - ID de la categoría
   * @param {object} data - Datos a actualizar
   * @returns {Promise<object>}
   * @throws {AppError} Si no existe
   */
  async updateCategory(id, data) {
    const updateData = {};
    const allowedFields = ['name', 'description', 'color', 'icon', 'sort_order', 'is_active'];
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        updateData[field] = data[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      throw new AppError('No se proporcionaron datos para actualizar.', 400);
    }

    const updated = await treatmentRepository.updateCategory(id, updateData);
    if (!updated) {
      throw new AppError('Categoría no encontrada.', 404);
    }
    return updated;
  }

  /**
   * Obtiene los tratamientos realizados a un paciente.
   * @param {number} patientId - ID del paciente
   * @returns {Promise<Array>}
   */
  async getPatientTreatments(patientId) {
    return treatmentRepository.getPatientTreatments(patientId);
  }

  /**
   * Registra un tratamiento realizado a un paciente.
   * @param {object} data - Datos del tratamiento del paciente
   * @returns {Promise<object>}
   * @throws {AppError} Si el tratamiento o paciente no existe
   */
  async addPatientTreatment(data) {
    const treatment = await treatmentRepository.findById(data.treatment_id);
    if (!treatment) {
      throw new AppError('El tratamiento seleccionado no existe.', 404);
    }

    let invoiceId = data.invoice_id || null;
    const price = parseFloat(data.price !== undefined ? data.price : (treatment.default_price || 0));

    if (!invoiceId && data.create_invoice !== false) {
      const invoiceNumber = await invoiceRepository.generateNumber();

      const subtotal = price;
      const taxRate = data.tax_rate !== undefined && data.tax_rate !== null ? parseFloat(data.tax_rate) : 16.00;
      const discountAmount = 0.00;
      const discountPct = 0.00;
      const taxable = subtotal - discountAmount;
      const taxAmount = parseFloat((taxable * (taxRate / 100)).toFixed(2));
      const total = parseFloat((taxable + taxAmount).toFixed(2));

      const invoiceData = {
        invoice_number: invoiceNumber,
        patient_id: data.patient_id,
        doctor_id: data.doctor_id || null,
        subtotal,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        discount_amount: discountAmount,
        discount_percentage: discountPct,
        total,
        balance: total,
        amount_paid: 0,
        status: 'pendiente',
        notes: `Factura por tratamiento registrado en historial: ${treatment.name}`,
        created_by: data.created_by || null,
      };

      const items = [{
        treatment_id: treatment.id,
        description: treatment.name,
        quantity: 1,
        unit_price: price,
        subtotal: price,
      }];

      const createdInvoice = await invoiceRepository.createWithItems(invoiceData, items);
      invoiceId = createdInvoice.id;
    }

    const ptData = {
      patient_id: data.patient_id,
      treatment_id: data.treatment_id,
      doctor_id: data.doctor_id || null,
      appointment_id: data.appointment_id || null,
      tooth_number: data.tooth_number || null,
      price,
      status: data.status || 'completado',
      notes: data.notes || null,
      start_date: data.start_date || null,
      end_date: data.end_date || null,
      created_by: data.created_by || null,
      invoice_id: invoiceId,
    };

    return treatmentRepository.createPatientTreatment(ptData);
  }

  /**
   * Actualiza un registro de tratamiento de paciente.
   * @param {number} id - ID del registro patient_treatments
   * @param {object} data - Datos a actualizar
   * @returns {Promise<object>}
   * @throws {AppError} Si no existe
   */
  async updatePatientTreatment(id, data) {
    const existing = await treatmentRepository.findPatientTreatmentById(id);
    if (!existing) {
      throw new AppError('Registro de tratamiento del paciente no encontrado.', 404);
    }

    if (existing.is_from_quotation || (existing.notes && existing.notes.includes('Presupuesto #'))) {
      throw new AppError('Los tratamientos derivados de un presupuesto deben gestionarse desde la pestaña de Tratamientos Aceptados.', 400);
    }

    const updateData = {};
    const allowedFields = ['tooth_number', 'price', 'status', 'notes', 'start_date', 'end_date'];
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        updateData[field] = data[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      throw new AppError('No se proporcionaron datos para actualizar.', 400);
    }

    const updated = await treatmentRepository.updatePatientTreatment(id, updateData);

    // Si cambió el precio o las notas y tiene una factura asociada sin pagos, actualizar los items e importes de la factura
    if (data.price !== undefined && existing.invoice_id && parseFloat(existing.invoice_amount_paid || 0) <= 0) {
      const newPrice = parseFloat(data.price);
      const invoice = await invoiceRepository.findByIdWithItems(existing.invoice_id);
      if (invoice && invoice.items && invoice.items.length > 0) {
        // Actualizar precio en invoice_items
        await query(
          `UPDATE invoice_items SET unit_price = $1, subtotal = $1, total = $1 WHERE invoice_id = $2 AND treatment_id = $3`,
          [newPrice, existing.invoice_id, existing.treatment_id]
        );

        // Recalcular subtotal y totales de la factura
        const subtotal = newPrice;
        const taxRate = parseFloat(invoice.tax_rate || 0);
        const discountAmount = parseFloat(invoice.discount_amount || 0);
        const taxable = Math.max(0, subtotal - discountAmount);
        const taxAmount = parseFloat((taxable * (taxRate / 100)).toFixed(2));
        const total = parseFloat((taxable + taxAmount).toFixed(2));

        await invoiceRepository.update(existing.invoice_id, {
          subtotal,
          tax_amount: taxAmount,
          total,
          balance: total,
        });
      }
    }

    return updated;
  }

  /**
   * Elimina un registro de tratamiento del paciente.
   * Si tiene una factura asociada sin pagos registrados, elimina también dicha factura.
   * @param {number} id - ID del registro patient_treatments
   * @returns {Promise<boolean>}
   */
  async deletePatientTreatment(id) {
    const existing = await treatmentRepository.findPatientTreatmentById(id);
    if (!existing) {
      throw new AppError('Registro de tratamiento del paciente no encontrado.', 404);
    }

    if (existing.is_from_quotation || (existing.notes && existing.notes.includes('Presupuesto #'))) {
      throw new AppError('Los tratamientos derivados de un presupuesto deben gestionarse desde la pestaña de Tratamientos Aceptados.', 400);
    }

    // Si tiene una factura vinculada sin pagos registrados, eliminarla automáticamente
    if (existing.invoice_id) {
      const invoice = await invoiceRepository.findByIdWithItems(existing.invoice_id);
      if (invoice) {
        const hasPayments = (invoice.payments && invoice.payments.length > 0) || parseFloat(invoice.amount_paid || 0) > 0;
        if (!hasPayments) {
          await invoiceRepository.softDelete(existing.invoice_id);
        }
      }
    }

    const deleted = await treatmentRepository.deletePatientTreatment(id);
    if (!deleted) {
      throw new AppError('No se pudo eliminar el tratamiento del paciente.', 500);
    }
    return true;
  }
}

export default new TreatmentService();
