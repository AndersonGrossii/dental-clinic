// ============================================
// Servicio de Tareas del Equipo Clínico
// ============================================
import taskRepository from '../repositories/task.repository.js';
import { NotFoundError, ValidationError, ForbiddenError } from '../utils/errors.js';

class TaskService {
  /**
   * Lista tareas según filtros.
   */
  async getTasks(filters) {
    return taskRepository.findTasks(filters);
  }

  /**
   * Obtiene una tarea por ID.
   */
  async getTaskById(id, clinicId) {
    const task = await taskRepository.getTaskById(id, clinicId);
    if (!task) {
      throw new NotFoundError('Tarea no encontrada');
    }
    return task;
  }

  /**
   * Crea una nueva tarea.
   */
  async createTask(data, userId, clinicId) {
    if (!data.title || !data.title.trim()) {
      throw new ValidationError('El título de la tarea es obligatorio');
    }
    if (!data.due_date) {
      throw new ValidationError('La fecha límite (due_date) es obligatoria');
    }

    let assignedUserIds = [];
    if (Array.isArray(data.assigned_user_ids)) {
      assignedUserIds = data.assigned_user_ids.map(Number).filter(Boolean);
    } else if (data.assigned_to_user_id) {
      assignedUserIds = [parseInt(data.assigned_to_user_id, 10)];
    }

    const payload = {
      clinic_id: clinicId,
      title: data.title.trim(),
      description: data.description ? data.description.trim() : null,
      due_date: data.due_date,
      due_time: data.due_time || null,
      priority: data.priority || 'MEDIUM',
      status: data.status || 'PENDING',
      assigned_to_user_id: assignedUserIds.length > 0 ? assignedUserIds[0] : null,
      assigned_user_ids: assignedUserIds,
      is_team_visible: Boolean(data.is_team_visible),
      created_by_user_id: userId,
      patient_id: data.patient_id ? parseInt(data.patient_id, 10) : null,
      appointment_id: data.appointment_id ? parseInt(data.appointment_id, 10) : null,
    };

    const task = await taskRepository.create(payload);
    return this.getTaskById(task.id, clinicId);
  }

  /**
   * Actualiza una tarea existente.
   */
  async updateTask(id, data, clinicId) {
    const existing = await this.getTaskById(id, clinicId);

    const updateData = {};
    if (data.title !== undefined) updateData.title = data.title.trim();
    if (data.description !== undefined) updateData.description = data.description ? data.description.trim() : null;
    if (data.due_date !== undefined) updateData.due_date = data.due_date;
    if (data.due_time !== undefined) updateData.due_time = data.due_time;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.is_team_visible !== undefined) updateData.is_team_visible = Boolean(data.is_team_visible);
    if (data.assigned_user_ids !== undefined && Array.isArray(data.assigned_user_ids)) {
      updateData.assigned_user_ids = data.assigned_user_ids.map(Number).filter(Boolean);
      updateData.assigned_to_user_id = updateData.assigned_user_ids[0] || null;
    } else if (data.assigned_to_user_id !== undefined) {
      updateData.assigned_to_user_id = data.assigned_to_user_id ? parseInt(data.assigned_to_user_id, 10) : null;
      updateData.assigned_user_ids = updateData.assigned_to_user_id ? [updateData.assigned_to_user_id] : [];
    }
    if (data.patient_id !== undefined) updateData.patient_id = data.patient_id ? parseInt(data.patient_id, 10) : null;

    updateData.updated_at = new Date();

    await taskRepository.update(id, updateData);
    return this.getTaskById(id, clinicId);
  }

  /**
   * Cambia el estado de una tarea (PENDING, IN_PROGRESS, COMPLETED, CANCELLED).
   */
  async updateStatus(id, status, clinicId) {
    const validStatuses = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      throw new ValidationError(`Estado inválido. Valores permitidos: ${validStatuses.join(', ')}`);
    }

    const existing = await this.getTaskById(id, clinicId);
    await taskRepository.updateStatus(id, status, clinicId);
    return this.getTaskById(id, clinicId);
  }

  /**
   * Elimina una tarea (Soft delete) solo si el usuario es el autor o el propietario.
   */
  async deleteTask(id, clinicId, userId = null, userRole = null) {
    const task = await this.getTaskById(id, clinicId);
    if (userId) {
      const isAuthor = task.created_by_user_id === userId;
      const isOwner = userRole === 'propietario';

      if (!isAuthor && !isOwner) {
        throw new ForbiddenError('Solo el usuario que creó esta tarea puede eliminarla');
      }
    }

    await taskRepository.softDelete(id);
    return { success: true, message: 'Tarea eliminada exitosamente' };
  }
}

export default new TaskService();
