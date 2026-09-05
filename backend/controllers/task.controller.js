// ============================================
// Controlador de Tareas del Equipo Clínico
// ============================================
import taskService from '../services/task.service.js';
import { ApiResponse } from '../utils/response.js';

export const getAll = async (req, res, next) => {
  try {
    const { start_date, end_date, status, priority, assigned_to_user_id } = req.query;

    const tasks = await taskService.getTasks({
      clinicId: req.user.clinicId,
      userId: req.user.id,
      startDate: start_date,
      endDate: end_date,
      status,
      priority,
      assignedUserId: assigned_to_user_id ? parseInt(assigned_to_user_id, 10) : null,
    });

    ApiResponse.success(res, tasks);
  } catch (error) {
    next(error);
  }
};

export const getById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const task = await taskService.getTaskById(parseInt(id, 10), req.user.clinicId);
    ApiResponse.success(res, task);
  } catch (error) {
    next(error);
  }
};

export const create = async (req, res, next) => {
  try {
    const task = await taskService.createTask(req.body, req.user.id, req.user.clinicId);
    ApiResponse.success(res, task, 'Tarea creada exitosamente', 201);
  } catch (error) {
    next(error);
  }
};

export const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const task = await taskService.updateTask(parseInt(id, 10), req.body, req.user.clinicId);
    ApiResponse.success(res, task, 'Tarea actualizada exitosamente');
  } catch (error) {
    next(error);
  }
};

export const updateStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const task = await taskService.updateStatus(parseInt(id, 10), status, req.user.clinicId);
    ApiResponse.success(res, task, 'Estado de tarea actualizado');
  } catch (error) {
    next(error);
  }
};

export const remove = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await taskService.deleteTask(
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
