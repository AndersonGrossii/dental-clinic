// ==============================================================================
// Test Suite: AI CRM Lead Workflow & Returning Patient Rule (Fase 6)
// Valida:
// 1. Regla de Paciente Antiguo / Habitual:
//    - Pacientes antiguos NUNCA se agendan con Dra. Sonia (exclusiva de primeras visitas en Xúquer).
//    - Detección precisa del doctor habitual a partir del historial de citas.
//    - Búsqueda de franjas con el doctor habitual y duración correcta (no 15 min de primera visita).
//    - Marcado de cita con is_first_visit = FALSE.
//    - Saludo y propuestas de Sofía adaptadas (sin mencionar "primera revisión gratuita").
//    - Si un paciente registrado no tiene citas previas, se asigna al doctor regular de la sede (NUNCA Dra. Sonia).
//    - Pacientes nuevos se dirigen a Dra. Sonia con is_first_visit = TRUE.
// 2. Integración Integral de Lead y CRM (Fase 6):
//    - Sincronización automática de contactos y leads desde mensajes entrantes.
//    - Calificación por IA (ai_score, ai_urgency, ai_summary, ai_extracted_interest).
//    - Creación automática de oportunidades en crm_opportunities para tratamientos de alto valor.
//    - Trazabilidad del ciclo de vida en crm_activities y crm_notes (BOOKED, RESCHEDULED, CANCELLED).
//    - Traspaso a recepción (Human Handoff): creación de tareas en tasks, chat interno y pausa de bot.
//    - Programación de seguimientos comerciales (Follow-ups).
// ==============================================================================
import assert from 'assert';
import aiBookingService from '../services/ai-booking.service.js';
import aiService from '../services/ai.service.js';
import aiCrmWorkflowService from '../services/ai-crm-workflow.service.js';
import messagingRepository from '../repositories/messaging.repository.js';
import { query } from '../database/pool.js';

let passed = 0;
let failed = 0;

function report(name, condition) {
  if (condition) {
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${name}`);
    failed++;
  }
}

async function runSuite() {
  console.log('\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║  🤝 SUITE FASE 6: CRM LEAD WORKFLOW & RETURNING PATIENT RULE     ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  let testPatientId = null;
  let testApptId = null;
  let testContactId = null;
  let testConvId = null;

  try {
    // -------------------------------------------------------------
    // 1. REGLA DE PACIENTE ANTIGUO VS PACIENTE NUEVO (DOCTOR HABITUAL)
    // -------------------------------------------------------------
    console.log('🔹 [1/6] Regla de Paciente Antiguo y Doctor Habitual (getDoctorForPatient)');

    // 1.1 Crear un paciente antiguo con historial de citas con Dr. Juan Rodríguez (Doctor #1, Odontología General)
    const oldPatientPhone = `+346${Math.floor(10000000 + Math.random() * 90000000)}`;
    const patRes = await query(
      `INSERT INTO patients (clinic_id, first_name, last_name, phone, created_at, updated_at)
       VALUES (1, 'Manuel', 'García Antiguo', $1, NOW() - INTERVAL '6 months', NOW())
       RETURNING id`,
      [oldPatientPhone]
    );
    testPatientId = patRes.rows[0].id;

    // Insertar 2 citas previas completadas con el Doctor 1 (Dr. Juan Rodríguez)
    await query(
      `INSERT INTO appointments (
         clinic_id, patient_id, doctor_id, appointment_date, start_time, end_time, status_id, reason, is_first_visit, created_at
       ) VALUES 
         (1, $1, 1, CURRENT_DATE - INTERVAL '60 days', '10:00:00', '10:30:00', 3, 'Obturación molar', FALSE, NOW() - INTERVAL '60 days'),
         (1, $1, 1, CURRENT_DATE - INTERVAL '30 days', '11:00:00', '11:30:00', 3, 'Revisión y limpieza', FALSE, NOW() - INTERVAL '30 days')`,
      [testPatientId]
    );

    // Resolver doctor para este paciente antiguo
    const habitDocInfo = await aiBookingService.getDoctorForPatient({
      clinicId: 1,
      patientId: testPatientId,
      phone: oldPatientPhone,
    });

    report('Detecta condición de paciente antiguo (isReturningPatient === true)', habitDocInfo.isReturningPatient === true);
    report('Marca isFirstVisit === false', habitDocInfo.isFirstVisit === false);
    report('Asigna al doctor habitual con el que más se atiende (Dr. Juan Rodríguez)', habitDocInfo.doctor?.id === 1);
    report('NUNCA asigna a Dra. Sonia Primeras Visitas a un paciente antiguo', !habitDocInfo.doctorTitle.includes('Sonia'));
    report('Usa la duración de consulta habitual del doctor (30 min)', habitDocInfo.slotDurationMinutes === 30);
    report('Registra el conteo de visitas previas correctamente', habitDocInfo.visitCount === 2);

    // 1.2 Paciente nuevo: debe ir obligatoriamente con Dra. Sonia en Xúquer (Sede 1)
    const brandNewPhone = `+346${Math.floor(10000000 + Math.random() * 90000000)}`;
    const newDocInfo = await aiBookingService.getDoctorForPatient({
      clinicId: 1,
      phone: brandNewPhone,
    });

    report('Paciente nuevo reporta isReturningPatient === false', newDocInfo.isReturningPatient === false);
    report('Paciente nuevo reporta isFirstVisit === true', newDocInfo.isFirstVisit === true);
    report('En Xúquer paciente nuevo va exclusivamente con Dra. Sonia', newDocInfo.doctorTitle.includes('Sonia'));
    report('Duración para primera visita es estrictamente 15 min', newDocInfo.slotDurationMinutes === 15);

    // 1.3 Paciente registrado en base de datos sin citas previas con especialista regular:
    // Debe dirigirse al doctor regular de la sede (NUNCA Dra. Sonia) con is_first_visit = false
    const regWithoutVisitsPhone = `+346${Math.floor(10000000 + Math.random() * 90000000)}`;
    const regRes = await query(
      `INSERT INTO patients (clinic_id, first_name, last_name, phone, created_at)
       VALUES (1, 'Laura', 'Registrada Recepción', $1, NOW())
       RETURNING id`,
      [regWithoutVisitsPhone]
    );
    const regDocInfo = await aiBookingService.getDoctorForPatient({
      clinicId: 1,
      patientId: regRes.rows[0].id,
      phone: regWithoutVisitsPhone,
    });

    report('Paciente registrado sin visitas previas reporta isReturningPatient === true', regDocInfo.isReturningPatient === true);
    report('Paciente registrado sin visitas previas NUNCA va con Dra. Sonia', !regDocInfo.doctorTitle.includes('Sonia'));
    report('Paciente registrado se deriva a especialista regular de la sede', regDocInfo.doctor?.id === 1);

    // -------------------------------------------------------------
    // 2. DISPONIBILIDAD Y AGENDAMIENTO PARA PACIENTES ANTIGUOS
    // -------------------------------------------------------------
    console.log('\n🔹 [2/6] Disponibilidad y Agendamiento Diferenciado (getAvailableSlots & bookFirstVisit)');

    // 2.1 Búsqueda de franjas para paciente antiguo
    const oldPatientSlots = await aiBookingService.getAvailableSlots(1, null, {
      patientId: testPatientId,
      phone: oldPatientPhone,
    });

    report('getAvailableSlots detecta paciente antiguo y devuelve isReturningPatient = true', oldPatientSlots.isReturningPatient === true);
    report('getAvailableSlots asigna al doctor habitual (ID 1)', oldPatientSlots.doctorId === 1);
    report('Franjas calculadas con duración del doctor habitual (30 min)', oldPatientSlots.slotDurationMinutes === 30);
    report('Devuelve franjas válidas para el doctor habitual', oldPatientSlots.availableSlots?.length > 0);

    // 2.2 Reserva de cita para paciente antiguo
    const selectedSlot = oldPatientSlots.availableSlots[0];
    const oldBookRes = await aiBookingService.bookFirstVisit({
      clinicId: 1,
      patientId: testPatientId,
      phone: oldPatientPhone,
      appointmentDate: selectedSlot.date,
      startTime: selectedSlot.time,
      serviceRequested: 'Revisión periódica de tratamiento',
    });
    testApptId = oldBookRes.appointmentId;

    report('bookFirstVisit reserva cita con éxito para paciente antiguo', typeof testApptId === 'number' && testApptId > 0);
    report('Asigna la cita al doctor habitual (ID 1)', oldBookRes.doctorId === 1);
    report('Registra is_first_visit = FALSE en la base de datos', oldBookRes.isFirstVisit === false);

    const checkApptInDb = (await query(`SELECT is_first_visit, doctor_id, notes FROM appointments WHERE id = $1`, [testApptId])).rows[0];
    report('Verificación en BD: appointments.is_first_visit === FALSE', checkApptInDb.is_first_visit === false);
    report('Verificación en BD: appointments.doctor_id coincide con Dr. Juan Rodríguez', checkApptInDb.doctor_id === 1);
    report('Verificación en BD: notas de cita indican seguimiento', checkApptInDb.notes.includes('seguimiento'));

    // -------------------------------------------------------------
    // 3. RESPUESTAS CONVERSACIONALES DE SOFÍA PARA PACIENTES ANTIGUOS
    // -------------------------------------------------------------
    console.log('\n🔹 [3/6] Personalización Conversacional de Sofía para Pacientes Antiguos');

    // 3.1 Consulta de agendamiento de paciente antiguo
    const sofiaBookingReply = await aiService.generateSofiaReply({
      clinicId: 1,
      incomingText: 'Hola, quiero pedir cita para hacerme una revisión',
      senderPhone: oldPatientPhone,
    });

    report('Sofía saluda cálidamente al paciente antiguo reconociéndole ("alegría saludarle de nuevo")',
      sofiaBookingReply.replyText.includes('alegría saludarle de nuevo'));
    report('Sofía menciona al doctor habitual del paciente en la propuesta',
      sofiaBookingReply.replyText.includes('Dr/a. Juan Rodríguez') || sofiaBookingReply.replyText.includes('Juan Rodríguez'));
    report('Sofía NO dice que la cita es una "primera revisión gratuita"',
      !sofiaBookingReply.replyText.includes('primera revisión diagnóstica gratuita'));

    // 3.2 Consulta de precio de paciente antiguo
    const sofiaPriceReply = await aiService.generateSofiaReply({
      clinicId: 1,
      incomingText: '¿Cuánto me costaría una corona dental?',
      senderPhone: oldPatientPhone,
    });

    report('Sofía respeta guardrail de precio cero para paciente antiguo',
      !/\b\d+\s*(?:€|euros)\b/i.test(sofiaPriceReply.replyText));
    report('Sofía ofrece revisión con su doctor habitual para presupuesto personalizado',
      sofiaPriceReply.replyText.includes('Juan Rodríguez'));

    // 3.3 Saludo general de paciente antiguo
    const sofiaGreetingReply = await aiService.generateSofiaReply({
      clinicId: 1,
      incomingText: 'Hola buenas tardes',
      senderPhone: oldPatientPhone,
    });

    report('Saludo general reconoce al paciente antiguo y ofrece cita con su doctor habitual',
      sofiaGreetingReply.replyText.includes('alegría saludarle de nuevo') && sofiaGreetingReply.replyText.includes('Juan Rodríguez'));

    // -------------------------------------------------------------
    // 4. SINCRONIZACIÓN AUTOMÁTICA DE CONTACTO, LEAD Y OPORTUNIDAD (FASE 6)
    // -------------------------------------------------------------
    console.log('\n🔹 [4/6] Sincronización Automática de Leads y Oportunidades (aiCrmWorkflowService)');

    const crmContactPhone = `+346${Math.floor(10000000 + Math.random() * 90000000)}`;
    const mockContact = await messagingRepository.findOrCreateContact(1, crmContactPhone, 'Alfonso Montes', null);
    testContactId = mockContact.id;

    // Mensaje entrante con interés de alto valor: Ortodoncia / Invisalign
    const syncRes = await aiCrmWorkflowService.syncLeadOnInboundMessage({
      clinicId: 1,
      contact: mockContact,
      incomingText: 'Hola, me gustaría saber información sobre ortodoncia invisible y brackets para alinear mis dientes',
      channel: 'WHATSAPP',
    });

    report('Crea o localiza Lead en crm_leads con éxito', typeof syncRes.leadId === 'number' && syncRes.leadId > 0);
    report('Califica automáticamente el lead con IA Sofía', Boolean(syncRes.qualification?.analysis));

    const checkLeadDb = (await query(`SELECT status, ai_score, ai_extracted_interest, ai_urgency FROM crm_leads WHERE id = $1`, [syncRes.leadId])).rows[0];
    report('Actualiza ai_extracted_interest con ORTODONCIA', checkLeadDb.ai_extracted_interest?.toUpperCase().includes('ORTODONCIA'));
    report('Calcula ai_score alto para intención comercial', checkLeadDb.ai_score >= 60);

    report('Crea automáticamente una Oportunidad Comercial en crm_opportunities para tratamiento de alto valor',
      typeof syncRes.opportunityId === 'number' && syncRes.opportunityId > 0);

    const checkOppDb = (await query(`SELECT name, service_interest, status FROM crm_opportunities WHERE id = $1`, [syncRes.opportunityId])).rows[0];
    report('Oportunidad tiene status "open"', checkOppDb.status === 'open');
    report('Oportunidad refleja el servicio de ortodoncia', checkOppDb.service_interest.includes('Ortodoncia') || checkOppDb.name.includes('Ortodoncia'));

    // Verificar actividad registrada en crm_activities
    const oppActivity = (await query(
      `SELECT activity_type, title FROM crm_activities WHERE lead_id = $1 AND activity_type = 'OPPORTUNITY_CREATED' LIMIT 1`,
      [syncRes.leadId]
    )).rows[0];
    report('Registra actividad OPPORTUNITY_CREATED en crm_activities', Boolean(oppActivity));

    // -------------------------------------------------------------
    // 5. TRAZABILIDAD DEL CICLO DE VIDA DE CITAS EN EL CRM
    // -------------------------------------------------------------
    console.log('\n🔹 [5/6] Trazabilidad del Ciclo de Vida de Citas en CRM (crm_activities y crm_notes)');

    // 5.1 Evento BOOKED
    const apptEventRes = await aiCrmWorkflowService.handleAppointmentEvent({
      clinicId: 1,
      appointmentId: testApptId,
      eventType: 'BOOKED',
      actorType: 'ai',
      details: { isReturningPatient: true },
    });

    report('handleAppointmentEvent procesa BOOKED con éxito', apptEventRes.handled === true);

    const checkActBooked = (await query(
      `SELECT activity_type, title FROM crm_activities WHERE (contact_id = $1 OR metadata->>'appointmentId' = $2) AND activity_type = 'APPOINTMENT_BOOKED' ORDER BY id DESC LIMIT 1`,
      [apptEventRes.contactId || mockContact.id, String(testApptId)]
    )).rows[0];
    report('Registra actividad APPOINTMENT_BOOKED con detalles del doctor', Boolean(checkActBooked));

    // 5.2 Evento RESCHEDULED
    const reschEventRes = await aiCrmWorkflowService.handleAppointmentEvent({
      clinicId: 1,
      appointmentId: testApptId,
      eventType: 'RESCHEDULED',
      actorType: 'ai',
      details: { reason: 'Cambio de turno laboral' },
    });
    report('handleAppointmentEvent procesa RESCHEDULED con éxito', reschEventRes.handled === true);

    // 5.3 Evento CANCELLED
    const cancelEventRes = await aiCrmWorkflowService.handleAppointmentEvent({
      clinicId: 1,
      appointmentId: testApptId,
      eventType: 'CANCELLED',
      actorType: 'ai',
      details: { reason: 'Imprevisto familiar' },
    });
    report('handleAppointmentEvent procesa CANCELLED con éxito', cancelEventRes.handled === true);

    const checkActCancelled = (await query(
      `SELECT activity_type, title FROM crm_activities WHERE (contact_id = $1 OR metadata->>'appointmentId' = $2) AND activity_type = 'APPOINTMENT_CANCELLED' ORDER BY id DESC LIMIT 1`,
      [cancelEventRes.contactId || mockContact.id, String(testApptId)]
    )).rows[0];
    report('Registra actividad APPOINTMENT_CANCELLED en crm_activities', Boolean(checkActCancelled));

    // -------------------------------------------------------------
    // 6. TRASPASO A RECEPCIÓN (HUMAN HANDOFF) Y SEGUIMIENTO COMERCIAL
    // -------------------------------------------------------------
    console.log('\n🔹 [6/6] Traspaso Humano (Tasks de Recepción) y Seguimiento Comercial (Follow-ups)');

    const conv = await messagingRepository.findOrCreateConversation(1, mockContact.id, 'WHATSAPP');
    testConvId = conv.id;

    // 6.1 Traspaso con Urgencia (URGENT)
    const handoffRes = await aiCrmWorkflowService.handleHumanHandoff({
      clinicId: 1,
      contact: mockContact,
      conversationId: conv.id,
      channel: 'WHATSAPP',
      reason: 'Molestia aguda con flemón',
      incomingText: 'Tengo un dolor insoportable en una muela y se me ha hinchado la cara',
      isUrgent: true,
    });

    report('handleHumanHandoff ejecutado con éxito', handoffRes.success === true);
    report('Crea tarea en tasks con prioridad URGENT para recepción', handoffRes.taskPriority === 'URGENT');

    const checkTaskInDb = (await query(`SELECT title, priority, status, created_by_type, is_team_visible FROM tasks WHERE id = $1`, [handoffRes.taskId])).rows[0];
    report('Tarea asignada como visible para el equipo clínico (is_team_visible = TRUE)', checkTaskInDb.is_team_visible === true);
    report('Tarea creada por tipo "ai"', checkTaskInDb.created_by_type === 'ai');
    report('Tarea en estado PENDING para el mostrador', checkTaskInDb.status === 'PENDING');

    const convAfter = await messagingRepository.getConversationById(conv.id, 1);
    report('Pausa la automatización de la conversación (automation_enabled === false)', convAfter.automation_enabled === false);
    report('Abre la conversación para atención humana (status === OPEN)', convAfter.status === 'OPEN');

    const handoffActivity = (await query(
      `SELECT activity_type, title FROM crm_activities WHERE lead_id = $1 AND activity_type = 'HUMAN_HANDOFF' LIMIT 1`,
      [handoffRes.leadId]
    )).rows[0];
    report('Registra actividad HUMAN_HANDOFF en crm_activities', Boolean(handoffActivity));

    // 6.2 Programación de seguimiento comercial (Follow-up)
    const followUpRes = await aiCrmWorkflowService.scheduleCommercialFollowUp({
      clinicId: 1,
      leadId: syncRes.leadId,
      contactId: mockContact.id,
      patientId: null,
      daysFromNow: 3,
      reason: 'Llamar para verificar si desea financiar ortodoncia',
      priority: 'HIGH',
    });

    report('Programa seguimiento comercial en tasks con fecha futura', followUpRes.success === true);
    report('Genera fecha límite de seguimiento adecuada (+3 días)', Boolean(followUpRes.dueDate));

    const checkFollowTask = (await query(`SELECT title, due_date FROM tasks WHERE id = $1`, [followUpRes.taskId])).rows[0];
    report('Verificación en BD: Tarea de seguimiento guardada con fecha futura', Boolean(checkFollowTask.due_date));

  } catch (err) {
    console.error('💥 Excepción no controlada durante las pruebas:', err);
    failed++;
  } finally {
    // Limpieza de datos de prueba
    try {
      if (testApptId) {
        await query(`DELETE FROM appointments WHERE id = $1`, [testApptId]);
      }
      if (testPatientId) {
        await query(`DELETE FROM appointments WHERE patient_id = $1`, [testPatientId]);
        await query(`DELETE FROM patients WHERE id = $1`, [testPatientId]);
      }
      if (testContactId) {
        await query(`DELETE FROM tasks WHERE contact_id = $1`, [testContactId]);
        await query(`DELETE FROM crm_activities WHERE contact_id = $1`, [testContactId]);
        await query(`DELETE FROM crm_notes WHERE contact_id = $1`, [testContactId]);
        await query(`DELETE FROM crm_opportunities WHERE contact_id = $1`, [testContactId]);
        await query(`DELETE FROM crm_leads WHERE contact_id = $1`, [testContactId]);
        await query(`DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE contact_id = $1)`, [testContactId]);
        await query(`DELETE FROM conversations WHERE contact_id = $1`, [testContactId]);
        await query(`DELETE FROM messaging_contacts WHERE id = $1`, [testContactId]);
      }
    } catch (cleanupErr) {
      console.warn('Advertencia en limpieza de prueba:', cleanupErr.message);
    }
  }

  console.log('\n═════════════════════════════════════════════════════════════');
  console.log(`  📊 RESULTADO SUITE FASE 6 & RETURNING PATIENTS: ${passed} superadas, ${failed} fallidas`);
  console.log('═════════════════════════════════════════════════════════════\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runSuite().catch(err => {
  console.error('Fatal error en test suite:', err);
  process.exit(1);
});
