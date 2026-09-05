// ============================================
// Rutas de Webhooks Externos (Meta / WhatsApp)
// ============================================
import { Router } from 'express';
import * as webhookController from '../controllers/webhook.controller.js';
import { verifyMetaSignature } from '../middlewares/webhook.middleware.js';

const router = Router();

// WhatsApp Webhook
router.get('/whatsapp', webhookController.verifyWebhook);
router.post('/whatsapp', verifyMetaSignature, webhookController.receiveWebhook);

// Instagram Webhook
router.get('/instagram', webhookController.verifyInstagramWebhook);
router.post('/instagram', verifyMetaSignature, webhookController.receiveInstagramWebhook);

export default router;
