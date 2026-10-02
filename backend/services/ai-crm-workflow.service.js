// ============================================
// Servicio de Integración de Flujo de Leads y CRM (Fase 6)
// Responsabilidades:
// - Sincronización automática de Contactos, Leads y Oportunidades
// - Enriquecimiento y calificación inteligente con IA Sofía
// - Generación de Actividades (crm_activities) y Notas (crm_notes)
// - Detección y creación de Oportunidades comerciales para tratamientos de alto valor
// - Gestión estructurada de Traspasos Humanos (Human Handoff) y Tareas de Recepción
// - Programación de Seguimientos Comerciales (Follow-ups)
// ============================================
import { query } from '../database/pool.js';
import messagingRepository from '../repositories/messaging.repository.js';
import internalChatService from './internal-chat.service.js';
import eventStreamService from './event-stream.service.js';
import aiService from './ai.service.js';
import { logger } from '../utils/logger.js';

class AICrmWorkflowService {
  /**
   * Sincroniza y enriquece Contacto, Lead y Oportunidad al recibir un mensaje entrante.
   */
  async syncLeadOnInboundMessage({ clinicId = 1, contact, incomingText = '', channel = 'WHATSAPP' }) {
    const cid = parseInt(clinicId, 10) || 1;
    const text = (incomingText || '').trim();

    try {
      // 1. Vincular automáticamente con paciente existente si no está vinculado
      if (!contact.patient_id && contact.phone) {
        const cleanPhone = contact.phone.replace(/\D/g, '').slice(-9);
        if (cleanPhone.length >= 6) {
          const patRes = await query(
            `SELECT id, first_name, last_name FROM patients 
             WHERE clinic_id = $1 AND deleted_at IS NULL 
               AND REGEXP_REPLACE(COALESCE(phone, ''), '\\D', '', 'g') LIKE '%' || $2
             ORDER BY id DESC LIMIT 1`,
            [cid, cleanPhone]
          );
          if (patRes.rows.length > 0) {
            const p = patRes.rows[0];
            await query(`UPDATE messaging_contacts SET patient_id = $1, updated_at = NOW() WHERE id = $2`, [p.id, contact.id]);
            contact.patient_id = p.id;
            logger.info(`[AI_CRM] Contacto #${contact.id} vinculado automáticamente a Paciente existente #${p.id} (${p.first_name} ${p.last_name}).`);
          }
        }
      }

      // 2. Localizar o crear Lead en crm_leads
      let leadId = null;
      let isNewLead = false;

      const leadRes = await query(
        `SELECT id, status, patient_id, interest 
         FROM crm_leads 
         WHERE clinic_id = $1 
           AND (contact_id = $2 OR (patient_id IS NOT NULL AND patient_id = $3))
           AND status NOT IN ('lost')
         ORDER BY id DESC LIMIT 1`,
        [cid, contact.id, contact.patient_id || null]
      );

      if (leadRes.rows.length > 0) {
        leadId = leadRes.rows[0].id;
        // Actualizar updated_at y patient_id si corresponde
        await query(
          `UPDATE crm_leads 
           SET updated_at = NOW(),
               patient_id = COALESCE(patient_id, $1)
           WHERE id = $2`,
          [contact.patient_id || null, leadId]
        );
      } else {
        // Validar source con crm_lead_sources
        const validSources = ['whatsapp', 'instagram', 'website', 'manual', 'other'];
        const leadSource = validSources.includes(channel.toLowerCase()) ? channel.toLowerCase() : 'other';
        const initialStatus = contact.patient_id ? 'converted' : 'new';
        const insLead = await query(
          `INSERT INTO crm_leads (
             clinic_id, contact_id, patient_id, source, status, interest, created_at, updated_at
           ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
           RETURNING id`,
          [
            cid,
            contact.id,
            contact.patient_id || null,
            leadSource,
            initialStatus,
            text.substring(0, 250) || 'Consulta inicial por mensajería',
          ]
        );
        leadId = insLead.rows[0].id;
        isNewLead = true;

        // Registrar actividad de creación de lead
        await query(
          `INSERT INTO crm_activities (clinic_id, contact_id, lead_id, activity_type, title, description, actor_type, metadata)
           VALUES ($1, $2, $3, 'LEAD_CREATED', $4, $5, 'ai', $6)`,
          [
            cid,
            contact.id,
            leadId,
            `Lead originado vía ${channel}`,
            `Contacto ${contact.name || contact.phone} inició conversación. Mensaje inicial: "${text.substring(0, 120)}"`,
            JSON.stringify({ channel, isPatient: Boolean(contact.patient_id) }),
          ]
        );
      }

      // 3. Calificar Lead con IA Sofía (actualiza ai_score, ai_urgency, ai_summary, ai_extracted_interest)
      let qualification = null;
      if (leadId) {
        qualification = await aiService.qualifyLeadFromConversation(
          leadId,
          cid,
          [{ direction: 'INBOUND', body: text }]
        );
      }

      // 4. Detección y creación automática de Oportunidad Comercial para tratamientos de alto valor
      let opportunityId = null;
      const detectedInterest = qualification?.analysis?.serviceInterest || null;
      const highValueServices = ['ORTODONCIA', 'IMPLANTOLOGIA', 'ESTETICA_DENTAL', 'ESTETICA_FACIAL', 'PERIODONCIA'];

      const isHighValue = highValueServices.some(s => 
        (detectedInterest && detectedInterest.toUpperCase().includes(s)) ||
        text.toLowerCase().includes('invisalign') ||
        text.toLowerCase().includes('bracket') ||
        text.toLowerCase().includes('ortodoncia') ||
        text.toLowerCase().includes('implante') ||
        text.toLowerCase().includes('carilla') ||
        text.toLowerCase().includes('hialuronico') ||
        text.toLowerCase().includes('hialurónico') ||
        text.toLowerCase().includes('botox')
      );

      if (isHighValue) {
        // Verificar si ya existe una oportunidad abierta para este contacto o lead
        const existingOpp = await query(
          `SELECT id FROM crm_opportunities 
           WHERE clinic_id = $1 
             AND (lead_id = $2 OR contact_id = $3 OR (patient_id IS NOT NULL AND patient_id = $4))
             AND status = 'open' 
             AND deleted_at IS NULL
           LIMIT 1`,
          [cid, leadId, contact.id, contact.patient_id || null]
        );

        if (existingOpp.rows.length === 0) {
          const serviceTitle = detectedInterest || 'Tratamiento Odontológico Avanzado';
          const oppName = `${serviceTitle} - ${contact.name || contact.phone}`;
          const insOpp = await query(
            `INSERT INTO crm_opportunities (
               clinic_id, contact_id, lead_id, patient_id, name, service_interest, status, estimated_value, created_at, updated_at
             ) VALUES ($1, $2, $3, $4, $5, $6, 'open', 0.00, NOW(), NOW())
             RETURNING id`,
            [
              cid,
              contact.id,
              leadId,
              contact.patient_id || null,
              oppName,
              serviceTitle,
            ]
          );
          opportunityId = insOpp.rows[0].id;

          // Registrar actividad comercial
          await query(
            `INSERT INTO crm_activities (clinic_id, contact_id, lead_id, opportunity_id, activity_type, title, description, actor_type, metadata)
             VALUES ($1, $2, $3, $4, 'OPPORTUNITY_CREATED', $5, $6, 'ai', $7)`,
            [
              cid,
              contact.id,
              leadId,
              opportunityId,
              `Oportunidad detectada por IA: ${serviceTitle}`,
              `Sofía identificó interés de alto valor en "${serviceTitle}" a partir de la consulta del paciente.`,
              JSON.stringify({ detectedInterest: serviceTitle, text: text.substring(0, 100) }),
            ]
          );

          logger.info(`[AI_CRM] Oportunidad comercial #${opportunityId} ("${oppName}") creada automáticamente por Sofía.`);
        } else {
          opportunityId = existingOpp.rows[0].id;
        }
      }

      return {
        leadId,
        isNewLead,
        opportunityId,
        qualification,
        isExistingPatient: Boolean(contact.patient_id),
      };
    } catch (err) {
      logger.error('[AI_CRM] Error sincronizando lead en mensaje entrante:', err.message);
      return { leadId: null, error: err.message };
    }
  }

  /**
   * Registra eventos del ciclo de vida de citas en el CRM (BOOKED, RESCHEDULED, CANCELLED).
   */
  async handleAppointmentEvent({ clinicId = 1, appointmentId, eventType, actorType = 'ai', details = {} }) {
    const cid = parseInt(clinicId, 10) || 1;

    try {
      // 1. Obtener detalles de la cita y del doctor
      const apptRes = await query(
        `SELECT a.*, 
                d.specialty AS doctor_specialty,
                u.first_name AS doctor_first_name, u.last_name AS doctor_last_name,
                p.first_name AS patient_first_name, p.last_name AS patient_last_name, p.phone AS patient_phone
         FROM appointments a
         LEFT JOIN doctors d ON a.doctor_id = d.id
         LEFT JOIN users u ON d.user_id = u.id
         LEFT JOIN patients p ON a.patient_id = p.id
         WHERE a.id = $1 AND a.clinic_id = $2`,
        [appointmentId, cid]
      );

      if (apptRes.rows.length === 0) return { handled: false, reason: 'APPOINTMENT_NOT_FOUND' };

      const appt = apptRes.rows[0];
      const doctorTitle = `Dr/a. ${appt.doctor_first_name} ${appt.doctor_last_name}`.trim();
      const patientName = appt.guest_name || `${appt.patient_first_name} ${appt.patient_last_name}`.trim() || 'Paciente';
      const patientPhone = appt.guest_phone || appt.patient_phone || null;

      // 2. Localizar Contacto y Lead vinculados
      let contactId = null;
      let leadId = null;

      if (patientPhone) {
        const cleanPhone = patientPhone.replace(/\D/g, '').slice(-9);
        const contactRes = await query(
          `SELECT id FROM messaging_contacts 
           WHERE clinic_id = $1 AND deleted_at IS NULL 
             AND REGEXP_REPLACE(COALESCE(phone, ''), '\\D', '', 'g') LIKE '%' || $2
           ORDER BY id DESC LIMIT 1`,
          [cid, cleanPhone]
        );
        if (contactRes.rows.length > 0) contactId = contactRes.rows[0].id;
      }

      if (!contactId && patientPhone) {
        const c = await messagingRepository.findOrCreateContact(
          cid,
          patientPhone,
          patientName,
          null
        );
        if (c) {
          contactId = c.id;
          if (appt.patient_id && !c.patient_id) {
            await query(`UPDATE messaging_contacts SET patient_id = $1 WHERE id = $2`, [appt.patient_id, c.id]);
          }
        }
      }

      if (contactId || appt.patient_id) {
        const leadRes = await query(
          `SELECT id, status FROM crm_leads 
           WHERE clinic_id = $1 
             AND (contact_id = $2 OR (patient_id IS NOT NULL AND patient_id = $3))
             AND status NOT IN ('lost')
           ORDER BY id DESC LIMIT 1`,
          [cid, contactId, appt.patient_id]
        );
        if (leadRes.rows.length > 0) {
          leadId = leadRes.rows[0].id;
        } else if (contactId) {
          const insL = await query(
            `INSERT INTO crm_leads (clinic_id, contact_id, patient_id, source, status, interest, created_at, updated_at)
             VALUES ($1, $2, $3, 'manual', 'appointment_scheduled', $4, NOW(), NOW())
             RETURNING id`,
            [cid, contactId, appt.patient_id || null, appt.reason || 'Cita agendada']
          );
          leadId = insL.rows[0].id;
        }
      }

      const dateStr = appt.appointment_date ? new Date(appt.appointment_date).toISOString().split('T')[0] : '';
      const timeStr = appt.start_time ? String(appt.start_time).substring(0, 5) : '';

      // 3. Procesar según tipo de evento
      if (eventType === 'BOOKED') {
        if (leadId) {
          await query(
            `UPDATE crm_leads 
             SET status = 'appointment_scheduled',
                 ai_recommended_action = 'Confirmar asistencia antes de la consulta',
                 updated_at = NOW() 
             WHERE id = $1`,
            [leadId]
          );
        }

        const visitTypeStr = appt.is_first_visit ? 'Primera Visita / Diagnóstico' : 'Consulta de Seguimiento';
        const activityTitle = appt.is_first_visit 
          ? `Primera visita agendada con ${doctorTitle}` 
          : `Cita de seguimiento agendada con ${doctorTitle}`;
        const activityDesc = `Cita programada para el ${dateStr} a las ${timeStr}h. Servicio: ${appt.reason || 'Revisión'}.`;

        await query(
          `INSERT INTO crm_activities (clinic_id, contact_id, lead_id, activity_type, title, description, actor_type, metadata)
           VALUES ($1, $2, $3, 'APPOINTMENT_BOOKED', $4, $5, $6, $7)`,
          [
            cid,
            contactId,
            leadId,
            activityTitle,
            activityDesc,
            actorType,
            JSON.stringify({ appointmentId, date: dateStr, time: timeStr, doctorId: appt.doctor_id, isFirstVisit: appt.is_first_visit }),
          ]
        );

        if (leadId) {
          await query(
            `INSERT INTO crm_notes (clinic_id, lead_id, contact_id, author_id, note, created_by_type)
             VALUES ($1, $2, $3, 1, $4, 'ai')`,
            [
              cid,
              leadId,
              contactId,
              `🤖 [IA Sofía]: ${visitTypeStr} agendada para el ${dateStr} a las ${timeStr}h con ${doctorTitle}. Motivo: ${appt.reason || 'Revisión'}.`,
            ]
          );
        }
      } else if (eventType === 'RESCHEDULED') {
        const activityTitle = `Cita reagendada para el ${dateStr} a las ${timeStr}h`;
        const activityDesc = `La cita #${appointmentId} con ${doctorTitle} fue reagendada a solicitud del paciente.`;

        await query(
          `INSERT INTO crm_activities (clinic_id, contact_id, lead_id, activity_type, title, description, actor_type, metadata)
           VALUES ($1, $2, $3, 'APPOINTMENT_RESCHEDULED', $4, $5, $6, $7)`,
          [
            cid,
            contactId,
            leadId,
            activityTitle,
            activityDesc,
            actorType,
            JSON.stringify({ appointmentId, newDate: dateStr, newTime: timeStr, doctorId: appt.doctor_id }),
          ]
        );

        if (leadId) {
          await query(
            `INSERT INTO crm_notes (clinic_id, lead_id, contact_id, author_id, note, created_by_type)
             VALUES ($1, $2, $3, 1, $4, 'ai')`,
            [
              cid,
              leadId,
              contactId,
              `🤖 [IA Sofía]: Cita reagendada para el ${dateStr} a las ${timeStr}h con ${doctorTitle}.`,
            ]
          );
        }
      } else if (eventType === 'CANCELLED') {
        if (leadId) {
          await query(
            `UPDATE crm_leads 
             SET status = 'contacted',
                 ai_recommended_action = 'Contactar para reprogramar cita cancelada',
                 updated_at = NOW() 
             WHERE id = $1`,
            [leadId]
          );
        }

        const cancelReason = details.reason || appt.cancellation_reason || 'Cancelada por el paciente';
        const activityTitle = `Cita cancelada por el paciente`;
        const activityDesc = `Cita del ${dateStr} a las ${timeStr}h con ${doctorTitle} cancelada. Motivo: ${cancelReason}.`;

        await query(
          `INSERT INTO crm_activities (clinic_id, contact_id, lead_id, activity_type, title, description, actor_type, metadata)
           VALUES ($1, $2, $3, 'APPOINTMENT_CANCELLED', $4, $5, $6, $7)`,
          [
            cid,
            contactId,
            leadId,
            activityTitle,
            activityDesc,
            actorType,
            JSON.stringify({ appointmentId, date: dateStr, time: timeStr, reason: cancelReason }),
          ]
        );

        if (leadId) {
          await query(
            `INSERT INTO crm_notes (clinic_id, lead_id, contact_id, author_id, note, created_by_type)
             VALUES ($1, $2, $3, 1, $4, 'ai')`,
            [
              cid,
              leadId,
              contactId,
              `🤖 [IA Sofía]: Cita del ${dateStr} a las ${timeStr}h con ${doctorTitle} CANCELADA. Motivo: ${cancelReason}.`,
            ]
          );
        }
      }

      return {
        handled: true,
        appointmentId,
        eventType,
        leadId,
        contactId,
      };
    } catch (err) {
      logger.error('[AI_CRM] Error registrando evento de cita en CRM:', err.message);
      return { handled: false, error: err.message };
    }
  }

  /**
   * Gestiona el Traspaso a Recepción (Human Handoff):
   * - Crea Tarea urgente o de alta prioridad en tasks para la recepción
   * - Registra actividad en crm_activities
   * - Emite notificación en el Chat Interno de la clínica
   * - Pausa la automatización de la conversación
   * - Emite evento SSE HUMAN_TAKEOVER_REQUIRED
   */
  async handleHumanHandoff({
    clinicId = 1,
    contact,
    conversationId,
    channel = 'WHATSAPP',
    reason = 'Solicitud de atención humana',
    incomingText = '',
    isUrgent = false,
  }) {
    const cid = parseInt(clinicId, 10) || 1;
    const patientName = contact.name || contact.phone || 'Paciente';

    try {
      // 1. Obtener lead_id si existe
      let leadId = null;
      const leadRes = await query(
        `SELECT id FROM crm_leads 
         WHERE clinic_id = $1 AND (contact_id = $2 OR (patient_id IS NOT NULL AND patient_id = $3))
         ORDER BY id DESC LIMIT 1`,
        [cid, contact.id, contact.patient_id || null]
      );
      if (leadRes.rows.length > 0) leadId = leadRes.rows[0].id;

      // 2. Crear Tarea para Recepción en la tabla tasks
      const taskPriority = isUrgent ? 'URGENT' : 'HIGH';
      const taskTitle = isUrgent
        ? `🚨 URGENCIA: Atención inmediata para ${patientName}`
        : `🔔 Traspaso de chat: ${patientName} (${channel})`;
      
      const taskDesc = `Traspaso solicitado por el paciente en el canal ${channel}.\n` +
        `Teléfono: ${contact.phone}\n` +
        `Último mensaje recibido: "${incomingText.substring(0, 200)}"\n` +
        `Motivo: ${reason}`;

      const taskRes = await query(
        `INSERT INTO tasks (
           clinic_id, contact_id, lead_id, patient_id, title, description,
           priority, status, due_date, due_time, is_team_visible, created_by_type, created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, 'PENDING', CURRENT_DATE, CURRENT_TIME, TRUE, 'ai', NOW(), NOW()
         ) RETURNING *`,
        [
          cid,
          contact.id,
          leadId,
          contact.patient_id || null,
          taskTitle,
          taskDesc,
          taskPriority,
        ]
      );

      const createdTask = taskRes.rows[0];

      // 3. Registrar Actividad de Traspaso en crm_activities
      await query(
        `INSERT INTO crm_activities (clinic_id, contact_id, lead_id, activity_type, title, description, actor_type, metadata)
         VALUES ($1, $2, $3, 'HUMAN_HANDOFF', $4, $5, 'ai', $6)`,
        [
          cid,
          contact.id,
          leadId,
          isUrgent ? 'Urgencia transferida a recepción' : 'Conversación transferida a recepcionista',
          `Transferencia solicitada por el paciente en ${channel}. Tarea #${createdTask.id} creada para el equipo.`,
          JSON.stringify({ taskId: createdTask.id, isUrgent, channel, reason, lastMessage: incomingText.substring(0, 100) }),
        ]
      );

      // 4. Notificar en el Chat Interno del personal
      try {
        const chatNotice = isUrgent
          ? `🚨 [URGENCIA CLÍNICA PRIORITARIA] El paciente ${patientName} (${contact.phone}) informa molestia aguda o urgencia por ${channel}. Conversación transferida al mostrador.`
          : `🔔 [TRASPASO A RECEPCIÓN] El paciente ${patientName} (${contact.phone}) solicita hablar con una persona por ${channel}. Conversación transferida al mostrador.`;

        await internalChatService.sendMessage({
          clinicId: cid,
          senderId: 1, // ID del sistema
          recipientId: null, // Canal general de esa clínica
          message: chatNotice,
        });
      } catch (chatErr) {
        logger.warn('[AI_CRM] No se pudo enviar notificación al chat interno:', chatErr.message);
      }

      // 5. Pausar la automatización y abrir la conversación para intervención humana
      if (conversationId) {
        await messagingRepository.setAutomationEnabled(conversationId, false, cid);
        await messagingRepository.setConversationStatus(conversationId, 'OPEN', cid);
      }

      // 6. Emitir evento Server-Sent Events en tiempo real
      eventStreamService.broadcastToClinic(cid, 'HUMAN_TAKEOVER_REQUIRED', {
        conversationId,
        contactId: contact.id,
        contactName: contact.name,
        phone: contact.phone,
        channel,
        isUrgent,
        taskId: createdTask.id,
      });

      logger.info(`[AI_CRM] Traspaso a humano completado para ${patientName}. Tarea #${createdTask.id} creada con prioridad ${taskPriority}.`);

      return {
        success: true,
        taskId: createdTask.id,
        taskPriority,
        leadId,
      };
    } catch (err) {
      logger.error('[AI_CRM] Error en traspaso humano:', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Programa un seguimiento comercial (Follow-up) preventivo o post-consulta.
   */
  async scheduleCommercialFollowUp({
    clinicId = 1,
    leadId = null,
    contactId = null,
    patientId = null,
    daysFromNow = 2,
    reason = 'Seguimiento comercial de interés en tratamiento',
    priority = 'MEDIUM',
  }) {
    const cid = parseInt(clinicId, 10) || 1;

    try {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + daysFromNow);
      const dueDateStr = dueDate.toISOString().split('T')[0];

      const taskTitle = `📞 ${reason}`;
      const taskDesc = `Seguimiento automático programado por Sofía tras interacción en mensajería.\n` +
        `Plazo sugerido: ${daysFromNow} días.`;

      const insTask = await query(
        `INSERT INTO tasks (
           clinic_id, contact_id, lead_id, patient_id, title, description,
           priority, status, due_date, due_time, is_team_visible, created_by_type, created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, 'PENDING', $8, '10:00:00', TRUE, 'ai', NOW(), NOW()
         ) RETURNING *`,
        [cid, contactId, leadId, patientId, taskTitle, taskDesc, priority, dueDateStr]
      );

      const task = insTask.rows[0];

      // Registrar actividad
      await query(
        `INSERT INTO crm_activities (clinic_id, contact_id, lead_id, activity_type, title, description, actor_type, metadata)
         VALUES ($1, $2, $3, 'FOLLOW_UP_SCHEDULED', $4, $5, 'ai', $6)`,
        [
          cid,
          contactId,
          leadId,
          `Seguimiento programado para el ${dueDateStr}`,
          taskDesc,
          JSON.stringify({ taskId: task.id, dueDate: dueDateStr, reason }),
        ]
      );

      return {
        success: true,
        taskId: task.id,
        dueDate: dueDateStr,
      };
    } catch (err) {
      logger.error('[AI_CRM] Error programando seguimiento comercial:', err.message);
      return { success: false, error: err.message };
    }
  }
}

export default new AICrmWorkflowService();
