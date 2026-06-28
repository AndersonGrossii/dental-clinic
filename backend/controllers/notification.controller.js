// ============================================
// Controlador de Notificaciones
// ============================================
import notificationService from '../services/notification.service.js';
import { ApiResponse } from '../utils/response.js';
import { parsePagination } from '../utils/pagination.js';

export const getMyNotifications = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { page, limit } = parsePagination(req.query);
    const { notifications, pagination } = await notificationService.getByUser(userId, { page, limit });
    return ApiResponse.paginated(res, notifications, pagination, 'Notificaciones obtenidas');
  } catch (error) {
    next(error);
  }
};

export const getUnreadCount = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const count = await notificationService.getUnreadCount(userId);
    return ApiResponse.success(res, { count }, 'Cantidad de notificaciones no leídas obtenida');
  } catch (error) {
    next(error);
  }
};

export const markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    await notificationService.markAsRead(id, userId);
    return ApiResponse.success(res, null, 'Notificación marcada como leída');
  } catch (error) {
    next(error);
  }
};

export const markAllAsRead = async (req, res, next) => {
  try {
    const userId = req.user.id;
    await notificationService.markAllAsRead(userId);
    return ApiResponse.success(res, null, 'Todas las notificaciones marcadas como leídas');
  } catch (error) {
    next(error);
  }
};
