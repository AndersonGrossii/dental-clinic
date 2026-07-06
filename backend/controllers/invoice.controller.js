// ============================================
// Controlador de Facturas
// ============================================
import invoiceService from '../services/invoice.service.js';
import { ApiResponse } from '../utils/response.js';
import { parsePagination } from '../utils/pagination.js';

export const getAll = async (req, res, next) => {
  try {
    const { page, limit, sortBy, sortOrder } = parsePagination(req.query);
    const { patient_id, status, date_from, date_to } = req.query;

    const { invoices, pagination } = await invoiceService.getAll({
      page,
      limit,
      sortBy,
      sortOrder,
      filters: { patient_id, status, date_from, date_to },
    });

    return ApiResponse.paginated(res, invoices, pagination, 'Facturas obtenidas exitosamente');
  } catch (error) {
    next(error);
  }
};

export const getById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const invoice = await invoiceService.getById(id);
    return ApiResponse.success(res, invoice, 'Factura obtenida exitosamente');
  } catch (error) {
    next(error);
  }
};

export const create = async (req, res, next) => {
  try {
    const data = { ...req.body, created_by: req.user.id };
    const invoice = await invoiceService.create(data, req.user.id);
    return ApiResponse.created(res, invoice, 'Factura creada exitosamente');
  } catch (error) {
    next(error);
  }
};

export const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const invoice = await invoiceService.update(id, req.body);
    return ApiResponse.success(res, invoice, 'Factura actualizada exitosamente');
  } catch (error) {
    next(error);
  }
};

export const remove = async (req, res, next) => {
  try {
    const { id } = req.params;
    await invoiceService.delete(id);
    return ApiResponse.success(res, null, 'Factura eliminada exitosamente');
  } catch (error) {
    next(error);
  }
};

export const createFromQuotation = async (req, res, next) => {
  try {
    const { quotationId } = req.params;
    const userId = req.user.id;
    const invoice = await invoiceService.createFromQuotation(quotationId, userId);
    return ApiResponse.created(res, invoice, 'Factura generada desde cotización exitosamente');
  } catch (error) {
    next(error);
  }
};

export const getStats = async (req, res, next) => {
  try {
    const stats = await invoiceService.getStats();
    return ApiResponse.success(res, stats, 'Estadísticas de facturas obtenidas');
  } catch (error) {
    next(error);
  }
};
