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
import doctorService from '../services/doctor.service.js';
import whatsappService from '../services/whatsapp.service.js';
import messagingService from '../services/messaging.service.js';
import taskService from '../services/task.service.js';
import calendarNoteService from '../services/calendar-note.service.js';
import followupService from '../services/followup.service.js';
import odontogramService from '../services/odontogram.service.js';
import instagramService from '../services/instagram.service.js';
import aiService from '../services/ai.service.js';
import automationSchedulerService from '../services/automation-scheduler.service.js';
import cronService from '../services/cron.service.js';

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

    // Creación de Nota Clínica de Evolución
    const createdNote = await patientService.createNote(testPatientId, adminId, {
      title: 'Limpieza e Higiene Dental Post-Tratamiento',
      content: 'Tratamiento de profilaxis realizado sin complicaciones. Instrucciones de higiene entregadas.',
      type: 'clinica'
    });
    assert(createdNote && createdNote.id, 'Nota de evolución clínica registrada con éxito', `(Nota ID: ${createdNote.id})`);
    assert(createdNote.content.includes('profilaxis'), 'Contenido de la nota guardado correctamente');

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
      if (err.message && (err.message.includes('Conflicto') || err.message.includes('conflicto'))) {
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

    // Marcar tratamiento de la cotización como realizado para que se renderice en Tratamientos Realizados
    const quoteItems = acceptedQuote.items || [];
    if (quoteItems.length > 0) {
      await quotationService.updateExecutionStatus(quoteItems[0].id, 'realizado', adminId);
    }

    const acceptedItems = await quotationService.getAcceptedItemsByPatient(testPatientId);
    assert(acceptedItems.length > 0, 'Tratamientos Realizados listados correctamente tras completar el tratamiento');
    assert(acceptedItems[0].quote_tax_rate !== undefined && acceptedItems[0].quote_tax_rate !== null, 'Tasa de IVA del presupuesto transmitida a Tratamientos Realizados');

    // Revertir estado de ejecución para no afectar pruebas financieras posteriores
    if (quoteItems.length > 0) {
      await quotationService.updateExecutionStatus(quoteItems[0].id, 'en_proceso', adminId);
    }

    // Prueba de conversión de cotización directa a Recibo (REC) y pago directo
    const quoteDoc = await invoiceService.createFromQuotation(testQuotationId, adminId, null, 'recibo');
    assert(quoteDoc && quoteDoc.id, 'Documento de recibo generado directamente desde cotización aceptada');
    assert(quoteDoc.invoice_number.startsWith('REC-'), 'Número de recibo secuencial (REC) asignado correctamente');

    // Prueba de Cotización con Múltiples Ítems y Abono Desglosado por Tratamiento
    const multiItemQuote = await quotationService.create({
      patient_id: testPatientId,
      doctor_id: docId,
      notes: 'Presupuesto con múltiples ítems para abono desglosado',
      items: [
        { treatment_id: treatment.id, description: 'Extracción dental', unit_price: 100, quantity: 1, discount: 0 },
        { treatment_id: treatment.id, description: 'Implante dental', unit_price: 400, quantity: 1, discount: 0 }
      ]
    }, adminId);
    await quotationService.changeStatus(multiItemQuote.id, 'aceptada');

    const multiItemAllocations = [
      { id: multiItemQuote.items[0].id, amount: 60.00 },
      { id: multiItemQuote.items[1].id, amount: 250.00 }
    ];

    const allocDoc = await invoiceService.createFromQuotation(multiItemQuote.id, adminId, null, 'recibo', multiItemAllocations);
    assert(allocDoc && allocDoc.id, 'Recibo generado con abonos desglosados por tratamiento');
    assert(allocDoc.items.some(i => i.description.includes('Extracción')), 'Recibo contiene ítem Extracción');
    assert(allocDoc.items.some(i => i.description.includes('Implante')), 'Recibo contiene ítem Implante');

    const allocPaymentMethods = (await query('SELECT id FROM payment_methods LIMIT 1')).rows;
    const allocMethodId = allocPaymentMethods[0]?.id || 1;
    await paymentService.create({
      invoice_id: allocDoc.id,
      amount: allocDoc.total,
      payment_method_id: allocMethodId,
      notes: 'Pago de recibo de prueba con abono desglosado'
    }, adminId);

    const updatedMultiQuote = await quotationService.getById(multiItemQuote.id);
    const item1 = updatedMultiQuote.items.find(i => i.id === multiItemQuote.items[0].id);
    const item2 = updatedMultiQuote.items.find(i => i.id === multiItemQuote.items[1].id);

    assert(item1.amount_paid === 60, 'Monto cobrado para Extracción es 60€');
    assert(item1.payment_status === 'parcial', 'Estado de pago para Extracción es parcial (naranja)');
    assert(item2.amount_paid === 250, 'Monto cobrado para Implante es 250€');
    assert(item2.payment_status === 'parcial', 'Estado de pago para Implante es parcial (naranja)');

    // Crear segundo recibo para completar Extracción (40€ faltantes)
    const secondAllocations = [{ id: multiItemQuote.items[0].id, amount: 40.00 }];
    const secondDoc = await invoiceService.createFromQuotation(multiItemQuote.id, adminId, null, 'recibo', secondAllocations);
    await paymentService.create({
      invoice_id: secondDoc.id,
      amount: secondDoc.total,
      payment_method_id: allocMethodId,
      notes: 'Segundo pago para completar Extracción'
    }, adminId);

    const secondDocDetail = await invoiceService.getById(secondDoc.id);
    const completedExtraccion = secondDocDetail.items.find(i => i.quotation_item_id === multiItemQuote.items[0].id);
    assert(completedExtraccion && parseFloat(completedExtraccion.previously_paid) === 60, 'Recibo #2 reconoce 60€ abonados previamente');
    assert(completedExtraccion && completedExtraccion.is_final_payment_of_partial === true, 'Recibo #2 reconoce que este abono completa al 100% la Extracción');

    // Limpieza de cotización multi-item de prueba
    await query('DELETE FROM payments WHERE invoice_id IN ($1, $2)', [allocDoc.id, secondDoc.id]);
    await query('DELETE FROM invoice_items WHERE invoice_id IN ($1, $2)', [allocDoc.id, secondDoc.id]);
    await query('DELETE FROM invoices WHERE id IN ($1, $2)', [allocDoc.id, secondDoc.id]);
    await query('DELETE FROM quotation_items WHERE quotation_id = $1', [multiItemQuote.id]);
    await query('DELETE FROM quotations WHERE id = $1', [multiItemQuote.id]);

    // Test de Presupuesto Unificado (Creación con estados de ejecución y actualización dinámica)
    const unifiedQuote = await quotationService.create({
      patient_id: testPatientId,
      notes: 'Presupuesto de prueba unificado',
      items: [
        { description: 'Profilaxis Dental', unit_price: 50, quantity: 1, discount: 0, execution_status: 'en_proceso' },
        { description: 'Obturación Simple', unit_price: 70, quantity: 1, discount: 0, execution_status: 'realizado' }
      ]
    });
    assert(unifiedQuote && unifiedQuote.id, 'Presupuesto unificado creado exitosamente');
    assert(unifiedQuote.items.length === 2, 'Presupuesto unificado contiene 2 ítems');
    const obturacionItem = unifiedQuote.items.find(i => i.description === 'Obturación Simple');
    assert(obturacionItem && obturacionItem.execution_status === 'realizado', 'Ítem marcado como realizado');

    // Verificar que se haya sincronizado a patient_treatments
    const ptUnifiedCheck = await query('SELECT * FROM patient_treatments WHERE patient_id = $1 AND deleted_at IS NULL AND price = 70', [testPatientId]);
    assert(ptUnifiedCheck.rows.length > 0, 'Tratamiento realizado sincronizado en patient_treatments');

    // Verificar que solo el ítem realizado afecte al débito/balance del paciente ($70, no $120)
    const patUnifiedState1 = await patientService.getById(testPatientId);
    assert(parseFloat(patUnifiedState1.total_debit) === 70.00, 'El débito del paciente solo incluye el ítem marcado como completado ($70)');

    // Actualizar presupuesto: añadir nuevo ítem pendiente y cambiar Profilaxis a realizado
    const updatedUnified = await quotationService.update(unifiedQuote.id, {
      items: [
        { id: unifiedQuote.items[0].id, description: 'Profilaxis Dental', unit_price: 50, quantity: 1, discount: 0, execution_status: 'realizado' },
        { id: unifiedQuote.items[1].id, description: 'Obturación Simple', unit_price: 70, quantity: 1, discount: 0, execution_status: 'realizado' },
        { description: 'Corona Zirconio', unit_price: 350, quantity: 1, discount: 0, execution_status: 'pendiente' }
      ]
    });
    assert(updatedUnified.items.length === 3, 'Presupuesto actualizado a 3 ítems con nuevo ítem agregado');

    // Verificar que el débito sea $120 (50 + 70) y no incluya los $350 del ítem pendiente
    const patUnifiedState2 = await patientService.getById(testPatientId);
    assert(parseFloat(patUnifiedState2.total_debit) === 120.00, 'El débito del paciente se actualiza a $120 (50+70) tras completar Profilaxis sin incluir el ítem pendiente de $350');

    // Test: Revertir Obturación Simple ($70) de realizado a en_proceso
    await quotationService.updateExecutionStatus(updatedUnified.items[1].id, 'en_proceso');
    const patUnifiedState3 = await patientService.getById(testPatientId);
    assert(parseFloat(patUnifiedState3.total_debit) === 50.00, 'Al cambiar Obturación Simple a en_proceso, el débito se reduce a $50 y el balance se actualiza');

    // Test: Revertir Profilaxis Dental ($50) de realizado a pendiente
    await quotationService.updateExecutionStatus(updatedUnified.items[0].id, 'pendiente');
    const patUnifiedState4 = await patientService.getById(testPatientId);
    assert(parseFloat(patUnifiedState4.total_debit) === 0.00, 'Al cambiar Profilaxis a pendiente, el débito regresa a $0.00');

    // Test: Volver a marcar Profilaxis ($50) como realizado
    await quotationService.updateExecutionStatus(updatedUnified.items[0].id, 'realizado');
    const patUnifiedState5 = await patientService.getById(testPatientId);
    assert(parseFloat(patUnifiedState5.total_debit) === 50.00, 'Al volver a marcar Profilaxis como realizado, el débito sube a $50');

    // Limpieza de presupuesto unificado
    await query('DELETE FROM patient_treatments WHERE patient_id = $1 AND notes LIKE $2', [testPatientId, `%${unifiedQuote.quote_number}%`]);
    await query('DELETE FROM quotation_items WHERE quotation_id = $1', [unifiedQuote.id]);
    await query('DELETE FROM quotations WHERE id = $1', [unifiedQuote.id]);

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

    await query('DELETE FROM payments WHERE invoice_id IN (SELECT id FROM invoices WHERE patient_id = $1)', [testPatientId]);
    await query('DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE patient_id = $1)', [testPatientId]);
    await query('DELETE FROM invoices WHERE patient_id = $1', [testPatientId]);
    await query('DELETE FROM quotation_items WHERE quotation_id IN (SELECT id FROM quotations WHERE patient_id = $1)', [testPatientId]);
    await query('DELETE FROM quotations WHERE patient_id = $1', [testPatientId]);
    await query('DELETE FROM patient_treatments WHERE patient_id = $1', [testPatientId]);

    // --------------------------------------------------
    // TEST 6: Flujo de Cobranza -> Tratamiento Aceptado + Crédito en Balance -> Conclusión y Débito
    // --------------------------------------------------
    console.log('\n🔹 [6/7] Flujo de Cobranza en Payments -> Tratamiento Aceptado -> Balance -> Conclusión');

    const patient6 = await patientService.create({
      first_name: 'Prueba',
      last_name: 'Cobranza',
      phone: '555000999',
      email: `cobranza_${Date.now()}@test.com`
    }, adminId);
    const testPatientId6 = patient6.id;

    // 1. Crear adelantamiento inicial ($200)
    const initAdv = await paymentService.create({
      patient_id: testPatientId6,
      payment_method_id: methodId,
      amount: 200.00,
      notes: 'Adelanto inicial de prueba'
    }, adminId);
    assert(initAdv && initAdv.payment, 'Adelantamiento inicial registrado con éxito');

    const patInit = await patientService.getById(testPatientId6);
    assert(parseFloat(patInit.balance) === 200.00, 'Balance inicial es +200.00 tras adelantamiento');
    assert(parseFloat(patInit.available_credit) === 200.00, 'Saldo(Crédito) inicial es 200.00');

    // 2. Registrar tratamiento completado de 200€
    const newPt = await treatmentService.addPatientTreatment({
      patient_id: testPatientId6,
      treatment_id: treatment.id,
      price: 200.00,
      status: 'completado',
      notes: 'Tratamiento completado de prueba'
    });
    assert(newPt && newPt.id, 'Tratamiento completado registrado');

    const patAfterPt = await patientService.getById(testPatientId6);
    assert(parseFloat(patAfterPt.balance) === 0.00, 'Balance se actualiza a 0.00 al completar tratamiento de 200€');
    assert(parseFloat(patAfterPt.available_credit) === 200.00, 'Saldo(Crédito) permanece en 200.00 sin usar');

    // 3. Test de Escenario Completo (Adelanto $5,000 + Tratamiento $3,500)
    const advPay = await paymentService.create({
      patient_id: testPatientId6,
      payment_method_id: methodId,
      amount: 5000.00,
      notes: 'Adelanto de prueba 5000'
    }, adminId);

    const ptScenario = await treatmentService.addPatientTreatment({
      patient_id: testPatientId6,
      treatment_id: treatment.id,
      price: 3500.00,
      status: 'completado',
      notes: 'Tratamiento completado 3500'
    });

    const patState1 = await patientService.getById(testPatientId6);
    assert(parseFloat(patState1.balance) === 1500.00, 'Balance se actualiza a +$1,500.00 tras completar tratamiento de $3,500');
    assert(parseFloat(patState1.available_credit) === 5200.00, 'Saldo(Crédito) permanece en $5,200.00 sin usar antes del cobro');

    // Cobrar tratamiento en efectivo / tarjeta (nuevo dinero entrante)
    const cashPay = await paymentService.processTreatmentPayment({
      patient_id: testPatientId6,
      treatment_ids: [ptScenario.id],
      document_type: 'recibo',
      payment_method_id: methodId,
      amount: 3500.00,
      notes: 'Pago en efectivo de tratamiento 3500'
    }, adminId);

    const patState2 = await patientService.getById(testPatientId6);
    assert(parseFloat(patState2.balance) === 5000.00, 'Balance retorna a +$5,000.00 tras pagar el tratamiento en efectivo/tarjeta');
    assert(parseFloat(patState2.available_credit) === 5200.00, 'Saldo(Crédito) se mantiene en $5,200.00');

    // Limpieza del test 6
    await query('DELETE FROM patient_credits WHERE patient_id = $1', [testPatientId6]);
    await query('DELETE FROM payments WHERE patient_id = $1 OR invoice_id IN (SELECT id FROM invoices WHERE patient_id = $1)', [testPatientId6]);
    await query('DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE patient_id = $1)', [testPatientId6]);
    await query('DELETE FROM invoices WHERE patient_id = $1', [testPatientId6]);
    await query('DELETE FROM patient_treatments WHERE patient_id = $1', [testPatientId6]);
    await query('DELETE FROM patients WHERE id = $1', [testPatientId6]);

    // --------------------------------------------------
    // TEST 7: Días Específicos de Atención (doctor_workdays)
    // --------------------------------------------------
    console.log('\n🔹 [7/8] Días Específicos de Atención (doctor_workdays)');
    const testWorkdate = '2026-11-21';
    const workdayRec = await doctorService.addWorkday(docId, {
      work_date: testWorkdate,
      start_time: '09:00',
      end_time: '14:00',
      notes: 'Test Especialista Visiting'
    });
    assert(workdayRec && workdayRec.id, 'Día específico registrado con éxito');

    const doctorWorkdaysList = await doctorService.getWorkdays(docId);
    assert(doctorWorkdaysList.length > 0, 'Días específicos listados para el doctor');

    const availWorkday = await doctorService.getAvailability(docId, testWorkdate);
    assert(availWorkday.length > 0, 'Horarios disponibles generados para la fecha específica registrada (2026-11-21)');

    const availOffday = await doctorService.getAvailability(docId, '2026-11-22');
    assert(availOffday.length === 0, 'Día no registrado marcado correctamente como NO disponible para el doctor visitante');

    await doctorService.removeWorkday(workdayRec.id, docId);
    assert(true, 'Día específico de prueba eliminado correctamente');

    // --------------------------------------------------
    // TEST 8: Carga de Expediente / Perfil de Paciente (Rol Higienista)
    // --------------------------------------------------
    console.log('\n🔹 [8/9] Carga de Perfil de Paciente para Rol Higienista');
    const patProfile = await patientService.getById(testPatientId);
    assert(patProfile && patProfile.id === testPatientId, 'Higienista puede obtener datos de paciente por ID');

    const patHistory = await patientService.getHistory(testPatientId);
    assert(patHistory !== undefined, 'Higienista puede consultar historial clínico');

    const patTreatments = await treatmentService.getPatientTreatments(testPatientId);
    assert(Array.isArray(patTreatments), 'Higienista puede consultar tratamientos del paciente');

    const patPayments = await paymentService.getAll({ patient_id: testPatientId, limit: 10 });
    assert(patPayments !== undefined, 'Higienista puede consultar pagos del paciente');

    const patAcceptedItems = await quotationService.getAcceptedItemsByPatient(testPatientId);
    assert(Array.isArray(patAcceptedItems), 'Higienista puede consultar ítems de presupuestos aceptados');

    // --------------------------------------------------
    // TEST 9: Historial Odontológico y Tratamientos con Múltiples Piezas (ej. "14, 15", "18, 28, 38, 48")
    // --------------------------------------------------
    console.log('\n🔹 [9/10] Historial Odontológico y Tratamientos con Múltiples Piezas');
    const dhMulti = await patientService.addDentalHistory(testPatientId, {
      procedure_name: 'Obturaciones múltiples en cuadrante 1',
      treatment: 'Obturaciones múltiples en cuadrante 1',
      tooth_number: '14, 15',
      notes: 'Tratamiento en 2 piezas dentales contiguas',
      condition: 'Tratamiento Realizado'
    });
    assert(dhMulti && dhMulti.tooth_number === '14, 15', 'Historial odontológico acepta múltiples piezas (ej. "14, 15")');

    const dhUpdated = await patientService.updateDentalHistory(dhMulti.id, {
      procedure_name: 'Obturaciones y selladores',
      tooth_number: '14, 15, 16',
      notes: 'Se amplió a 3 piezas'
    });
    assert(dhUpdated && dhUpdated.tooth_number === '14, 15, 16', 'Historial odontológico actualizado con 3 piezas ("14, 15, 16")');

    // Limpieza de entrada de historial dental
    await query('DELETE FROM dental_history WHERE id = $1', [dhMulti.id]);

    // --------------------------------------------------
    // TEST 10: Generación de Factura vinculada a Recibo & Pago con Saldo (Crédito)
    // --------------------------------------------------
    console.log('\n🔹 [10/11] Generación de Factura vinculada a Recibo & Saldo (Crédito)');
    
    // 10a. Crear tratamiento para prueba de factura
    const ptInvoiceTest = await treatmentService.addPatientTreatment({
      patient_id: testPatientId,
      treatment_id: treatment.id,
      price: 150.00,
      status: 'pendiente',
      notes: 'Tratamiento prueba factura+recibo'
    });

    const invoicePayRes = await paymentService.processTreatmentPayment({
      patient_id: testPatientId,
      treatment_ids: [ptInvoiceTest.id],
      document_type: 'factura',
      payment_method_id: methodId,
      amount: 150.00,
      notes: 'Cobro con Factura Oficial'
    }, adminId);

    assert(invoicePayRes.document && invoicePayRes.document.document_type === 'factura', 'Factura oficial (FAC) generada');
    assert(invoicePayRes.receipt && invoicePayRes.receipt.document_type === 'recibo', 'Recibo de pago (REC) generado');
    assert(parseFloat(invoicePayRes.receipt.total) === 150.00, 'Recibo tiene total de 150€');
    assert(parseFloat(invoicePayRes.receipt.amount_paid) === 150.00, 'Recibo tiene amount_paid de 150€ (no 0€)');
    assert(parseFloat(invoicePayRes.document.total) === 150.00, 'Factura tiene total de 150€ copiado del recibo');
    assert(parseFloat(invoicePayRes.document.amount_paid) === 150.00, 'Factura tiene amount_paid de 150€ copiado del recibo');
    assert(invoicePayRes.document.receipt_id === invoicePayRes.receipt.id, 'Factura vinculada al ID del Recibo');
    
    const recCheck = await query('SELECT receipt_id FROM invoices WHERE id = $1', [invoicePayRes.receipt.id]);
    assert(recCheck.rows[0]?.receipt_id === invoicePayRes.document.id, 'Recibo vinculado al ID de la Factura');

    const fullRec = await invoiceService.getById(invoicePayRes.receipt.id);
    assert(fullRec.payments.length > 0, 'Recibo contiene registro de pago y método de pago disponible');

    const fullInv = await invoiceService.getById(invoicePayRes.document.id);
    assert(fullInv.payments.length > 0, 'Factura contiene registro de pago');

    // 10b. Pago con Saldo (Crédito) NO debe generar ningún recibo ni factura
    // Añadir saldo al paciente
    await query(
      `INSERT INTO patient_credits (patient_id, clinic_id, type, amount, source, notes, created_by)
       VALUES ($1, 1, 'credit', 200.00, 'manual', 'Crédito para prueba', $2)`,
      [testPatientId, adminId]
    );

    const ptCreditTest = await treatmentService.addPatientTreatment({
      patient_id: testPatientId,
      treatment_id: treatment.id,
      price: 80.00,
      status: 'pendiente',
      notes: 'Tratamiento prueba saldo credito'
    });

    const pmCreditRes = await query(`SELECT id FROM payment_methods WHERE name = 'saldo_credito' LIMIT 1`);
    const creditMethodId = pmCreditRes.rows[0]?.id || 5;

    const creditPayRes = await paymentService.processTreatmentPayment({
      patient_id: testPatientId,
      treatment_ids: [ptCreditTest.id],
      document_type: 'factura', // even if factura is sent, saldo_credito must NOT generate any document
      payment_method_id: creditMethodId,
      amount: 80.00,
      notes: 'Pago con Saldo Crédito'
    }, adminId);

    assert(creditPayRes.document === null, 'Pago con Saldo(Crédito) NO genera Factura');
    assert(creditPayRes.receipt === null, 'Pago con Saldo(Crédito) NO genera Recibo');
    assert(creditPayRes.payment && creditPayRes.payment.invoice_id === null, 'Registro de pago con Saldo(Crédito) tiene invoice_id = null');

    // Limpieza de tratamientos y comprobantes de prueba 10
    await query('DELETE FROM patient_credits WHERE patient_id = $1', [testPatientId]);
    await query('DELETE FROM payments WHERE patient_id = $1', [testPatientId]);
    await query('DELETE FROM invoice_items WHERE invoice_id IN ($1, $2)', [invoicePayRes.document.id, invoicePayRes.receipt.id]);
    await query('DELETE FROM invoices WHERE id IN ($1, $2)', [invoicePayRes.document.id, invoicePayRes.receipt.id]);
    await query('DELETE FROM patient_treatments WHERE id IN ($1, $2)', [ptInvoiceTest.id, ptCreditTest.id]);

    // --------------------------------------------------
    // TEST 11: WhatsApp Business Cloud API & Mensajería Unificada
    // --------------------------------------------------
    console.log('\n🔹 [11/12] WhatsApp Business Cloud API & Mensajería Unificada (MVP)');
    
    // 11a. Verificación de Handshake Webhook
    const validChallenge = whatsappService.verifyWebhookChallenge('subscribe', 'vides_dental_webhook_token_2026', 'challenge_meta_test_9988');
    assert(validChallenge === 'challenge_meta_test_9988', 'Handshake de verificación de Meta Webhook valida token correcto');

    const invalidChallenge = whatsappService.verifyWebhookChallenge('subscribe', 'wrong_token', 'challenge_meta_test_9988');
    assert(invalidChallenge === null, 'Handshake de Meta Webhook rechaza token inválido');

    // 11b. Ingesta de Mensaje Entrante desde Webhook
    const testWaPhone = '34699887766';
    const mockWebhookPayload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'WABA_TEST_ACCOUNT',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '34912345678',
                  phone_number_id: 'PHONE_ID_TEST'
                },
                contacts: [
                  {
                    profile: { name: 'Laura Gómez Test' },
                    wa_id: testWaPhone
                  }
                ],
                messages: [
                  {
                    from: testWaPhone,
                    id: `wamid.test_${Date.now()}`,
                    timestamp: Math.floor(Date.now() / 1000).toString(),
                    text: { body: 'Hola, quisiera agendar una cita de valoración dental' },
                    type: 'text'
                  }
                ]
              }
            }
          ]
        }
      ]
    };

    const webhookResults = await messagingService.processInboundWebhook(mockWebhookPayload);
    assert(webhookResults.length > 0 && webhookResults[0].success === true, 'Webhook procesó exitosamente el mensaje entrante de WhatsApp');

    // Verificar que se haya creado el contacto y la conversación
    const convsRes = await messagingService.getConversations({ search: testWaPhone });
    assert(convsRes.rows.length > 0, 'Conversación registrada en bandeja de mensajería para el contacto de WhatsApp');
    const testConv = convsRes.rows[0];
    assert(testConv.contact_phone === testWaPhone, 'Teléfono del contacto coincide con el remitente de WhatsApp');
    assert(testConv.channel === 'WHATSAPP', "Canal asignado como 'WHATSAPP'");

    // Verificar mensajes de la conversación (Inbound + Auto-reply saliente)
    const threadData = await messagingService.getConversationMessages(testConv.id);
    assert(threadData.messages.length >= 2, 'Conversación contiene mensaje entrante y respuesta automática inicial');
    const inboundMsg = threadData.messages.find(m => m.direction === 'INBOUND');
    const autoOutboundMsg = threadData.messages.find(m => m.direction === 'OUTBOUND');
    assert(inboundMsg && inboundMsg.body.includes('cita de valoración'), 'Mensaje entrante guardado con texto íntegro');
    assert(autoOutboundMsg && autoOutboundMsg.body.includes('Vides Dental'), 'Auto-reply de bienvenida generado automáticamente');

    // 11c. Respuesta Manual de Staff (Human Takeover)
    const staffOutbound = await messagingService.sendOutboundMessage({
      conversationId: testConv.id,
      userId: adminId,
      messageType: 'TEXT',
      body: '¡Hola Laura! Tenemos disponibilidad este jueves a las 11:00 con el Dr. Juan.'
    });
    assert(staffOutbound && staffOutbound.direction === 'OUTBOUND', 'Staff puede enviar mensaje saliente de WhatsApp');

    const updatedConv = await messagingService.getConversationDetail(testConv.id);
    assert(updatedConv.automation_enabled === false, 'Al responder el staff, se desactiva el Auto-Bot y se activa el Modo Atención Humana');

    // 11d. Envío de Plantilla Pre-Aprobada (Template)
    const templateMsg = await messagingService.sendOutboundMessage({
      conversationId: testConv.id,
      userId: adminId,
      messageType: 'TEMPLATE',
      templateName: 'recordatorio_cita',
      templateParams: ['Laura', 'Jueves 17 de Octubre', '11:00']
    });
    assert(templateMsg && templateMsg.message_type === 'TEMPLATE', 'Plantilla de WhatsApp enviada con parámetros dinámicos');

    // 11e. Vinculación de Contacto de WhatsApp a Expediente de Paciente
    const linkRes = await messagingService.linkPatient(testConv.id, testPatientId);
    assert(linkRes && Number(linkRes.contact.patient_id) === Number(testPatientId), 'Contacto de WhatsApp vinculado exitosamente al expediente del paciente');

    const convAfterLink = await messagingService.getConversationDetail(testConv.id);
    assert(Number(convAfterLink.patient_id) === Number(testPatientId), 'Conversación refleja el ID del paciente vinculado');

    // 11f. Estadísticas de Mensajería
    const msgStats = await messagingService.getStats();
    assert(parseInt(msgStats.total_conversations, 10) >= 1, 'Estadísticas del centro de mensajería calculadas correctamente');

    // Limpieza de datos de mensajería de prueba
    await query('DELETE FROM messages WHERE conversation_id = $1', [testConv.id]);
    await query('DELETE FROM conversations WHERE id = $1', [testConv.id]);
    await query('DELETE FROM messaging_contacts WHERE phone = $1', [testWaPhone]);

    // --------------------------------------------------
    // TEST 12: Productividad en Calendario (Tareas, Notas y Seguimientos)
    // --------------------------------------------------
    console.log('\n🔹 [12/13] Productividad en Calendario (Tareas, Notas y Seguimientos)');

    // 12a. Creación de Tarea de Equipo
    const testTask = await taskService.createTask({
      title: 'Pedir corona de zirconio a laboratorio',
      description: 'Molar 46 para paciente de prueba',
      due_date: '2026-11-25',
      due_time: '10:30:00',
      priority: 'HIGH',
      patient_id: testPatientId,
    }, adminId, 1);

    assert(testTask && testTask.id, 'Tarea creada con éxito');
    assert(testTask.status === 'PENDING', 'Tarea inicializada con estado PENDING');
    assert(testTask.priority === 'HIGH', 'Prioridad asignada como HIGH');
    assert(Number(testTask.patient_id) === Number(testPatientId), 'Tarea vinculada correctamente al paciente de prueba');

    // 12b. Consulta y Filtrado de Tareas
    const tasksList = await taskService.getTasks({
      clinicId: 1,
      startDate: '2026-11-01',
      endDate: '2026-11-30',
      status: 'PENDING',
    });
    assert(tasksList.some(t => t.id === testTask.id), 'Tarea listada dentro del rango de fechas del calendario');

    // 12c. Actualización de Estado (Completar Tarea)
    const updatedTask = await taskService.updateStatus(testTask.id, 'COMPLETED', 1);
    assert(updatedTask.status === 'COMPLETED', 'Tarea marcada exitosamente como COMPLETED');

    // 12d. Creación y Consulta de Notas Adhesivas de Calendario (Sticky Notes)
    const testNote = await calendarNoteService.createNote({
      note_date: '2026-11-25',
      title: 'Mantenimiento Preventivo',
      content: 'Revisión semestral del compresor y equipo de rayos X.',
      color: '#bfdbfe',
      is_pinned: true,
      is_team_visible: true,
    }, adminId, 1);

    assert(testNote && testNote.id, 'Nota adhesiva de calendario creada');
    assert(testNote.is_pinned === true, 'Nota marcada como fijada (pinned)');

    const notesList = await calendarNoteService.getNotes({
      clinicId: 1,
      startDate: '2026-11-01',
      endDate: '2026-11-30',
    });
    assert(notesList.some(n => n.id === testNote.id), 'Nota adhesiva recuperada para la vista de calendario');

    // 12e. Creación y Seguimiento de Paciente (Follow-up)
    const testFollowup = await followupService.createFollowup({
      patient_id: testPatientId,
      followup_date: '2026-11-28',
      reason: 'Control dolor post-extracción molar 48',
      notes: 'Llamar por la mañana para evaluar inflamación.',
    }, adminId, 1);

    assert(testFollowup && testFollowup.id, 'Seguimiento de paciente programado');
    assert(testFollowup.status === 'PENDING', 'Seguimiento inicializado con estado PENDING');

    const updatedFollowup = await followupService.updateStatus(testFollowup.id, 'CONTACTED', 1);
    assert(updatedFollowup.status === 'CONTACTED', 'Estado de seguimiento actualizado a CONTACTED');

    const followupsList = await followupService.getFollowups({
      clinicId: 1,
      patientId: testPatientId,
    });
    assert(followupsList.length > 0, 'Seguimientos recuperados para el paciente');

    // Limpieza de datos de productividad de prueba
    await taskService.deleteTask(testTask.id, 1);
    await calendarNoteService.deleteNote(testNote.id, adminId, 1);
    await followupService.deleteFollowup(testFollowup.id, 1);

    // --------------------------------------------------
    // TEST 13: Odontograma Dental Clínico (Anotaciones por Pieza y Superficies FDI)
    // --------------------------------------------------
    console.log('\n🔹 [13/14] Odontograma Dental Clínico (Anotaciones por Pieza y Superficies FDI)');

    // 13a. Registro de Caries en Superficies Oclusal y Mesial de Pieza 16
    const entry16 = await odontogramService.saveEntry(
      testPatientId,
      {
        tooth_number: '16',
        surfaces: ['O', 'M'],
        condition: 'CARIES',
        state: 'DIAGNOSED',
        severity: 'MODERATE',
        notes: 'Caries de esmalte y dentina en fosa mesio-oclusal.',
      },
      adminId,
      1
    );

    assert(entry16 && entry16.id, 'Entrada de odontograma para pieza #16 creada exitosamente');
    assert(entry16.tooth_number === '16', 'Número de pieza FDI registrado como 16');
    assert(entry16.condition === 'CARIES', 'Condición asignada como CARIES');
    assert(Array.isArray(entry16.surfaces) && entry16.surfaces.includes('O') && entry16.surfaces.includes('M'), 'Superficies O y M registradas');
    assert(entry16.state === 'DIAGNOSED', 'Estado inicial registrado como DIAGNOSED');

    // 13b. Registro de Implante en Pieza 46 (Diente Completo)
    const entry46 = await odontogramService.saveEntry(
      testPatientId,
      {
        tooth_number: '46',
        surfaces: [],
        condition: 'IMPLANTE',
        state: 'COMPLETED',
        severity: 'MODERATE',
        notes: 'Implante osteointegrado con corona sobre implante.',
      },
      adminId,
      1
    );

    assert(entry46 && entry46.id, 'Entrada de implante en pieza #46 creada');
    assert(entry46.condition === 'IMPLANTE', 'Condición registrada como IMPLANTE');

    // 13c. Consulta del Odontograma del Paciente y Mapeo por Piezas
    const odontoData = await odontogramService.getPatientOdontogram(testPatientId, 1);
    assert(odontoData && Array.isArray(odontoData.entries), 'Odontograma recuperado como estructura de datos válida');
    assert(odontoData.teethMap['16'] && odontoData.teethMap['16'].length >= 1, 'Mapeo rápido de pieza #16 contiene los hallazgos');
    assert(odontoData.teethMap['46'] && odontoData.teethMap['46'].length >= 1, 'Mapeo rápido de pieza #46 contiene el implante');

    // 13d. Actualización de Entrada (Caries curada con Obturación / Realizado)
    const updatedEntry16 = await odontogramService.updateEntry(
      entry16.id,
      {
        condition: 'OBTURACION',
        state: 'COMPLETED',
        notes: 'Restauración con resina compuesta fotopolimerizable realizada.',
      },
      1
    );

    assert(updatedEntry16.condition === 'OBTURACION', 'Condición actualizada a OBTURACION tras realizar tratamiento');
    assert(updatedEntry16.state === 'COMPLETED', 'Estado actualizado a COMPLETED');

    // 13e. Eliminación (Soft Delete) de Entrada de Odontograma
    const deleteRes = await odontogramService.deleteEntry(entry46.id, 1);
    assert(deleteRes.success === true, 'Entrada de odontograma eliminada mediante soft delete');

    const odontoAfterDelete = await odontogramService.getPatientOdontogram(testPatientId, 1);
    assert(!odontoAfterDelete.teethMap['46'], 'Pieza #46 ya no figura con registros activos en el mapa dental');

    // Limpieza de entrada restante
    await odontogramService.deleteEntry(entry16.id, 1);

    // --------------------------------------------------
    // TEST 14: Instagram Direct Messaging (Meta Graph API & Omnicanal)
    // --------------------------------------------------
    console.log('\n🔹 [14/15] Instagram Direct Messaging (Meta Graph API & Omnicanal)');

    // 14a. Handshake de Verificación de Webhook de Instagram
    const igChallengeResult = instagramService.verifyWebhookChallenge('subscribe', 'vides_dental_webhook_token_2026', 'challenge_test_code_ig_7788');
    assert(igChallengeResult === 'challenge_test_code_ig_7788', 'Handshake de verificación de Meta Instagram Webhook valida token correcto');

    const igFailedChallenge = instagramService.verifyWebhookChallenge('subscribe', 'wrong_token', 'challenge_test_code_ig_7788');
    assert(igFailedChallenge === null, 'Handshake de Meta Instagram Webhook rechaza token inválido');

    // 14b. Ingesta de Mensaje Entrante por Webhook de Instagram
    const testIgSenderId = '1784140099887766';
    const mockIgPayload = {
      object: 'instagram',
      entry: [{
        id: '17841400000000000',
        time: Date.now(),
        messaging: [{
          sender: { id: testIgSenderId },
          recipient: { id: '17841400000000000' },
          timestamp: Date.now(),
          message: {
            mid: `m_ig_${Date.now()}`,
            text: '¡Hola! Quisiera saber el precio de una limpieza dental y blanqueamiento.',
          }
        }]
      }]
    };

    const igWebhookRes = await messagingService.processInboundInstagramWebhook(mockIgPayload);
    assert(Array.isArray(igWebhookRes) && igWebhookRes.length > 0 && igWebhookRes[0].success, 'Webhook procesó exitosamente el mensaje entrante de Instagram');

    // 14c. Verificación de Conversación y Canal 'INSTAGRAM'
    const igConvsRes = await messagingService.getConversations({ search: testIgSenderId });
    assert(igConvsRes && igConvsRes.rows && igConvsRes.rows.length > 0, 'Conversación registrada en bandeja omnicanal para el usuario de Instagram');

    const testIgConv = igConvsRes.rows[0];
    assert(testIgConv.channel === 'INSTAGRAM', 'Canal asignado correctamente como INSTAGRAM');

    // 14d. Respuesta Automática en Instagram
    const igMessagesData = await messagingService.getConversationMessages(testIgConv.id);
    const igMessages = igMessagesData?.messages || [];
    assert(igMessages.length >= 2, 'Conversación contiene mensaje entrante y auto-reply de Instagram');
    assert(igMessages.some(m => m.direction === 'OUTBOUND'), 'Auto-reply de bienvenida para Instagram generado automáticamente');

    // 14e. Envío de Mensaje Saliente por parte del Staff (Modo Mock / Sandboxed)
    const outboundIgReply = await messagingService.sendOutboundMessage({
      conversationId: testIgConv.id,
      userId: adminId,
      body: '¡Hola! La limpieza dental tiene un costo de 50€ y el blanqueamiento 180€. ¿Deseas agendar?',
    });

    assert(outboundIgReply && outboundIgReply.id, 'Staff puede enviar mensaje directo saliente de Instagram');

    const convAfterIgStaffReply = await messagingService.getConversationDetail(testIgConv.id);
    assert(convAfterIgStaffReply.automation_enabled === false, 'Al responder el staff por Instagram, se activa el Modo Atención Humana');

    // 14f. Vinculación del Usuario de Instagram al Expediente del Paciente
    const linkIgRes = await messagingService.linkPatient(testIgConv.id, testPatientId);
    assert(linkIgRes && Number(linkIgRes.contact.patient_id) === Number(testPatientId), 'Contacto de Instagram vinculado exitosamente al paciente');

    // Limpieza de datos de prueba de Instagram
    await query('DELETE FROM messages WHERE conversation_id = $1', [testIgConv.id]);
    await query('DELETE FROM conversations WHERE id = $1', [testIgConv.id]);
    await query('DELETE FROM messaging_contacts WHERE phone = $1', [testIgSenderId]);

    // --------------------------------------------------
    // TEST 15: AI Structured Copilot & Motor de Automações Clínicas
    // --------------------------------------------------
    console.log('\n🔹 [15/16] AI Structured Copilot & Motor de Automações Clínicas');

    // 15a. Clasificador de Intención de IA (Heurístico / Free LLM)
    const intentConfirm = await aiService.classifyIntent('1');
    assert(intentConfirm.intent === 'CONFIRM', 'IA clasifica "1" como confirmación de cita (CONFIRM)');

    const intentTextConfirm = await aiService.classifyIntent('Sim, estarei presente amanhã às 10h');
    assert(intentTextConfirm.intent === 'CONFIRM', 'IA clasifica texto afirmativo como CONFIRM');

    const intentCancel = await aiService.classifyIntent('2');
    assert(intentCancel.intent === 'CANCEL', 'IA clasifica "2" como cancelación/reagendamiento (CANCEL)');

    const intentUrgent = await aiService.classifyIntent('Tengo un dolor muy fuerte en la muela y sangrado');
    assert(intentUrgent.intent === 'URGENT', 'IA clasifica síntomas agudos como urgencia (URGENT)');

    // 15b. Escaneo de Confirmaciones 24h
    // Crear una cita de prueba para mañana en estado 'programada'
    const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const statusProgRes = await query(`SELECT id FROM appointment_status WHERE name = 'programada' LIMIT 1`);
    const progStatusId = statusProgRes.rows[0]?.id;

    const testAppt24hRes = await query(
      `INSERT INTO appointments (clinic_id, patient_id, doctor_id, appointment_date, start_time, end_time, status_id)
       VALUES (1, $1, $2, $3, '11:00:00', '11:30:00', $4)
       RETURNING id`,
      [testPatientId, docId, tomorrowStr, progStatusId]
    );
    const testAppt24hId = testAppt24hRes.rows[0].id;

    const scanResult = await automationSchedulerService.run24hAppointmentConfirmationScan(1);
    assert(scanResult && scanResult.sent >= 1, 'Escaneo 24h detecta y envía recordatorio de confirmación por WhatsApp');

    // 15c. Procesamiento de Confirmación Inbound en Webhook ("1")
    const patientPhone = '600000999';
    const confirmInboundRes = await automationSchedulerService.processInboundConfirmation(patientPhone, '1', 1);
    assert(confirmInboundRes.handled === true && confirmInboundRes.action === 'CONFIRMED', 'Respuesta "1" en WhatsApp procesada como confirmación exitosa');

    const verifiedApptRes = await query(`SELECT s.name AS status_name FROM appointments a JOIN appointment_status s ON a.status_id = s.id WHERE a.id = $1`, [testAppt24hId]);
    assert(verifiedApptRes.rows[0]?.status_name === 'confirmada', 'Estado de la cita actualizado automáticamente a "confirmada" en base de datos');

    // 15d. Procesamiento de Cancelación Inbound en Webhook ("2")
    const cancelInboundRes = await automationSchedulerService.processInboundConfirmation(patientPhone, '2', 1);
    assert(cancelInboundRes.handled === true && cancelInboundRes.action === 'CANCELLED', 'Respuesta "2" en WhatsApp procesada como cancelación');

    const verifiedCancelRes = await query(`SELECT s.name AS status_name FROM appointments a JOIN appointment_status s ON a.status_id = s.id WHERE a.id = $1`, [testAppt24hId]);
    assert(verifiedCancelRes.rows[0]?.status_name === 'cancelada', 'Estado de la cita actualizado automáticamente a "cancelada"');

    const createdTaskRes = await query(`SELECT * FROM tasks WHERE appointment_id = $1 AND priority = 'URGENT'`, [testAppt24hId]);
    assert(createdTaskRes.rows.length > 0, 'Tarea urgente creada automáticamente para la recepción para liberar el hueco de agenda');

    // 15e. Motor de Recall & Retención de Pacientes (1x al día)
    const recallPatient = await patientService.create({
      first_name: 'Maria',
      last_name: 'Recall',
      dni: `R${Date.now().toString().slice(-8)}`,
      phone: '600111222',
      email: `recall.${Date.now()}@clinic.com`
    }, adminId);

    const past190Date = new Date(Date.now() - 190 * 86400000).toISOString().split('T')[0];
    const statusCompRes = await query(`SELECT id FROM appointment_status WHERE name = 'completada' LIMIT 1`);
    const compStatusId = statusCompRes.rows[0]?.id;

    const oldApptRes = await query(
      `INSERT INTO appointments (clinic_id, patient_id, doctor_id, appointment_date, start_time, end_time, status_id)
       VALUES (1, $1, $2, $3, '10:00:00', '10:30:00', $4)
       RETURNING id`,
      [recallPatient.id, docId, past190Date, compStatusId]
    );
    const oldApptId = oldApptRes.rows[0].id;

    // Eliminar cita 24h de prueba
    await query(`DELETE FROM appointments WHERE id = $1`, [testAppt24hId]);

    const recallResult = await automationSchedulerService.runDailyRecallSweep(1);
    assert(recallResult && recallResult.hygieneSent >= 1, 'Motor de recall detecta paciente con profilaxis >180d y envía mensaje de retención');

    const followupsRes = await query(`SELECT * FROM patient_followups WHERE patient_id = $1 AND reason LIKE '%Recall%'`, [recallPatient.id]);
    assert(followupsRes.rows.length > 0, 'Llamada de seguimiento registrada en patient_followups para la recepción');

    // 15f. Briefing Operativo Matinal de IA
    const briefing = await aiService.generateReceptionBriefing({
      date: new Date().toISOString().split('T')[0],
      appointments: [{ status_name: 'confirmada' }, { status_name: 'programada' }],
      pendingConfirmations: [{ id: 1 }],
      recalls: followupsRes.rows,
    });
    assert(briefing && briefing.summary && briefing.metrics.totalAppointments === 2, 'Briefing inteligente de recepción generado con métricas precisas');

    // 15g. Motor de Cron Autónomo en Segundo Plano
    const cronStatus = cronService.getStatus();
    assert(cronStatus && typeof cronStatus === 'object', 'Motor de cron responde con estado operativo');
    await cronService.executeAllClinicsConfirmations();
    assert(true, 'Cron ejecuta escaneo multi-clínica de confirmaciones 24h sin errores');
    await cronService.executeAllClinicsRecall();
    assert(true, 'Cron ejecuta barrido multi-clínica de recall preventivo sin errores');

    // Limpieza de datos específicos de automatizaciones
    await query(`DELETE FROM automation_logs WHERE patient_id = $1`, [recallPatient.id]);
    await query(`DELETE FROM patient_followups WHERE patient_id = $1`, [recallPatient.id]);
    await query(`DELETE FROM appointments WHERE id = $1`, [oldApptId]);
    await query(`DELETE FROM patients WHERE id = $1`, [recallPatient.id]);
    await query(`DELETE FROM automation_logs WHERE patient_id = $1`, [testPatientId]);
    await query(`DELETE FROM tasks WHERE patient_id = $1`, [testPatientId]);

    // --------------------------------------------------
    // TEST 16: Limpieza y Teardown
    // --------------------------------------------------
    console.log('\n🔹 [16/16] Limpieza de Datos de Prueba');
    if (testAppointmentId) {
      await appointmentService.delete(testAppointmentId);
      assert(true, 'Cita de prueba eliminada');
    }

    if (testQuotationId) {
      await query('DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE quotation_id = $1)', [testQuotationId]);
      await query('DELETE FROM payments WHERE invoice_id IN (SELECT id FROM invoices WHERE quotation_id = $1)', [testQuotationId]);
      await query('DELETE FROM invoices WHERE quotation_id = $1', [testQuotationId]);
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
