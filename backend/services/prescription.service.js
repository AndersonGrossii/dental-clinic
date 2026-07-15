import prescriptionRepository from '../repositories/prescription.repository.js';
import { AppError } from '../utils/errors.js';

class PrescriptionService {
  async getByPatient(patientId, queryParams = {}) {
    const { page = 1, limit = 20 } = queryParams;
    const offset = (page - 1) * limit;
    return prescriptionRepository.findByPatient(patientId, { limit, offset });
  }

  async getById(id) {
    const prescription = await prescriptionRepository.findByIdWithItems(id);
    if (!prescription) {
      throw new AppError('Prescripción no encontrada.', 404);
    }
    return prescription;
  }

  async create(data) {
    const { items, ...fields } = data;

    if (!items || items.length === 0) {
      throw new AppError('Debe incluir al menos un medicamento.', 400);
    }

    for (const item of items) {
      if (!item.medication_name || !item.medication_name.trim()) {
        throw new AppError('El nombre del medicamento es obligatorio.', 400);
      }
    }

    const number = await prescriptionRepository.generateNumber();

    const prescriptionData = {
      prescription_number: number,
      patient_id: fields.patient_id,
      doctor_id: fields.doctor_id,
      notes: fields.notes || null,
      issued_date: fields.issued_date || new Date().toISOString().split('T')[0],
      valid_until: fields.valid_until || null,
      created_by: fields.created_by,
    };

    return prescriptionRepository.createWithItems(prescriptionData, items);
  }

  async delete(id) {
    const existing = await prescriptionRepository.findById(id);
    if (!existing) {
      throw new AppError('Prescripción no encontrada.', 404);
    }
    const deleted = await prescriptionRepository.softDelete(id);
    if (!deleted) {
      throw new AppError('No se pudo eliminar la prescripción.', 500);
    }
    return true;
  }
}

export default new PrescriptionService();
