// ==============================================================================
// Test Suite: AI Tool Grounding Hub & Dynamic Services Integration (Fase 4)
// Valida que el hub de herramientas de IA (ai-tools.service.js) conecta de forma
// determinista y segura con los servicios de negocio (agenda, estado de clínica,
// pacientes, citas activas, catálogo médico y CRM leads), garantizando estricta
// separación multiclínica, políticas deontológicas y ausencia de alucinaciones.
// ==============================================================================
import assert from 'assert';
import aiService from '../services/ai.service.js';
import aiToolsService from '../services/ai-tools.service.js';
import aiBookingService from '../services/ai-booking.service.js';
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
  console.log('║  🛠️  SUITE FASE 4: AI TOOL GROUNDING & DETERMINISTIC SERVICES     ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  try {
    // -------------------------------------------------------------
    // PREPARACIÓN DE DATOS DE PRUEBA EN BD
    // -------------------------------------------------------------
    // Obtener un paciente real de la clínica 1 (o asegurar existencia)
    let patientXuquer = (await query(
      `SELECT id, first_name, last_name, phone FROM patients WHERE clinic_id = 1 AND phone IS NOT NULL LIMIT 1`
    )).rows[0];

    if (!patientXuquer) {
      const inserted = await query(
        `INSERT INTO patients (clinic_id, first_name, last_name, phone, created_at, updated_at)
         VALUES (1, 'Carlos', 'Navarro Test', '+34600112233', NOW(), NOW())
         RETURNING id, first_name, last_name, phone`
      );
      patientXuquer = inserted.rows[0];
    }

    // Obtener o asegurar un doctor para clínica 1
    const doctorXuquer = (await query(
      `SELECT d.id, u.first_name, u.last_name, d.specialty 
       FROM doctors d 
       JOIN users u ON d.user_id = u.id 
       WHERE d.clinic_id = 1 AND d.deleted_at IS NULL LIMIT 1`
    )).rows[0];

    // Asegurar una cita futura para patientXuquer
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 5);
    const futureDateStr = futureDate.toISOString().split('T')[0];

    // Verificar si ya tiene cita futura; si no, crear una
    const existingAppt = await query(
      `SELECT id FROM appointments 
       WHERE clinic_id = 1 AND patient_id = $1 AND appointment_date >= CURRENT_DATE AND deleted_at IS NULL LIMIT 1`,
      [patientXuquer.id]
    );

    let testApptId = null;
    if (existingAppt.rows.length === 0 && doctorXuquer) {
      const insAppt = await query(
        `INSERT INTO appointments (clinic_id, patient_id, doctor_id, appointment_date, start_time, end_time, status_id, reason, created_at, updated_at)
         VALUES (1, $1, $2, $3, '11:00:00', '11:30:00', 1, 'Revisión y Limpieza', NOW(), NOW())
         RETURNING id`,
        [patientXuquer.id, doctorXuquer.id, futureDateStr]
      );
      testApptId = insAppt.rows[0].id;
    }

    // -------------------------------------------------------------
    // 1. UNIVERSAL TOOL DISPATCHER (executeTool)
    // -------------------------------------------------------------
    console.log('🔹 [1/7] Universal Tool Dispatcher & Alias Resolution');

    const resAvail = await aiToolsService.executeTool('availability_tool', { clinicId: 1 });
    report('availability_tool se despacha con éxito', resAvail.success === true);
    report('availability_tool devuelve array de slots', Array.isArray(resAvail.data?.availableSlots));
    report('availability_tool preserva clinicId 1', resAvail.data?.clinicId === 1);

    const resStatus = await aiToolsService.executeTool('clinic_status_tool', { clinicId: 1 });
    report('clinic_status_tool se despacha con éxito', resStatus.success === true);
    report('clinic_status_tool devuelve isOpen booleano', typeof resStatus.data?.isOpen === 'boolean');
    report('clinic_status_tool incluye openingHoursText', Boolean(resStatus.data?.openingHoursText));

    const resUnknown = await aiToolsService.executeTool('herramienta_inexistente', { clinicId: 1 });
    report('Herramienta desconocida falla elegantemente con success: false', resUnknown.success === false);
    report('Herramienta desconocida contiene mensaje de error informativo', resUnknown.error.includes('no reconocida'));

    // -------------------------------------------------------------
    // 2. PATIENT IDENTITY LOOKUP TOOL (patient_identity_tool)
    // -------------------------------------------------------------
    console.log('\n🔹 [2/7] Patient Identity Lookup & Multi-Clinic Isolation');

    const patByPhone = await aiToolsService.lookupPatient({ clinicId: 1, phone: patientXuquer.phone });
    report('Localiza paciente existente por teléfono en clínica 1', patByPhone.success === true && patByPhone.found === true);
    report('Identifica correctamente nombre y apellidos del paciente', patByPhone.patient?.name.includes(patientXuquer.first_name));

    // Aislamiento multiclínica: el mismo paciente no debe aparecer como existente en clínica 2
    const patInClinic2 = await aiToolsService.lookupPatient({ clinicId: 2, phone: patientXuquer.phone });
    report('Aislamiento multiclínica: paciente de clínica 1 no aparece en clínica 2', patInClinic2.found === false);

    const patNotFound = await aiToolsService.lookupPatient({ clinicId: 1, phone: '+34999999999' });
    report('Teléfono inexistente reporta found: false sin error', patNotFound.found === false);

    // -------------------------------------------------------------
    // 3. PATIENT APPOINTMENTS TOOL (patient_appointments_tool)
    // -------------------------------------------------------------
    console.log('\n🔹 [3/7] Patient Appointments Tool & Upcoming Visits Grounding');

    const patAppts = await aiToolsService.getPatientAppointments({
      clinicId: 1,
      patientId: patientXuquer.id,
      phone: patientXuquer.phone,
    });
    report('Recupera citas del paciente con éxito', patAppts.success === true);
    report('Detecta citas próximas programadas', patAppts.count > 0);
    report('Cada cita incluye formato de llegada seguro (formattedArrival)', Boolean(patAppts.appointments[0]?.formattedArrival));
    report('summaryText generado informa claramente al paciente', patAppts.summaryText.includes('cita'));

    // Paciente sin citas programadas
    const emptyAppts = await aiToolsService.getPatientAppointments({
      clinicId: 1,
      phone: '+34666000111_inexistente',
    });
    report('Paciente sin citas reporta count: 0', emptyAppts.count === 0);
    report('summaryText aclara que no constan citas pendientes', emptyAppts.summaryText.includes('No constan citas'));

    // -------------------------------------------------------------
    // 4. DOCTOR CATALOG TOOL (doctor_catalog_tool)
    // -------------------------------------------------------------
    console.log('\n🔹 [4/7] Doctor Catalog Tool & Tenant Separation');

    const xuquerDoctors = await aiToolsService.getClinicDoctors({ clinicId: 1 });
    report('Recupera catálogo médico de Xúquer (clínica 1)', xuquerDoctors.success === true && xuquerDoctors.count > 0);
    report('En Xúquer identifica a Dra. Sonia Vides como firstVisitDoctor', xuquerDoctors.firstVisitDoctor?.name.includes('Sonia'));
    report('summaryText de Xúquer incluye cuadro médico odontológico', xuquerDoctors.summaryText.includes('médico de la clínica'));

    const castellonDoctors = await aiToolsService.getClinicDoctors({ clinicId: 2 });
    report('Recupera catálogo médico de Castellón (clínica 2)', castellonDoctors.success === true);
    report('En Castellón JAMÁS incluye a Dra. Sonia como médico de primera visita', !castellonDoctors.summaryText.includes('Sonia'));

    // -------------------------------------------------------------
    // 5. CRM LEAD STATE TOOL (crm_lead_tool)
    // -------------------------------------------------------------
    console.log('\n🔹 [5/7] CRM Lead State Tool Grounding');

    const leadState = await aiToolsService.getCRMLeadState({ clinicId: 1, phone: patientXuquer.phone });
    report('crm_lead_tool responde deterministamente sin lanzar excepción', leadState.success === true);
    report('Estructura de respuesta contiene objeto lead o found: false', typeof leadState.found === 'boolean');

    // -------------------------------------------------------------
    // 6. SOFIA GENERATOR INTEGRATION CON TOOL GROUNDING
    // -------------------------------------------------------------
    console.log('\n🔹 [6/7] Integración en aiService.generateSofiaReply con Tool Grounding');

    // Consulta de citas del paciente (MY_APPOINTMENTS con cita activa)
    const replyMyActiveAppts = await aiService.generateSofiaReply({
      clinicId: 1,
      incomingText: 'Hola, ¿podrían recordarme cuándo tengo mi próxima cita?',
      senderPhone: patientXuquer.phone,
      senderName: patientXuquer.first_name,
      isNameConfirmed: true,
      confirmedName: `${patientXuquer.first_name} ${patientXuquer.last_name}`,
    });
    report('Detecta intención MY_APPOINTMENTS', replyMyActiveAppts.intent === 'MY_APPOINTMENTS');
    report('Activa acción APPOINTMENTS_CHECKED cuando tiene cita', replyMyActiveAppts.action === 'APPOINTMENTS_CHECKED');
    report('Indica en el texto la fecha y hora de la cita real', replyMyActiveAppts.replyText.includes('próxima cita está programada'));
    report('Registra toolExecuted: patient_appointments_tool', replyMyActiveAppts.toolExecuted === 'patient_appointments_tool');

    // Consulta de citas sin ninguna cita activa (NO_APPOINTMENTS_FOUND)
    const replyNoAppts = await aiService.generateSofiaReply({
      clinicId: 1,
      incomingText: '¿Tengo alguna cita agendada en la clínica?',
      senderPhone: '+34699887766_sin_citas',
      senderName: 'Marta Desconocida',
    });
    report('Detecta intención MY_APPOINTMENTS sin citas', replyNoAppts.intent === 'MY_APPOINTMENTS');
    report('Activa acción NO_APPOINTMENTS_FOUND', replyNoAppts.action === 'NO_APPOINTMENTS_FOUND');
    report('No inventa citas y ofrece agendar o verificar ficha', replyNoAppts.replyText.includes('no hemos localizado ninguna cita'));

    // Consulta sobre cuadro médico (DOCTOR_INQUIRY en Xúquer)
    const replyDocsXuquer = await aiService.generateSofiaReply({
      clinicId: 1,
      incomingText: '¿Qué especialistas y doctores atienden en la clínica?',
      senderName: 'David Marín',
    });
    report('Detecta intención DOCTOR_INQUIRY', replyDocsXuquer.intent === 'DOCTOR_INQUIRY');
    report('Activa acción DOCTORS_PROVIDED', replyDocsXuquer.action === 'DOCTORS_PROVIDED');
    report('Menciona al equipo médico y primera visita con Dra. Sonia', replyDocsXuquer.replyText.includes('Dra. Sonia') || replyDocsXuquer.replyText.includes('equipo'));
    report('Registra toolExecuted: doctor_catalog_tool', replyDocsXuquer.toolExecuted === 'doctor_catalog_tool');

    // Consulta sobre doctores en Castellón (clínica 2)
    const replyDocsCastellon = await aiService.generateSofiaReply({
      clinicId: 2,
      incomingText: '¿Qué doctores o especialistas tienen en su centro?',
      senderName: 'Elena Ramos',
    });
    report('En Castellón activa DOCTORS_PROVIDED', replyDocsCastellon.action === 'DOCTORS_PROVIDED');
    report('En Castellón NO menciona a Dra. Sonia', !replyDocsCastellon.replyText.includes('Sonia'));

    // -------------------------------------------------------------
    // 7. GUARDRAIL DE LLEGADA ESTRICTA Y PRECIO CERO CON TOOLS
    // -------------------------------------------------------------
    console.log('\n🔹 [7/7] Guardrails: Arrival-Only Slots & Zero Price Policy Invariants');

    // Booking con propuesta de slots
    const replyBooking = await aiService.generateSofiaReply({
      clinicId: 1,
      incomingText: 'Quisiera pedir cita para una primera revisión con la doctora',
      senderName: 'Juan Carlos',
    });
    report('En BOOKING activa SLOTS_OFFERED', replyBooking.action === 'SLOTS_OFFERED');
    report('Ofrece slots reales de availability_tool', replyBooking.slots?.length > 0);
    report('Jamás menciona duración de cita en slots (solo hora de llegada)', !replyBooking.replyText.includes('durará') && !replyBooking.replyText.includes('15 minutos'));

    // Precio con pregunta de slots
    const replyPrice = await aiService.generateSofiaReply({
      clinicId: 1,
      incomingText: '¿Cuánto cuesta un implante dental y qué horario tenéis mañana?',
      senderName: 'Roberto Soler',
    });
    report('Guardrail de precio cero prevalece sobre cualquier tool', replyPrice.action === 'OFFER_FIRST_VISIT');
    report('No devuelve tarifas numéricas de tratamientos', !replyPrice.replyText.match(/\b\d+\s*(?:€|euros?)\b/i));

    // Limpieza de datos de prueba si se creó cita temporal
    if (testApptId) {
      await query(`DELETE FROM appointments WHERE id = $1`, [testApptId]);
    }

  } catch (err) {
    console.error('❌ Error fatal en test suite de Tool Grounding:', err);
    failed++;
  }

  console.log('\n═════════════════════════════════════════════════════════════');
  console.log(`  📊 RESULTADO SUITE TOOL GROUNDING: ${passed} superadas, ${failed} fallidas`);
  console.log('═════════════════════════════════════════════════════════════\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runSuite().then(() => {
  process.exit(0);
});
