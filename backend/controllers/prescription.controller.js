import prescriptionService from '../services/prescription.service.js';
import { ApiResponse } from '../utils/response.js';
import { parsePagination, buildPaginationMeta } from '../utils/pagination.js';

export const getByPatient = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { page, limit } = parsePagination(req.query);
    const result = await prescriptionService.getByPatient(id, { page, limit });
    const rows = result.rows || [];
    const total = result.total || 0;
    const pagination = buildPaginationMeta(total, page, limit);
    return ApiResponse.paginated(res, rows, pagination, 'Prescripciones obtenidas exitosamente');
  } catch (error) {
    next(error);
  }
};

export const getById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const prescription = await prescriptionService.getById(id);
    return ApiResponse.success(res, prescription, 'Prescripción obtenida exitosamente');
  } catch (error) {
    next(error);
  }
};

export const create = async (req, res, next) => {
  try {
    const data = { ...req.body, created_by: req.user.id };
    const prescription = await prescriptionService.create(data);
    return ApiResponse.created(res, prescription, 'Prescripción creada exitosamente');
  } catch (error) {
    next(error);
  }
};

export const remove = async (req, res, next) => {
  try {
    const { id } = req.params;
    await prescriptionService.delete(id);
    return ApiResponse.success(res, null, 'Prescripción eliminada exitosamente');
  } catch (error) {
    next(error);
  }
};
