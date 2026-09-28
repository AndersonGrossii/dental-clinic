// ============================================
// Controlador de Inteligencia Artificial & Automatizaciones Clínicas
// ============================================
import aiService from '../services/ai.service.js';
import automationSchedulerService from '../services/automation-scheduler.service.js';
import aiSupervisionService from '../services/ai-supervision.service.js';
import aiKnowledgeRepository from '../repositories/ai-knowledge.repository.js';
import aiBookingService from '../services/ai-booking.service.js';
import messagingRepository from '../repositories/messaging.repository.js';
import { query } from '../database/pool.js';
import { ApiResponse } from '../utils/response.js';

/**
 * Obtiene el briefing operativo del día para la recepción.
 */
export const getReceptionBriefing = async (req, res, next) => {
  try {
    const clinicId = req.user?.clinic_id || 1;
    const today = new Date().toISOString().split('T')[0];

    // Consultas del día
    const apptsRes = await query(
      `SELECT a.id, a.appointment_date, a.start_time, s.name AS status_name,
              p.first_name, p.last_name, COALESCE(u.first_name || ' ' || u.last_name, 'el especialista') AS doctor_name
       FROM appointments a
       JOIN patients p ON a.patient_id = p.id
       JOIN appointment_status s ON a.status_id = s.id
       LEFT JOIN doctors d ON a.doctor_id = d.id
       LEFT JOIN users u ON d.user_id = u.id
       WHERE a.clinic_id = $1 AND a.appointment_date = $2 AND a.deleted_at IS NULL
       ORDER BY a.start_time ASC`,
      [clinicId, today]
    );

    const pendingConfirmations = apptsRes.rows.filter(a => a.status_name === 'programada');

    // Recalls pendientes en patient_followups
    const recallsRes = await query(
      `SELECT f.*, p.first_name, p.last_name, p.phone
       FROM patient_followups f
       JOIN patients p ON f.patient_id = p.id
       WHERE f.clinic_id = $1 AND f.status = 'PENDING' AND f.deleted_at IS NULL
       LIMIT 10`,
      [clinicId]
    );

    const briefing = await aiService.generateReceptionBriefing({
      date: today,
      appointments: apptsRes.rows,
      pendingConfirmations,
      recalls: recallsRes.rows,
    });

    return ApiResponse.success(res, {
      ...briefing,
      appointments: apptsRes.rows,
      followups: recallsRes.rows,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Lista todas las reglas de automatización configuradas para la clínica.
 */
export const getAutomationRules = async (req, res, next) => {
  try {
    const clinicId = req.user?.clinic_id || 1;
    const result = await query(
      `SELECT * FROM automation_rules WHERE clinic_id = $1 AND deleted_at IS NULL ORDER BY id ASC`,
      [clinicId]
    );
    return ApiResponse.success(res, result.rows);
  } catch (err) {
    next(err);
  }
};

/**
 * Actualiza una regla de automatización.
 */
export const updateAutomationRule = async (req, res, next) => {
  try {
    const clinicId = req.user?.clinic_id || 1;
    const ruleId = parseInt(req.params.id, 10);
    const { is_active, template_body, trigger_timing } = req.body;

    const result = await query(
      `UPDATE automation_rules 
       SET is_active = COALESCE($1, is_active),
           template_body = COALESCE($2, template_body),
           trigger_timing = COALESCE($3, trigger_timing),
           updated_at = NOW()
       WHERE id = $4 AND clinic_id = $5
       RETURNING *`,
      [is_active !== undefined ? is_active : null, template_body, trigger_timing, ruleId, clinicId]
    );

    if (result.rows.length === 0) {
      return ApiResponse.error(res, 'Regla de automatización no encontrada', 404);
    }

    return ApiResponse.success(res, result.rows[0], 'Regla actualizada exitosamente');
  } catch (err) {
    next(err);
  }
};

/**
 * Dispara manualmente el escaneo de confirmaciones de citas 24h.
 */
export const trigger24hConfirmations = async (req, res, next) => {
  try {
    const clinicId = req.user?.clinic_id || 1;
    const result = await automationSchedulerService.run24hAppointmentConfirmationScan(clinicId);
    return ApiResponse.success(res, result, 'Escaneo de confirmaciones 24h ejecutado correctamente');
  } catch (err) {
    next(err);
  }
};

/**
 * Dispara manualmente el barrido de recall y retención de pacientes.
 */
export const triggerRecallSweep = async (req, res, next) => {
  try {
    const clinicId = req.user?.clinic_id || 1;
    const result = await automationSchedulerService.runDailyRecallSweep(clinicId);
    return ApiResponse.success(res, result, 'Barrido de recall preventivo ejecutado correctamente');
  } catch (err) {
    next(err);
  }
};

/**
 * Obtiene métricas y logs de automatizaciones.
 */
export const getAutomationStats = async (req, res, next) => {
  try {
    const clinicId = req.user?.clinic_id || 1;
    const stats = await automationSchedulerService.getAutomationStats(clinicId);

    let totalSent = 0;
    let totalConfirmed = 0;
    let totalCancelled = 0;
    let totalRecallSent = 0;

    for (const row of stats.summary || []) {
      const count = parseInt(row.count, 10) || 0;
      if (row.status === 'SENT') totalSent += count;
      if (row.status === 'CONFIRMED') {
        totalConfirmed += count;
        totalSent += count;
      }
      if (row.status === 'CANCELLED') {
        totalCancelled += count;
        totalSent += count;
      }
      if (row.rule_type.startsWith('RECALL_') && (row.status === 'SENT' || row.status === 'CONFIRMED')) {
        totalRecallSent += count;
      }
    }

    const confirmationRate = totalSent > 0 
      ? Math.round((totalConfirmed / (totalConfirmed + totalCancelled || 1)) * 100) 
      : 100;

    return ApiResponse.success(res, {
      ...stats,
      kpis: {
        totalSent,
        totalConfirmed,
        totalCancelled,
        totalRecallSent,
        confirmationRate,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Clasifica la intención de un mensaje.
 */
export const classifyIntent = async (req, res, next) => {
  try {
    const { text } = req.body;
    const classification = await aiService.classifyIntent(text);
    return ApiResponse.success(res, classification);
  } catch (err) {
    next(err);
  }
};

/**
 * Genera explicación pedagógica de un presupuesto.
 */
export const explainQuotation = async (req, res, next) => {
  try {
    const { patient_name, items, total_amount, tone } = req.body;
    const explanation = await aiService.generatePatientQuotationExplanation({
      patientName: patient_name,
      items: items || [],
      totalAmount: total_amount || 0,
      tone: tone || 'friendly',
    });
    return ApiResponse.success(res, explanation);
  } catch (err) {
    next(err);
  }
};

// ============================================
// NUEVOS CONTROLADORES: SUPERVISIÓN HUMANA (HUMAN-IN-THE-LOOP)
// ============================================

/**
 * Lista los mensajes de la cola de supervisión humana (ai_message_approvals).
 */
export const getApprovals = async (req, res, next) => {
  try {
    const clinicId = req.user?.clinic_id || 1;
    const status = req.query.status || 'PENDING_APPROVAL';
    const items = await aiSupervisionService.getApprovals(clinicId, status);
    return ApiResponse.success(res, items);
  } catch (err) {
    next(err);
  }
};

/**
 * Aprueba y envía un mensaje pendiente de la cola.
 */
export const approveMessage = async (req, res, next) => {
  try {
    const clinicId = req.user?.clinic_id || 1;
    const userId = req.user?.id;
    const approvalId = parseInt(req.params.id, 10);

    const approved = await aiSupervisionService.approveAndSend(approvalId, clinicId, userId);
    return ApiResponse.success(res, approved, 'Mensaje aprobado y enviado correctamente.');
  } catch (err) {
    next(err);
  }
};

/**
 * Modifica el texto de una propuesta antes de aprobarla.
 */
export const editApprovalMessage = async (req, res, next) => {
  try {
    const clinicId = req.user?.clinic_id || 1;
    const userId = req.user?.id;
    const approvalId = parseInt(req.params.id, 10);
    const { message } = req.body;

    const updated = await aiSupervisionService.editMessage(approvalId, clinicId, message, userId);
    return ApiResponse.success(res, updated, 'Propuesta de mensaje actualizada correctamente.');
  } catch (err) {
    next(err);
  }
};

/**
 * Descarta una propuesta para que no se envíe.
 */
export const discardApprovalMessage = async (req, res, next) => {
  try {
    const clinicId = req.user?.clinic_id || 1;
    const userId = req.user?.id;
    const approvalId = parseInt(req.params.id, 10);

    const discarded = await aiSupervisionService.discard(approvalId, clinicId, userId);
    return ApiResponse.success(res, discarded, 'Propuesta descartada correctamente.');
  } catch (err) {
    next(err);
  }
};

/**
 * Dispara el escaneo de presupuestos presentados hace >= 48h para generar propuestas en cola.
 */
export const triggerQuotationFollowupScan = async (req, res, next) => {
  try {
    const clinicId = req.user?.clinic_id || 1;
    const result = await automationSchedulerService.runSupervisedQuotationFollowupScan(clinicId);
    return ApiResponse.success(res, result, 'Escaneo de presupuestos completado exitosamente.');
  } catch (err) {
    next(err);
  }
};

// ============================================
// NUEVOS CONTROLADORES: COPILOT DE RECEPCIÓN & CRM
// ============================================

/**
 * Genera 2 sugerencias de respuesta en español europeo para la recepcionista en el chat.
 */
export const suggestReply = async (req, res, next) => {
  try {
    const clinicId = req.user?.clinic_id || 1;
    const { conversation_id } = req.body;

    let messages = [];
    if (conversation_id) {
      messages = await messagingRepository.getMessagesByConversation(conversation_id, { limit: 10 });
    }

    const suggestions = await aiService.suggestCopilotReplies({ clinicId, messages });
    return ApiResponse.success(res, suggestions);
  } catch (err) {
    next(err);
  }
};

/**
 * Resume una conversación omnicanal para generar una nota de CRM.
 */
export const summarizeConversation = async (req, res, next) => {
  try {
    const clinicId = req.user?.clinic_id || 1;
    const { conversation_id } = req.body;

    let messages = [];
    if (conversation_id) {
      messages = await messagingRepository.getMessagesByConversation(conversation_id, { limit: 20 });
    }

    const summary = await aiService.summarizeConversationForCRM({ clinicId, messages });
    return ApiResponse.success(res, summary);
  } catch (err) {
    next(err);
  }
};

/**
 * Califica automáticamente un lead del CRM extrayendo interés, urgencia y nota de IA.
 */
export const qualifyLead = async (req, res, next) => {
  try {
    const clinicId = req.user?.clinic_id || 1;
    const userId = req.user?.id;
    const leadId = parseInt(req.params.id, 10);

    // Buscar mensajes vinculados al contacto del lead
    const messagesRes = await query(
      `SELECT m.* 
       FROM messages m
       JOIN conversations c ON m.conversation_id = c.id
       JOIN crm_leads l ON c.contact_id = l.contact_id
       WHERE l.id = $1 AND l.clinic_id = $2
       ORDER BY m.created_at ASC
       LIMIT 30`,
      [leadId, clinicId]
    );

    const result = await aiService.qualifyLeadFromConversation(leadId, clinicId, messagesRes.rows, userId);
    return ApiResponse.success(res, result, 'Lead calificado con IA exitosamente.');
  } catch (err) {
    next(err);
  }
};

// ============================================
// BASE DE CONOCIMIENTO RAG
// ============================================

export const getKnowledgeBase = async (req, res, next) => {
  try {
    const clinicId = req.user?.clinic_id || 1;
    const articles = await aiKnowledgeRepository.findByClinic(clinicId);
    return ApiResponse.success(res, articles);
  } catch (err) {
    next(err);
  }
};

export const createKnowledgeArticle = async (req, res, next) => {
  try {
    const clinicId = req.user?.clinic_id || 1;
    const { category, title, content, keywords } = req.body;
    const created = await aiKnowledgeRepository.create({ clinicId, category, title, content, keywords });
    return ApiResponse.success(res, created, 'Artículo de conocimiento creado.', 201);
  } catch (err) {
    next(err);
  }
};

export const updateKnowledgeArticle = async (req, res, next) => {
  try {
    const clinicId = req.user?.clinic_id || 1;
    const id = parseInt(req.params.id, 10);
    const updated = await aiKnowledgeRepository.update(id, clinicId, req.body);
    return ApiResponse.success(res, updated, 'Artículo de conocimiento actualizado.');
  } catch (err) {
    next(err);
  }
};

export const deleteKnowledgeArticle = async (req, res, next) => {
  try {
    const clinicId = req.user?.clinic_id || 1;
    const id = parseInt(req.params.id, 10);
    await aiKnowledgeRepository.delete(id, clinicId);
    return ApiResponse.success(res, null, 'Artículo de conocimiento eliminado.');
  } catch (err) {
    next(err);
  }
};

// ============================================
// AGENDAMIENTO DE PRIMERA VISITA
// ============================================

export const getAvailableBookingSlots = async (req, res, next) => {
  try {
    const clinicId = req.user?.clinic_id || 1;
    const date = req.query.date || null;
    const slots = await aiBookingService.getAvailableSlots(clinicId, date);
    return ApiResponse.success(res, slots);
  } catch (err) {
    next(err);
  }
};

export const bookFirstVisit = async (req, res, next) => {
  try {
    const clinicId = req.user?.clinic_id || 1;
    const { patient_id, guest_name, phone, appointment_date, start_time } = req.body;

    const result = await aiBookingService.bookFirstVisit({
      clinicId,
      patientId: patient_id || null,
      guestName: guest_name || null,
      phone,
      appointmentDate: appointment_date,
      startTime: start_time,
    });

    return ApiResponse.success(res, result, 'Primera visita agendada correctamente.');
  } catch (err) {
    next(err);
  }
};
