// ============================================
// Middleware de Seguridad para Webhooks de Meta
// ============================================
import whatsappService from '../services/whatsapp.service.js';
import { ApiResponse } from '../utils/response.js';
import { logger } from '../utils/logger.js';

/**
 * Valida la firma HMAC-SHA256 de las peticiones POST de Meta Webhooks.
 */
export const verifyMetaSignature = (req, res, next) => {
  const signature = req.headers['x-hub-signature-256'];

  const isValid = whatsappService.validateSignature(signature, req.body);
  if (!isValid) {
    logger.warn('Firma de webhook de Meta inválida o ausente');
    return ApiResponse.error(res, 'Firma de webhook no válida', 401);
  }

  next();
};
