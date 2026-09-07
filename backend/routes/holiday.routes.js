// ============================================
// Rutas de Días Festivos — /api/v1/holidays
// ============================================
import { Router } from 'express';
import * as controller from '../controllers/holiday.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { managementOnly, allRoles } from '../middlewares/role.middleware.js';
import { auditMiddleware } from '../middlewares/audit.middleware.js';

const router = Router();

router.use(authMiddleware);

// Ver festivos (todos los roles de la clínica)
router.get('/', allRoles, controller.getHolidays);

// Gestión de festivos (solo propietario y dirección)
router.post(
  '/',
  managementOnly,
  auditMiddleware('REGISTRAR_FESTIVO', 'clinic_holidays'),
  controller.createHoliday
);

router.post(
  '/seed',
  managementOnly,
  auditMiddleware('SINCRONIZAR_FESTIVOS_OFICIALES', 'clinic_holidays'),
  controller.seedOfficialHolidays
);

router.delete(
  '/:id',
  managementOnly,
  auditMiddleware('ELIMINAR_FESTIVO', 'clinic_holidays'),
  controller.deleteHoliday
);

export default router;
