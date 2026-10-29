// ============================================
// Middleware de Seguridad para Webhooks de Meta
// ============================================
import whatsappService from '../services/whatsapp.service.js';
import instagramService from '../services/instagram.service.js';
import { logger } from '../utils/logger.js';

/**
 * Valida la firma HMAC-SHA256 de las peticiones POST de Meta Webhooks.
 * Meta calcula la firma sobre los bytes originales de la solicitud, no sobre JSON reserializado.
 */
export const verifyMetaSignature = (req, res, next) => {
  const isInstagramWebhook = req.path.endsWith('/instagram');
  const service = isInstagramWebhook ? instagramService : whatsappService;

  if (!service.appSecret) {
    logger.error('META_APP_SECRET no está configurado; se rechaza el webhook por seguridad.');
    return res.status(503).json({
      success: false,
      message: 'La verificación del webhook no está configurada.',
    });
  }

  if (!Buffer.isBuffer(req.rawBody)) {
    logger.error('No se conservaron los bytes originales del webhook de Meta.');
    return res.status(400).json({
      success: false,
      message: 'No se pudo validar la firma del webhook.',
    });
  }

  const signatureHeader = req.get
    ? req.get('x-hub-signature-256')
    : req.headers?.['x-hub-signature-256'];

  if (!service.validateSignature(signatureHeader, req.rawBody)) {
    logger.warn('Webhook de Meta rechazado: firma ausente o no válida.');
    return res.status(401).json({
      success: false,
      message: 'Firma de webhook no válida.',
    });
  }

  return next();
};
