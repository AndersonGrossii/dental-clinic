// ============================================
// Controlador de Configuración y Auditoría
// ============================================
import settingsService from '../services/settings.service.js';
import { ApiResponse } from '../utils/response.js';
import { parsePagination } from '../utils/pagination.js';

export const getAllSettings = async (req, res, next) => {
  try {
    const settings = await settingsService.getAll();
    return ApiResponse.success(res, settings, 'Configuraciones obtenidas');
  } catch (error) {
    next(error);
  }
};

export const updateSetting = async (req, res, next) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    const setting = await settingsService.update(key, value);
    return ApiResponse.success(res, setting, `Configuración '${key}' actualizada exitosamente`);
  } catch (error) {
    next(error);
  }
};

export const getClinicInfo = async (req, res, next) => {
  try {
    const info = await settingsService.getClinicInfo();
    return ApiResponse.success(res, info, 'Información de la clínica obtenida');
  } catch (error) {
    next(error);
  }
};

export const updateClinicInfo = async (req, res, next) => {
  try {
    const info = await settingsService.updateClinicInfo(req.body);
    return ApiResponse.success(res, info, 'Información de la clínica actualizada exitosamente');
  } catch (error) {
    next(error);
  }
};

export const getAuditLogs = async (req, res, next) => {
  try {
    const { page, limit } = parsePagination(req.query);
    const { user_id, action, date_from, date_to } = req.query;

    const { logs, pagination } = await settingsService.getAuditLogs({
      page,
      limit,
      user_id,
      action,
      date_from,
      date_to,
    });

    return ApiResponse.paginated(res, logs, pagination, 'Registro de auditoría obtenido exitosamente');
  } catch (error) {
    next(error);
  }
};
