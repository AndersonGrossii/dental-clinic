// ============================================
// Rutas de Chat Interno del Personal
// ============================================
import { Router } from 'express';
import {
  getGeneralMessages,
  getDirectMessages,
  sendMessage,
  markAsRead,
  getUnreadCounts,
} from '../controllers/internal-chat.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = Router();

// Todas las rutas requieren autenticación del personal de la clínica
router.use(authMiddleware);

router.get('/general', getGeneralMessages);
router.get('/direct/:userId', getDirectMessages);
router.post('/', sendMessage);
router.post('/read', markAsRead);
router.get('/unread', getUnreadCounts);

export default router;
