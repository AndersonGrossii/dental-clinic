// ============================================
// Controlador de Doctores
// ============================================
import doctorService from '../services/doctor.service.js';
import { ApiResponse } from '../utils/response.js';
import { parsePagination } from '../utils/pagination.js';

export const getAll = async (req, res, next) => {
  try {
    const { page, limit } = parsePagination(req.query);
    const { doctors, pagination } = await doctorService.getAll({ page, limit });
    return ApiResponse.paginated(res, doctors, pagination, 'Doctores obtenidos exitosamente');
  } catch (error) {
    next(error);
  }
};

export const getById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const doctor = await doctorService.getById(id);
    return ApiResponse.success(res, doctor, 'Doctor obtenido exitosamente');
  } catch (error) {
    next(error);
  }
};

export const getSchedule = async (req, res, next) => {
  try {
    const { id } = req.params;
    const schedule = await doctorService.getSchedule(id);
    return ApiResponse.success(res, schedule, 'Horario de doctor obtenido');
  } catch (error) {
    next(error);
  }
};

export const updateSchedule = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (req.user.roleName === 'doctor') {
      if (!req.user.doctorId || Number(id) !== Number(req.user.doctorId)) {
        return ApiResponse.error(res, 'No tiene permisos para modificar la configuración de otro doctor.', 403);
      }
    }

    const scheduleArray = req.body; // Se espera array de horarios
    const schedule = await doctorService.updateSchedule(id, scheduleArray);
    return ApiResponse.success(res, schedule, 'Horario de doctor actualizado exitosamente');
  } catch (error) {
    next(error);
  }
};

export const getUnavailability = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { date_from, date_to } = req.query;
    if (!date_from || !date_to) {
      return ApiResponse.error(res, 'date_from y date_to son requeridos', 400);
    }
    const records = await doctorService.getUnavailability(id, date_from, date_to);
    return ApiResponse.success(res, records, 'No disponibilidad obtenida exitosamente');
  } catch (error) {
    next(error);
  }
};

export const addUnavailability = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (req.user.roleName === 'doctor') {
      if (!req.user.doctorId || Number(id) !== Number(req.user.doctorId)) {
        return ApiResponse.error(res, 'No tiene permisos para modificar la configuración de otro doctor.', 403);
      }
    }

    const unavailabilityData = req.body;
    const record = await doctorService.addUnavailability(id, unavailabilityData);
    return ApiResponse.created(res, record, 'No disponibilidad registrada exitosamente');
  } catch (error) {
    next(error);
  }
};

export const removeUnavailability = async (req, res, next) => {
  try {
    const { id, unavailId } = req.params;

    if (req.user.roleName === 'doctor') {
      if (!req.user.doctorId || Number(id) !== Number(req.user.doctorId)) {
        return ApiResponse.error(res, 'No tiene permisos para modificar la configuración de otro doctor.', 403);
      }
    }

    await doctorService.removeUnavailability(unavailId, id);
    return ApiResponse.success(res, null, 'No disponibilidad eliminada exitosamente');
  } catch (error) {
    next(error);
  }
};

export const getWorkdays = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { date_from, date_to } = req.query;
    const records = await doctorService.getWorkdays(id, date_from || null, date_to || null);
    return ApiResponse.success(res, records, 'Días específicos de atención obtenidos exitosamente');
  } catch (error) {
    next(error);
  }
};

export const addWorkday = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (req.user.roleName === 'doctor') {
      if (!req.user.doctorId || Number(id) !== Number(req.user.doctorId)) {
        return ApiResponse.error(res, 'No tiene permisos para modificar la configuración de otro doctor.', 403);
      }
    }

    const workdayData = req.body;
    const record = await doctorService.addWorkday(id, workdayData);
    return ApiResponse.created(res, record, 'Día específico de atención registrado exitosamente');
  } catch (error) {
    next(error);
  }
};

export const removeWorkday = async (req, res, next) => {
  try {
    const { id, workdayId } = req.params;

    if (req.user.roleName === 'doctor') {
      if (!req.user.doctorId || Number(id) !== Number(req.user.doctorId)) {
        return ApiResponse.error(res, 'No tiene permisos para modificar la configuración de otro doctor.', 403);
      }
    }

    await doctorService.removeWorkday(workdayId, id);
    return ApiResponse.success(res, null, 'Día específico de atención eliminado exitosamente');
  } catch (error) {
    next(error);
  }
};

export const create = async (req, res, next) => {
  try {
    const doctor = await doctorService.create(req.body);
    return ApiResponse.created(res, doctor, 'Doctor creado exitosamente');
  } catch (error) {
    next(error);
  }
};

export const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const doctor = await doctorService.update(id, req.body);
    return ApiResponse.success(res, doctor, 'Doctor actualizado exitosamente');
  } catch (error) {
    next(error);
  }
};

export const remove = async (req, res, next) => {
  try {
    const { id } = req.params;
    await doctorService.delete(id);
    return ApiResponse.success(res, null, 'Doctor eliminado exitosamente');
  } catch (error) {
    next(error);
  }
};

export const getAvailability = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { date } = req.query; // YYYY-MM-DD
    const slots = await doctorService.getAvailability(id, date);
    return ApiResponse.success(res, slots, 'Disponibilidad horaria obtenida');
  } catch (error) {
    next(error);
  }
};
