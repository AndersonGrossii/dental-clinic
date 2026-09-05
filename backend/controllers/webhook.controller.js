// ============================================
// Controlador de Webhooks de Meta (WhatsApp & Instagram)
// ============================================
import whatsappService from '../services/whatsapp.service.js';
import instagramService from '../services/instagram.service.js';
import messagingService from '../services/messaging.service.js';
import { logger } from '../utils/logger.js';

/**
 * Endpoint de verificación de Webhook de WhatsApp (Handshake GET).
 */
export const verifyWebhook = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const verifiedChallenge = whatsappService.verifyWebhookChallenge(mode, token, challenge);
  if (verifiedChallenge) {
    return res.status(200).send(verifiedChallenge);
  }

  return res.status(403).send('Forbidden');
};

/**
 * Receptor de eventos de Webhook de WhatsApp (POST).
 */
export const receiveWebhook = async (req, res) => {
  try {
    res.status(200).json({ status: 'EVENT_RECEIVED' });
    await messagingService.processInboundWebhook(req.body);
  } catch (error) {
    logger.error('Error al procesar evento de Webhook WhatsApp:', error.message);
  }
};

/**
 * Endpoint de verificación de Webhook de Instagram (Handshake GET).
 */
export const verifyInstagramWebhook = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const verifiedChallenge = instagramService.verifyWebhookChallenge(mode, token, challenge);
  if (verifiedChallenge) {
    return res.status(200).send(verifiedChallenge);
  }

  return res.status(403).send('Forbidden');
};

/**
 * Receptor de eventos de Webhook de Instagram (POST).
 */
export const receiveInstagramWebhook = async (req, res) => {
  try {
    res.status(200).json({ status: 'EVENT_RECEIVED' });
    await messagingService.processInboundInstagramWebhook(req.body);
  } catch (error) {
    logger.error('Error al procesar evento de Webhook Instagram:', error.message);
  }
};
