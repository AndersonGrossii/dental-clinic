// ============================================
// Rutas de Facturas
// ============================================
import { Router } from 'express';
import * as controller from '../controllers/invoice.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { ownerOnly, staffOnly, allRoles } from '../middlewares/role.middleware.js';
import { validate } from '../middlewares/validation.middleware.js';
import {
  createInvoiceRules,
  updateInvoiceRules,
} from '../validators/invoice.validator.js';
import { auditMiddleware } from '../middlewares/audit.middleware.js';

const router = Router();

router.use(authMiddleware);

router.get('/', allRoles, controller.getAll);
router.get('/stats', ownerOnly, controller.getStats);
router.get('/:id', allRoles, controller.getById);

router.post('/', staffOnly, validate(createInvoiceRules), auditMiddleware('CREAR_FACTURA', 'invoices'), controller.create);
router.put('/:id', staffOnly, validate(updateInvoiceRules), auditMiddleware('ACTUALIZAR_FACTURA', 'invoices'), controller.update);
router.post('/from-quotation/:quotationId', staffOnly, auditMiddleware('FACTURAR_DESDE_COTIZACION', 'invoices'), controller.createFromQuotation);
router.delete('/:id', staffOnly, auditMiddleware('ELIMINAR_FACTURA', 'invoices'), controller.remove);

export default router;
