// ============================================
// Controlador del Centro de Mensajería
// ============================================
import messagingService from '../services/messaging.service.js';
import { ApiResponse } from '../utils/response.js';

export const getConversations = async (req, res, next) => {
  try {
    const { channel, status, search, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const result = await messagingService.getConversations({
      clinicId: req.user.clinicId,
      channel,
      status,
      search,
      limit: parseInt(limit, 10),
      offset,
    });

    ApiResponse.paginated(res, result.rows, {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      total: result.total,
    });
  } catch (error) {
    next(error);
  }
};

export const getConversationDetail = async (req, res, next) => {
  try {
    const { id } = req.params;
    const conversation = await messagingService.getConversationDetail(parseInt(id, 10));
    ApiResponse.success(res, conversation);
  } catch (error) {
    next(error);
  }
};

export const getConversationMessages = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { limit = 50, before_id } = req.query;

    const data = await messagingService.getConversationMessages(parseInt(id, 10), {
      limit: parseInt(limit, 10),
      beforeId: before_id ? parseInt(before_id, 10) : null,
    });

    ApiResponse.success(res, data);
  } catch (error) {
    next(error);
  }
};

export const sendOutboundMessage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { message_type, body, template_name, parameters } = req.body;

    const message = await messagingService.sendOutboundMessage({
      conversationId: parseInt(id, 10),
      userId: req.user.id,
      messageType: message_type || 'TEXT',
      body,
      templateName: template_name,
      templateParams: parameters || [],
    });

    ApiResponse.success(res, message, 'Mensaje enviado exitosamente', 201);
  } catch (error) {
    next(error);
  }
};

export const toggleAutomation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { automation_enabled } = req.body;

    const updated = await messagingService.toggleAutomation(
      parseInt(id, 10),
      Boolean(automation_enabled)
    );

    ApiResponse.success(res, updated, 'Estado de automatización actualizado');
  } catch (error) {
    next(error);
  }
};

export const updateStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const updated = await messagingService.updateStatus(parseInt(id, 10), status);
    ApiResponse.success(res, updated, 'Estado de la conversación actualizado');
  } catch (error) {
    next(error);
  }
};

export const linkPatient = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { patient_id } = req.body;

    const result = await messagingService.linkPatient(
      parseInt(id, 10),
      parseInt(patient_id, 10)
    );

    ApiResponse.success(res, result, 'Contacto vinculado al paciente exitosamente');
  } catch (error) {
    next(error);
  }
};

export const getTemplates = async (req, res, next) => {
  try {
    const templates = await messagingService.getTemplates();
    ApiResponse.success(res, templates);
  } catch (error) {
    next(error);
  }
};

export const getStats = async (req, res, next) => {
  try {
    const stats = await messagingService.getStats();
    ApiResponse.success(res, stats);
  } catch (error) {
    next(error);
  }
};
