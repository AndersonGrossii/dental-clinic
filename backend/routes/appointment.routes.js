// ============================================
// Rutas de Citas
// ============================================
import { Router } from 'express';
import * as controller from '../controllers/appointment.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { staffOnly, allRoles } from '../middlewares/role.middleware.js';
import { validate } from '../middlewares/validation.middleware.js';
import {
  createAppointmentRules,
  updateAppointmentRules,
  updateStatusRules,
} from '../validators/appointment.validator.js';
import { auditMiddleware } from '../middlewares/audit.middleware.js';

const router = Router();

// Aplicar autenticación a todas las rutas
router.use(authMiddleware);

router.get('/', allRoles, controller.getAll);
router.get('/calendar', allRoles, controller.getCalendar);
router.get('/today', allRoles, controller.getTodayAppointments);
router.get('/stats', staffOnly, controller.getStats);
router.get('/:id', allRoles, controller.getById);

router.post('/', allRoles, validate(createAppointmentRules), auditMiddleware('CREAR_CITA', 'appointments'), controller.create);
router.put('/:id', allRoles, validate(updateAppointmentRules), auditMiddleware('ACTUALIZAR_CITA', 'appointments'), controller.update);
router.patch('/:id/status', allRoles, validate(updateStatusRules), auditMiddleware('CAMBIAR_ESTADO_CITA', 'appointments'), controller.updateStatus);
router.delete('/:id', allRoles, auditMiddleware('CANCELAR_CITA', 'appointments'), controller.remove);

export default router;
