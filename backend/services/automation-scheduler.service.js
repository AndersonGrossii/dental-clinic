// ============================================
// Motor de Automatizaciones Clínicas & Scheduler
// Confirmação 24h, Recall Diário de Pacientes e Integração com Webhooks
// ============================================
import { query } from '../database/pool.js';
import whatsappService from './whatsapp.service.js';
import aiService from './ai.service.js';
import eventStreamService from './event-stream.service.js';
import { logger } from '../utils/logger.js';

class AutomationSchedulerService {
  /**
   * Ejecuta el escaneo y envío de confirmaciones para citas en las próximas 24 horas.
   */
  async run24hAppointmentConfirmationScan(clinicId = 1) {
    logger.info(`[AUTOCONFIRM] Iniciando escaneo de confirmaciones 24h para clínica #${clinicId}`);
    
    // 1. Obtener regla activa
    const ruleRes = await query(
      `SELECT * FROM automation_rules WHERE clinic_id = $1 AND rule_type = 'CONFIRMATION_24H' AND is_active = TRUE AND deleted_at IS NULL`,
      [clinicId]
    );

    if (ruleRes.rows.length === 0) {
      logger.info('[AUTOCONFIRM] Regla de confirmación 24h inactiva o no configurada.');
      return { sent: 0, skipped: 0 };
    }

    const rule = ruleRes.rows[0];

    // 2. Buscar citas para el día de mañana en estado 'programada' (status_id = 1)
    const tomorrowAppts = await query(
      `SELECT a.id, a.appointment_date, a.start_time, a.patient_id,
              p.first_name, p.last_name, p.phone AS patient_phone,
              COALESCE(u.first_name || ' ' || u.last_name, 'el especialista') AS doctor_name
       FROM appointments a
       JOIN patients p ON a.patient_id = p.id
       LEFT JOIN doctors d ON a.doctor_id = d.id
       LEFT JOIN users u ON d.user_id = u.id
       JOIN appointment_status s ON a.status_id = s.id
       WHERE a.clinic_id = $1 
         AND a.deleted_at IS NULL 
         AND s.name = 'programada'
         AND a.appointment_date = CURRENT_DATE + INTERVAL '1 day'
         AND NOT EXISTS (
           SELECT 1 FROM automation_logs l 
           WHERE l.appointment_id = a.id AND l.rule_type = 'CONFIRMATION_24H' AND l.status IN ('SENT', 'CONFIRMED')
         )`,
      [clinicId]
    );

    let sent = 0;
    let skipped = 0;

    for (const appt of tomorrowAppts.rows) {
      if (!appt.patient_phone) {
        skipped++;
        continue;
      }

      const patientName = `${appt.first_name} ${appt.last_name}`.trim();
      const dateFormatted = new Date(appt.appointment_date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
      const timeFormatted = String(appt.start_time).substring(0, 5);

      // Reemplazo de variables de plantilla
      const messageBody = rule.template_body
        .replace(/{{patient_name}}/g, patientName)
        .replace(/{{date}}/g, dateFormatted)
        .replace(/{{time}}/g, timeFormatted)
        .replace(/{{doctor_name}}/g, appt.doctor_name);

      try {
        await whatsappService.sendTextMessage(appt.patient_phone, messageBody);

        // Registrar log de automatización
        await query(
          `INSERT INTO automation_logs (clinic_id, rule_type, patient_id, appointment_id, channel, status, details)
           VALUES ($1, 'CONFIRMATION_24H', $2, $3, 'WHATSAPP', 'SENT', $4)`,
          [clinicId, appt.patient_id, appt.id, JSON.stringify({ sent_at: new Date().toISOString(), phone: appt.patient_phone })]
        );

        sent++;
      } catch (err) {
        logger.error(`Error al enviar confirmación de cita #${appt.id}:`, err.message);
        skipped++;
      }
    }

    logger.info(`[AUTOCONFIRM] Finalizado: ${sent} confirmaciones enviadas, ${skipped} omitidas.`);
    return { sent, skipped };
  }

  /**
   * Procesa la respuesta de un paciente para confirmar o cancelar una cita pendiente.
   */
  async processInboundConfirmation(phone, incomingText, clinicId = 1) {
    if (!phone || !incomingText) return { handled: false };

    const cleanPhone = phone.trim().replace(/[\s\-+]/g, '');
    const classification = await aiService.classifyIntent(incomingText);

    if (classification.intent !== 'CONFIRM' && classification.intent !== 'CANCEL') {
      return { handled: false, intent: classification.intent };
    }

    // 1. Buscar si el paciente tiene una cita próxima en estado 'programada' o 'confirmada'
    const upcomingApptRes = await query(
      `SELECT a.id, a.appointment_date, a.start_time, a.patient_id, a.clinic_id,
              p.first_name, p.last_name, p.phone,
              s.name AS current_status
       FROM appointments a
       JOIN patients p ON a.patient_id = p.id
       JOIN appointment_status s ON a.status_id = s.id
       WHERE a.deleted_at IS NULL
         AND a.appointment_date >= CURRENT_DATE
         AND (REPLACE(REPLACE(REPLACE(p.phone, ' ', ''), '-', ''), '+', '') LIKE '%' || $1 || '%'
              OR $1 LIKE '%' || REPLACE(REPLACE(REPLACE(p.phone, ' ', ''), '-', ''), '+', '') || '%')
         AND s.name IN ('programada', 'confirmada')
       ORDER BY a.appointment_date ASC, a.start_time ASC
       LIMIT 1`,
      [cleanPhone]
    );

    if (upcomingApptRes.rows.length === 0) {
      return { handled: false, reason: 'NO_UPCOMING_APPOINTMENT' };
    }

    const appt = upcomingApptRes.rows[0];

    if (classification.intent === 'CONFIRM') {
      // Obtener ID del estado 'confirmada'
      const statusRes = await query(`SELECT id FROM appointment_status WHERE name = 'confirmada' LIMIT 1`);
      const confirmedStatusId = statusRes.rows[0]?.id;

      if (confirmedStatusId) {
        await query(
          `UPDATE appointments SET status_id = $1, updated_at = NOW() WHERE id = $2`,
          [confirmedStatusId, appt.id]
        );

        // Actualizar o insertar en automation_logs
        await query(
          `INSERT INTO automation_logs (clinic_id, rule_type, patient_id, appointment_id, channel, status, details)
           VALUES ($1, 'CONFIRMATION_24H', $2, $3, 'WHATSAPP', 'CONFIRMED', $4)`,
          [appt.clinic_id, appt.patient_id, appt.id, JSON.stringify({ confirmed_via: 'WHATSAPP_AUTO', text: incomingText })]
        );

        logger.info(`[AUTOCONFIRM] Cita #${appt.id} CONFIRMADA automáticamente por respuesta de WhatsApp.`);
        
        // Emitir evento SSE en tiempo real para actualizar la agenda en todos los navegadores
        eventStreamService.broadcastToClinic(appt.clinic_id, 'APPOINTMENT_CONFIRMED', {
          appointmentId: appt.id,
          patientName: `${appt.first_name} ${appt.last_name}`,
          time: appt.start_time,
          status: 'confirmada',
        });

        return { handled: true, action: 'CONFIRMED', appointmentId: appt.id };
      }
    }

    if (classification.intent === 'CANCEL') {
      const statusRes = await query(`SELECT id FROM appointment_status WHERE name = 'cancelada' LIMIT 1`);
      const cancelledStatusId = statusRes.rows[0]?.id;

      if (cancelledStatusId) {
        await query(
          `UPDATE appointments SET status_id = $1, updated_at = NOW() WHERE id = $2`,
          [cancelledStatusId, appt.id]
        );

        // Crear una tarea urgente para la recepción en la tabla `tasks`
        await query(
          `INSERT INTO tasks (clinic_id, title, description, due_date, priority, status, patient_id, appointment_id)
           VALUES ($1, $2, $3, CURRENT_DATE, 'URGENT', 'PENDING', $4, $5)`,
          [
            appt.clinic_id,
            `⚠️ Cita Cancelada por WhatsApp: ${appt.first_name} ${appt.last_name}`,
            `El paciente canceló su cita del ${new Date(appt.appointment_date).toLocaleDateString()} a las ${String(appt.start_time).substring(0,5)}. Contactar lista de espera para cubrir el horario libre.`,
            appt.patient_id,
            appt.id,
          ]
        );

        await query(
          `INSERT INTO automation_logs (clinic_id, rule_type, patient_id, appointment_id, channel, status, details)
           VALUES ($1, 'CONFIRMATION_24H', $2, $3, 'WHATSAPP', 'CANCELLED', $4)`,
          [appt.clinic_id, appt.patient_id, appt.id, JSON.stringify({ cancelled_via: 'WHATSAPP_AUTO', text: incomingText })]
        );

        logger.info(`[AUTOCONFIRM] Cita #${appt.id} CANCELADA automáticamente. Tarea de recepción creada.`);

        // Emitir evento SSE en tiempo real
        eventStreamService.broadcastToClinic(appt.clinic_id, 'APPOINTMENT_CANCELLED', {
          appointmentId: appt.id,
          patientName: `${appt.first_name} ${appt.last_name}`,
          time: appt.start_time,
          status: 'cancelada',
        });

        return { handled: true, action: 'CANCELLED', appointmentId: appt.id };
      }
    }

    return { handled: false };
  }

  /**
   * Ejecuta el escaneo diario de Recall y Retención de Pacientes (1x al día).
   */
  async runDailyRecallSweep(clinicId = 1) {
    logger.info(`[RECALL] Iniciando barrido diario de recall y retención para clínica #${clinicId}`);

    let hygieneSent = 0;
    let surgerySent = 0;

    // 1. RECALL 1: Limpiezas y Profilaxis (+180 días / 6 Meses)
    const hygieneRule = await query(
      `SELECT * FROM automation_rules WHERE clinic_id = $1 AND rule_type = 'RECALL_HYGIENE_6M' AND is_active = TRUE AND deleted_at IS NULL`,
      [clinicId]
    );

    if (hygieneRule.rows.length > 0) {
      const rule = hygieneRule.rows[0];
      
      // Pacientes con última cita completada hace >= 180 días y sin citas futuras
      const eligiblePatients = await query(
        `SELECT p.id, p.first_name, p.last_name, p.phone, MAX(a.appointment_date) AS last_visit
         FROM patients p
         JOIN appointments a ON p.id = a.patient_id
         JOIN appointment_status s ON a.status_id = s.id
         WHERE p.clinic_id = $1 
           AND p.deleted_at IS NULL 
           AND s.name = 'completada'
         GROUP BY p.id, p.first_name, p.last_name, p.phone
         HAVING MAX(a.appointment_date) <= CURRENT_DATE - INTERVAL '180 days'
            AND NOT EXISTS (
              SELECT 1 FROM appointments future_a 
              WHERE future_a.patient_id = p.id AND future_a.appointment_date >= CURRENT_DATE AND future_a.deleted_at IS NULL
            )
            AND NOT EXISTS (
              SELECT 1 FROM automation_logs l 
              WHERE l.patient_id = p.id AND l.rule_type = 'RECALL_HYGIENE_6M' AND l.executed_at >= CURRENT_DATE - INTERVAL '30 days'
            )
         LIMIT 20`,
        [clinicId]
      );

      for (const p of eligiblePatients.rows) {
        if (!p.phone) continue;
        const patientName = `${p.first_name} ${p.last_name}`.trim();
        const body = rule.template_body.replace(/{{patient_name}}/g, patientName);

        try {
          await whatsappService.sendTextMessage(p.phone, body);

          // Crear seguimiento en patient_followups
          await query(
            `INSERT INTO patient_followups (clinic_id, patient_id, followup_date, reason, notes, status)
             VALUES ($1, $2, CURRENT_DATE, 'Recall Limpieza Semestral', 'Mensaje de WhatsApp preventivo enviado automáticamente', 'PENDING')`,
            [clinicId, p.id]
          );

          await query(
            `INSERT INTO automation_logs (clinic_id, rule_type, patient_id, channel, status, details)
             VALUES ($1, 'RECALL_HYGIENE_6M', $2, 'WHATSAPP', 'SENT', $3)`,
            [clinicId, p.id, JSON.stringify({ last_visit: p.last_visit })]
          );

          hygieneSent++;
        } catch (err) {
          logger.error(`Error en recall de limpieza paciente #${p.id}:`, err.message);
        }
      }
    }

    // 2. RECALL 2: Revisión Post-Quirúrgica (+7 Días)
    const surgeryRule = await query(
      `SELECT * FROM automation_rules WHERE clinic_id = $1 AND rule_type = 'RECALL_SURGERY_7D' AND is_active = TRUE AND deleted_at IS NULL`,
      [clinicId]
    );

    if (surgeryRule.rows.length > 0) {
      const rule = surgeryRule.rows[0];

      const postOpPatients = await query(
        `SELECT p.id, p.first_name, p.last_name, p.phone, a.id AS appt_id, a.appointment_date
         FROM patients p
         JOIN appointments a ON p.id = a.patient_id
         JOIN appointment_status s ON a.status_id = s.id
         WHERE p.clinic_id = $1 
           AND p.deleted_at IS NULL 
           AND s.name = 'completada'
           AND a.appointment_date = CURRENT_DATE - INTERVAL '7 days'
           AND NOT EXISTS (
             SELECT 1 FROM appointments future_a 
             WHERE future_a.patient_id = p.id AND future_a.appointment_date >= CURRENT_DATE AND future_a.deleted_at IS NULL
           )
           AND NOT EXISTS (
             SELECT 1 FROM automation_logs l 
             WHERE l.patient_id = p.id AND l.rule_type = 'RECALL_SURGERY_7D' AND l.executed_at >= CURRENT_DATE - INTERVAL '7 days'
           )
         LIMIT 10`,
        [clinicId]
      );

      for (const p of postOpPatients.rows) {
        if (!p.phone) continue;
        const patientName = `${p.first_name} ${p.last_name}`.trim();
        const body = rule.template_body.replace(/{{patient_name}}/g, patientName);

        try {
          await whatsappService.sendTextMessage(p.phone, body);

          await query(
            `INSERT INTO patient_followups (clinic_id, patient_id, followup_date, reason, notes, status)
             VALUES ($1, $2, CURRENT_DATE, 'Revisión Post-Quirúrgica 7 Días', 'Recordatorio de control enviado automáticamente', 'PENDING')`,
            [clinicId, p.id]
          );

          await query(
            `INSERT INTO automation_logs (clinic_id, rule_type, patient_id, appointment_id, channel, status, details)
             VALUES ($1, 'RECALL_SURGERY_7D', $2, $3, 'WHATSAPP', 'SENT', $4)`,
            [clinicId, p.id, p.appt_id, JSON.stringify({ surgery_date: p.appointment_date })]
          );

          surgerySent++;
        } catch (err) {
          logger.error(`Error en recall post-op paciente #${p.id}:`, err.message);
        }
      }
    }

    logger.info(`[RECALL] Barrido completado: ${hygieneSent} limpiezas y ${surgerySent} revisiones post-quirúrgicas activadas.`);
    return { hygieneSent, surgerySent, total: hygieneSent + surgerySent };
  }

  /**
   * Obtiene métricas y logs de automatizaciones.
   */
  async getAutomationStats(clinicId = 1) {
    const logs = await query(
      `SELECT l.*, p.first_name, p.last_name, p.custom_id
       FROM automation_logs l
       LEFT JOIN patients p ON l.patient_id = p.id
       WHERE l.clinic_id = $1
       ORDER BY l.executed_at DESC
       LIMIT 50`,
      [clinicId]
    );

    const counts = await query(
      `SELECT rule_type, status, COUNT(*) AS count
       FROM automation_logs
       WHERE clinic_id = $1
       GROUP BY rule_type, status`,
      [clinicId]
    );

    return {
      recentLogs: logs.rows,
      summary: counts.rows,
    };
  }
}

export default new AutomationSchedulerService();
