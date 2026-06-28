// ============================================
// Controlador de Cotizaciones
// ============================================
import quotationService from '../services/quotation.service.js';
import { ApiResponse } from '../utils/response.js';
import { parsePagination, buildPaginationMeta } from '../utils/pagination.js';

export const getAll = async (req, res, next) => {
  try {
    const { page, limit, sortBy, sortOrder } = parsePagination(req.query);
    const { patient_id, status, date_from, date_to } = req.query;

    const result = await quotationService.getAll({
      page,
      limit,
      offset: (page - 1) * limit,
      sortBy,
      sortOrder,
      filters: { patient_id, status, date_from, date_to },
    });

    const rows = result.rows || [];
    const total = result.total || 0;
    const pagination = buildPaginationMeta(total, page, limit);

    return ApiResponse.paginated(res, rows, pagination, 'Cotizaciones obtenidas exitosamente');
  } catch (error) {
    next(error);
  }
};

export const getById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const quotation = await quotationService.getById(id);
    return ApiResponse.success(res, quotation, 'Cotización obtenida exitosamente');
  } catch (error) {
    next(error);
  }
};

export const create = async (req, res, next) => {
  try {
    const data = { ...req.body, created_by: req.user.id };
    const quotation = await quotationService.create(data);
    return ApiResponse.created(res, quotation, 'Cotización creada exitosamente');
  } catch (error) {
    next(error);
  }
};

export const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const quotation = await quotationService.update(id, req.body);
    return ApiResponse.success(res, quotation, 'Cotización actualizada exitosamente');
  } catch (error) {
    next(error);
  }
};

export const remove = async (req, res, next) => {
  try {
    const { id } = req.params;
    await quotationService.delete(id);
    return ApiResponse.success(res, null, 'Cotización eliminada exitosamente');
  } catch (error) {
    next(error);
  }
};

export const changeStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const quotation = await quotationService.changeStatus(id, status);
    return ApiResponse.success(res, quotation, `Estado de cotización cambiado a ${status}`);
  } catch (error) {
    next(error);
  }
};
