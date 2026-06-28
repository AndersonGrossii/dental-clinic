// ============================================
// Rutas de Búsqueda Global
// ============================================
import { Router } from 'express';
import * as controller from '../controllers/search.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { allRoles } from '../middlewares/role.middleware.js';

const router = Router();

router.use(authMiddleware);
router.get('/', allRoles, controller.globalSearch);

export default router;
