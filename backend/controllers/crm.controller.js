// ============================================
// Controlador del Dominio CRM
// ============================================
import crmService from '../services/crm.service.js';
import { ApiResponse } from '../utils/response.js';
import { ValidationError } from '../utils/errors.js';

export const getDashboard = async (req, res, next) => {
  try {
    const data = await crmService.getDashboardKPIs(req.user.clinicId);
    ApiResponse.success(res, data, 'Métricas del CRM obtenidas exitosamente');
  } catch (error) {
    next(error);
  }
};

export const getLeads = async (req, res, next) => {
  try {
    const {
      status,
      source,
      search,
      assigned_user_id,
      assignedUserId,
      date_from,
      dateFrom,
      date_to,
      dateTo,
      page = 1,
      limit = 20,
      sortBy,
      sort_by,
      sortOrder,
      sort_order,
    } = req.query;

    const assignedId = assigned_user_id || assignedUserId;
    const from = date_from || dateFrom;
    const to = date_to || dateTo;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    const result = await crmService.listLeads({
      status,
      source,
      search,
      assignedUserId: assignedId ? parseInt(assignedId, 10) : null,
      dateFrom: from,
      dateTo: to,
      limit: limitNum,
      offset,
      sortBy: sortBy || sort_by,
      sortOrder: sortOrder || sort_order,
    }, req.user.clinicId);

    ApiResponse.paginated(res, result.rows, {
      page: pageNum,
      limit: limitNum,
      total: result.total,
    });
  } catch (error) {
    next(error);
  }
};

export const checkDuplicate = async (req, res, next) => {
  try {
    const { phone, email } = req.query;
    const result = await crmService.checkDuplicate({ phone, email }, req.user.clinicId);
    ApiResponse.success(res, result, 'Verificación de duplicados completada');
  } catch (error) {
    next(error);
  }
};

export const getLeadDetail = async (req, res, next) => {
  try {
    const { id } = req.params;
    const leadId = parseInt(id, 10);
    if (isNaN(leadId)) {
      throw new ValidationError('ID de lead inválido');
    }
    const lead = await crmService.getLeadById(leadId, req.user.clinicId);
    ApiResponse.success(res, lead);
  } catch (error) {
    next(error);
  }
};

export const createLead = async (req, res, next) => {
  try {
    const contactId = req.body.contact_id || req.body.contactId;
    const assignedUserId = req.body.assigned_user_id || req.body.assignedUserId;
    const notesContent = req.body.notes || req.body.note;
    const allowDuplicate = req.body.allow_duplicate === true || req.body.allowDuplicate === true || req.body.force === true;
    const estimatedValue = req.body.estimated_value !== undefined ? req.body.estimated_value : req.body.estimatedValue;
    const { phone, name, email, source, status, interest } = req.body;

    const lead = await crmService.createLead({
      clinicId: req.user.clinicId,
      contactId: contactId ? parseInt(contactId, 10) : null,
      phone,
      name,
      email,
      source: source || 'manual',
      status: status || 'new',
      interest,
      assignedUserId: assignedUserId ? parseInt(assignedUserId, 10) : null,
      notes: notesContent,
      userId: req.user.id,
      allowDuplicate,
      estimatedValue,
    });

    if (lead.convertedToOpportunity) {
      return ApiResponse.created(res, lead, lead.message);
    }

    ApiResponse.created(res, lead, 'Lead creado exitosamente');
  } catch (error) {
    next(error);
  }
};

export const updateLeadStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const leadId = parseInt(id, 10);
    if (isNaN(leadId)) {
      throw new ValidationError('ID de lead inválido');
    }

    const { status } = req.body;
    const lossReason = req.body.loss_reason || req.body.lossReason;

    const updated = await crmService.updateLeadStatus(
      leadId,
      status,
      {
        lossReason,
        userId: req.user.id,
        clinicId: req.user.clinicId,
      }
    );

    ApiResponse.success(res, updated, 'Estado del lead actualizado');
  } catch (error) {
    next(error);
  }
};

export const getOpportunities = async (req, res, next) => {
  try {
    const {
      status,
      lead_id,
      leadId,
      contact_id,
      contactId,
      patient_id,
      patientId,
      search,
      page = 1,
      limit = 20,
      sortBy,
      sort_by,
      sortOrder,
      sort_order,
    } = req.query;

    const lId = lead_id || leadId;
    const cId = contact_id || contactId;
    const pId = patient_id || patientId;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    const result = await crmService.listOpportunities({
      status,
      leadId: lId ? parseInt(lId, 10) : null,
      contactId: cId ? parseInt(cId, 10) : null,
      patientId: pId ? parseInt(pId, 10) : null,
      search,
      limit: limitNum,
      offset,
      sortBy: sortBy || sort_by,
      sortOrder: sortOrder || sort_order,
    }, req.user.clinicId);

    ApiResponse.paginated(res, result.rows, {
      page: pageNum,
      limit: limitNum,
      total: result.total,
    });
  } catch (error) {
    next(error);
  }
};

export const createOpportunity = async (req, res, next) => {
  try {
    const contactId = req.body.contact_id || req.body.contactId;
    const leadId = req.body.lead_id || req.body.leadId;
    const patientId = req.body.patient_id || req.body.patientId;
    const assignedUserId = req.body.assigned_user_id || req.body.assignedUserId;
    const serviceInterest = req.body.service_interest || req.body.serviceInterest;
    const estimatedValue = req.body.estimated_value !== undefined ? req.body.estimated_value : req.body.estimatedValue;
    const { name, status } = req.body;

    const opp = await crmService.createOpportunity({
      clinicId: req.user.clinicId,
      contactId: contactId ? parseInt(contactId, 10) : null,
      leadId: leadId ? parseInt(leadId, 10) : null,
      patientId: patientId ? parseInt(patientId, 10) : null,
      name,
      serviceInterest,
      status: status || 'open',
      estimatedValue: estimatedValue !== undefined ? estimatedValue : 0.00,
      assignedUserId: assignedUserId ? parseInt(assignedUserId, 10) : null,
      userId: req.user.id,
    });

    ApiResponse.created(res, opp, 'Oportunidad creada exitosamente');
  } catch (error) {
    next(error);
  }
};

export const updateOpportunityStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const oppId = parseInt(id, 10);
    if (isNaN(oppId)) {
      throw new ValidationError('ID de oportunidad inválido');
    }

    const { status } = req.body;
    const lossReason = req.body.loss_reason || req.body.lossReason;

    const updated = await crmService.updateOpportunityStatus(
      oppId,
      status,
      {
        lossReason,
        userId: req.user.id,
        clinicId: req.user.clinicId,
      }
    );

    ApiResponse.success(res, updated, 'Estado de la oportunidad actualizado');
  } catch (error) {
    next(error);
  }
};

export const addNote = async (req, res, next) => {
  try {
    const contactId = req.body.contact_id || req.body.contactId;
    const leadId = req.body.lead_id || req.body.leadId;
    const opportunityId = req.body.opportunity_id || req.body.opportunityId;
    const note = req.body.note || req.body.notes;

    const created = await crmService.addNote({
      clinicId: req.user.clinicId,
      contactId: contactId ? parseInt(contactId, 10) : null,
      leadId: leadId ? parseInt(leadId, 10) : null,
      opportunityId: opportunityId ? parseInt(opportunityId, 10) : null,
      authorId: req.user.id,
      note,
    });

    ApiResponse.created(res, created, 'Nota comercial agregada');
  } catch (error) {
    next(error);
  }
};

export const getContactCRMContext = async (req, res, next) => {
  try {
    const { contactId } = req.params;
    const cId = parseInt(contactId, 10);
    if (isNaN(cId)) {
      throw new ValidationError('ID de contacto inválido');
    }

    const context = await crmService.getContactCRMContext(cId, req.user.clinicId);
    ApiResponse.success(res, context);
  } catch (error) {
    next(error);
  }
};

export const convertToPatient = async (req, res, next) => {
  try {
    const { id } = req.params;
    const leadId = parseInt(id, 10);
    if (isNaN(leadId)) {
      throw new ValidationError('ID de lead inválido');
    }

    const targetPatientId = req.body.patient_id || req.body.patientId;
    let targetPatientData = req.body.patient_data || req.body.patientData;

    // Fallback: admitir datos de paciente directamente en req.body si no vienen anidados
    if (!targetPatientId && !targetPatientData && (req.body.first_name || req.body.firstName)) {
      targetPatientData = {
        first_name: req.body.first_name || req.body.firstName,
        last_name: req.body.last_name || req.body.lastName,
        phone: req.body.phone,
        email: req.body.email,
        dni: req.body.dni,
        custom_id: req.body.custom_id || req.body.customId,
      };
    }

    const result = await crmService.convertToPatient(
      leadId,
      {
        patientId: targetPatientId ? parseInt(targetPatientId, 10) : null,
        patientData: targetPatientData || null,
      },
      req.user.clinicId,
      req.user.id
    );
    ApiResponse.success(res, result, 'Lead convertido en paciente clínico exitosamente');
  } catch (error) {
    next(error);
  }
};

export const getCRMTasks = async (req, res, next) => {
  try {
    const {
      status,
      priority,
      assigned_user_id,
      assignedUserId,
      lead_id,
      leadId,
      opportunity_id,
      opportunityId,
      page = 1,
      limit = 50,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const offset = (pageNum - 1) * limitNum;

    const result = await crmService.getCRMTasks(req.user.clinicId, {
      status,
      priority,
      assignedUserId: (assigned_user_id || assignedUserId) ? parseInt(assigned_user_id || assignedUserId, 10) : null,
      leadId: (lead_id || leadId) ? parseInt(lead_id || leadId, 10) : null,
      opportunityId: (opportunity_id || opportunityId) ? parseInt(opportunity_id || opportunityId, 10) : null,
      limit: limitNum,
      offset,
    });

    ApiResponse.paginated(res, result.rows, {
      page: pageNum,
      limit: limitNum,
      total: result.total,
    });
  } catch (error) {
    next(error);
  }
};

export const createCRMTask = async (req, res, next) => {
  try {
    const {
      title,
      description,
      due_date,
      dueDate,
      due_time,
      dueTime,
      priority,
      assigned_to_user_id,
      assignedUserId,
      contact_id,
      contactId,
      lead_id,
      leadId,
      opportunity_id,
      opportunityId,
    } = req.body;

    const task = await crmService.createCRMTask({
      clinicId: req.user.clinicId,
      title,
      description,
      dueDate: due_date || dueDate,
      dueTime: due_time || dueTime,
      priority,
      assignedUserId: (assigned_to_user_id || assignedUserId) ? parseInt(assigned_to_user_id || assignedUserId, 10) : null,
      contactId: (contact_id || contactId) ? parseInt(contact_id || contactId, 10) : null,
      leadId: (lead_id || leadId) ? parseInt(lead_id || leadId, 10) : null,
      opportunityId: (opportunity_id || opportunityId) ? parseInt(opportunity_id || opportunityId, 10) : null,
      userId: req.user.id,
    });

    ApiResponse.created(res, task, 'Tarea comercial creada');
  } catch (error) {
    next(error);
  }
};

export const updateCRMTaskStatus = async (req, res, next) => {
  try {
    const taskId = parseInt(req.params.id, 10);
    if (isNaN(taskId)) throw new ValidationError('ID de tarea inválido');

    const { status } = req.body;
    const updated = await crmService.updateCRMTaskStatus(taskId, status, req.user.clinicId, req.user.id);
    ApiResponse.success(res, updated, 'Estado de la tarea comercial actualizado');
  } catch (error) {
    next(error);
  }
};

