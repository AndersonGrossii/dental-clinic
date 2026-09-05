// ============================================
// Controlador de Odontograma Clínico
// ============================================
import odontogramService from '../services/odontogram.service.js';
import { ApiResponse } from '../utils/response.js';

export const getByPatient = async (req, res, next) => {
  try {
    const { patientId } = req.params;
    const odontogram = await odontogramService.getPatientOdontogram(
      parseInt(patientId, 10),
      req.user.clinicId
    );
    ApiResponse.success(res, odontogram);
  } catch (error) {
    next(error);
  }
};

export const create = async (req, res, next) => {
  try {
    const { patientId } = req.params;
    const entry = await odontogramService.saveEntry(
      parseInt(patientId, 10),
      req.body,
      req.user.id,
      req.user.clinicId
    );
    ApiResponse.success(res, entry, 'Entrada de odontograma guardada exitosamente', 201);
  } catch (error) {
    next(error);
  }
};

export const update = async (req, res, next) => {
  try {
    const { entryId } = req.params;
    const entry = await odontogramService.updateEntry(
      parseInt(entryId, 10),
      req.body,
      req.user.clinicId
    );
    ApiResponse.success(res, entry, 'Entrada de odontograma actualizada exitosamente');
  } catch (error) {
    next(error);
  }
};

export const remove = async (req, res, next) => {
  try {
    const { entryId } = req.params;
    const result = await odontogramService.deleteEntry(
      parseInt(entryId, 10),
      req.user.clinicId
    );
    ApiResponse.success(res, result);
  } catch (error) {
    next(error);
  }
};
