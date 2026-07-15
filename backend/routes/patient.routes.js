// ============================================
// Rutas de Pacientes — /api/v1/patients
// ============================================
import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { staffOnly, allRoles, roleMiddleware } from '../middlewares/role.middleware.js';
import { validate } from '../middlewares/validation.middleware.js';
import { createPatientRules, updatePatientRules } from '../validators/patient.validator.js';
import { auditMiddleware } from '../middlewares/audit.middleware.js';
import * as patientController from '../controllers/patient.controller.js';
import * as prescriptionController from '../controllers/prescription.controller.js';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

/**
 * @route   GET /api/v1/patients
 * @desc    Listar todos los pacientes con paginación
 * @access  Propietario, Recepcionista
 */
router.get('/', allRoles, patientController.getAll);

/**
 * @route   GET /api/v1/patients/search
 * @desc    Buscar pacientes por nombre, DNI, teléfono o email
 * @access  Todos los roles
 */
router.get('/search', allRoles, patientController.search);

/**
 * @route   GET /api/v1/patients/stats
 * @desc    Obtener estadísticas de pacientes
 * @access  Propietario, Recepcionista
 */
router.get('/stats', staffOnly, patientController.getStats);

/**
 * @route   POST /api/v1/patients
 * @desc    Crear un nuevo paciente
 * @access  Propietario, Recepcionista
 */
router.post('/', staffOnly, validate(createPatientRules), auditMiddleware('CREAR_PACIENTE', 'patients'), patientController.create);

/**
 * @route   GET /api/v1/patients/:id
 * @desc    Obtener un paciente por ID (perfil completo)
 * @access  Todos los roles
 */
router.get('/:id', allRoles, patientController.getById);

/**
 * @route   PUT /api/v1/patients/:id
 * @desc    Actualizar un paciente
 * @access  Propietario, Recepcionista
 */
router.put('/:id', staffOnly, validate(updatePatientRules), auditMiddleware('ACTUALIZAR_PACIENTE', 'patients'), patientController.update);

/**
 * @route   DELETE /api/v1/patients/:id
 * @desc    Eliminar un paciente (soft delete)
 * @access  Propietario, Recepcionista
 */
router.delete('/:id', staffOnly, auditMiddleware('ELIMINAR_PACIENTE', 'patients'), patientController.remove);

/**
 * @route   GET /api/v1/patients/:id/history
 * @desc    Obtener historial médico y dental del paciente
 * @access  Todos los roles
 */
router.get('/:id/history', allRoles, patientController.getHistory);

/**
 * @route   GET /api/v1/patients/:id/appointments
 * @desc    Obtener citas del paciente
 * @access  Todos los roles
 */
router.get('/:id/appointments', allRoles, patientController.getAppointments);

/**
 * @route   GET /api/v1/patients/:id/treatments
 * @desc    Obtener tratamientos del paciente
 * @access  Todos los roles
 */
router.get('/:id/treatments', allRoles, patientController.getTreatments);

/**
 * @route   GET /api/v1/patients/:id/invoices
 * @desc    Obtener facturas del paciente
 * @access  Todos los roles
 */
router.get('/:id/invoices', allRoles, patientController.getInvoices);

/**
 * @route   GET /api/v1/patients/:id/images
 * @desc    Obtener imágenes del paciente
 * @access  Todos los roles
 */
router.get('/:id/images', allRoles, patientController.getImages);

/**
 * @route   GET /api/v1/patients/:id/notes
 * @desc    Obtener notas de evolución clínica del paciente
 * @access  Todos los roles
 */
router.get('/:id/notes', allRoles, patientController.getNotes);

/**
 * @route   POST /api/v1/patients/:id/notes
 * @desc    Crear una nota de evolución clínica para el paciente
 * @access  Propietario, Dirección, Doctor
 */
router.post('/:id/notes', roleMiddleware('propietario', 'direccion', 'doctor'), patientController.createNote);

/**
 * @route   GET /api/v1/patients/:id/prescriptions
 * @desc    Obtener prescripciones del paciente
 * @access  Todos los roles
 */
router.get('/:id/prescriptions', allRoles, prescriptionController.getByPatient);

export default router;
