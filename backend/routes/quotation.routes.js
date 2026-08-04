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
router.patch('/:id/restore', staffOnly, auditMiddleware('RESTAURAR_COTIZACION', 'quotations'), controller.restore);
router.post('/:id/accept-all', staffOnly, auditMiddleware('ACEPTAR_COTIZACION_COMPLETA', 'quotations'), controller.acceptAll);
router.post('/:id/items-status', staffOnly, auditMiddleware('ACTUALIZAR_ITEMS_COTIZACION', 'quotations'), controller.updateItemsStatusBulk);
router.get('/patients/:patientId/accepted-items', allRoles, controller.getAcceptedItemsByPatient);
router.patch('/items/:itemId/execution-status', staffOnly, auditMiddleware('CAMBIAR_ESTADO_EJECUCION_ITEM', 'quotation_items'), controller.updateExecutionStatus);
router.patch('/items/:itemId/status', staffOnly, auditMiddleware('CAMBIAR_ESTADO_ITEM_COTIZACION', 'quotations'), controller.updateItemStatus);
router.delete('/:id', staffOnly, auditMiddleware('ELIMINAR_COTIZACION', 'quotations'), controller.remove);

export default router;
