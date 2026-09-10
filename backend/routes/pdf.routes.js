// ============================================
// Rutas de Generación y Descarga de PDFs
// ============================================
import { Router } from 'express';
import * as controller from '../controllers/pdf.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { allRoles } from '../middlewares/role.middleware.js';

const router = Router();

// Todas las rutas de PDF requieren autenticación de sesión y rol activo en la clínica
router.use(authMiddleware);

router.get('/invoices/:id', allRoles, controller.getInvoicePDF);
router.get('/receipts/:id', allRoles, controller.getReceiptPDF);
router.get('/quotations/:id', allRoles, controller.getQuotationPDF);
router.get('/prescriptions/:id', allRoles, controller.getPrescriptionPDF);

export default router;
