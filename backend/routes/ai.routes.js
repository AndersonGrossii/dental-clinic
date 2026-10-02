// ============================================
// Rutas de Inteligencia Artificial & Automatizaciones — /api/v1/ai
// ============================================
import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { allRoles, staffOnly } from '../middlewares/role.middleware.js';
import * as aiController from '../controllers/ai.controller.js';

const router = Router();

router.use(authMiddleware);

// 1. Briefing matinal operativo
router.get('/briefing', allRoles, aiController.getReceptionBriefing);

// 2. Reglas y disparadores de automatización existentes
router.get('/automations/rules', allRoles, aiController.getAutomationRules);
router.put('/automations/rules/:id', staffOnly, aiController.updateAutomationRule);
router.post('/automations/run-confirmations', staffOnly, aiController.trigger24hConfirmations);
router.post('/automations/run-recall', staffOnly, aiController.triggerRecallSweep);
router.get('/automations/stats', allRoles, aiController.getAutomationStats);

// 3. Clasificación de intención y traducción de presupuestos
router.post('/classify-intent', allRoles, aiController.classifyIntent);
router.post('/explain-quotation', allRoles, aiController.explainQuotation);

// 4. Cola de Supervisión Humana de Mensajes (Human-in-the-Loop)
router.get('/approvals', allRoles, aiController.getApprovals);
router.post('/approvals/:id/approve', staffOnly, aiController.approveMessage);
router.put('/approvals/:id/edit', staffOnly, aiController.editApprovalMessage);
router.post('/approvals/:id/discard', staffOnly, aiController.discardApprovalMessage);
router.post('/approvals/scan-quotations', staffOnly, aiController.triggerQuotationFollowupScan);

// 5. Copilot para Recepción (Sugerencia de Respuestas y Resumen CRM)
router.post('/copilot/suggest-reply', allRoles, aiController.suggestReply);
router.post('/copilot/summarize-conversation', allRoles, aiController.summarizeConversation);

// 6. Calificación y Lead Scoring con IA (Visible para Propietario, Dirección y Recepcionista)
router.post('/leads/:id/qualify', staffOnly, aiController.qualifyLead);

// 7. Base de Conocimiento RAG de la Clínica
router.get('/knowledge', allRoles, aiController.getKnowledgeBase);
router.post('/knowledge', staffOnly, aiController.createKnowledgeArticle);
router.put('/knowledge/:id', staffOnly, aiController.updateKnowledgeArticle);
router.delete('/knowledge/:id', staffOnly, aiController.deleteKnowledgeArticle);

// 8. Agendamiento Inteligente de Primera Visita
router.get('/booking/slots', allRoles, aiController.getAvailableBookingSlots);
router.post('/booking/first-visit', allRoles, aiController.bookFirstVisit);

// 9. Motor de Trabajos de Automatización (Jobs) & Seguimiento de Leads Inactivos
router.get('/automations/jobs', allRoles, aiController.getAutomationJobs);
router.post('/automations/jobs/run', staffOnly, aiController.processAutomationJobs);
router.post('/automations/run-lead-followups', staffOnly, aiController.triggerInactiveLeadFollowupScan);

export default router;
