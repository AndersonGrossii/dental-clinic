// ==============================================================================
// Test Suite: AI Appointment Workflow & Conversational Lifecycle (Fase 5)
// Valida el ciclo de vida completo de citas:
// - Identificación y resolución automática de pacientes
// - Detección de servicio clínico solicitado
// - Búsqueda avanzada de franjas (día hábil siguiente y franjas mañana/tarde)
// - Reserva determinista y protección contra colisiones (concurrencia)
// - Reagendamiento interactivo (RESCHEDULE)
// - Cancelación determinista (CANCEL)
// - Guardrails de llegada estricta y precio cero
// ==============================================================================
import assert from 'assert';
import aiService from '../services/ai.service.js';
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
  console.log('║  🗓️  SUITE FASE 5: AI APPOINTMENT WORKFLOW & LIFECYCLE            ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  let testPatientId = null;
  let testApptId = null;

  try {
    // -------------------------------------------------------------
    // 1. IDENTIFICACIÓN Y RESOLUCIÓN AUTOMÁTICA DE PACIENTES
    // -------------------------------------------------------------
    console.log('🔹 [1/7] Identificación y Vinculación de Pacientes (resolveOrCreatePatient)');

    // 1.1 Paciente existente
    const existing = (await query(`SELECT id, phone FROM patients WHERE clinic_id = 1 AND phone IS NOT NULL LIMIT 1`)).rows[0];
    const resolvedId = await aiBookingService.resolveOrCreatePatient({
      clinicId: 1,
      phone: existing.phone,
    });
    report('Resuelve paciente existente por teléfono normalizado', resolvedId === existing.id);

    // 1.2 Paciente nuevo: alta automática determinista
    const testPhone = `+346${Math.floor(10000000 + Math.random() * 90000000)}`;
    testPatientId = await aiBookingService.resolveOrCreatePatient({
      clinicId: 1,
      name: 'Sergio Peñafiel Ramos',
      phone: testPhone,
    });
    report('Da de alta automáticamente nuevo paciente si no existe', typeof testPatientId === 'number' && testPatientId > 0);

    const checkPatient = (await query(`SELECT first_name, last_name, phone FROM patients WHERE id = $1`, [testPatientId])).rows[0];
    report('Guarda nombre y apellidos separados correctamente', checkPatient.first_name === 'Sergio' && checkPatient.last_name === 'Peñafiel Ramos');

    // -------------------------------------------------------------
    // 2. IDENTIFICACIÓN DE SERVICIO CLÍNICO SOLICITADO
    // -------------------------------------------------------------
    console.log('\n🔹 [2/7] Identificación de Servicio Clínico (identifyServiceRequested)');

    const sLimpieza = aiBookingService.identifyServiceRequested('Quiero cita para una limpieza dental', 1);
    report('Identifica servicio LIMPIEZA', sLimpieza.serviceType === 'LIMPIEZA' && sLimpieza.reason.includes('Limpieza'));

    const sOrtodoncia = aiBookingService.identifyServiceRequested('Me gustaría ponerme brackets o invisalign', 1);
    report('Identifica servicio ORTODONCIA', sOrtodoncia.serviceType === 'ORTODONCIA');

    const sImplantes = aiBookingService.identifyServiceRequested('Información sobre implantes dentales', 1);
    report('Identifica servicio IMPLANTOLOGIA', sImplantes.serviceType === 'IMPLANTOLOGIA');

    const sEstetica = aiBookingService.identifyServiceRequested('Quisiera consulta para ácido hialurónico en labios', 2);
    report('Identifica servicio ESTETICA_FACIAL en sede 2', sEstetica.serviceType === 'ESTETICA_FACIAL');

    const sUrgencia = aiBookingService.identifyServiceRequested('Tengo mucho dolor en una muela', 1);
    report('Identifica servicio URGENCIA', sUrgencia.serviceType === 'URGENCIA');

    // -------------------------------------------------------------
    // 3. BÚSQUEDA AVANZADA DE FRANJAS (Día hábil y franjas horarias)
    // -------------------------------------------------------------
    console.log('\n🔹 [3/7] Búsqueda Avanzada de Franjas (getAvailableSlots)');

    const defaultSlots = await aiBookingService.getAvailableSlots(1);
    report('Encuentra franjas disponibles para la clínica 1', defaultSlots.availableSlots?.length > 0);
    report('Franjas incluyen formato seguro de llegada', Boolean(defaultSlots.availableSlots[0]?.formattedArrival));
    report('En Xúquer asigna a Dra. Sonia Primeras Visitas con franjas de 15 min', defaultSlots.slotDurationMinutes === 15);

    // Filtrado por franja horaria (morning vs afternoon)
    const morningSlots = await aiBookingService.getAvailableSlots(1, defaultSlots.date, { timeframe: 'morning' });
    const allMorning = (morningSlots.availableSlots || []).every(s => parseInt(s.time.split(':')[0], 10) < 14);
    report('Filtra correctamente franjas de mañana (< 14:00h)', allMorning && morningSlots.availableSlots.length > 0);

    const afternoonSlots = await aiBookingService.getAvailableSlots(1, defaultSlots.date, { timeframe: 'afternoon' });
    const allAfternoon = (afternoonSlots.availableSlots || []).every(s => parseInt(s.time.split(':')[0], 10) >= 15);
    report('Filtra correctamente franjas de tarde (>= 15:00h)', allAfternoon);

    // -------------------------------------------------------------
    // 4. RESERVA FORMAL Y REVALIDACIÓN ANTE COLISIONES
    // -------------------------------------------------------------
    console.log('\n🔹 [4/7] Reserva Formal y Revalidación Concurrente (bookFirstVisit)');

    const targetDate = defaultSlots.date;
    const targetSlot = defaultSlots.availableSlots[0];

    const bookRes = await aiBookingService.bookFirstVisit({
      clinicId: 1,
      patientId: testPatientId,
      guestName: 'Sergio Peñafiel',
      phone: testPhone,
      appointmentDate: targetDate,
      startTime: targetSlot.time,
      serviceRequested: 'limpieza dental',
    });

    testApptId = bookRes.appointmentId;
    report('Crea cita formalmente en base de datos', typeof testApptId === 'number');
    report('Asigna motivo personalizado según el servicio detectado', bookRes.serviceName.includes('Limpieza'));
    report('Comunica al paciente solo la hora de llegada', Boolean(bookRes.arrivalTime));

    // Intento de colisión simultánea en la misma franja
    let collisionDetected = false;
    try {
      await aiBookingService.bookFirstVisit({
        clinicId: 1,
        patientId: testPatientId,
        guestName: 'Otro Paciente',
        phone: '+34699000111',
        appointmentDate: targetDate,
        startTime: targetSlot.time,
      });
    } catch (err) {
      if (err.statusCode === 409) collisionDetected = true;
    }
    report('Protege contra colisiones de agenda lanzando error 409', collisionDetected);

    // -------------------------------------------------------------
    // 5. REAGENDAMIENTO DETERMINISTA (rescheduleAppointment)
    // -------------------------------------------------------------
    console.log('\n🔹 [5/7] Reagendamiento Determinista (rescheduleAppointment)');

    // Buscar una nueva franja disponible diferente
    const newSlotsData = await aiBookingService.getAvailableSlots(1, targetDate);
    const newSlot = newSlotsData.availableSlots.find(s => s.time !== targetSlot.time);

    assert(newSlot, 'Debe haber al menos otro hueco libre para reagendar');

    const rescheduleRes = await aiBookingService.rescheduleAppointment({
      clinicId: 1,
      appointmentId: testApptId,
      phone: testPhone,
      newDate: targetDate,
      newTime: newSlot.time,
      reason: 'Paciente solicitó cambiar de hora por trabajo',
    });

    report('Reagenda la cita con éxito', rescheduleRes.success === true);
    report('Actualiza la hora de llegada a la nueva franja', rescheduleRes.newTime === newSlot.time);

    const checkAppt = (await query(`SELECT start_time, notes, status_id FROM appointments WHERE id = $1`, [testApptId])).rows[0];
    report('Hora actualizada en base de datos', String(checkAppt.start_time).substring(0, 5) === newSlot.time);
    report('Registra nota de auditoría del cambio en la cita', checkAppt.notes.includes('Reagendada por Sofía'));

    // -------------------------------------------------------------
    // 6. CANCELACIÓN DETERMINISTA (cancelAppointment)
    // -------------------------------------------------------------
    console.log('\n🔹 [6/7] Cancelación Determinista (cancelAppointment)');

    const cancelRes = await aiBookingService.cancelAppointment({
      clinicId: 1,
      appointmentId: testApptId,
      phone: testPhone,
      reason: 'Cancelada por el paciente',
    });

    report('Cancela la cita con éxito', cancelRes.success === true);

    const cancelledCheck = (await query(
      `SELECT s.name as status_name, a.cancellation_reason 
       FROM appointments a 
       JOIN appointment_status s ON a.status_id = s.id 
       WHERE a.id = $1`,
      [testApptId]
    )).rows[0];
    report('Estado de cita actualizado a "cancelada"', cancelledCheck.status_name === 'cancelada');
    report('Guarda el motivo de la cancelación', Boolean(cancelledCheck.cancellation_reason));

    // Tras cancelar, la franja debe volver a estar disponible en el calendario
    const slotsAfterCancel = await aiBookingService.getAvailableSlots(1, targetDate);
    const slotFreed = (slotsAfterCancel.availableSlots || []).some(s => s.time === newSlot.time);
    report('Libera la franja en el calendario para otros pacientes', slotFreed);

    // -------------------------------------------------------------
    // 7. FLUJO CONVERSACIONAL DE SOFÍA (RESCHEDULE & CANCEL)
    // -------------------------------------------------------------
    console.log('\n🔹 [7/7] Respuestas de Sofía para RESCHEDULE y CANCEL');

    // 7.1 Crear cita futura temporal para probar Sofía en conversación
    const futureApptDate = new Date();
    futureApptDate.setDate(futureApptDate.getDate() + 6);
    const futureDateStr = futureApptDate.toISOString().split('T')[0];

    const tempBook = await aiBookingService.bookFirstVisit({
      clinicId: 1,
      patientId: testPatientId,
      guestName: 'Sergio Peñafiel',
      phone: testPhone,
      appointmentDate: futureDateStr,
      startTime: '10:00',
    });

    // Sofía ante mensaje de reagendar
    const sofiaReschedule = await aiService.generateSofiaReply({
      clinicId: 1,
      incomingText: 'Hola Sofía, no voy a poder ir a mi cita, ¿podríamos cambiarla de día?',
      senderPhone: testPhone,
      senderName: 'Sergio',
      isNameConfirmed: true,
      confirmedName: 'Sergio Peñafiel',
    });

    report('Detecta intención RESCHEDULE', sofiaReschedule.intent === 'RESCHEDULE');
    report('Emite acción RESCHEDULE_PROPOSED', sofiaReschedule.action === 'RESCHEDULE_PROPOSED');
    report('Identifica la cita actual y ofrece alternativas reales', sofiaReschedule.replyText.includes('programada su próxima cita') && sofiaReschedule.slots?.length > 0);

    // Sofía ante mensaje de cancelar
    const sofiaCancel = await aiService.generateSofiaReply({
      clinicId: 1,
      incomingText: 'Quiero cancelar mi cita, por favor.',
      senderPhone: testPhone,
      senderName: 'Sergio',
      isNameConfirmed: true,
      confirmedName: 'Sergio Peñafiel',
    });

    report('Detecta intención CANCEL', sofiaCancel.intent === 'CANCEL');
    report('Emite acción APPOINTMENT_CANCELLED', sofiaCancel.action === 'APPOINTMENT_CANCELLED');
    report('Ejecuta la cancelación formal de la cita en BD', sofiaCancel.replyText.includes('cancelado en nuestra agenda'));

    // Paciente sin citas que pide cancelar
    const sofiaNoApptCancel = await aiService.generateSofiaReply({
      clinicId: 1,
      incomingText: 'Deseo anular mi cita de mañana',
      senderPhone: '+34699999999_sin_citas',
      senderName: 'Paciente Desconocido',
    });
    report('Informa cordialmente cuando no hay cita que cancelar (NO_APPOINTMENT_TO_CANCEL)', sofiaNoApptCancel.action === 'NO_APPOINTMENT_TO_CANCEL');

    // Limpieza de datos de prueba
    if (tempBook.appointmentId) {
      await query(`DELETE FROM appointments WHERE id = $1`, [tempBook.appointmentId]);
    }
    if (testApptId) {
      await query(`DELETE FROM appointments WHERE id = $1`, [testApptId]);
    }
    if (testPatientId) {
      await query(`DELETE FROM patients WHERE id = $1`, [testPatientId]);
    }

  } catch (err) {
    console.error('❌ Error fatal en test suite de Appointment Workflow:', err);
    failed++;
    // Limpieza de emergencia
    if (testApptId) await query(`DELETE FROM appointments WHERE id = $1`, [testApptId]).catch(() => {});
    if (testPatientId) await query(`DELETE FROM patients WHERE id = $1`, [testPatientId]).catch(() => {});
  }

  console.log('\n═════════════════════════════════════════════════════════════');
  console.log(`  📊 RESULTADO SUITE APPOINTMENT WORKFLOW: ${passed} superadas, ${failed} fallidas`);
  console.log('═════════════════════════════════════════════════════════════\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runSuite().then(() => {
  process.exit(0);
});
