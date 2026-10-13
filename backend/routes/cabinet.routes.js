// ============================================
// Rutas de Gabinetes — /api/v1/cabinets
// ============================================
import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { allRoles, staffOnly } from '../middlewares/role.middleware.js';
import { requireFeature } from '../middlewares/feature.middleware.js';
import * as cabinetController from '../controllers/cabinet.controller.js';

const router = Router();

router.use(authMiddleware);
router.use(requireFeature('cabinets'));

router.get('/', allRoles, cabinetController.getCabinets);
router.post('/', staffOnly, cabinetController.createCabinet);
router.patch('/:id/deactivate', staffOnly, cabinetController.deactivateCabinet);
router.patch('/:id/activate', staffOnly, cabinetController.activateCabinet);

export default router;
