// ============================================
// Prueba Automatizada: Generación de Reportes en PDF de Alta Calidad
// ============================================
process.env.NODE_ENV = 'test';
import { als } from '../database/pool.js';
import pdfService from '../services/pdf.service.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import jwt from 'jsonwebtoken';
import config from '../config/app.js';

let passed = 0;
let failed = 0;

function assert(condition, name, extra = '') {
  if (condition) {
    console.log(`  ✅ PASS: ${name} ${extra}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${name} ${extra}`);
    failed++;
  }
}

async function runReportPdfTests() {
  console.log('\n=============================================================');
  console.log('  📄 PRUEBAS: GENERACIÓN DE REPORTES EN PDF DE ALTA CALIDAD');
  console.log('=============================================================\n');

  try {
    // 1. Probar generación de PDF para 'facturas_recibos' en contexto de clínica 1
    console.log('🔹 1. Probando generación de PDF para "facturas_recibos"...');
    await als.run({ clinicId: 1, isOwner: true, roleName: 'propietario' }, async () => {
      const result = await pdfService.generateReportPDF('facturas_recibos', '2026-07-01', '2026-09-30');
      assert(!!result, 'Resultado retornado no es nulo');
      assert(Buffer.isBuffer(result.buffer), 'El resultado contiene un Buffer');
      assert(result.buffer.length > 1000, `El tamaño del PDF es consistente (${result.buffer.length} bytes)`);
      const header = result.buffer.slice(0, 5).toString('utf-8');
      assert(header === '%PDF-', `El buffer es un PDF válido (cabecera: ${header})`);
      assert(result.filename.startsWith('Resumen_Facturas_Recibos_'), `Nombre de archivo generado correctamente: ${result.filename}`);
    });

    // 2. Probar generación de PDF para los otros tipos de reporte
    console.log('\n🔹 2. Probando generación de PDF para "ingresos", "citas" y "tratamientos"...');
    await als.run({ clinicId: 1, isOwner: true, roleName: 'propietario' }, async () => {
      const revResult = await pdfService.generateReportPDF('ingresos', '2026-07-01', '2026-09-30');
      assert(Buffer.isBuffer(revResult.buffer) && revResult.buffer.length > 1000, 'PDF de ingresos generado con éxito');
      assert(revResult.filename.startsWith('Reporte_Ingresos_'), `Filename ingresos: ${revResult.filename}`);

      const aptResult = await pdfService.generateReportPDF('citas', '2026-07-01', '2026-09-30');
      assert(Buffer.isBuffer(aptResult.buffer) && aptResult.buffer.length > 1000, 'PDF de citas generado con éxito');
      assert(aptResult.filename.startsWith('Reporte_Citas_'), `Filename citas: ${aptResult.filename}`);

      const trtResult = await pdfService.generateReportPDF('tratamientos', '2026-07-01', '2026-09-30');
      assert(Buffer.isBuffer(trtResult.buffer) && trtResult.buffer.length > 1000, 'PDF de tratamientos generado con éxito');
      assert(trtResult.filename.startsWith('Reporte_Tratamientos_'), `Filename tratamientos: ${trtResult.filename}`);
    });

    // 3. Probar autenticación por req.query.token en authMiddleware
    console.log('\n🔹 3. Probando autenticación vía query param ?token=...');
    const { query: dbQuery } = await import('../database/pool.js');
    const uRow = (await dbQuery('SELECT id, current_session_id FROM users WHERE id = 1')).rows[0];

    const testToken = jwt.sign(
      { id: 1, email: 'admin@dentalclinic.com', roleId: 1, roleName: 'propietario', clinicId: 1, sessionId: uRow?.current_session_id },
      config.jwt.secret,
      { expiresIn: '1h' }
    );

    const mockReq = {
      headers: {},
      query: { token: testToken, clinic_id: '1' },
    };
    let nextCalled = false;
    let authUser = null;
    let errResponse = null;

    await new Promise((resolve) => {
      const mockRes = {
        status: (code) => mockRes,
        json: (data) => {
          errResponse = data;
          resolve();
        },
      };

      authMiddleware(mockReq, mockRes, () => {
        nextCalled = true;
        authUser = mockReq.user;
        resolve();
      });
    });

    if (errResponse) {
      console.error('Error retornado por authMiddleware:', errResponse);
    }

    assert(nextCalled, 'authMiddleware llamó a next() exitosamente con ?token=...');
    assert(authUser && authUser.id === 1, 'Usuario extraído correctamente del token');
    assert(authUser && authUser.clinicId === 1, 'clinicId resuelto correctamente');

    // 4. Probar resiliencia de ReportService con fechas vacías o undefined (defaults automáticos)
    console.log('\n🔹 4. Probando resiliencia de ReportService ante parámetros de fecha vacíos...');
    const reportService = (await import('../services/report.service.js')).default;
    await als.run({ clinicId: 1, isOwner: true, roleName: 'propietario' }, async () => {
      const rev = await reportService.getRevenueReport();
      assert(typeof rev.total === 'number', 'RevenueReport sin fechas calcula total numérico por defecto');
      assert(Array.isArray(rev.byMethod), 'RevenueReport byMethod es array');

      const apt = await reportService.getAppointmentReport();
      assert(typeof apt.total === 'number', 'AppointmentReport sin fechas calcula total numérico por defecto');
      assert(Array.isArray(apt.byStatus), 'AppointmentReport byStatus es array');

      const pat = await reportService.getPatientReport();
      assert(typeof pat.newPatients === 'number', 'PatientReport sin fechas calcula newPatients');

      const trt = await reportService.getTreatmentReport();
      assert(Array.isArray(trt.popular), 'TreatmentReport sin fechas retorna lista de popular');

      const invRec = await reportService.getInvoiceReceiptSummaryReport();
      assert(Array.isArray(invRec.invoices), 'InvoiceReceiptSummary sin fechas retorna invoices array');
      assert(Array.isArray(invRec.receipts), 'InvoiceReceiptSummary sin fechas retorna receipts array');
    });

    // 5. Probar compatibilidad de parámetros camelCase en ReportController
    console.log('\n🔹 5. Probando compatibilidad camelCase/snake_case en ReportController...');
    const reportController = await import('../controllers/report.controller.js');
    await als.run({ clinicId: 1, isOwner: true, roleName: 'propietario' }, async () => {
      let controllerData = null;
      const mockReq = { query: { startDate: '2026-01-01', endDate: '2026-12-31' } };
      const mockRes = {
        status: () => mockRes,
        json: (payload) => { controllerData = payload; return mockRes; }
      };
      await reportController.getRevenueReport(mockReq, mockRes, (err) => { if (err) throw err; });
      assert(controllerData && controllerData.success, 'Controller procesa startDate/endDate camelCase exitosamente');
      assert(typeof controllerData.data?.total === 'number', 'Controller retorna total numérico');
    });

  } catch (error) {
    console.error('❌ Excepción durante las pruebas:', error);
    failed++;
  }

  console.log('\n-------------------------------------------------------------');
  console.log(`  RESULTADOS: ${passed} pasadas, ${failed} fallidas`);
  console.log('-------------------------------------------------------------\n');

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runReportPdfTests();
