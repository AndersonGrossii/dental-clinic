// ============================================
// Rutas de Cotizaciones
// ============================================
import { Router } from 'express';
import * as controller from '../controllers/quotation.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { staffOnly, allRoles } from '../middlewares/role.middleware.js';
import { validate } from '../middlewares/validation.middleware.js';
import {
  createQuotationRules,
  updateQuotationRules,
  changeStatusRules,
} from '../validators/quotation.validator.js';
import { auditMiddleware } from '../middlewares/audit.middleware.js';

const router = Router();

router.use(authMiddleware);

router.get('/', allRoles, controller.getAll);
router.get('/:id', allRoles, controller.getById);

router.post('/', staffOnly, validate(createQuotationRules), auditMiddleware('CREAR_COTIZACION', 'quotations'), controller.create);
router.put('/:id', staffOnly, validate(updateQuotationRules), auditMiddleware('ACTUALIZAR_COTIZACION', 'quotations'), controller.update);
router.patch('/:id/status', staffOnly, validate(changeStatusRules), auditMiddleware('CAMBIAR_ESTADO_COTIZACION', 'quotations'), controller.changeStatus);
router.delete('/:id', staffOnly, auditMiddleware('ELIMINAR_COTIZACION', 'quotations'), controller.remove);

export default router;
