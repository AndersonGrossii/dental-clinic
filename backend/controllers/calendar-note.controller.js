// ============================================
// Controlador de Notas de Calendario
// ============================================
import calendarNoteService from '../services/calendar-note.service.js';
import { ApiResponse } from '../utils/response.js';

export const getAll = async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;

    const notes = await calendarNoteService.getNotes({
      clinicId: req.user.clinicId,
      userId: req.user.id,
      startDate: start_date,
      endDate: end_date,
    });

    ApiResponse.success(res, notes);
  } catch (error) {
    next(error);
  }
};

export const getById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const note = await calendarNoteService.getNoteById(parseInt(id, 10), req.user.clinicId);
    ApiResponse.success(res, note);
  } catch (error) {
    next(error);
  }
};

export const create = async (req, res, next) => {
  try {
    const note = await calendarNoteService.createNote(req.body, req.user.id, req.user.clinicId);
    ApiResponse.success(res, note, 'Nota creada exitosamente', 201);
  } catch (error) {
    next(error);
  }
};

export const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const note = await calendarNoteService.updateNote(parseInt(id, 10), req.body, req.user.id, req.user.clinicId);
    ApiResponse.success(res, note, 'Nota actualizada exitosamente');
  } catch (error) {
    next(error);
  }
};

export const remove = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await calendarNoteService.deleteNote(parseInt(id, 10), req.user.id, req.user.clinicId);
    ApiResponse.success(res, result);
  } catch (error) {
    next(error);
  }
};
