// ============================================
// Rutas del Centro de Mensajería — /api/v1/messaging
// ============================================
import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { allRoles, staffOnly } from '../middlewares/role.middleware.js';
import { auditMiddleware } from '../middlewares/audit.middleware.js';
import * as messagingController from '../controllers/messaging.controller.js';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// 1. Estadísticas y plantillas
router.get('/stats', allRoles, messagingController.getStats);
router.get('/templates', allRoles, messagingController.getTemplates);

// 2. Listado y detalle de conversaciones
router.get('/conversations', allRoles, messagingController.getConversations);
router.get('/conversations/:id', allRoles, messagingController.getConversationDetail);
router.get('/conversations/:id/messages', allRoles, messagingController.getConversationMessages);

// 3. Enviar mensaje saliente
router.post(
  '/conversations/:id/messages',
  staffOnly,
  auditMiddleware('ENVIAR_MENSAJE_WHATSAPP', 'messages'),
  messagingController.sendOutboundMessage
);

// 4. Cambiar automatización (Human Takeover)
router.patch(
  '/conversations/:id/automation',
  staffOnly,
  auditMiddleware('CAMBIAR_MODO_ATENCION_MENSAJERIA', 'conversations'),
  messagingController.toggleAutomation
);

// 5. Cambiar estado de conversación (OPEN, PENDING, CLOSED)
router.patch(
  '/conversations/:id/status',
  staffOnly,
  auditMiddleware('CAMBIAR_ESTADO_CONVERSACION', 'conversations'),
  messagingController.updateStatus
);

// 6. Vincular contacto a expediente de paciente
router.post(
  '/conversations/:id/link-patient',
  staffOnly,
  auditMiddleware('VINCULAR_CONTACTO_PACIENTE', 'messaging_contacts'),
  messagingController.linkPatient
);

export default router;
