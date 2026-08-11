// ============================================
// Suite Completa de Pruebas Automatizadas (E2E) — Clínica Dental
// ============================================
import { query, als } from '../database/pool.js';
import appointmentService from '../services/appointment.service.js';
import patientService from '../services/patient.service.js';
import quotationService from '../services/quotation.service.js';
import invoiceService from '../services/invoice.service.js';
import paymentService from '../services/payment.service.js';
import treatmentService from '../services/treatment.service.js';

let passed = 0;
let failed = 0;

function assert(condition, testName, extraInfo = '') {
  if (condition) {
    console.log(`  ✅ PASS: ${testName} ${extraInfo}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${testName} ${extraInfo}`);
    failed++;
  }
}

async function runAllTests() {
  await als.run({ clinicId: 1, userId: 1 }, async () => {
  console.log('\n==================================================');
  console.log('  🧪 CLÍNICA DENTAL - SUITE DE PRUEBAS AUTOMATIZADAS');
  console.log('==================================================\n');

  let testPatientId = null;
  let testAppointmentId = null;
  let testQuotationId = null;

  try {
    await query("DELETE FROM appointments WHERE appointment_date = '2026-10-15'");
    await query("DELETE FROM patients WHERE email LIKE 'test.%@clinic.com'");
    // --------------------------------------------------
    // TEST 1: Sanidad y Catálogos de la Base de Datos
    // --------------------------------------------------
    console.log('🔹 [1/6] Verificación de Catálogos y Base de Datos');
    const docRes = await query('SELECT d.id, u.first_name, u.last_name FROM doctors d JOIN users u ON d.user_id = u.id LIMIT 1');
    assert(docRes.rows.length > 0, 'Existen doctores en el sistema', `(Encontrado: Dr. ${docRes.rows[0]?.first_name} ${docRes.rows[0]?.last_name})`);
    const docId = docRes.rows[0]?.id;

    const userRes = await query("SELECT id FROM users WHERE email = 'admin@dentalclinic.com'");
    assert(userRes.rows.length > 0, 'Existe usuario administrador por defecto');
    const adminId = userRes.rows[0]?.id || 1;

    const statusRes = await query("SELECT id FROM appointment_status WHERE name = 'sala'");
    assert(statusRes.rows.length > 0, "El estado de cita 'sala' (En Sala) existe en catálogo");

    // --------------------------------------------------
    // TEST 2: Gestión de Pacientes y custom_id Editable
    // --------------------------------------------------
    console.log('\n🔹 [2/6] Gestión de Pacientes y Código Personalizado (custom_id)');
    const uniqueCustomId = `PAC-TEST-${Date.now().toString().slice(-5)}`;
    const newPatient = await patientService.create({
      custom_id: uniqueCustomId,
      first_name: 'Prueba',
      last_name: 'Automatizada',
      dni: `T${Date.now().toString().slice(-8)}`,
      phone: '600000111',
      email: `test.${Date.now()}@clinic.com`
    }, adminId);
    
    assert(newPatient && newPatient.id, 'Paciente creado exitosamente', `(ID: ${newPatient.id})`);
    assert(newPatient.custom_id === uniqueCustomId, 'custom_id asignado correctamente', `(${newPatient.custom_id})`);
    testPatientId = newPatient.id;

    // Actualización de custom_id
    const updatedCustomId = `PAC-EDIT-${Date.now().toString().slice(-5)}`;
    const updatedPatient = await patientService.update(testPatientId, {
      custom_id: updatedCustomId,
      phone: '600000999'
    });
    assert(updatedPatient.custom_id === updatedCustomId, 'custom_id editado y guardado correctamente en la BD', `(${updatedPatient.custom_id})`);

    // --------------------------------------------------
    // TEST 3: Citas de Primera Visita (Invitados) y Conversión
    // --------------------------------------------------
    console.log('\n🔹 [3/6] Citas de Primera Visita (Invitados) y Conversión a Expediente');
    const guestAppt = await appointmentService.create({
      guest_name: 'Carlos Invitado Test',
      guest_phone: '611223344',
      guest_email: 'invitado@test.com',
      doctor_id: docId,
      appointment_date: '2026-10-15',
      start_time: '11:00',
      end_time: '11:30',
      gabinete: 'Gabinete 1',
      reason: 'Primera consulta de valoración'
    }, adminId);

    assert(guestAppt && guestAppt.id, 'Cita de primera visita creada sin patient_id obligatorio', `(Cita ID: ${guestAppt.id})`);
    assert(guestAppt.patient_id === null || guestAppt.patientId === null, 'patient_id es NULL en la cita de invitado');
    assert(guestAppt.guest_name === 'Carlos Invitado Test', 'Nombre del invitado guardado correctamente');
    testAppointmentId = guestAppt.id;

    // Cambio de estado a 'sala'
    const statusUpdate = await appointmentService.updateStatus(testAppointmentId, 'sala', null, null, adminId);
    assert(statusUpdate.status_name === 'sala' || statusUpdate.statusName === 'sala', "Estado actualizado a 'sala' (En Sala)");

    // Conversión de invitado a paciente
    const convertedAppt = await appointmentService.convertGuestToPatient(testAppointmentId, testPatientId);
    assert(Number(convertedAppt.patient_id) === Number(testPatientId), 'Cita de invitado convertida y vinculada al expediente del paciente', `(Vinculada a Paciente ID: ${testPatientId})`);

    // --------------------------------------------------
    // TEST 4: Control de Conflictos de Horario (Doble Reserva)
    // --------------------------------------------------
    console.log('\n🔹 [4/6] Prevención de Doble Reserva (Conflicto de Horario)');
    let conflictCaught = false;
    try {
      await appointmentService.create({
        patient_id: testPatientId,
        doctor_id: docId,
        appointment_date: '2026-10-15',
        start_time: '11:15', // Se solapa con 11:00 - 11:30
        end_time: '11:45',
        gabinete: 'Gabinete 1'
      }, adminId);
    } catch (err) {
      if (err.message && err.message.includes('Conflicto de horario')) {
        conflictCaught = true;
      }
    }
    assert(conflictCaught, 'Conflicto de horario prevenido correctamente por la lógica del sistema');

    // --------------------------------------------------
    // TEST 5: Cotizaciones (Presupuestos)
    // --------------------------------------------------
    console.log('\n🔹 [5/6] Gestión de Presupuestos');
    const treatmentsRes = await treatmentService.getAll();
    const treatments = Array.isArray(treatmentsRes) ? treatmentsRes : (treatmentsRes?.data || treatmentsRes?.rows || []);
    assert(treatments.length > 0, 'Catálogo de tratamientos disponible');
    const treatment = treatments[0];

    const quotation = await quotationService.create({
      patient_id: testPatientId,
      doctor_id: docId,
      notes: 'Presupuesto de prueba automatizada',
      items: [
        { treatment_id: treatment.id, tooth_number: 16, description: treatment.name || 'Tratamiento', unit_price: 150, quantity: 1, discount: 0 }
      ]
    }, adminId);

    assert(quotation && quotation.id, 'Presupuesto creado con éxito', `(ID: ${quotation.id})`);
    testQuotationId = quotation.id;

    const acceptedQuote = await quotationService.changeStatus(testQuotationId, 'aceptada');
    assert(acceptedQuote.status === 'aceptada', 'Presupuesto actualizado a estado aceptada');

    // Registrar pago con fecha personalizada
    const invoice = await invoiceService.create({
      patient_id: testPatientId,
      items: [
        { description: 'Tratamiento de prueba', quantity: 1, unit_price: 150 }
      ]
    }, adminId);
    assert(invoice && invoice.id, 'Factura creada exitosamente');

    const quoteCheck = await query('SELECT id, status FROM quotations WHERE patient_id = $1 AND status = \'aceptada\'', [testPatientId]);
    assert(quoteCheck.rows.length > 0, 'Presupuesto Aceptado (Tratamiento Aceptado) generado correctamente');

    const ptCheck = await query('SELECT id FROM patient_treatments WHERE invoice_id = $1', [invoice.id]);
    assert(ptCheck.rows.length === 0, 'No se duplica en Historial Odontológico (se reserva para procedimientos clínicos realizados)');

    const paymentMethods = (await query('SELECT id FROM payment_methods LIMIT 1')).rows;
    const methodId = paymentMethods[0]?.id || 1;
    const customPaymentDate = '2026-05-10';

    const payment = await paymentService.create({
      invoice_id: invoice.id,
      amount: 50,
      payment_method_id: methodId,
      payment_date: customPaymentDate,
      notes: 'Pago con fecha personalizada de prueba'
    }, adminId);

    const checkPayment = await query('SELECT id, payment_date::text FROM payments WHERE id = $1', [payment.id]);
    const storedDateStr = checkPayment.rows[0]?.payment_date || '';
    assert(storedDateStr.startsWith(customPaymentDate), 'Pago guardado con fecha personalizada en la BD', `(Fecha: ${storedDateStr.slice(0, 10)})`);

    await query('DELETE FROM payments WHERE id = $1', [payment.id]);
    await query('DELETE FROM invoice_items WHERE invoice_id = $1', [invoice.id]);
    await query('DELETE FROM invoices WHERE id = $1', [invoice.id]);

    // --------------------------------------------------
    // TEST 6: Limpieza y Teardown
    // --------------------------------------------------
    console.log('\n🔹 [6/6] Limpieza de Datos de Prueba');
    if (testAppointmentId) {
      await appointmentService.delete(testAppointmentId);
      assert(true, 'Cita de prueba eliminada');
    }

    if (testQuotationId) {
      await query('DELETE FROM quotation_items WHERE quotation_id = $1', [testQuotationId]);
      await query('DELETE FROM quotations WHERE id = $1', [testQuotationId]);
      assert(true, 'Presupuesto de prueba limpiado');
    }

    if (testPatientId) {
      await query('DELETE FROM patients WHERE id = $1', [testPatientId]);
      assert(true, 'Paciente de prueba limpiado');
    }

    console.log('\n==================================================');
    console.log(`  📊 RESULTADOS: ${passed} PRUEBAS EXITOSAS, ${failed} FALLIDAS`);
    console.log('==================================================\n');

    process.exit(failed > 0 ? 1 : 0);

  } catch (err) {
    console.error('\n❌ ERROR EN SUITE DE PRUEBAS:', err);
    process.exit(1);
  }
  });
}

runAllTests();
