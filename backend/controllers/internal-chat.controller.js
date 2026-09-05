// ============================================
// Controlador de Chat Interno del Personal
// ============================================
import internalChatService from '../services/internal-chat.service.js';
import ApiResponse from '../utils/response.js';

export const getGeneralMessages = async (req, res, next) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 100;
    const messages = await internalChatService.getGeneralMessages(req.user.clinicId, limit);
    ApiResponse.success(res, messages);
  } catch (error) {
    next(error);
  }
};

export const getDirectMessages = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 100;
    const messages = await internalChatService.getDirectMessages(
      req.user.clinicId,
      req.user.id,
      parseInt(userId, 10),
      limit
    );
    ApiResponse.success(res, messages);
  } catch (error) {
    next(error);
  }
};

export const sendMessage = async (req, res, next) => {
  try {
    const { recipient_id, message } = req.body;
    const created = await internalChatService.sendMessage({
      clinicId: req.user.clinicId,
      senderId: req.user.id,
      recipientId: recipient_id || null,
      message,
    });
    ApiResponse.created(res, created, 'Mensaje enviado exitosamente');
  } catch (error) {
    next(error);
  }
};

export const markAsRead = async (req, res, next) => {
  try {
    const { channel, sender_id } = req.body;
    const result = await internalChatService.markAsRead({
      clinicId: req.user.clinicId,
      userId: req.user.id,
      channel: channel || 'general',
      senderId: sender_id || null,
    });
    ApiResponse.success(res, result);
  } catch (error) {
    next(error);
  }
};

export const getUnreadCounts = async (req, res, next) => {
  try {
    const counts = await internalChatService.getUnreadCounts(req.user.clinicId, req.user.id);
    ApiResponse.success(res, counts);
  } catch (error) {
    next(error);
  }
};
