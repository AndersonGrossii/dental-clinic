// ============================================
// Servicio de Packs Promocionales de Tratamientos
// ============================================
import promotionalPackRepository from '../repositories/promotional-pack.repository.js';
import treatmentRepository from '../repositories/treatment.repository.js';
import { AppError } from '../utils/errors.js';

class PromotionalPackService {
  /**
   * Helper privado para formatear el pack con cálculo de ahorro respecto al catálogo regular.
   */
  _formatPack(pack) {
    if (!pack) return null;
    const catalogTotal = parseFloat(pack.original_total_price || 0);
    const fixedPrice = parseFloat(pack.fixed_price || 0);
    const savings = Math.max(0, catalogTotal - fixedPrice);
    const savingsPercentage = catalogTotal > 0 ? Math.round((savings / catalogTotal) * 100) : 0;
    return {
      ...pack,
      total_catalog_value: catalogTotal,
      savings_amount: savings,
      savings_percentage: savingsPercentage,
    };
  }

  /**
   * Lista todos los packs promocionales con soporte de filtros.
   */
  async getAll(options = {}) {
    const packs = await promotionalPackRepository.findAllWithItems(options);
    return packs.map(p => this._formatPack(p));
  }

  /**
   * Obtiene un pack promocional por su identificador.
   */
  async getById(id) {
    const pack = await promotionalPackRepository.findByIdWithItems(id);
    if (!pack) {
      throw new AppError('Pack promocional no encontrado.', 404);
    }
    return this._formatPack(pack);
  }

  /**
   * Valida y crea un nuevo pack promocional con sus tratamientos asociados.
   */
  async create(data) {
    const { name, description, fixed_price, is_active, start_date, end_date, items, created_by } = data;

    if (!name || typeof name !== 'string' || !name.trim()) {
      throw new AppError('El nombre del pack promocional es obligatorio.', 400);
    }

    const priceNum = parseFloat(fixed_price);
    if (isNaN(priceNum) || priceNum < 0) {
      throw new AppError('El precio fijo del pack debe ser un número válido mayor o igual a 0.', 400);
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new AppError('El pack debe incluir al menos un tratamiento.', 400);
    }

    if (start_date && end_date && new Date(start_date) > new Date(end_date)) {
      throw new AppError('La fecha de inicio no puede ser posterior a la fecha de fin de vigencia.', 400);
    }

    // Validar que cada tratamiento exista y pertenezca a la clínica activa
    const validatedItems = [];
    const seenTreatments = new Set();

    for (const item of items) {
      const treatmentId = parseInt(item.treatment_id, 10);
      if (!treatmentId || isNaN(treatmentId)) {
        throw new AppError('Identificador de tratamiento inválido en el pack.', 400);
      }
      if (seenTreatments.has(treatmentId)) {
        throw new AppError('No se permite duplicar el mismo tratamiento dentro del mismo pack.', 400);
      }
      seenTreatments.add(treatmentId);

      const treatment = await treatmentRepository.findById(treatmentId);
      if (!treatment || treatment.deleted_at) {
        throw new AppError(`El tratamiento con ID ${treatmentId} no existe o no está disponible.`, 404);
      }

      validatedItems.push({
        treatment_id: treatmentId,
        quantity: parseInt(item.quantity || 1, 10) || 1,
        sort_order: item.sort_order !== undefined ? parseInt(item.sort_order, 10) : undefined,
      });
    }

    const packPayload = {
      name: name.trim(),
      description: description ? description.trim() : null,
      fixed_price: priceNum,
      is_active: is_active !== undefined ? Boolean(is_active) : true,
      start_date: start_date || null,
      end_date: end_date || null,
      created_by: created_by || null,
    };

    const created = await promotionalPackRepository.createWithItems(packPayload, validatedItems);
    return this.getById(created.id);
  }

  /**
   * Actualiza los datos o composición de tratamientos de un pack promocional existente.
   */
  async update(id, data) {
    const existing = await promotionalPackRepository.findById(id);
    if (!existing) {
      throw new AppError('Pack promocional no encontrado.', 404);
    }

    const packPayload = {};

    if (data.name !== undefined) {
      if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {
        throw new AppError('El nombre del pack no puede estar vacío.', 400);
      }
      packPayload.name = data.name.trim();
    }

    if (data.description !== undefined) {
      packPayload.description = data.description ? data.description.trim() : null;
    }

    if (data.fixed_price !== undefined) {
      const priceNum = parseFloat(data.fixed_price);
      if (isNaN(priceNum) || priceNum < 0) {
        throw new AppError('El precio fijo del pack debe ser un número válido mayor o igual a 0.', 400);
      }
      packPayload.fixed_price = priceNum;
    }

    if (data.is_active !== undefined) {
      packPayload.is_active = Boolean(data.is_active);
    }

    const startDate = data.start_date !== undefined ? data.start_date : existing.start_date;
    const endDate = data.end_date !== undefined ? data.end_date : existing.end_date;

    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      throw new AppError('La fecha de inicio no puede ser posterior a la fecha de fin de vigencia.', 400);
    }

    if (data.start_date !== undefined) packPayload.start_date = data.start_date || null;
    if (data.end_date !== undefined) packPayload.end_date = data.end_date || null;

    let validatedItems = null;
    if (data.items !== undefined) {
      if (!Array.isArray(data.items) || data.items.length === 0) {
        throw new AppError('El pack debe incluir al menos un tratamiento.', 400);
      }

      validatedItems = [];
      const seenTreatments = new Set();

      for (const item of data.items) {
        const treatmentId = parseInt(item.treatment_id, 10);
        if (!treatmentId || isNaN(treatmentId)) {
          throw new AppError('Identificador de tratamiento inválido en el pack.', 400);
        }
        if (seenTreatments.has(treatmentId)) {
          throw new AppError('No se permite duplicar el mismo tratamiento dentro del mismo pack.', 400);
        }
        seenTreatments.add(treatmentId);

        const treatment = await treatmentRepository.findById(treatmentId);
        if (!treatment || treatment.deleted_at) {
          throw new AppError(`El tratamiento con ID ${treatmentId} no existe o no está disponible.`, 404);
        }

        validatedItems.push({
          treatment_id: treatmentId,
          quantity: parseInt(item.quantity || 1, 10) || 1,
          sort_order: item.sort_order !== undefined ? parseInt(item.sort_order, 10) : undefined,
        });
      }
    }

    await promotionalPackRepository.updateWithItems(id, packPayload, validatedItems);
    return this.getById(id);
  }

  /**
   * Cambia el estado activo/inactivo del pack promocional.
   */
  async toggleStatus(id, isActive) {
    const existing = await promotionalPackRepository.findById(id);
    if (!existing) {
      throw new AppError('Pack promocional no encontrado.', 404);
    }
    const newStatus = isActive !== undefined ? Boolean(isActive) : !existing.is_active;
    await promotionalPackRepository.toggleStatus(id, newStatus);
    return this.getById(id);
  }

  /**
   * Elimina lógicamente un pack promocional.
   */
  async delete(id) {
    const existing = await promotionalPackRepository.findById(id);
    if (!existing) {
      throw new AppError('Pack promocional no encontrado.', 404);
    }
    await promotionalPackRepository.softDelete(id);
    return { message: 'Pack promocional eliminado exitosamente.' };
  }

  /**
   * Valida si un pack puede ser seleccionado para un nuevo presupuesto.
   */
  async validatePackForQuotation(id) {
    const pack = await promotionalPackRepository.findByIdWithItems(id);
    if (!pack) {
      throw new AppError('El pack promocional seleccionado no existe.', 404);
    }
    if (!pack.is_active) {
      throw new AppError(`El pack promocional "${pack.name}" está inactivo y no puede ser seleccionado para presupuestos.`, 400);
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const startDateStr = pack.start_date instanceof Date 
      ? pack.start_date.toISOString().split('T')[0] 
      : (pack.start_date ? String(pack.start_date).split('T')[0] : null);
    const endDateStr = pack.end_date instanceof Date 
      ? pack.end_date.toISOString().split('T')[0] 
      : (pack.end_date ? String(pack.end_date).split('T')[0] : null);

    if (startDateStr && startDateStr > todayStr) {
      throw new AppError(`El pack promocional "${pack.name}" aún no ha entrado en vigencia (inicia el ${startDateStr}).`, 400);
    }
    if (endDateStr && endDateStr < todayStr) {
      throw new AppError(`El pack promocional "${pack.name}" ha expirado el ${endDateStr} y no puede ser seleccionado.`, 400);
    }

    return pack;
  }
}

export default new PromotionalPackService();
