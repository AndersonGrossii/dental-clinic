// ============================================
// Rutas de Doctores
// ============================================
import { Router } from 'express';
import * as controller from '../controllers/doctor.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { ownerOnly, allRoles } from '../middlewares/role.middleware.js';
import { validate } from '../middlewares/validation.middleware.js';
import { createDoctorRules, updateDoctorRules } from '../validators/doctor.validator.js';
import { auditMiddleware } from '../middlewares/audit.middleware.js';

const router = Router();

router.use(authMiddleware);

router.get('/', allRoles, controller.getAll);
router.get('/:id', allRoles, controller.getById);
router.get('/:id/schedule', allRoles, controller.getSchedule);
router.get('/:id/availability', allRoles, controller.getAvailability);

router.post('/', ownerOnly, validate(createDoctorRules), auditMiddleware('CREAR_DOCTOR', 'doctors'), controller.create);
router.put('/:id', ownerOnly, validate(updateDoctorRules), auditMiddleware('ACTUALIZAR_DOCTOR', 'doctors'), controller.update);
router.delete('/:id', ownerOnly, auditMiddleware('ELIMINAR_DOCTOR', 'doctors'), controller.remove);

router.put('/:id/schedule', ownerOnly, auditMiddleware('ACTUALIZAR_HORARIO_DOCTOR', 'doctor_schedules'), controller.updateSchedule);
router.post('/:id/unavailability', ownerOnly, auditMiddleware('REGISTRAR_NO_DISPONIBILIDAD', 'doctor_unavailability'), controller.addUnavailability);
router.delete('/:id/unavailability/:unavailId', ownerOnly, auditMiddleware('ELIMINAR_NO_DISPONIBILIDAD', 'doctor_unavailability'), controller.removeUnavailability);

export default router;
