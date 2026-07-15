import { Router } from 'express';
import * as controller from '../controllers/prescription.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { allRoles, roleMiddleware, managementOnly } from '../middlewares/role.middleware.js';
import { validate } from '../middlewares/validation.middleware.js';
import { createPrescriptionRules } from '../validators/prescription.validator.js';
import { auditMiddleware } from '../middlewares/audit.middleware.js';

const router = Router();

router.use(authMiddleware);

const doctorAndStaff = roleMiddleware('propietario', 'direccion', 'doctor');

router.post('/', doctorAndStaff, validate(createPrescriptionRules), auditMiddleware('CREAR_PRESCRIPCION', 'prescriptions'), controller.create);
router.get('/:id', allRoles, controller.getById);
router.delete('/:id', managementOnly, auditMiddleware('ELIMINAR_PRESCRIPCION', 'prescriptions'), controller.remove);

export default router;
