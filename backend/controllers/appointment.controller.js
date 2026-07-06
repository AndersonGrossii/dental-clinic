// ============================================
// Controlador de Citas
// ============================================
import appointmentService from '../services/appointment.service.js';
import { ApiResponse } from '../utils/response.js';
import { parsePagination, buildPaginationMeta } from '../utils/pagination.js';

/**
 * Obtiene todas las citas con filtros y paginación.
 */
export const getAll = async (req, res, next) => {
  try {
    const { page, limit, sortBy, sortOrder } = parsePagination(req.query);
    let { doctor_id, patient_id, status_id, date_from, date_to, search, time_from, time_to } = req.query;

    if (req.user.roleName === 'doctor') {
      doctor_id = req.user.doctorId;
    }

    const { data: appointments, total } = await appointmentService.getAll({
      page,
      limit,
      sortBy,
      sortOrder,
      filters: { doctor_id, patient_id, status_id, date_from, date_to, search, time_from, time_to },
    });

    const pagination = buildPaginationMeta(total, page, limit);

    return ApiResponse.paginated(res, appointments, pagination, 'Citas obtenidas exitosamente');
  } catch (error) {
    next(error);
  }
};

/**
 * Obtiene el detalle de una cita por su ID.
 */
export const getById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const appointment = await appointmentService.getById(id);
    return ApiResponse.success(res, appointment, 'Cita obtenida exitosamente');
  } catch (error) {
    next(error);
  }
};

/**
 * Crea una nueva cita.
 */
export const create = async (req, res, next) => {
  try {
    const appointmentData = req.body;
    const userId = req.user.id;

    if (req.user.roleName === 'doctor') {
      if (Number(appointmentData.doctor_id) !== Number(req.user.doctorId)) {
        return ApiResponse.error(res, 'No tiene permisos para programar citas para otros doctores.', 403);
      }
    }

    const appointment = await appointmentService.create(appointmentData, userId);
    return ApiResponse.created(res, appointment, 'Cita programada exitosamente');
  } catch (error) {
    next(error);
  }
};

/**
 * Actualiza una cita existente (reprograma).
 */
export const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const appointmentData = req.body;

    if (req.user.roleName === 'doctor') {
      const existing = await appointmentService.getById(id);
      if (!existing || Number(existing.doctor_id) !== Number(req.user.doctorId)) {
        return ApiResponse.error(res, 'No tiene permisos para modificar esta cita.', 403);
      }
      if (appointmentData.doctor_id !== undefined && Number(appointmentData.doctor_id) !== Number(req.user.doctorId)) {
        return ApiResponse.error(res, 'No tiene permisos para asignar esta cita a otro doctor.', 403);
      }
    }

    const appointment = await appointmentService.update(id, appointmentData);
    return ApiResponse.success(res, appointment, 'Cita actualizada exitosamente');
  } catch (error) {
    next(error);
  }
};

/**
 * Cambia el estado de una cita (confirmada, en consulta, completada, no asistió, etc.).
 */
export const updateStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status_name, cancellation_reason } = req.body;
    const appointment = await appointmentService.updateStatus(id, status_name, cancellation_reason);
    return ApiResponse.success(res, appointment, `Estado de la cita cambiado a ${status_name}`);
  } catch (error) {
    next(error);
  }
};

/**
 * Cancela una cita.
 */
export const remove = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (req.user.roleName === 'doctor') {
      const existing = await appointmentService.getById(id);
      if (!existing || Number(existing.doctor_id) !== Number(req.user.doctorId)) {
        return ApiResponse.error(res, 'No tiene permisos para cancelar esta cita.', 403);
      }
    }

    const appointment = await appointmentService.delete(id);
    return ApiResponse.success(res, appointment, 'Cita cancelada exitosamente');
  } catch (error) {
    next(error);
  }
};

/**
 * Obtiene citas formateadas para vista de calendario.
 */
export const getCalendar = async (req, res, next) => {
  try {
    let { start_date, end_date, doctor_id } = req.query;
    if (req.user.roleName === 'doctor') {
      doctor_id = req.user.doctorId;
    }
    const calendarEvents = await appointmentService.getCalendar(start_date, end_date, doctor_id);
    return ApiResponse.success(res, calendarEvents, 'Citas para calendario obtenidas');
  } catch (error) {
    next(error);
  }
};

/**
 * Obtiene las citas del día actual para un doctor.
 */
export const getTodayAppointments = async (req, res, next) => {
  try {
    const doctorId = req.user.doctorId || req.query.doctor_id;
    const appointments = await appointmentService.getTodayAppointments(doctorId);
    return ApiResponse.success(res, appointments, 'Citas de hoy obtenidas');
  } catch (error) {
    next(error);
  }
};

/**
 * Obtiene las estadísticas rápidas del dashboard para citas.
 */
export const getStats = async (req, res, next) => {
  try {
    const doctorId = req.user.roleName === 'doctor' ? req.user.doctorId : null;
    const stats = await appointmentService.getStats(doctorId);
    return ApiResponse.success(res, stats, 'Estadísticas de citas obtenidas');
  } catch (error) {
    next(error);
  }
};
