// ============================================
// Test de Generación de PDFs y Aislamiento Multi-Tenant
// ============================================
import fs from 'fs';
import { query, pool, als } from '../database/pool.js';
import pdfService from '../services/pdf.service.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n========================================');
  console.log('🧪 SUITE: Generación de PDFs Clínicos & Multi-Tenant (TASK-110)');
  console.log('========================================\n');

  try {
    // 0. Verificación de Logo de la Clínica
    console.log('--- 0. Verificación de Detección de Logo Clínico ---');
    const logoPath = pdfService.resolveClinicLogoPath({ name: 'Vides Dental' });
    assert(logoPath !== null, `Ruta de logotipo resuelta con éxito: "${logoPath}"`);
    assert(logoPath && fs.existsSync(logoPath), 'El archivo físico del logotipo existe y es legible');

    // 1. Obtener o crear datos de prueba en Clínica 1
    const clinic1Id = 1;
    const clinic2Id = 2;

    // Buscar una factura/recibo existente en clínica 1
    let invRes = await query(
      'SELECT id, invoice_number, document_type FROM invoices WHERE clinic_id = $1 AND deleted_at IS NULL LIMIT 1',
      [clinic1Id]
    );
    let invoiceId = invRes.rows[0]?.id;

    if (!invoiceId) {
      // Crear paciente y factura de prueba
      const patRes = await query(
        `INSERT INTO patients (first_name, last_name, dni, clinic_id)
         VALUES ('Paciente', 'TestPDF', '12345678A', $1) RETURNING id`,
        [clinic1Id]
      );
      const patId = patRes.rows[0].id;
      const newInv = await query(
        `INSERT INTO invoices (invoice_number, document_type, patient_id, clinic_id, subtotal, total, status)
         VALUES ('FAC-TEST-001', 'factura', $1, $2, 100.00, 100.00, 'pagada') RETURNING id`,
        [patId, clinic1Id]
      );
      invoiceId = newInv.rows[0].id;
      await query(
        `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, subtotal, total, clinic_id)
         VALUES ($1, 'Limpieza Dental Test', 1, 100.00, 100.00, 100.00, $2)`,
        [invoiceId, clinic1Id]
      );
    }

    // Buscar o crear cotización en clínica 1
    let quoRes = await query(
      'SELECT id, quote_number FROM quotations WHERE clinic_id = $1 AND deleted_at IS NULL LIMIT 1',
      [clinic1Id]
    );
    let quoteId = quoRes.rows[0]?.id;

    if (!quoteId) {
      const patId = (await query('SELECT id FROM patients WHERE clinic_id = $1 LIMIT 1', [clinic1Id])).rows[0].id;
      const newQuo = await query(
        `INSERT INTO quotations (quote_number, patient_id, clinic_id, subtotal, total, status)
         VALUES ('COT-TEST-001', $1, $2, 250.00, 250.00, 'aceptada') RETURNING id`,
        [patId, clinic1Id]
      );
      quoteId = newQuo.rows[0].id;
      await query(
        `INSERT INTO quotation_items (quotation_id, description, quantity, unit_price, total, clinic_id)
         VALUES ($1, 'Endodoncia Unirradicular', 1, 250.00, 250.00, $2)`,
        [quoteId, clinic1Id]
      );
    }

    // Buscar o crear prescripción en clínica 1
    let prescRes = await query(
      'SELECT id, prescription_number FROM prescriptions WHERE clinic_id = $1 AND deleted_at IS NULL LIMIT 1',
      [clinic1Id]
    );
    let prescId = prescRes.rows[0]?.id;

    if (!prescId) {
      const patId = (await query('SELECT id FROM patients WHERE clinic_id = $1 LIMIT 1', [clinic1Id])).rows[0].id;
      const newPresc = await query(
        `INSERT INTO prescriptions (prescription_number, patient_id, clinic_id, issued_date, notes)
         VALUES ('PRC-TEST-001', $1, $2, CURRENT_DATE, 'Tomar amoxicilina con alimentos') RETURNING id`,
        [patId, clinic1Id]
      );
      prescId = newPresc.rows[0].id;
      await query(
        `INSERT INTO prescription_items (prescription_id, medication_name, dosage, frequency, duration, instructions)
         VALUES ($1, 'Amoxicilina 500mg', '1 cápsula', 'Cada 8 horas', '7 días', 'Ingerir con abundante agua')`,
        [prescId]
      );
    }

    // ==========================================
    // 1. Generación de PDF de Factura / Recibo
    // ==========================================
    console.log('--- 1. Verificación de Factura / Recibo PDF ---');
    await als.run({ clinicId: clinic1Id, userId: 1, roleName: 'propietario' }, async () => {
      const result = await pdfService.generateInvoicePDF(invoiceId);

      assert(Buffer.isBuffer(result.buffer), 'generateInvoicePDF retorna un Buffer binario');
      assert(result.buffer.length > 1000, `El tamaño del PDF es válido (${result.buffer.length} bytes > 1000)`);
      const magicBytes = result.buffer.toString('utf8', 0, 5);
      assert(magicBytes === '%PDF-', `El buffer contiene la firma estándar de PDF (%PDF-): "${magicBytes}"`);
      assert(result.filename.endsWith('.pdf'), `El nombre de archivo generado es válido: "${result.filename}"`);
      assert(result.documentNumber !== undefined, `El número de documento fue retornado: "${result.documentNumber}"`);
    });

    // ==========================================
    // 2. Generación de PDF de Presupuesto
    // ==========================================
    console.log('\n--- 2. Verificación de Presupuesto Odontológico PDF ---');
    await als.run({ clinicId: clinic1Id, userId: 1, roleName: 'propietario' }, async () => {
      const result = await pdfService.generateQuotationPDF(quoteId);

      assert(Buffer.isBuffer(result.buffer), 'generateQuotationPDF retorna un Buffer binario');
      assert(result.buffer.length > 1000, `El tamaño del PDF es válido (${result.buffer.length} bytes > 1000)`);
      const magicBytes = result.buffer.toString('utf8', 0, 5);
      assert(magicBytes === '%PDF-', `El buffer de cotización contiene firma %PDF-: "${magicBytes}"`);
      assert(result.filename.startsWith('Presupuesto_') && result.filename.endsWith('.pdf'), `Nombre de archivo adecuado: "${result.filename}"`);
    });

    // ==========================================
    // 3. Generación de PDF de Receta Médica
    // ==========================================
    console.log('\n--- 3. Verificación de Receta Médica PDF ---');
    await als.run({ clinicId: clinic1Id, userId: 1, roleName: 'propietario' }, async () => {
      const result = await pdfService.generatePrescriptionPDF(prescId);

      assert(Buffer.isBuffer(result.buffer), 'generatePrescriptionPDF retorna un Buffer binario');
      assert(result.buffer.length > 1000, `El tamaño del PDF es válido (${result.buffer.length} bytes > 1000)`);
      const magicBytes = result.buffer.toString('utf8', 0, 5);
      assert(magicBytes === '%PDF-', `El buffer de receta contiene firma %PDF-: "${magicBytes}"`);
      assert(result.filename.startsWith('Receta_') && result.filename.endsWith('.pdf'), `Nombre de archivo de receta adecuado: "${result.filename}"`);
    });

    // ==========================================
    // 4. Aislamiento Multi-Tenant Estricto (Clínica 2 intentando descargar Clínica 1)
    // ==========================================
    console.log('\n--- 4. Verificación de Aislamiento Multi-Tenant (Seguridad) ---');
    await als.run({ clinicId: clinic2Id, userId: 99, roleName: 'doctor' }, async () => {
      // 4.1 Factura de Clínica 1 bloqueada para Clínica 2
      let blockedInvoice = false;
      try {
        await pdfService.generateInvoicePDF(invoiceId);
      } catch (err) {
        if (err.statusCode === 403 || err.statusCode === 404) {
          blockedInvoice = true;
        }
      }
      assert(blockedInvoice, 'Clínica 2 no puede generar ni acceder al PDF de factura de Clínica 1 (403/404)');

      // 4.2 Presupuesto de Clínica 1 bloqueado para Clínica 2
      let blockedQuote = false;
      try {
        await pdfService.generateQuotationPDF(quoteId);
      } catch (err) {
        if (err.statusCode === 403 || err.statusCode === 404) {
          blockedQuote = true;
        }
      }
      assert(blockedQuote, 'Clínica 2 no puede generar ni acceder al PDF de presupuesto de Clínica 1 (403/404)');

      // 4.3 Receta de Clínica 1 bloqueada para Clínica 2
      let blockedPresc = false;
      try {
        await pdfService.generatePrescriptionPDF(prescId);
      } catch (err) {
        if (err.statusCode === 403 || err.statusCode === 404) {
          blockedPresc = true;
        }
      }
      assert(blockedPresc, 'Clínica 2 no puede generar ni acceder al PDF de receta de Clínica 1 (403/404)');
    });

    // ==========================================
    // 5. Manejo de Documentos Inexistentes (404)
    // ==========================================
    console.log('\n--- 5. Verificación de Documentos Inexistentes (404) ---');
    await als.run({ clinicId: clinic1Id, userId: 1, roleName: 'propietario' }, async () => {
      let notFound = false;
      try {
        await pdfService.generateInvoicePDF(999999);
      } catch (err) {
        if (err.statusCode === 404) notFound = true;
      }
      assert(notFound, 'Solicitud de PDF de factura inexistente arroja error 404');
    });

    console.log('\n========================================');
    console.log(`📊 RESULTADO: ${passed} pasados, ${failed} fallidos`);
    console.log('========================================\n');

    return failed === 0;
  } catch (err) {
    console.error('Error fatal durante la ejecución de los tests de PDF:', err);
    return false;
  }
}

// Ejecutar directamente
runTests()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
