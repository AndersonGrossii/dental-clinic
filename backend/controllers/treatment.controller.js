// ============================================
// Controlador de Tratamientos
// ============================================
import treatmentService from '../services/treatment.service.js';
import { ApiResponse } from '../utils/response.js';
import { parsePagination, buildPaginationMeta } from '../utils/pagination.js';

export const getAll = async (req, res, next) => {
  try {
    const { page, limit, offset, sortBy, sortOrder } = parsePagination(req.query);
    const { category_id, is_active } = req.query;

    const { data: treatments, total } = await treatmentService.getAll({
      limit,
      offset,
      sortBy,
      sortOrder,
      filters: { category_id, is_active },
    });
    const pagination = buildPaginationMeta(total, page, limit);

    return ApiResponse.paginated(res, treatments, pagination, 'Tratamientos obtenidos exitosamente');
  } catch (error) {
    next(error);
  }
};

export const getById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const treatment = await treatmentService.getById(id);
    return ApiResponse.success(res, treatment, 'Tratamiento obtenido exitosamente');
  } catch (error) {
    next(error);
  }
};

export const create = async (req, res, next) => {
  try {
    const treatment = await treatmentService.create(req.body);
    return ApiResponse.created(res, treatment, 'Tratamiento creado exitosamente');
  } catch (error) {
    next(error);
  }
};

export const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const treatment = await treatmentService.update(id, req.body);
    return ApiResponse.success(res, treatment, 'Tratamiento actualizado exitosamente');
  } catch (error) {
    next(error);
  }
};

export const remove = async (req, res, next) => {
  try {
    const { id } = req.params;
    await treatmentService.delete(id);
    return ApiResponse.success(res, null, 'Tratamiento eliminado exitosamente');
  } catch (error) {
    next(error);
  }
};

export const getCategories = async (req, res, next) => {
  try {
    const categories = await treatmentService.getCategories();
    return ApiResponse.success(res, categories, 'Categorías de tratamientos obtenidas');
  } catch (error) {
    next(error);
  }
};

export const createCategory = async (req, res, next) => {
  try {
    const category = await treatmentService.createCategory(req.body);
    return ApiResponse.created(res, category, 'Categoría creada exitosamente');
  } catch (error) {
    next(error);
  }
};

export const updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const category = await treatmentService.updateCategory(id, req.body);
    return ApiResponse.success(res, category, 'Categoría actualizada exitosamente');
  } catch (error) {
    next(error);
  }
};

export const getPatientTreatments = async (req, res, next) => {
  try {
    const { patientId } = req.params;
    const treatments = await treatmentService.getPatientTreatments(patientId);
    return ApiResponse.success(res, treatments, 'Tratamientos del paciente obtenidos');
  } catch (error) {
    next(error);
  }
};

export const addPatientTreatment = async (req, res, next) => {
  try {
    const data = { ...req.body, created_by: req.user.id };
    const treatment = await treatmentService.addPatientTreatment(data);
    return ApiResponse.created(res, treatment, 'Tratamiento registrado en el historial del paciente');
  } catch (error) {
    next(error);
  }
};

export const updatePatientTreatment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const treatment = await treatmentService.updatePatientTreatment(id, req.body);
    return ApiResponse.success(res, treatment, 'Tratamiento del historial actualizado');
  } catch (error) {
    next(error);
  }
};
