// ============================================
// Rutas de Seguimientos de Pacientes — /api/v1/followups
// ============================================
import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { allRoles } from '../middlewares/role.middleware.js';
import { auditMiddleware } from '../middlewares/audit.middleware.js';
import * as followupController from '../controllers/followup.controller.js';

const router = Router();

router.use(authMiddleware);

router.get('/', allRoles, followupController.getAll);
router.get('/:id', allRoles, followupController.getById);

router.post(
  '/',
  allRoles,
  auditMiddleware('CREAR_SEGUIMIENTO_PACIENTE', 'patient_followups'),
  followupController.create
);

router.patch(
  '/:id/status',
  allRoles,
  auditMiddleware('CAMBIAR_ESTADO_SEGUIMIENTO', 'patient_followups'),
  followupController.updateStatus
);

router.delete(
  '/:id',
  allRoles,
  auditMiddleware('ELIMINAR_SEGUIMIENTO_PACIENTE', 'patient_followups'),
  followupController.remove
);

export default router;
