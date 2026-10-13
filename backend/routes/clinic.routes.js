// ============================================
// Rutas de Clínicas — /api/v1/clinics
// ============================================
import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import clinicService from '../services/clinic.service.js';
import clinicConfigService from '../services/clinic-config.service.js';
import { ApiResponse } from '../utils/response.js';

const router = Router();

router.use(authMiddleware);

router.get('/', async (req, res, next) => {
  try {
    const clinics = await clinicService.getClinics(req.user);
    ApiResponse.success(res, clinics);
  } catch (error) {
    next(error);
  }
});

router.get('/active-config', async (req, res, next) => {
  try {
    const config = await clinicConfigService.getActiveConfig(req.user.clinicId);
    ApiResponse.success(res, config, 'Configuración de clínica activa obtenida exitosamente');
  } catch (error) {
    next(error);
  }
});

export default router;
