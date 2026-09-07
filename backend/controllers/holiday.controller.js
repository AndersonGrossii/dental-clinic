// ============================================
// Controlador de Días Festivos y Bloqueos de Agenda
// ============================================
import holidayService from '../services/holiday.service.js';
import { ApiResponse } from '../utils/response.js';

export const getHolidays = async (req, res, next) => {
  try {
    const clinicId = req.user.clinic_id || 1;
    const { date_from, date_to } = req.query;
    const holidays = await holidayService.getHolidays(clinicId, date_from, date_to);
    ApiResponse.success(res, holidays);
  } catch (error) {
    next(error);
  }
};

export const createHoliday = async (req, res, next) => {
  try {
    const clinicId = req.user.clinic_id || 1;
    const holiday = await holidayService.createHoliday(clinicId, req.body, req.user.id);
    ApiResponse.success(res, holiday, 'Día festivo registrado correctamente', 201);
  } catch (error) {
    next(error);
  }
};

export const deleteHoliday = async (req, res, next) => {
  try {
    const clinicId = req.user.clinic_id || 1;
    const { id } = req.params;
    const deleted = await holidayService.deleteHoliday(id, clinicId);
    ApiResponse.success(res, deleted, 'Día festivo eliminado exitosamente');
  } catch (error) {
    next(error);
  }
};

export const seedOfficialHolidays = async (req, res, next) => {
  try {
    const clinicId = req.user.clinic_id || 1;
    const { year } = req.body;
    const holidays = await holidayService.seedOfficialHolidays(clinicId, year, req.user.id);
    ApiResponse.success(res, holidays, `Festivos oficiales cargados exitosamente (${holidays.length} días)`);
  } catch (error) {
    next(error);
  }
};
