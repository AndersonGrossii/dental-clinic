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

    const ptData = {
      patient_id: data.patient_id,
      treatment_id: data.treatment_id,
      doctor_id: data.doctor_id || null,
      appointment_id: data.appointment_id || null,
      tooth_number: data.tooth_number || null,
      price: data.price,
      status: data.status || 'pendiente',
      notes: data.notes || null,
      start_date: data.start_date || null,
      end_date: data.end_date || null,
      created_by: data.created_by || null,
    };

    const ptRecord = await treatmentRepository.createPatientTreatment(ptData);

    const taxRate = data.tax_rate !== undefined ? Number(data.tax_rate) : 16;
    const subtotal = Number(data.price) || 0;
    const taxAmount = parseFloat((subtotal * taxRate / 100).toFixed(2));
    const total = parseFloat((subtotal + taxAmount).toFixed(2));
    const invoiceNumber = await invoiceRepository.generateNumber();

    const invoiceData = {
      invoice_number: invoiceNumber,
      patient_id: data.patient_id,
      doctor_id: data.doctor_id || null,
      subtotal,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      discount_amount: 0,
      discount_percentage: 0,
      total,
      balance: total,
      amount_paid: 0,
      status: 'pendiente',
      notes: `Auto-generado — ${treatment.name}`,
      created_by: data.created_by || null,
    };

    const items = [{
      treatment_id: data.treatment_id,
      description: treatment.name,
      quantity: 1,
      unit_price: subtotal,
      subtotal,
      tooth_number: data.tooth_number || null,
    }];

    await invoiceRepository.createWithItems(invoiceData, items);

    return ptRecord;
  }

  /**
   * Actualiza un registro de tratamiento de paciente.
   * @param {number} id - ID del registro patient_treatments
   * @param {object} data - Datos a actualizar
   * @returns {Promise<object>}
   * @throws {AppError} Si no existe
   */
  async updatePatientTreatment(id, data) {
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
    if (!updated) {
      throw new AppError('Registro de tratamiento del paciente no encontrado.', 404);
    }
    return updated;
  }
}

export default new TreatmentService();
