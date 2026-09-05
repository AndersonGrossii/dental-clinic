// ============================================
// Controlador de Seguimientos de Pacientes (Follow-ups)
// ============================================
import followupService from '../services/followup.service.js';
import { ApiResponse } from '../utils/response.js';

export const getAll = async (req, res, next) => {
  try {
    const { start_date, end_date, patient_id, status, assigned_to_user_id } = req.query;

    const followups = await followupService.getFollowups({
      clinicId: req.user.clinicId,
      userId: req.user.id,
      patientId: patient_id ? parseInt(patient_id, 10) : null,
      startDate: start_date,
      endDate: end_date,
      status,
      assignedUserId: assigned_to_user_id ? parseInt(assigned_to_user_id, 10) : null,
    });

    ApiResponse.success(res, followups);
  } catch (error) {
    next(error);
  }
};

export const getById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const followup = await followupService.getFollowupById(parseInt(id, 10), req.user.clinicId);
    ApiResponse.success(res, followup);
  } catch (error) {
    next(error);
  }
};

export const create = async (req, res, next) => {
  try {
    const followup = await followupService.createFollowup(req.body, req.user.id, req.user.clinicId);
    ApiResponse.success(res, followup, 'Seguimiento programado exitosamente', 201);
  } catch (error) {
    next(error);
  }
};

export const updateStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const followup = await followupService.updateStatus(parseInt(id, 10), status, req.user.clinicId);
    ApiResponse.success(res, followup, 'Estado de seguimiento actualizado');
  } catch (error) {
    next(error);
  }
};

export const remove = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await followupService.deleteFollowup(
      parseInt(id, 10),
      req.user.clinicId,
      req.user.id,
      req.user.roleName?.toLowerCase()
    );
    ApiResponse.success(res, result);
  } catch (error) {
    next(error);
  }
};
