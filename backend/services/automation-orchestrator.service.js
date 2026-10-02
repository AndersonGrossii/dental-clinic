// ============================================
// Orquestador Central de Automatizaciones (AI Automation Orchestrator)
// Ejecución determinista de flujos, control de ciclo de vida e idempotencia
// ============================================
import automationJobRepository from '../repositories/automation-job.repository.js';
import whatsappService from './whatsapp.service.js';
import aiSupervisionService from './ai-supervision.service.js';
import eventStreamService from './event-stream.service.js';
import { query } from '../database/pool.js';
import { logger } from '../utils/logger.js';

class AutomationOrchestratorService {
  /**
   * Encola los recordatorios de confirmación 24h para las citas de mañana.
   * La clave de idempotencia garantiza que nunca se encole más de una vez para la misma cita.
   */
  async enqueueDailyConfirmationJobs(clinicId = 1) {
    const cid = parseInt(clinicId, 10) || 1;
    logger.info(`[ORCHESTRATOR] Encolando recordatorios 24h para clínica #${cid}`);

    // Regla activa
    const ruleRes = await query(
      `SELECT * FROM automation_rules WHERE clinic_id = $1 AND rule_type = 'CONFIRMATION_24H' AND is_active = TRUE AND deleted_at IS NULL`,
      [cid]
    );
    if (ruleRes.rows.length === 0) return { enqueued: 0, skipped: 0 };
    const rule = ruleRes.rows[0];

    const apptsRes = await query(
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
         AND a.appointment_date = CURRENT_DATE + INTERVAL '1 day'`,
      [cid]
    );

    let enqueued = 0;
    let skipped = 0;

    for (const appt of apptsRes.rows) {
      if (!appt.patient_phone) {
        skipped++;
        continue;
      }

      const dateStr = new Date(appt.appointment_date).toISOString().split('T')[0];
      const idempotencyKey = `CONFIRMATION_24H:appt_${appt.id}:${dateStr}`;

      const res = await automationJobRepository.createJob({
        clinicId: cid,
        jobType: 'CONFIRMATION_24H',
        idempotencyKey,
        payload: {
          appointmentId: appt.id,
          patientId: appt.patient_id,
          phone: appt.patient_phone,
          patientName: `${appt.first_name} ${appt.last_name}`.trim(),
          dateStr,
          timeStr: String(appt.start_time).substring(0, 5),
          doctorName: appt.doctor_name,
          templateBody: rule.template_body,
        },
      });

      if (res.created) enqueued++;
      else skipped++;
    }

    return { enqueued, skipped, totalFound: apptsRes.rows.length };
  }

  /**
   * Encola los trabajos de recall preventivo (6 meses profilaxis y 7 días post-cirugía).
   */
  async enqueueDailyRecallJobs(clinicId = 1) {
    const cid = parseInt(clinicId, 10) || 1;
    logger.info(`[ORCHESTRATOR] Encolando recalls preventivos para clínica #${cid}`);

    let hygieneEnqueued = 0;
    let surgeryEnqueued = 0;

    // 1. Recall Profilaxis 6M
    const hygieneRule = await query(
      `SELECT * FROM automation_rules WHERE clinic_id = $1 AND rule_type = 'RECALL_HYGIENE_6M' AND is_active = TRUE AND deleted_at IS NULL`,
      [cid]
    );
    if (hygieneRule.rows.length > 0) {
      const rule = hygieneRule.rows[0];
      const eligible = await query(
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
         LIMIT 20`,
        [cid]
      );

      const currentMonth = new Date().toISOString().substring(0, 7); // 'YYYY-MM'
      for (const p of eligible.rows) {
        if (!p.phone) continue;
        const idempotencyKey = `RECALL_6M:patient_${p.id}:${currentMonth}`;

        const res = await automationJobRepository.createJob({
          clinicId: cid,
          jobType: 'RECALL_HYGIENE_6M',
          idempotencyKey,
          payload: {
            patientId: p.id,
            patientName: `${p.first_name} ${p.last_name}`.trim(),
            phone: p.phone,
            lastVisit: p.last_visit,
            templateBody: rule.template_body,
          },
        });
        if (res.created) hygieneEnqueued++;
      }
    }

    // 2. Recall Post-Op 7D
    const surgeryRule = await query(
      `SELECT * FROM automation_rules WHERE clinic_id = $1 AND rule_type = 'RECALL_SURGERY_7D' AND is_active = TRUE AND deleted_at IS NULL`,
      [cid]
    );
    if (surgeryRule.rows.length > 0) {
      const rule = surgeryRule.rows[0];
      const postOp = await query(
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
         LIMIT 10`,
        [cid]
      );

      for (const p of postOp.rows) {
        if (!p.phone) continue;
        const idempotencyKey = `RECALL_SURGERY_7D:appt_${p.appt_id}`;

        const res = await automationJobRepository.createJob({
          clinicId: cid,
          jobType: 'RECALL_SURGERY_7D',
          idempotencyKey,
          payload: {
            patientId: p.id,
            appointmentId: p.appt_id,
            patientName: `${p.first_name} ${p.last_name}`.trim(),
            phone: p.phone,
            surgeryDate: p.appointment_date,
            templateBody: rule.template_body,
          },
        });
        if (res.created) surgeryEnqueued++;
      }
    }

    return { hygieneEnqueued, surgeryEnqueued, total: hygieneEnqueued + surgeryEnqueued };
  }

  /**
   * Encola seguimientos comerciales supervisados para presupuestos >= 48h.
   */
  async enqueueQuotationFollowupJobs(clinicId = 1) {
    const cid = parseInt(clinicId, 10) || 1;
    logger.info(`[ORCHESTRATOR] Encolando seguimiento de presupuestos para clínica #${cid}`);

    const quotesRes = await query(
      `SELECT q.id, q.quote_number, q.total, q.patient_id, q.created_at,
              p.first_name, p.last_name, p.phone
       FROM quotations q
       JOIN patients p ON q.patient_id = p.id
       WHERE q.clinic_id = $1 
         AND q.status = 'presentado'
         AND q.deleted_at IS NULL
         AND p.deleted_at IS NULL
         AND q.created_at <= NOW() - INTERVAL '48 hours'
       LIMIT 10`,
      [cid]
    );

    let enqueued = 0;
    for (const q of quotesRes.rows) {
      if (!q.phone) continue;
      const idempotencyKey = `QUOTE_SUPERVISED:quote_${q.id}`;

      const res = await automationJobRepository.createJob({
        clinicId: cid,
        jobType: 'QUOTATION_FOLLOWUP_SCAN',
        idempotencyKey,
        payload: {
          quotationId: q.id,
          patientId: q.patient_id,
          phone: q.phone,
          patientName: `${q.first_name} ${q.last_name}`.trim(),
          firstName: (q.first_name || 'paciente').trim(),
        },
      });
      if (res.created) enqueued++;
    }

    return { enqueued, totalFound: quotesRes.rows.length };
  }

  /**
   * Encola tareas de seguimiento comercial para leads inactivos (>= 48h sin actividad).
   * No duplica si ya existe una tarea pendiente para ese lead.
   */
  async enqueueInactiveLeadFollowupJobs(clinicId = 1) {
    const cid = parseInt(clinicId, 10) || 1;
    logger.info(`[ORCHESTRATOR] Encolando seguimiento para leads inactivos clínica #${cid}`);

    const inactiveLeads = await query(
      `SELECT l.id, l.contact_id, l.source, l.status, l.interest, l.created_at,
              c.name AS contact_name, c.phone AS contact_phone
       FROM crm_leads l
       JOIN messaging_contacts c ON l.contact_id = c.id
       WHERE l.clinic_id = $1
         AND l.status IN ('new', 'contacted')
         AND l.updated_at <= NOW() - INTERVAL '48 hours'
         AND NOT EXISTS (
           SELECT 1 FROM tasks t 
           WHERE t.lead_id = l.id AND t.clinic_id = $1 AND t.status = 'PENDING'
         )
       LIMIT 10`,
      [cid]
    );

    let enqueued = 0;
    const dateStr = new Date().toISOString().substring(0, 10);

    for (const l of inactiveLeads.rows) {
      const idempotencyKey = `LEAD_INACTIVE:lead_${l.id}:${dateStr}`;
      const res = await automationJobRepository.createJob({
        clinicId: cid,
        jobType: 'LEAD_INACTIVE_FOLLOWUP',
        idempotencyKey,
        payload: {
          leadId: l.id,
          contactId: l.contact_id,
          contactName: l.contact_name,
          contactPhone: l.contact_phone,
          interest: l.interest,
        },
      });
      if (res.created) enqueued++;
    }

    return { enqueued, totalFound: inactiveLeads.rows.length };
  }

  /**
   * Procesa los trabajos pendientes de la cola de forma transaccional y resiliente.
   */
  async processPendingJobs(clinicId = 1, limit = 20) {
    const cid = parseInt(clinicId, 10) || 1;
    const jobs = await automationJobRepository.claimPendingJobs(cid, limit);

    if (jobs.length === 0) return { processed: 0, succeeded: 0, failed: 0 };

    logger.info(`[ORCHESTRATOR] Procesando ${jobs.length} trabajos reclamados para clínica #${cid}`);

    let succeeded = 0;
    let failed = 0;

    for (const job of jobs) {
      try {
        const payload = typeof job.payload === 'string' ? JSON.parse(job.payload) : job.payload;
        let result = {};

        switch (job.job_type) {
          case 'CONFIRMATION_24H':
            result = await this._executeConfirmationJob(cid, payload);
            break;

          case 'RECALL_HYGIENE_6M':
            result = await this._executeHygieneRecallJob(cid, payload);
            break;

          case 'RECALL_SURGERY_7D':
            result = await this._executeSurgeryRecallJob(cid, payload);
            break;

          case 'QUOTATION_FOLLOWUP_SCAN':
            result = await this._executeQuotationFollowupJob(cid, payload);
            break;

          case 'LEAD_INACTIVE_FOLLOWUP':
            result = await this._executeInactiveLeadJob(cid, payload);
            break;

          default:
            logger.warn(`[ORCHESTRATOR] Tipo de trabajo desconocido: ${job.job_type}`);
            result = { skipped: true, reason: 'UNKNOWN_JOB_TYPE' };
        }

        await automationJobRepository.markCompleted(job.id, cid, result);
        succeeded++;
      } catch (err) {
        logger.error(`[ORCHESTRATOR] Error ejecutando trabajo #${job.id} (${job.job_type}):`, err.message);
        await automationJobRepository.markFailed(job.id, cid, err.message, true);
        failed++;
      }
    }

    return { processed: jobs.length, succeeded, failed };
  }

  // --- Handlers específicos de ejecución de cada tipo de trabajo ---

  async _executeConfirmationJob(clinicId, payload) {
    const { appointmentId, patientId, phone, patientName, dateStr, timeStr, doctorName, templateBody } = payload;

    const messageBody = (templateBody || '')
      .replace(/{{patient_name}}/g, patientName)
      .replace(/{{date}}/g, dateStr)
      .replace(/{{time}}/g, timeStr)
      .replace(/{{doctor_name}}/g, doctorName);

    await whatsappService.sendTextMessage(phone, messageBody);

    await query(
      `INSERT INTO automation_logs (clinic_id, rule_type, patient_id, appointment_id, channel, status, details)
       VALUES ($1, 'CONFIRMATION_24H', $2, $3, 'WHATSAPP', 'SENT', $4)`,
      [clinicId, patientId, appointmentId, JSON.stringify({ sent_at: new Date().toISOString(), phone })]
    );

    return { sent: true, phone, appointmentId };
  }

  async _executeHygieneRecallJob(clinicId, payload) {
    const { patientId, patientName, phone, lastVisit, templateBody } = payload;
    const body = (templateBody || '').replace(/{{patient_name}}/g, patientName);

    await whatsappService.sendTextMessage(phone, body);

    await query(
      `INSERT INTO patient_followups (clinic_id, patient_id, followup_date, reason, notes, status)
       VALUES ($1, $2, CURRENT_DATE, 'Recall Limpieza Semestral', 'Recordatorio preventivo enviado automáticamente', 'PENDING')`,
      [clinicId, patientId]
    );

    await query(
      `INSERT INTO automation_logs (clinic_id, rule_type, patient_id, channel, status, details)
       VALUES ($1, 'RECALL_HYGIENE_6M', $2, 'WHATSAPP', 'SENT', $3)`,
      [clinicId, patientId, JSON.stringify({ last_visit: lastVisit })]
    );

    return { sent: true, patientId };
  }

  async _executeSurgeryRecallJob(clinicId, payload) {
    const { patientId, appointmentId, patientName, phone, surgeryDate, templateBody } = payload;
    const body = (templateBody || '').replace(/{{patient_name}}/g, patientName);

    await whatsappService.sendTextMessage(phone, body);

    await query(
      `INSERT INTO patient_followups (clinic_id, patient_id, followup_date, reason, notes, status)
       VALUES ($1, $2, CURRENT_DATE, 'Revisión Post-Quirúrgica 7 Días', 'Control preventivo post-cirugía enviado', 'PENDING')`,
      [clinicId, patientId]
    );

    await query(
      `INSERT INTO automation_logs (clinic_id, rule_type, patient_id, appointment_id, channel, status, details)
       VALUES ($1, 'RECALL_SURGERY_7D', $2, $3, 'WHATSAPP', 'SENT', $4)`,
      [clinicId, patientId, appointmentId, JSON.stringify({ surgery_date: surgeryDate })]
    );

    return { sent: true, patientId, appointmentId };
  }

  async _executeQuotationFollowupJob(clinicId, payload) {
    const { quotationId, patientId, phone, patientName, firstName } = payload;
    const suggestedMsg = `¡Hola ${firstName}! Le escribimos desde nuestra clínica para saber si le ha quedado alguna duda sobre el plan de tratamiento que preparamos para usted. Si desea comentar cualquier detalle o revisar opciones de financiación a su medida, estamos a su total disposición. ¿Le gustaría que le llamemos?`;

    const approval = await aiSupervisionService.queueQuotationFollowup({
      clinicId,
      patientId,
      quotationId,
      phone,
      patientName,
      suggestedMessage: suggestedMsg,
    });

    return { queued: true, approvalId: approval?.id };
  }

  async _executeInactiveLeadJob(clinicId, payload) {
    const { leadId, contactId, contactName, contactPhone, interest } = payload;

    // Crear tarea comercial en tasks para la recepcionista asignada o recepción general
    const taskRes = await query(
      `INSERT INTO tasks (clinic_id, lead_id, title, description, due_date, priority, status)
       VALUES ($1, $2, $3, $4, CURRENT_DATE, 'MEDIUM', 'PENDING')
       RETURNING id`,
      [
        clinicId,
        leadId,
        `📞 Contactar Lead Inactivo: ${contactName || contactPhone}`,
        `El lead (${interest || 'Interés General'}) lleva más de 48h sin actividad. Contactar para coordinar 1ª cita de valoración gratuita.`,
      ]
    );

    return { taskCreated: true, taskId: taskRes.rows[0]?.id };
  }
}

export default new AutomationOrchestratorService();
