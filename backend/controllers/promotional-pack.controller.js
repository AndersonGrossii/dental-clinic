// ============================================
// Controlador de Packs Promocionales
// ============================================
import promotionalPackService from '../services/promotional-pack.service.js';
import { ApiResponse } from '../utils/response.js';

export const getAll = async (req, res, next) => {
  try {
    const includeInactive = req.query.include_inactive === 'true';
    const search = req.query.search || '';
    const packs = await promotionalPackService.getAll({ includeInactive, search });
    return ApiResponse.success(res, packs, 'Packs promocionales obtenidos exitosamente');
  } catch (error) {
    next(error);
  }
};

export const getById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const pack = await promotionalPackService.getById(id);
    return ApiResponse.success(res, pack, 'Pack promocional obtenido exitosamente');
  } catch (error) {
    next(error);
  }
};

export const create = async (req, res, next) => {
  try {
    const pack = await promotionalPackService.create({
      ...req.body,
      created_by: req.user?.id,
    });
    return ApiResponse.created(res, pack, 'Pack promocional creado exitosamente');
  } catch (error) {
    next(error);
  }
};

export const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const pack = await promotionalPackService.update(id, req.body);
    return ApiResponse.success(res, pack, 'Pack promocional actualizado exitosamente');
  } catch (error) {
    next(error);
  }
};

export const toggleStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;
    const pack = await promotionalPackService.toggleStatus(id, is_active);
    return ApiResponse.success(res, pack, 'Estado del pack promocional actualizado exitosamente');
  } catch (error) {
    next(error);
  }
};

export const remove = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await promotionalPackService.delete(id);
    return ApiResponse.success(res, null, result.message);
  } catch (error) {
    next(error);
  }
};
