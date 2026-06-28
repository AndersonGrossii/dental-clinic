// ============================================
// Rutas de Reportes
// ============================================
import { Router } from 'express';
import * as controller from '../controllers/report.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { ownerOnly, allRoles } from '../middlewares/role.middleware.js';

const router = Router();

router.use(authMiddleware);

// Acceso general al dashboard según el rol
router.get('/dashboard', allRoles, controller.getDashboardStats);

// Reportes y exportación (Solo Propietarios)
router.get('/revenue', ownerOnly, controller.getRevenueReport);
router.get('/appointments', ownerOnly, controller.getAppointmentReport);
router.get('/patients', ownerOnly, controller.getPatientReport);
router.get('/treatments', ownerOnly, controller.getTreatmentReport);
router.get('/export/:type', ownerOnly, controller.exportCsv);

export default router;
