// ============================================
// Rutas de Reportes
// ============================================
import { Router } from 'express';
import * as controller from '../controllers/report.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { managementOnly, allRoles } from '../middlewares/role.middleware.js';

const router = Router();

router.use(authMiddleware);

// Acceso general al dashboard según el rol
router.get('/dashboard', allRoles, controller.getDashboardStats);

// Reportes y exportación (Dirección y Propietarios)
router.get('/revenue', managementOnly, controller.getRevenueReport);
router.get('/appointments', managementOnly, controller.getAppointmentReport);
router.get('/patients', managementOnly, controller.getPatientReport);
router.get('/treatments', managementOnly, controller.getTreatmentReport);
router.get('/export/:type', managementOnly, controller.exportCsv);

export default router;
