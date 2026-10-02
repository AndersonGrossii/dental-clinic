// ============================================
// Rutas del Dominio CRM — /api/v1/crm
// ============================================
import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { staffOnly } from '../middlewares/role.middleware.js';
import { auditMiddleware } from '../middlewares/audit.middleware.js';
import * as crmController from '../controllers/crm.controller.js';

const router = Router();

// Todas las rutas de CRM requieren autenticación y rol de staff (propietario, direccion o recepcionista).
// Doctores e higienistas quedan explícitamente bloqueados (HTTP 403 Forbidden).
router.use(authMiddleware);
router.use(staffOnly);

// Dashboard
router.get('/dashboard', crmController.getDashboard);

// Leads
router.get('/leads', crmController.getLeads);
router.get('/leads/check-duplicate', crmController.checkDuplicate);
router.get('/leads/:id', crmController.getLeadDetail);
router.post(
  '/leads',
  auditMiddleware('CREAR_LEAD_CRM', 'crm_leads'),
  crmController.createLead
);
router.patch(
  '/leads/:id/status',
  auditMiddleware('CAMBIAR_ESTADO_LEAD_CRM', 'crm_leads'),
  crmController.updateLeadStatus
);
router.post(
  '/leads/:id/convert-to-patient',
  auditMiddleware('CONVERTIR_LEAD_A_PACIENTE_CRM', 'crm_leads'),
  crmController.convertToPatient
);

// Oportunidades
router.get('/opportunities', crmController.getOpportunities);
router.post(
  '/opportunities',
  auditMiddleware('CREAR_OPORTUNIDAD_CRM', 'crm_opportunities'),
  crmController.createOpportunity
);
router.patch(
  '/opportunities/:id/status',
  auditMiddleware('CAMBIAR_ESTADO_OPORTUNIDAD_CRM', 'crm_opportunities'),
  crmController.updateOpportunityStatus
);

// Notas de CRM
router.post(
  '/notes',
  auditMiddleware('AGREGAR_NOTA_CRM', 'crm_notes'),
  crmController.addNote
);

// Tareas Comerciales
router.get('/tasks', crmController.getCRMTasks);
router.post(
  '/tasks',
  auditMiddleware('CREAR_TAREA_CRM', 'tasks'),
  crmController.createCRMTask
);
router.patch(
  '/tasks/:id/status',
  auditMiddleware('CAMBIAR_ESTADO_TAREA_CRM', 'tasks'),
  crmController.updateCRMTaskStatus
);

// Contexto comercial unificado del contacto
router.get('/contacts/:contactId/context', crmController.getContactCRMContext);

export default router;

