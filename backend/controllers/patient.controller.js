// ============================================
// Controlador de Pacientes
// ============================================
import patientService from '../services/patient.service.js';
import { ApiResponse } from '../utils/response.js';
import { parsePagination, buildPaginationMeta } from '../utils/pagination.js';

/**
 * Lista todos los pacientes con paginación y filtros.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export const getAll = async (req, res, next) => {
  try {
    const { page, limit, offset, sortBy, sortOrder } = parsePagination(req.query);

    const filters = {};
    if (req.query.isActive !== undefined) filters.isActive = req.query.isActive === 'true';
    if (req.query.gender) filters.gender = req.query.gender;
    if (req.query.insuranceProvider) filters.insuranceProvider = req.query.insuranceProvider;

    const { rows, total } = await patientService.getAll({
      limit,
      offset,
      sortBy,
      sortOrder,
      filters,
    });

    const pagination = buildPaginationMeta(total, page, limit);

    return ApiResponse.paginated(res, rows, pagination, 'Pacientes obtenidos exitosamente.');
  } catch (error) {
    next(error);
  }
};

/**
 * Obtiene un paciente por ID con perfil completo.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export const getById = async (req, res, next) => {
  try {
    const patient = await patientService.getById(parseInt(req.params.id, 10));

    return ApiResponse.success(res, patient, 'Paciente obtenido exitosamente.');
  } catch (error) {
    next(error);
  }
};

/**
 * Crea un nuevo paciente.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export const create = async (req, res, next) => {
  try {
    const patient = await patientService.create(req.body, req.user.id);

    return ApiResponse.created(res, patient, 'Paciente creado exitosamente.');
  } catch (error) {
    next(error);
  }
};

/**
 * Actualiza un paciente existente.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export const update = async (req, res, next) => {
  try {
    const patient = await patientService.update(parseInt(req.params.id, 10), req.body);

    return ApiResponse.success(res, patient, 'Paciente actualizado exitosamente.');
  } catch (error) {
    next(error);
  }
};

/**
 * Elimina un paciente (soft delete).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export const remove = async (req, res, next) => {
  try {
    await patientService.delete(parseInt(req.params.id, 10));

    return ApiResponse.success(res, null, 'Paciente eliminado exitosamente.');
  } catch (error) {
    next(error);
  }
};

/**
 * Busca pacientes por término de búsqueda.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export const search = async (req, res, next) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const term = req.query.q || req.query.term || '';

    const { rows, total } = await patientService.search(term, { limit, offset });

    const pagination = buildPaginationMeta(total, page, limit);

    return ApiResponse.paginated(res, rows, pagination, 'Resultados de búsqueda obtenidos.');
  } catch (error) {
    next(error);
  }
};

/**
 * Obtiene el historial médico y dental de un paciente.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export const getHistory = async (req, res, next) => {
  try {
    const history = await patientService.getHistory(parseInt(req.params.id, 10));

    return ApiResponse.success(res, history, 'Historial del paciente obtenido exitosamente.');
  } catch (error) {
    next(error);
  }
};

/**
 * Obtiene las citas de un paciente.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export const getAppointments = async (req, res, next) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const patientId = parseInt(req.params.id, 10);

    const { rows, total } = await patientService.getAppointments(patientId, { limit, offset });

    const pagination = buildPaginationMeta(total, page, limit);

    return ApiResponse.paginated(res, rows, pagination, 'Citas del paciente obtenidas exitosamente.');
  } catch (error) {
    next(error);
  }
};

/**
 * Obtiene los tratamientos de un paciente.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export const getTreatments = async (req, res, next) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const patientId = parseInt(req.params.id, 10);

    const { rows, total } = await patientService.getTreatments(patientId, { limit, offset });

    const pagination = buildPaginationMeta(total, page, limit);

    return ApiResponse.paginated(res, rows, pagination, 'Tratamientos del paciente obtenidos exitosamente.');
  } catch (error) {
    next(error);
  }
};

/**
 * Obtiene las imágenes de un paciente.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export const getImages = async (req, res, next) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const patientId = parseInt(req.params.id, 10);

    const { rows, total } = await patientService.getImages(patientId, { limit, offset });

    const pagination = buildPaginationMeta(total, page, limit);

    return ApiResponse.paginated(res, rows, pagination, 'Imágenes del paciente obtenidas exitosamente.');
  } catch (error) {
    next(error);
  }
};

/**
 * Obtiene las facturas de un paciente.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export const getInvoices = async (req, res, next) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const patientId = parseInt(req.params.id, 10);

    const { rows, total } = await patientService.getInvoices(patientId, { limit, offset });

    const pagination = buildPaginationMeta(total, page, limit);

    return ApiResponse.paginated(res, rows, pagination, 'Facturas del paciente obtenidas exitosamente.');
  } catch (error) {
    next(error);
  }
};

/**
 * Obtiene estadísticas generales de pacientes.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export const getStats = async (req, res, next) => {
  try {
    const stats = await patientService.getStats();

    return ApiResponse.success(res, stats, 'Estadísticas de pacientes obtenidas exitosamente.');
  } catch (error) {
    next(error);
  }
};
