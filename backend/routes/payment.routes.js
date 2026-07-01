// ============================================
// Rutas de Pagos
// ============================================
import { Router } from 'express';
import * as controller from '../controllers/payment.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { managementOnly, staffOnly, allRoles } from '../middlewares/role.middleware.js';
import { validate } from '../middlewares/validation.middleware.js';
import { createPaymentRules } from '../validators/payment.validator.js';
import { auditMiddleware } from '../middlewares/audit.middleware.js';

const router = Router();

router.use(authMiddleware);

router.get('/', staffOnly, controller.getAll);
router.get('/methods', allRoles, controller.getPaymentMethods);
router.get('/invoice/:invoiceId', allRoles, controller.getByInvoice);

router.post('/', staffOnly, validate(createPaymentRules), auditMiddleware('REGISTRAR_PAGO', 'payments'), controller.create);
router.delete('/:id', managementOnly, auditMiddleware('ELIMINAR_PAGO', 'payments'), controller.remove);

export default router;
