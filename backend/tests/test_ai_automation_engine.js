// ============================================
// SUITE DE PRUEBAS: MOTOR DE AUTOMATIZACIONES ASÍNCRONAS,
// IDEMPOTENCIA Y AGENDAMIENTO CONVERSACIONAL
// ============================================
import assert from 'assert';
import { query } from '../database/pool.js';
import automationJobRepository from '../repositories/automation-job.repository.js';
import automationOrchestratorService from '../services/automation-orchestrator.service.js';
import aiBookingService from '../services/ai-booking.service.js';
import messagingService from '../services/messaging.service.js';
import messagingRepository from '../repositories/messaging.repository.js';
import { logger } from '../utils/logger.js';

let passed = 0;
let failed = 0;

function report(name, isPass, detail = '') {
  if (isPass) {
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${name} — ${detail}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n═════════════════════════════════════════════════════════════');
  console.log('  ⚡ PRUEBAS: MOTOR DE AUTOMATIZACIÓN, IDEMPOTENCIA & BOOKING');
  console.log('═════════════════════════════════════════════════════════════\n');

  try {
    // -------------------------------------------------------------
    // 1. IDEMPOTENCIA Y AISLAMIENTO MULTI-TENANT EN AUTOMATION JOBS
    // -------------------------------------------------------------
    console.log('🔹 [1/6] Idempotencia y Creación de Trabajos (Jobs)');
    const testKey = `TEST_IDEMP_${Date.now()}`;

    // Job 1 en Clínica 1
    const res1 = await automationJobRepository.createJob({
      clinicId: 1,
      jobType: 'CONFIRMATION_24H',
      idempotencyKey: testKey,
      payload: { appointmentId: 99999, phone: '+34600000001' },
    });
    report('Crear trabajo con clave de idempotencia única', res1.created === true && res1.job?.id > 0);

    // Intento de duplicado exacto en la misma clínica
    const res2 = await automationJobRepository.createJob({
      clinicId: 1,
      jobType: 'CONFIRMATION_24H',
      idempotencyKey: testKey,
      payload: { appointmentId: 99999, phone: '+34600000001' },
    });
    report('Rechazo determinista de trabajo duplicado (Idempotency Key guard)', res2.created === false && res2.job?.id === res1.job?.id);

    // Misma clave en Clínica 2 debe permitirse (Aislamiento Multi-Tenant)
    const resTenant = await automationJobRepository.createJob({
      clinicId: 2,
      jobType: 'CONFIRMATION_24H',
      idempotencyKey: testKey,
      payload: { appointmentId: 88888, phone: '+34600000002' },
    });
    report('Permitir clave idéntica en diferente clínica (Aislamiento de Sede)', resTenant.created === true && resTenant.job?.clinic_id === 2);

    // -------------------------------------------------------------
    // 2. CICLO DE VIDA DE TRABAJOS (CLAIM, RUNNING, COMPLETED, FAILED)
    // -------------------------------------------------------------
    console.log('\n🔹 [2/6] Ciclo de Vida de Trabajos y Reclamo Seguro');
    const claimRes = await automationJobRepository.claimPendingJobs(1, 10);
    const claimedJob = claimRes.find(j => j.id === res1.job.id);
    report('Reclamo transaccional de trabajo (status = RUNNING, attempts = 1)', claimedJob && claimedJob.status === 'RUNNING' && claimedJob.attempts === 1);

    const completed = await automationJobRepository.markCompleted(res1.job.id, 1, { sent: true });
    report('Completar trabajo exitosamente (status = COMPLETED)', completed && completed.status === 'COMPLETED' && completed.completed_at !== null);

    // Probar fallo y reintento
    const failJobRes = await automationJobRepository.createJob({
      clinicId: 1,
      jobType: 'RECALL_HYGIENE_6M',
      idempotencyKey: `FAIL_TEST_${Date.now()}`,
      payload: { patientId: 123 },
    });
    const failedRetry = await automationJobRepository.markFailed(failJobRes.job.id, 1, 'Error de conexión simulado', true);
    report('Manejo de fallo con reintento (status = RETRY)', failedRetry && failedRetry.status === 'RETRY' && failedRetry.error_message.includes('simulado'));

    // -------------------------------------------------------------
    // 3. EMPAREJAMIENTO DE FRANJAS HORARIAS (SLOT MATCHING)
    // -------------------------------------------------------------
    console.log('\n🔹 [3/6] Emparejamiento Conversacional de Franjas (Slot Matching)');
    const sampleSlots = [
      { time: '10:00', formattedArrival: 'a las 10:00h', date: '2026-10-15' },
      { time: '11:15', formattedArrival: 'a las 11:15h', date: '2026-10-15' }
    ];

    const matchByTime = aiBookingService.matchSlotSelection('me viene perfecto el de las 10:00', sampleSlots);
    report('Coincidencia por hora exacta ("10:00")', matchByTime && matchByTime.time === '10:00');

    const matchByOrdinal = aiBookingService.matchSlotSelection('la primera opción me parece bien', sampleSlots);
    report('Coincidencia por ordinal ("la primera opción")', matchByOrdinal && matchByOrdinal.time === '10:00');

    const matchSecond = aiBookingService.matchSlotSelection('Prefiero el segundo hueco a las 11:15', sampleSlots);
    report('Coincidencia de segundo slot ("segundo")', matchSecond && matchSecond.time === '11:15');

    const matchInvalid = aiBookingService.matchSlotSelection('ninguno de esos me va bien', sampleSlots);
    report('Rechazo de texto sin selección de franja válida', matchInvalid === null);

    // -------------------------------------------------------------
    // 4. FLUJO COMPLETO DE AGENDAMIENTO CONVERSACIONAL (END-TO-END)
    // -------------------------------------------------------------
    console.log('\n🔹 [4/6] Agendamiento Conversacional Autónomo con Dra. Sonia (Xúquer)');
    // Obtener un slot real disponible para Dra. Sonia
    const avail = await aiBookingService.getAvailableSlots(1);
    const realSlot = (avail.availableSlots || [])[0];

    if (realSlot) {
      // Crear contacto temporal para la prueba
      const contactPhone = `+34699${Math.floor(100000 + Math.random() * 900000)}`;
      const contact = await messagingRepository.findOrCreateContact(1, contactPhone, 'Marta González Test');
      const conv = await messagingRepository.findOrCreateConversation(1, contact.id, 'WHATSAPP');

      // Crear lead asociado
      const leadRes = await query(
        `INSERT INTO crm_leads (clinic_id, contact_id, source, status, interest)
         VALUES (1, $1, 'whatsapp', 'new', 'Primera revisión dental')
         RETURNING id`,
        [contact.id]
      );
      const leadId = leadRes.rows[0].id;

      // Estado simulado: Sofía ofreció la franja
      const bookingFlowState = {
        step: 'AWAITING_SLOT_SELECTION',
        offered_slots: [realSlot],
        target_date: realSlot.date,
        offered_at: new Date().toISOString(),
      };

      const bookingExec = await aiBookingService.handleConversationalBookingSelection({
        clinicId: 1,
        contact,
        incomingText: `Sí, me viene perfecto el de las ${realSlot.time}h`,
        bookingFlowState,
      });

      report('Ejecución exitosa de reserva formal por chat', bookingExec.handled === true && bookingExec.success === true && bookingExec.appointmentId > 0);
      report('Mensaje de confirmación amistoso y claro', bookingExec.replyText.includes('CONFIRMADA') && bookingExec.replyText.includes(realSlot.time));

      // Verificar que la cita está en appointments en la base de datos
      const apptCheck = await query(`SELECT * FROM appointments WHERE id = $1`, [bookingExec.appointmentId]);
      report('Cita persistida en base de datos con reglas clínicas de Xúquer', apptCheck.rows.length === 0 ? false : (
        apptCheck.rows[0].is_first_visit === true && apptCheck.rows[0].clinic_id === 1
      ));

      // Verificar que el lead de CRM pasó a status 'appointment_scheduled'
      const leadCheck = await query(`SELECT status FROM crm_leads WHERE id = $1`, [leadId]);
      report('Lead de CRM actualizado a status "appointment_scheduled"', leadCheck.rows[0]?.status === 'appointment_scheduled');

      // Verificar actividad de CRM registrada
      const actCheck = await query(`SELECT * FROM crm_activities WHERE lead_id = $1 AND activity_type = 'APPOINTMENT_BOOKED'`, [leadId]);
      report('Actividad de CRM "APPOINTMENT_BOOKED" registrada automáticamente', actCheck.rows.length > 0);
    } else {
      console.log('  ⚠️ Omitido agendamiento real: No hay franjas libres en la fecha evaluada.');
    }

    // -------------------------------------------------------------
    // 5. SEGUIMIENTO DE LEADS INACTIVOS (>48h sin actividad)
    // -------------------------------------------------------------
    console.log('\n🔹 [5/6] Automatización de Seguimiento de Leads Inactivos');
    // Insertar un lead inactivo simulado
    const inactiveContact = await messagingRepository.findOrCreateContact(1, `+34688${Math.floor(100000 + Math.random() * 900000)}`, 'Lead Inactivo Test');
    const inactiveLead = await query(
      `INSERT INTO crm_leads (clinic_id, contact_id, source, status, interest, updated_at)
       VALUES (1, $1, 'whatsapp', 'new', 'Implantes', NOW() - INTERVAL '72 hours')
       RETURNING id`,
      [inactiveContact.id]
    );

    const enqLeadsRes = await automationOrchestratorService.enqueueInactiveLeadFollowupJobs(1);
    report('Detección y encolado de leads inactivos (>48h)', enqLeadsRes.enqueued > 0);

    const procRes = await automationOrchestratorService.processPendingJobs(1);
    report('Procesamiento de trabajo y creación de tarea de seguimiento comercial', procRes.succeeded > 0);

    const taskCheck = await query(`SELECT * FROM tasks WHERE lead_id = $1`, [inactiveLead.rows[0].id]);
    report('Tarea para recepción generada en la tabla tasks', taskCheck.rows.length > 0 && taskCheck.rows[0].title.includes('Lead Inactivo'));

    // -------------------------------------------------------------
    // 6. COMPATIBILIDAD CON ORQUESTACIÓN DE CONFIRMACIONES Y RECALL
    // -------------------------------------------------------------
    console.log('\n🔹 [6/6] Compatibilidad del Orquestador con Confirmaciones 24h y Recall');
    const confRes = await automationOrchestratorService.enqueueDailyConfirmationJobs(1);
    report('Orquestador de confirmaciones 24h encola trabajos de forma segura', typeof confRes.enqueued === 'number');

    const recallRes = await automationOrchestratorService.enqueueDailyRecallJobs(1);
    report('Orquestador de recall preventivo encola trabajos sin romper esquemas', typeof recallRes.total === 'number');

    const quotesRes = await automationOrchestratorService.enqueueQuotationFollowupJobs(1);
    report('Orquestador de presupuestos supervisados encola trabajos correctamente', typeof quotesRes.enqueued === 'number');

  } catch (err) {
    console.error('❌ Error fatal en la ejecución de pruebas:', err);
    failed++;
  }

  console.log('\n═════════════════════════════════════════════════════════════');
  console.log(`  📊 RESULTADO SUITE AUTOMATIZACIÓN & JOBS: ${passed} superadas, ${failed} fallidas`);
  console.log('═════════════════════════════════════════════════════════════\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().then(() => {
  process.exit(0);
});
