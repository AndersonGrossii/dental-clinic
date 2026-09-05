// ============================================
// Servicio de Seguimientos de Pacientes (Follow-ups)
// ============================================
import followupRepository from '../repositories/followup.repository.js';
import { NotFoundError, ValidationError, ForbiddenError } from '../utils/errors.js';

class FollowupService {
  /**
   * Lista seguimientos según filtros.
   */
  async getFollowups(filters) {
    return followupRepository.findFollowups(filters);
  }

  /**
   * Obtiene un seguimiento por ID.
   */
  async getFollowupById(id, clinicId) {
    const followup = await followupRepository.findById(id);
    if (!followup || (clinicId && followup.clinic_id !== clinicId)) {
      throw new NotFoundError('Seguimiento de paciente no encontrado');
    }
    return followup;
  }

  /**
   * Registra un nuevo seguimiento para un paciente.
   */
  async createFollowup(data, userId, clinicId) {
    if (!data.followup_date) {
      throw new ValidationError('La fecha de seguimiento (followup_date) es obligatoria');
    }
    if (!data.reason || !data.reason.trim()) {
      throw new ValidationError('El motivo del seguimiento (reason) es obligatorio');
    }

    let assignedUserIds = [];
    if (Array.isArray(data.assigned_user_ids)) {
      assignedUserIds = data.assigned_user_ids.map(Number).filter(Boolean);
    } else if (data.assigned_to_user_id) {
      assignedUserIds = [parseInt(data.assigned_to_user_id, 10)];
    }

    const payload = {
      clinic_id: clinicId,
      patient_id: data.patient_id ? parseInt(data.patient_id, 10) : null,
      followup_date: data.followup_date,
      reason: data.reason.trim(),
      notes: data.notes ? data.notes.trim() : null,
      status: data.status || 'PENDING',
      assigned_to_user_id: assignedUserIds.length > 0 ? assignedUserIds[0] : null,
      assigned_user_ids: assignedUserIds,
      is_team_visible: Boolean(data.is_team_visible),
      created_by_user_id: userId,
    };

    return followupRepository.create(payload);
  }

  /**
   * Actualiza el estado de un seguimiento (PENDING, CONTACTED, SCHEDULED, DISCARDED).
   */
  async updateStatus(id, status, clinicId) {
    const validStatuses = ['PENDING', 'CONTACTED', 'SCHEDULED', 'DISCARDED'];
    if (!validStatuses.includes(status)) {
      throw new ValidationError(`Estado inválido. Valores permitidos: ${validStatuses.join(', ')}`);
    }
    await this.getFollowupById(id, clinicId);
    return followupRepository.updateStatus(id, status, clinicId);
  }

  /**
   * Elimina un seguimiento (Soft delete) solo si el usuario es el autor o el propietario.
   */
  async deleteFollowup(id, clinicId, userId = null, userRole = null) {
    const followup = await this.getFollowupById(id, clinicId);
    if (userId) {
      const isAuthor = followup.created_by_user_id === userId;
      const isOwner = userRole === 'propietario';

      if (!isAuthor && !isOwner) {
        throw new ForbiddenError('Solo el usuario que programó este seguimiento puede eliminarlo');
      }
    }

    await followupRepository.softDelete(id);
    return { success: true, message: 'Seguimiento eliminado exitosamente' };
  }
}

export default new FollowupService();
