// ============================================
// Rutas de Tratamientos
// ============================================
import { Router } from 'express';
import * as controller from '../controllers/treatment.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { managementOnly, allRoles } from '../middlewares/role.middleware.js';
import { validate } from '../middlewares/validation.middleware.js';
import {
  createTreatmentRules,
  updateTreatmentRules,
  createCategoryRules,
  updateCategoryRules,
  createPatientTreatmentRules,
  updatePatientTreatmentRules,
} from '../validators/treatment.validator.js';
import { auditMiddleware } from '../middlewares/audit.middleware.js';

const router = Router();

router.use(authMiddleware);

// Catálogo general de tratamientos (Lectura para todos, escritura para propietarios)
router.get('/', allRoles, controller.getAll);
router.get('/categories', allRoles, controller.getCategories);
router.get('/:id', allRoles, controller.getById);

router.post('/', managementOnly, validate(createTreatmentRules), auditMiddleware('CREAR_TRATAMIENTO', 'treatments'), controller.create);
router.put('/:id', managementOnly, validate(updateTreatmentRules), auditMiddleware('ACTUALIZAR_TRATAMIENTO', 'treatments'), controller.update);
router.delete('/:id', managementOnly, auditMiddleware('ELIMINAR_TRATAMIENTO', 'treatments'), controller.remove);

router.post('/categories', managementOnly, validate(createCategoryRules), auditMiddleware('CREAR_CATEGORIA_TRATAMIENTO', 'treatment_categories'), controller.createCategory);
router.put('/categories/:id', managementOnly, validate(updateCategoryRules), auditMiddleware('ACTUALIZAR_CATEGORIA_TRATAMIENTO', 'treatment_categories'), controller.updateCategory);

// Tratamientos de pacientes (Historial de tratamientos clínicos)
router.get('/patient/:patientId', allRoles, controller.getPatientTreatments);
router.post('/patient', allRoles, validate(createPatientTreatmentRules), auditMiddleware('REGISTRAR_TRATAMIENTO_PACIENTE', 'patient_treatments'), controller.addPatientTreatment);
router.put('/patient/:id', allRoles, validate(updatePatientTreatmentRules), auditMiddleware('ACTUALIZAR_TRATAMIENTO_PACIENTE', 'patient_treatments'), controller.updatePatientTreatment);

export default router;
