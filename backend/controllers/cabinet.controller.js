// ============================================
// Controlador de Gabinetes
// ============================================
import cabinetService from '../services/cabinet.service.js';
import { ApiResponse } from '../utils/response.js';

export const getCabinets = async (req, res, next) => {
  try {
    const onlyActive = req.query.include_inactive !== 'true';
    const cabinets = await cabinetService.getCabinets(req.user.clinicId, { onlyActive });
    ApiResponse.success(res, cabinets);
  } catch (error) {
    next(error);
  }
};

export const createCabinet = async (req, res, next) => {
  try {
    const cabinet = await cabinetService.createCabinet(req.user.clinicId, req.body);
    ApiResponse.created(res, cabinet, 'Gabinete creado exitosamente');
  } catch (error) {
    next(error);
  }
};

export const deactivateCabinet = async (req, res, next) => {
  try {
    const { id } = req.params;
    const cabinet = await cabinetService.deactivateCabinet(parseInt(id, 10), req.user.clinicId);
    ApiResponse.success(res, cabinet, 'Gabinete desactivado exitosamente');
  } catch (error) {
    next(error);
  }
};

export const activateCabinet = async (req, res, next) => {
  try {
    const { id } = req.params;
    const cabinet = await cabinetService.activateCabinet(parseInt(id, 10), req.user.clinicId);
    ApiResponse.success(res, cabinet, 'Gabinete reactivado exitosamente');
  } catch (error) {
    next(error);
  }
};
