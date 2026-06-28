// ============================================
// Controlador de Usuarios
// ============================================
import userService from '../services/user.service.js';
import { ApiResponse } from '../utils/response.js';
import { parsePagination, buildPaginationMeta } from '../utils/pagination.js';

/**
 * Lista todos los usuarios con paginación y filtros.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export const getAll = async (req, res, next) => {
  try {
    const { page, limit, offset, sortBy, sortOrder } = parsePagination(req.query);

    const filters = {};
    if (req.query.roleId) filters.roleId = parseInt(req.query.roleId, 10);
    if (req.query.isActive !== undefined) filters.isActive = req.query.isActive === 'true';
    if (req.query.search) filters.search = req.query.search;

    const { rows, total } = await userService.getAll({
      limit,
      offset,
      sortBy: sortBy === 'created_at' ? 'u.created_at' : sortBy,
      sortOrder,
      filters,
    });

    const pagination = buildPaginationMeta(total, page, limit);

    return ApiResponse.paginated(res, rows, pagination, 'Usuarios obtenidos exitosamente.');
  } catch (error) {
    next(error);
  }
};

/**
 * Obtiene un usuario por ID.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export const getById = async (req, res, next) => {
  try {
    const user = await userService.getById(parseInt(req.params.id, 10));

    return ApiResponse.success(res, user, 'Usuario obtenido exitosamente.');
  } catch (error) {
    next(error);
  }
};

/**
 * Crea un nuevo usuario.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export const create = async (req, res, next) => {
  try {
    const user = await userService.create(req.body);

    return ApiResponse.created(res, user, 'Usuario creado exitosamente.');
  } catch (error) {
    next(error);
  }
};

/**
 * Actualiza un usuario existente.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export const update = async (req, res, next) => {
  try {
    const user = await userService.update(parseInt(req.params.id, 10), req.body);

    return ApiResponse.success(res, user, 'Usuario actualizado exitosamente.');
  } catch (error) {
    next(error);
  }
};

/**
 * Elimina un usuario (soft delete).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export const remove = async (req, res, next) => {
  try {
    await userService.delete(parseInt(req.params.id, 10));

    return ApiResponse.success(res, null, 'Usuario eliminado exitosamente.');
  } catch (error) {
    next(error);
  }
};

/**
 * Activa o desactiva un usuario.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export const toggleStatus = async (req, res, next) => {
  try {
    const user = await userService.toggleStatus(parseInt(req.params.id, 10));
    const statusMsg = user.is_active ? 'activado' : 'desactivado';

    return ApiResponse.success(res, user, `Usuario ${statusMsg} exitosamente.`);
  } catch (error) {
    next(error);
  }
};

/**
 * Resetea la contraseña de un usuario (administrador).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export const resetPassword = async (req, res, next) => {
  try {
    await userService.resetPassword(parseInt(req.params.id, 10), req.body.newPassword);

    return ApiResponse.success(res, null, 'Contraseña del usuario restablecida exitosamente.');
  } catch (error) {
    next(error);
  }
};
