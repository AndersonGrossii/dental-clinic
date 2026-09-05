// ============================================
// Rutas de Inteligencia Artificial & Automações — /api/v1/ai
// ============================================
import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { allRoles, staffOnly } from '../middlewares/role.middleware.js';
import * as aiController from '../controllers/ai.controller.js';

const router = Router();

router.use(authMiddleware);

// Briefing matinal operativo
router.get('/briefing', allRoles, aiController.getReceptionBriefing);

// Reglas de automatización
router.get('/automations/rules', allRoles, aiController.getAutomationRules);
router.put('/automations/rules/:id', staffOnly, aiController.updateAutomationRule);

// Disparadores de automatizaciones
router.post('/automations/run-confirmations', staffOnly, aiController.trigger24hConfirmations);
router.post('/automations/run-recall', staffOnly, aiController.triggerRecallSweep);
router.get('/automations/stats', allRoles, aiController.getAutomationStats);

// Clasificación de intención y traducción de presupuestos
router.post('/classify-intent', allRoles, aiController.classifyIntent);
router.post('/explain-quotation', allRoles, aiController.explainQuotation);

export default router;
