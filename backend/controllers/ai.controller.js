// ============================================
// Controlador de Inteligencia Artificial & Automações Clínicas
// ============================================
import aiService from '../services/ai.service.js';
import automationSchedulerService from '../services/automation-scheduler.service.js';
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
 * Actualiza una regla de automatización (estado activo/inactivo, plantilla o timing).
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
 * Obtiene logs detallados y métricas KPI de automatizaciones.
 */
export const getAutomationStats = async (req, res, next) => {
  try {
    const clinicId = req.user?.clinic_id || 1;
    const stats = await automationSchedulerService.getAutomationStats(clinicId);

    // Calcular KPIs
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
      }
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
 * Genera explicación amable de presupuesto.
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
