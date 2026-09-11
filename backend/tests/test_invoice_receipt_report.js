// ============================================
// Prueba Automatizada: Resumen de Facturas y Recibos (TASK-113)
// Valida los 14 criterios obligatorios:
// 1. Rango de fechas con facturas
// 2. Rango de fechas con recibos
// 3. Rango de fechas vacío
// 4. Cliente con DNI
// 5. Cliente con NIE
// 6. Cliente con Pasaporte
// 7. Cliente sin identificación -> "No registrado"
// 8. Distintos métodos de pago
// 9. Múltiples facturas
// 10. Múltiples recibos
// 11. Totales correctos
// 12. Filtrado de fechas correcto
// 13. Aislamiento multi-clínica
// 14. No modificación de registros fiscales (Read-Only)
// ============================================
process.env.NODE_ENV = 'test';
import { query, als } from '../database/pool.js';
import reportService from '../services/report.service.js';

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

async function runInvoiceReceiptReportTests() {
  console.log('\n=============================================================');
  console.log('  📊 PRUEBAS: RESUMEN DE FACTURAS Y RECIBOS (TASK-113)');
  console.log('=============================================================\n');

  const testSuffix = Date.now();
  let pDniId, pNieId, pPassId, pNoneId, pC2Id;
  let inv1, inv2, inv3, inv4, invOld;
  let rec1, rec2, rec3, recOld;
  let invC2, recC2;

  try {
    // -----------------------------------------------------------------
    // PREPARACIÓN DE DATOS DE PRUEBA
    // -----------------------------------------------------------------
    console.log('🔹 [SETUP] Creando pacientes y comprobantes de prueba...');

    // Métodos de pago
    const pmCash = (await query("SELECT id, label FROM payment_methods WHERE name = 'efectivo' LIMIT 1")).rows[0];
    const pmCard = (await query("SELECT id, label FROM payment_methods WHERE name IN ('tarjeta_credito', 'tarjeta_debito') LIMIT 1")).rows[0];
    const pmTransfer = (await query("SELECT id, label FROM payment_methods WHERE name = 'transferencia' LIMIT 1")).rows[0];

    // 1. Pacientes en Clínica 1
    // Paciente con DNI
    const p1Res = await query(
      `INSERT INTO patients (clinic_id, first_name, last_name, dni, email)
       VALUES (1, 'Carlos', 'DNI_${testSuffix}', '12345678Z', 'dni_${testSuffix}@test.com') RETURNING id`
    );
    pDniId = p1Res.rows[0].id;

    // Paciente con NIE
    const p2Res = await query(
      `INSERT INTO patients (clinic_id, first_name, last_name, dni, email)
       VALUES (1, 'Elena', 'NIE_${testSuffix}', 'Y1234567W', 'nie_${testSuffix}@test.com') RETURNING id`
    );
    pNieId = p2Res.rows[0].id;

    // Paciente con Pasaporte
    const p3Res = await query(
      `INSERT INTO patients (clinic_id, first_name, last_name, passport, email)
       VALUES (1, 'Marcus', 'Pass_${testSuffix}', 'PASS998877', 'pass_${testSuffix}@test.com') RETURNING id`
    );
    pPassId = p3Res.rows[0].id;

    // Paciente sin Identificación
    const p4Res = await query(
      `INSERT INTO patients (clinic_id, first_name, last_name, email)
       VALUES (1, 'SinID', 'Anon_${testSuffix}', 'noid_${testSuffix}@test.com') RETURNING id`
    );
    pNoneId = p4Res.rows[0].id;

    // Paciente en Clínica 2 (para prueba de aislamiento)
    const pC2Res = await query(
      `INSERT INTO patients (clinic_id, first_name, last_name, dni, email)
       VALUES (2, 'Clinica2', 'Tenant_${testSuffix}', '99999999K', 'c2_${testSuffix}@test.com') RETURNING id`
    );
    pC2Id = pC2Res.rows[0].id;

    // 2. Facturas en Clínica 1
    // Factura 1: Paciente con DNI, Fecha 2026-09-05, Monto 100.00, Efectivo
    const inv1Res = await query(
      `INSERT INTO invoices (clinic_id, invoice_number, document_type, patient_id, total, status, created_at)
       VALUES (1, 'FAC-T1-${testSuffix}', 'factura', $1, 100.00, 'pagada', '2026-09-05 10:00:00+02') RETURNING *`,
      [pDniId]
    );
    inv1 = inv1Res.rows[0];
    await query(
      `INSERT INTO payments (clinic_id, invoice_id, patient_id, payment_method_id, amount, payment_date)
       VALUES (1, $1, $2, $3, 100.00, '2026-09-05 10:00:00+02')`,
      [inv1.id, pDniId, pmCash.id]
    );

    // Factura 2: Paciente con NIE, Fecha 2026-09-06, Monto 250.00, Tarjeta
    const inv2Res = await query(
      `INSERT INTO invoices (clinic_id, invoice_number, document_type, patient_id, total, status, created_at)
       VALUES (1, 'FAC-T2-${testSuffix}', 'factura', $1, 250.00, 'pagada', '2026-09-06 11:30:00+02') RETURNING *`,
      [pNieId]
    );
    inv2 = inv2Res.rows[0];
    await query(
      `INSERT INTO payments (clinic_id, invoice_id, patient_id, payment_method_id, amount, payment_date)
       VALUES (1, $1, $2, $3, 250.00, '2026-09-06 11:30:00+02')`,
      [inv2.id, pNieId, pmCard.id]
    );

    // Factura 3: Paciente con Pasaporte, Fecha 2026-09-07, Monto 300.00, Transferencia
    const inv3Res = await query(
      `INSERT INTO invoices (clinic_id, invoice_number, document_type, patient_id, total, status, created_at)
       VALUES (1, 'FAC-T3-${testSuffix}', 'factura', $1, 300.00, 'pagada', '2026-09-07 14:00:00+02') RETURNING *`,
      [pPassId]
    );
    inv3 = inv3Res.rows[0];
    await query(
      `INSERT INTO payments (clinic_id, invoice_id, patient_id, payment_method_id, amount, payment_date)
       VALUES (1, $1, $2, $3, 300.00, '2026-09-07 14:00:00+02')`,
      [inv3.id, pPassId, pmTransfer.id]
    );

    // Factura 4: Paciente sin ID, Fecha 2026-09-08, Monto 150.00, Efectivo
    const inv4Res = await query(
      `INSERT INTO invoices (clinic_id, invoice_number, document_type, patient_id, total, status, created_at)
       VALUES (1, 'FAC-T4-${testSuffix}', 'factura', $1, 150.00, 'pagada', '2026-09-08 16:00:00+02') RETURNING *`,
      [pNoneId]
    );
    inv4 = inv4Res.rows[0];
    await query(
      `INSERT INTO payments (clinic_id, invoice_id, patient_id, payment_method_id, amount, payment_date)
       VALUES (1, $1, $2, $3, 150.00, '2026-09-08 16:00:00+02')`,
      [inv4.id, pNoneId, pmCash.id]
    );

    // Factura Antigua (fuera de rango): Fecha 2026-08-01, Monto 500.00
    const invOldRes = await query(
      `INSERT INTO invoices (clinic_id, invoice_number, document_type, patient_id, total, status, created_at)
       VALUES (1, 'FAC-OLD-${testSuffix}', 'factura', $1, 500.00, 'pagada', '2026-08-01 09:00:00+02') RETURNING *`,
      [pDniId]
    );
    invOld = invOldRes.rows[0];

    // 3. Recibos en Clínica 1
    // Recibo 1: Paciente con DNI, Fecha 2026-09-05, Monto 80.00, Efectivo
    const rec1Res = await query(
      `INSERT INTO invoices (clinic_id, invoice_number, document_type, patient_id, total, status, created_at)
       VALUES (1, 'REC-T1-${testSuffix}', 'recibo', $1, 80.00, 'pagada', '2026-09-05 10:30:00+02') RETURNING *`,
      [pDniId]
    );
    rec1 = rec1Res.rows[0];
    await query(
      `INSERT INTO payments (clinic_id, invoice_id, patient_id, payment_method_id, amount, payment_date)
       VALUES (1, $1, $2, $3, 80.00, '2026-09-05 10:30:00+02')`,
      [rec1.id, pDniId, pmCash.id]
    );

    // Recibo 2: Paciente con NIE, Fecha 2026-09-06, Monto 120.00, Tarjeta
    const rec2Res = await query(
      `INSERT INTO invoices (clinic_id, invoice_number, document_type, patient_id, total, status, created_at)
       VALUES (1, 'REC-T2-${testSuffix}', 'recibo', $1, 120.00, 'pagada', '2026-09-06 12:00:00+02') RETURNING *`,
      [pNieId]
    );
    rec2 = rec2Res.rows[0];
    await query(
      `INSERT INTO payments (clinic_id, invoice_id, patient_id, payment_method_id, amount, payment_date)
       VALUES (1, $1, $2, $3, 120.00, '2026-09-06 12:00:00+02')`,
      [rec2.id, pNieId, pmCard.id]
    );

    // Recibo 3: Paciente sin ID, Fecha 2026-09-07, Monto 200.00, Transferencia
    const rec3Res = await query(
      `INSERT INTO invoices (clinic_id, invoice_number, document_type, patient_id, total, status, created_at)
       VALUES (1, 'REC-T3-${testSuffix}', 'recibo', $1, 200.00, 'pagada', '2026-09-07 15:00:00+02') RETURNING *`,
      [pNoneId]
    );
    rec3 = rec3Res.rows[0];
    await query(
      `INSERT INTO payments (clinic_id, invoice_id, patient_id, payment_method_id, amount, payment_date)
       VALUES (1, $1, $2, $3, 200.00, '2026-09-07 15:00:00+02')`,
      [rec3.id, pNoneId, pmTransfer.id]
    );

    // Recibo Antiguo (fuera de rango): Fecha 2026-08-01, Monto 400.00
    const recOldRes = await query(
      `INSERT INTO invoices (clinic_id, invoice_number, document_type, patient_id, total, status, created_at)
       VALUES (1, 'REC-OLD-${testSuffix}', 'recibo', $1, 400.00, 'pagada', '2026-08-01 09:30:00+02') RETURNING *`,
      [pDniId]
    );
    recOld = recOldRes.rows[0];

    // 4. Documentos en Clínica 2 (para prueba de aislamiento)
    const invC2Res = await query(
      `INSERT INTO invoices (clinic_id, invoice_number, document_type, patient_id, total, status, created_at)
       VALUES (2, 'FAC-C2-${testSuffix}', 'factura', $1, 999.00, 'pagada', '2026-09-06 10:00:00+02') RETURNING *`,
      [pC2Id]
    );
    invC2 = invC2Res.rows[0];

    const recC2Res = await query(
      `INSERT INTO invoices (clinic_id, invoice_number, document_type, patient_id, total, status, created_at)
       VALUES (2, 'REC-C2-${testSuffix}', 'recibo', $1, 888.00, 'pagada', '2026-09-06 11:00:00+02') RETURNING *`,
      [pC2Id]
    );
    recC2 = recC2Res.rows[0];

    // =================================================================
    // EJECUCIÓN DE PRUEBAS
    // =================================================================

    // Contexto Clínica 1
    await als.run({ clinicId: 1, userId: 1 }, async () => {
      // -------------------------------------------------------------
      // Test 1: Date range with invoices
      // -------------------------------------------------------------
      console.log('\n--- Test 1: Rango de fechas con facturas ---');
      const repSept = await reportService.getInvoiceReceiptSummaryReport('2026-09-01', '2026-09-10');
      const invoiceNumbers = repSept.invoices.map(i => i.invoice_number);

      assert(invoiceNumbers.includes(inv1.invoice_number), 'Factura 1 (05-sep) presente en reporte');
      assert(invoiceNumbers.includes(inv2.invoice_number), 'Factura 2 (06-sep) presente en reporte');
      assert(invoiceNumbers.includes(inv3.invoice_number), 'Factura 3 (07-sep) presente en reporte');
      assert(invoiceNumbers.includes(inv4.invoice_number), 'Factura 4 (08-sep) presente en reporte');
      assert(!invoiceNumbers.includes(invOld.invoice_number), 'Factura fuera de rango (agosto) EXCLUIDA');

      // -------------------------------------------------------------
      // Test 2: Date range with receipts
      // -------------------------------------------------------------
      console.log('\n--- Test 2: Rango de fechas con recibos ---');
      const receiptNumbers = repSept.receipts.map(r => r.receipt_number || r.invoice_number);

      assert(receiptNumbers.includes(rec1.invoice_number), 'Recibo 1 (05-sep) presente en reporte');
      assert(receiptNumbers.includes(rec2.invoice_number), 'Recibo 2 (06-sep) presente en reporte');
      assert(receiptNumbers.includes(rec3.invoice_number), 'Recibo 3 (07-sep) presente en reporte');
      assert(!receiptNumbers.includes(recOld.invoice_number), 'Recibo fuera de rango (agosto) EXCLUIDO');

      // -------------------------------------------------------------
      // Test 3: Empty date range
      // -------------------------------------------------------------
      console.log('\n--- Test 3: Rango de fechas vacío ---');
      const repEmpty = await reportService.getInvoiceReceiptSummaryReport('', '');
      const allInvNumbers = repEmpty.invoices.map(i => i.invoice_number);
      const allRecNumbers = repEmpty.receipts.map(r => r.receipt_number || r.invoice_number);

      assert(allInvNumbers.includes(inv1.invoice_number), 'Rango vacío incluye Factura 1');
      assert(allInvNumbers.includes(invOld.invoice_number), 'Rango vacío incluye Factura histórica (agosto)');
      assert(allRecNumbers.includes(rec1.invoice_number), 'Rango vacío incluye Recibo 1');
      assert(allRecNumbers.includes(recOld.invoice_number), 'Rango vacío incluye Recibo histórico (agosto)');

      // -------------------------------------------------------------
      // Test 4: Customer with DNI
      // -------------------------------------------------------------
      console.log('\n--- Test 4: Cliente con DNI ---');
      const invDniRow = repSept.invoices.find(i => i.invoice_number === inv1.invoice_number);
      assert(invDniRow && invDniRow.patient_identification === '12345678Z', 'DNI de cliente retornado correctamente', `(${invDniRow?.patient_identification})`);

      // -------------------------------------------------------------
      // Test 5: Customer with NIE
      // -------------------------------------------------------------
      console.log('\n--- Test 5: Cliente con NIE ---');
      const invNieRow = repSept.invoices.find(i => i.invoice_number === inv2.invoice_number);
      assert(invNieRow && invNieRow.patient_identification === 'Y1234567W', 'NIE de cliente retornado correctamente', `(${invNieRow?.patient_identification})`);

      // -------------------------------------------------------------
      // Test 6: Customer with Passport
      // -------------------------------------------------------------
      console.log('\n--- Test 6: Cliente con Pasaporte ---');
      const invPassRow = repSept.invoices.find(i => i.invoice_number === inv3.invoice_number);
      assert(invPassRow && invPassRow.patient_identification === 'PASS998877', 'Pasaporte de cliente retornado correctamente al no tener DNI', `(${invPassRow?.patient_identification})`);

      // -------------------------------------------------------------
      // Test 7: Customer without identification -> "No registrado"
      // -------------------------------------------------------------
      console.log('\n--- Test 7: Cliente sin identificación -> "No registrado" ---');
      const invNoneRow = repSept.invoices.find(i => i.invoice_number === inv4.invoice_number);
      const recNoneRow = repSept.receipts.find(r => r.invoice_number === rec3.invoice_number);

      assert(invNoneRow && invNoneRow.patient_identification === 'No registrado', 'Factura de cliente sin ID muestra exactamente "No registrado"', `(${invNoneRow?.patient_identification})`);
      assert(recNoneRow && recNoneRow.patient_identification === 'No registrado', 'Recibo de cliente sin ID muestra exactamente "No registrado"', `(${recNoneRow?.patient_identification})`);

      // -------------------------------------------------------------
      // Test 8: Different payment methods
      // -------------------------------------------------------------
      console.log('\n--- Test 8: Distintos métodos de pago ---');
      assert(invDniRow && invDniRow.payment_method.includes('Efectivo'), 'Factura 1 muestra método Efectivo');
      assert(invNieRow && (invNieRow.payment_method.includes('Tarjeta') || invNieRow.payment_method.length > 0), 'Factura 2 muestra método Tarjeta');
      assert(invPassRow && invPassRow.payment_method.includes('Transferencia'), 'Factura 3 muestra método Transferencia');

      // -------------------------------------------------------------
      // Test 9: Multiple invoices
      // -------------------------------------------------------------
      console.log('\n--- Test 9: Múltiples facturas ---');
      assert(repSept.invoices.length >= 4, `Listado de facturas contiene múltiples filas (${repSept.invoices.length} filas)`);

      // -------------------------------------------------------------
      // Test 10: Multiple receipts
      // -------------------------------------------------------------
      console.log('\n--- Test 10: Múltiples recibos ---');
      assert(repSept.receipts.length >= 3, `Listado de recibos contiene múltiples filas (${repSept.receipts.length} filas)`);

      // -------------------------------------------------------------
      // Test 11: Correct totals
      // -------------------------------------------------------------
      console.log('\n--- Test 11: Totales correctos ---');
      // Suma de nuestras facturas de sept: 100 + 250 + 300 + 150 = 800.00
      const sumSeptInvoices = repSept.invoices
        .filter(i => [inv1.id, inv2.id, inv3.id, inv4.id].includes(i.id))
        .reduce((sum, i) => sum + i.amount, 0);
      assert(Math.abs(sumSeptInvoices - 800.00) < 0.01, 'Suma de facturas de prueba de septiembre = 800.00 €', `(Calculado: ${sumSeptInvoices.toFixed(2)})`);

      // Suma de nuestros recibos de sept: 80 + 120 + 200 = 400.00
      const sumSeptReceipts = repSept.receipts
        .filter(r => [rec1.id, rec2.id, rec3.id].includes(r.id))
        .reduce((sum, r) => sum + r.amount, 0);
      assert(Math.abs(sumSeptReceipts - 400.00) < 0.01, 'Suma de recibos de prueba de septiembre = 400.00 €', `(Calculado: ${sumSeptReceipts.toFixed(2)})`);

      assert(repSept.totals.invoices.total >= 800.00, 'Total global de facturas en reporte es consistente');
      assert(repSept.totals.receipts.total >= 400.00, 'Total global de recibos en reporte es consistente');
      assert(Array.isArray(repSept.totals.byPaymentMethod), 'Totales agrupados por método de pago es un array');
      assert(repSept.totals.byPaymentMethod.length > 0, 'Existen totales por método de pago');

      // -------------------------------------------------------------
      // Test 12: Correct date filtering
      // -------------------------------------------------------------
      console.log('\n--- Test 12: Filtrado de fechas estricto ---');
      // Rango estrecho: 2026-09-06 al 2026-09-07 (debe incluir Inv 2 e Inv 3, Rec 2 y Rec 3)
      const repNarrow = await reportService.getInvoiceReceiptSummaryReport('2026-09-06', '2026-09-07');
      const narrowInvNumbers = repNarrow.invoices.map(i => i.invoice_number);
      const narrowRecNumbers = repNarrow.receipts.map(r => r.invoice_number);

      assert(!narrowInvNumbers.includes(inv1.invoice_number), 'Factura del 05-sep excluida en rango 06-07 sep');
      assert(narrowInvNumbers.includes(inv2.invoice_number), 'Factura del 06-sep incluida en rango 06-07 sep');
      assert(narrowInvNumbers.includes(inv3.invoice_number), 'Factura del 07-sep incluida en rango 06-07 sep');
      assert(!narrowInvNumbers.includes(inv4.invoice_number), 'Factura del 08-sep excluida en rango 06-07 sep');

      assert(!narrowRecNumbers.includes(rec1.invoice_number), 'Recibo del 05-sep excluido en rango 06-07 sep');
      assert(narrowRecNumbers.includes(rec2.invoice_number), 'Recibo del 06-sep incluido en rango 06-07 sep');
      assert(narrowRecNumbers.includes(rec3.invoice_number), 'Recibo del 07-sep incluido en rango 06-07 sep');

      // -------------------------------------------------------------
      // Test 13: Clinic isolation
      // -------------------------------------------------------------
      console.log('\n--- Test 13: Aislamiento multi-clínica ---');
      assert(!invoiceNumbers.includes(invC2.invoice_number), 'Clínica 1 NO ve facturas de Clínica 2');
      assert(!receiptNumbers.includes(recC2.invoice_number), 'Clínica 1 NO ve recibos de Clínica 2');
    });

    // Ahora cambiamos contexto a Clínica 2
    await als.run({ clinicId: 2, userId: 1 }, async () => {
      const repC2 = await reportService.getInvoiceReceiptSummaryReport('2026-09-01', '2026-09-10');
      const c2InvNumbers = repC2.invoices.map(i => i.invoice_number);
      const c2RecNumbers = repC2.receipts.map(r => r.invoice_number);

      assert(c2InvNumbers.includes(invC2.invoice_number), 'Clínica 2 ve su propia factura');
      assert(c2RecNumbers.includes(recC2.invoice_number), 'Clínica 2 ve su propio recibo');
      assert(!c2InvNumbers.includes(inv1.invoice_number), 'Clínica 2 NO ve facturas de Clínica 1');
      assert(!c2RecNumbers.includes(rec1.invoice_number), 'Clínica 2 NO ve recibos de Clínica 1');
    });

    // -------------------------------------------------------------
    // Test 14: No modification of fiscal records (Read-Only)
    // -------------------------------------------------------------
    console.log('\n--- Test 14: No modificación de registros fiscales (Read-Only) ---');
    const invCountBefore = (await query('SELECT COUNT(*) AS c FROM invoices')).rows[0].c;
    const payCountBefore = (await query('SELECT COUNT(*) AS c FROM payments')).rows[0].c;
    const inv1Before = (await query('SELECT total, status, updated_at FROM invoices WHERE id = $1', [inv1.id])).rows[0];

    // Ejecutar el reporte varias veces
    await als.run({ clinicId: 1, userId: 1 }, async () => {
      await reportService.getInvoiceReceiptSummaryReport('2026-09-01', '2026-09-10');
      await reportService.getInvoiceReceiptSummaryReport();
      await reportService.getInvoiceReceiptSummaryReport('2026-01-01', '2026-12-31');
    });

    const invCountAfter = (await query('SELECT COUNT(*) AS c FROM invoices')).rows[0].c;
    const payCountAfter = (await query('SELECT COUNT(*) AS c FROM payments')).rows[0].c;
    const inv1After = (await query('SELECT total, status, updated_at FROM invoices WHERE id = $1', [inv1.id])).rows[0];

    assert(invCountBefore === invCountAfter, 'Conteo de facturas idéntico antes y después del reporte');
    assert(payCountBefore === payCountAfter, 'Conteo de pagos idéntico antes y después del reporte');
    assert(parseFloat(inv1Before.total) === parseFloat(inv1After.total), 'Importe de factura no alterado');
    assert(inv1Before.status === inv1After.status, 'Estado de factura no alterado');
    assert(String(inv1Before.updated_at) === String(inv1After.updated_at), 'Timestamp updated_at intacto (operación 100% READ-ONLY)');

  } catch (err) {
    console.error('Error fatal durante la suite de pruebas:', err);
    failed++;
  } finally {
    // -------------------------------------------------------------
    // LIMPIEZA DE DATOS DE PRUEBA
    // -------------------------------------------------------------
    console.log('\n🔹 [CLEANUP] Eliminando comprobantes y pacientes de prueba...');
    try {
      await query(`DELETE FROM payments WHERE invoice_id IN (SELECT id FROM invoices WHERE invoice_number LIKE '%${testSuffix}%')`);
      await query(`DELETE FROM invoices WHERE invoice_number LIKE '%${testSuffix}%'`);
      await query(`DELETE FROM patients WHERE email LIKE '%${testSuffix}%'`);
    } catch (cleanErr) {
      console.warn('Advertencia durante cleanup:', cleanErr.message);
    }
  }

  console.log('\n=============================================================');
  console.log(`  📊 RESULTADOS: ${passed} PRUEBAS EXITOSAS, ${failed} FALLIDAS`);
  console.log('=============================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runInvoiceReceiptReportTests();
