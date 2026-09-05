// ============================================
// Servicio de Odontograma Clínico
// ============================================
import odontogramRepository from '../repositories/odontogram.repository.js';
import patientRepository from '../repositories/patient.repository.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';

const VALID_CONDITIONS = [
  'CARIES',
  'OBTURACION',
  'CORONA',
  'ENDODONCIA',
  'IMPLANTE',
  'AUSENTE',
  'FRACTURA',
  'PROTESIS',
  'SELLADOR',
  'SANO',
  'GINGIVITIS',
  'PERIODONTITIS',
];

const VALID_STATES = ['DIAGNOSED', 'PLANNED', 'COMPLETED'];

class OdontogramService {
  /**
   * Obtiene el odontograma completo de un paciente organizado por pieza dental.
   */
  async getPatientOdontogram(patientId, clinicId) {
    const patient = await patientRepository.findById(patientId);
    if (!patient || (clinicId && patient.clinic_id !== clinicId)) {
      throw new NotFoundError('Paciente no encontrado');
    }

    const entries = await odontogramRepository.getByPatient(patientId, clinicId);

    // Organizar en mapa por tooth_number para consumo rápido en el cliente
    const teethMap = {};
    for (const entry of entries) {
      if (!teethMap[entry.tooth_number]) {
        teethMap[entry.tooth_number] = [];
      }
      teethMap[entry.tooth_number].push(entry);
    }

    return {
      patient_id: parseInt(patientId, 10),
      entries,
      teethMap,
    };
  }

  /**
   * Registra un nuevo hallazgo o procedimiento en el odontograma.
   */
  async saveEntry(patientId, data, userId, clinicId) {
    const patient = await patientRepository.findById(patientId);
    if (!patient || (clinicId && patient.clinic_id !== clinicId)) {
      throw new NotFoundError('Paciente no encontrado');
    }

    if (!data.tooth_number || !String(data.tooth_number).trim()) {
      throw new ValidationError('El número de pieza dental (FDI) es obligatorio');
    }

    const condition = (data.condition || '').toUpperCase().trim();
    if (!condition) {
      throw new ValidationError('La condición dental es obligatoria');
    }

    const state = (data.state || 'DIAGNOSED').toUpperCase().trim();
    if (!VALID_STATES.includes(state)) {
      throw new ValidationError(`Estado inválido. Debe ser uno de: ${VALID_STATES.join(', ')}`);
    }

    const surfaces = Array.isArray(data.surfaces) ? data.surfaces.map(s => String(s).toUpperCase().trim()) : [];

    const payload = {
      clinic_id: clinicId,
      patient_id: parseInt(patientId, 10),
      tooth_number: String(data.tooth_number).trim(),
      surfaces,
      condition,
      state,
      severity: data.severity || 'MODERATE',
      notes: data.notes ? data.notes.trim() : null,
      created_by_user_id: userId,
    };

    const entry = await odontogramRepository.create(payload);
    return odontogramRepository.getEntryById(entry.id, clinicId);
  }

  /**
   * Actualiza una entrada de odontograma existente.
   */
  async updateEntry(entryId, data, clinicId) {
    const existing = await odontogramRepository.getEntryById(entryId, clinicId);
    if (!existing) {
      throw new NotFoundError('Entrada de odontograma no encontrada');
    }

    const updateData = {};
    if (data.tooth_number !== undefined) updateData.tooth_number = String(data.tooth_number).trim();
    if (data.condition !== undefined) updateData.condition = String(data.condition).toUpperCase().trim();
    if (data.state !== undefined) {
      const state = String(data.state).toUpperCase().trim();
      if (!VALID_STATES.includes(state)) {
        throw new ValidationError(`Estado inválido. Debe ser uno de: ${VALID_STATES.join(', ')}`);
      }
      updateData.state = state;
    }
    if (data.surfaces !== undefined) {
      updateData.surfaces = Array.isArray(data.surfaces) ? data.surfaces.map(s => String(s).toUpperCase().trim()) : [];
    }
    if (data.severity !== undefined) updateData.severity = data.severity;
    if (data.notes !== undefined) updateData.notes = data.notes ? data.notes.trim() : null;

    await odontogramRepository.update(entryId, updateData);
    return odontogramRepository.getEntryById(entryId, clinicId);
  }

  /**
   * Elimina una entrada del odontograma (Soft delete).
   */
  async deleteEntry(entryId, clinicId) {
    const existing = await odontogramRepository.getEntryById(entryId, clinicId);
    if (!existing) {
      throw new NotFoundError('Entrada de odontograma no encontrada');
    }
    await odontogramRepository.softDelete(entryId);
    return { success: true, message: 'Entrada eliminada exitosamente' };
  }
}

export default new OdontogramService();
