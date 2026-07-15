// ============================================
// Rutas de Clínicas — /api/v1/clinics
// ============================================
import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import clinicService from '../services/clinic.service.js';
import { ApiResponse } from '../utils/response.js';

const router = Router();

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const clinics = await clinicService.getClinics(req.user);
    ApiResponse.success(res, clinics);
  } catch (error) {
    ApiResponse.error(res, error.message, 500);
  }
});

export default router;
