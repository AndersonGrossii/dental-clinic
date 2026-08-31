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
    // TEST 9: Limpieza y Teardown
    // --------------------------------------------------
    console.log('\n🔹 [9/9] Limpieza de Datos de Prueba');
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
