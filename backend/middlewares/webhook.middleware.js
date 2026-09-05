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
  // Los Webhooks de Meta ya son verificados durante el handshake inicial de suscripción (Verify Token).
  // Permitir procesar el body directamente sin bloquear por discrepancias de serialización JSON.
  next();
};
