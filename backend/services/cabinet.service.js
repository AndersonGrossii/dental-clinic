// ============================================
// Servicio de Gabinetes / Salas de Tratamiento
// ============================================
import cabinetRepository from '../repositories/cabinet.repository.js';
import { AppError } from '../utils/errors.js';

class CabinetService {
  /**
   * Obtiene los gabinetes de la clínica activa.
   */
  async getCabinets(clinicId, { onlyActive = true } = {}) {
    if (!clinicId) {
      throw new AppError('Contexto de clínica requerido.', 400);
    }
    return await cabinetRepository.findByClinic(clinicId, { onlyActive });
  }

  /**
   * Crea un nuevo gabinete para la clínica.
   */
  async createCabinet(clinicId, { name, code, is_active = true }) {
    if (!clinicId) throw new AppError('Contexto de clínica requerido.', 400);
    if (!name || !name.trim()) throw new AppError('El nombre del gabinete es requerido.', 400);

    const existing = await cabinetRepository.findByName(name.trim(), clinicId);
    if (existing) {
      throw new AppError(`Ya existe un gabinete con el nombre "${name.trim()}" en esta clínica.`, 409);
    }

    return await cabinetRepository.createCabinet({
      clinicId,
      name: name.trim(),
      code: code ? code.trim() : null,
      isActive: is_active,
    });
  }

  /**
   * Desactiva un gabinete garantizando que no existan citas futuras asociadas.
   */
  async deactivateCabinet(id, clinicId) {
    if (!clinicId) throw new AppError('Contexto de clínica requerido.', 400);

    const cabinet = await cabinetRepository.findById(id);
    if (!cabinet || cabinet.clinic_id !== clinicId) {
      throw new AppError('Gabinete no encontrado en esta clínica.', 404);
    }

    // Verificar si existen citas futuras en este gabinete
    const futureCount = await cabinetRepository.countFutureAppointments(clinicId, cabinet.name);
    if (futureCount > 0) {
      throw new AppError(
        `No se puede desactivar el gabinete "${cabinet.name}" porque tiene ${futureCount} cita(s) futura(s) programada(s). Reasigne las citas antes de desactivarlo.`,
        409
      );
    }

    return await cabinetRepository.setActiveStatus(id, clinicId, false);
  }

  /**
   * Reactiva un gabinete previamente archivado o desactivado.
   */
  async activateCabinet(id, clinicId) {
    if (!clinicId) throw new AppError('Contexto de clínica requerido.', 400);

    const cabinet = await cabinetRepository.findById(id);
    if (!cabinet || cabinet.clinic_id !== clinicId) {
      throw new AppError('Gabinete no encontrado en esta clínica.', 404);
    }

    return await cabinetRepository.setActiveStatus(id, clinicId, true);
  }
}

export default new CabinetService();
