// ============================================
// Servicio de Notas de Calendario
// ============================================
import calendarNoteRepository from '../repositories/calendar-note.repository.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';

class CalendarNoteService {
  /**
   * Obtiene notas en un rango de fechas.
   */
  async getNotes(filters) {
    return calendarNoteRepository.findNotes(filters);
  }

  /**
   * Obtiene una nota por ID.
   */
  async getNoteById(id, clinicId) {
    const note = await calendarNoteRepository.findById(id);
    if (!note || (clinicId && note.clinic_id !== clinicId)) {
      throw new NotFoundError('Nota de calendario no encontrada');
    }
    return note;
  }

  /**
   * Crea una nueva nota adhesiva de calendario.
   */
  async createNote(data, userId, clinicId) {
    if (!data.note_date) {
      throw new ValidationError('La fecha de la nota (note_date) es obligatoria');
    }
    if (!data.content || !data.content.trim()) {
      throw new ValidationError('El contenido de la nota no puede estar vacío');
    }

    let assignedUserIds = [];
    if (Array.isArray(data.assigned_user_ids)) {
      assignedUserIds = data.assigned_user_ids.map(Number).filter(Boolean);
    } else if (data.assigned_to_user_id) {
      assignedUserIds = [parseInt(data.assigned_to_user_id, 10)];
    }

    const payload = {
      clinic_id: clinicId,
      note_date: data.note_date,
      title: data.title ? data.title.trim() : null,
      content: data.content.trim(),
      color: data.color || '#fef08a',
      is_pinned: Boolean(data.is_pinned),
      user_id: userId,
      assigned_to_user_id: assignedUserIds.length > 0 ? assignedUserIds[0] : null,
      assigned_user_ids: assignedUserIds,
      is_team_visible: Boolean(data.is_team_visible),
    };

    return calendarNoteRepository.create(payload);
  }

  /**
   * Actualiza una nota existente.
   */
  async updateNote(id, data, userId, clinicId) {
    const note = await this.getNoteById(id, clinicId);

    const updateData = {};
    if (data.note_date !== undefined) updateData.note_date = data.note_date;
    if (data.title !== undefined) updateData.title = data.title ? data.title.trim() : null;
    if (data.content !== undefined) updateData.content = data.content.trim();
    if (data.color !== undefined) updateData.color = data.color;
    if (data.is_pinned !== undefined) updateData.is_pinned = Boolean(data.is_pinned);
    if (data.is_team_visible !== undefined) updateData.is_team_visible = Boolean(data.is_team_visible);
    if (data.assigned_user_ids !== undefined && Array.isArray(data.assigned_user_ids)) {
      updateData.assigned_user_ids = data.assigned_user_ids.map(Number).filter(Boolean);
      updateData.assigned_to_user_id = updateData.assigned_user_ids[0] || null;
    } else if (data.assigned_to_user_id !== undefined) {
      updateData.assigned_to_user_id = data.assigned_to_user_id ? parseInt(data.assigned_to_user_id, 10) : null;
      updateData.assigned_user_ids = updateData.assigned_to_user_id ? [updateData.assigned_to_user_id] : [];
    }
    updateData.updated_at = new Date();

    return calendarNoteRepository.update(id, updateData);
  }

  /**
   * Elimina una nota (Soft delete).
   */
  async deleteNote(id, userId, clinicId) {
    await this.getNoteById(id, clinicId);
    await calendarNoteRepository.softDelete(id);
    return { success: true, message: 'Nota eliminada exitosamente' };
  }
}

export default new CalendarNoteService();
