// ============================================
// Rutas de Configuración y Auditoría
// ============================================
import { Router } from 'express';
import * as controller from '../controllers/settings.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { ownerOnly } from '../middlewares/role.middleware.js';
import { auditMiddleware } from '../middlewares/audit.middleware.js';

const router = Router();

// GET /clinic es público para que login y todas las páginas
// puedan mostrar el nombre de la clínica sin autenticación
router.get('/clinic', controller.getClinicInfo);

// Todas las demás rutas requieren autenticación y rol de propietario
router.use(authMiddleware);
router.use(ownerOnly);

router.put('/clinic', auditMiddleware('MODIFICAR_DATOS_CLINICA', 'clinic_information'), controller.updateClinicInfo);

router.get('/', controller.getAllSettings);
router.put('/:key', auditMiddleware('MODIFICAR_AJUSTE', 'settings'), controller.updateSetting);

router.get('/audit-logs', controller.getAuditLogs);

export default router;
