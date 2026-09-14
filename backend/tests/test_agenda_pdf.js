// ============================================
// Prueba Automatizada: Generación de Agenda en PDF (Diaria y Semanal)
// ============================================
process.env.NODE_ENV = 'test';
import { query, als } from '../database/pool.js';
import pdfService from '../services/pdf.service.js';
import { getAgendaPDF } from '../controllers/pdf.controller.js';

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

async function runAgendaPdfTests() {
  console.log('\n=============================================================');
  console.log('  📄 PRUEBAS: GENERACIÓN DE AGENDA EN PDF (MÉTODO DE IMPRESIÓN)');
  console.log('=============================================================\n');

  const testDate = '2026-09-14';

  try {
    // 1. Probar generación de Agenda Diaria con intervalo estándar de 30 min
    console.log('🔹 1. Probando generación de Agenda Diaria con intervalo de 30 min...');
    await als.run({ clinicId: 1, isOwner: true, roleName: 'propietario' }, async () => {
      const result = await pdfService.generateAgendaPDF({
        date: testDate,
        slotDuration: 30,
        mode: 'daily',
      });
      assert(!!result, 'Resultado de agenda diaria 30 min retornado con éxito');
      assert(Buffer.isBuffer(result.buffer), 'El resultado contiene un Buffer binario');
      assert(result.buffer.length > 1000, `El tamaño del PDF es consistente (${result.buffer.length} bytes)`);
      const header = result.buffer.slice(0, 5).toString('utf-8');
      assert(header === '%PDF-', `El buffer es un PDF válido (cabecera: ${header})`);
      assert(result.filename === `Agenda_Dia_${testDate}.pdf`, `Nombre de archivo generado correctamente: ${result.filename}`);
      assert(result.documentNumber === 'AGE-DIA', 'Identificador de documento AGE-DIA asignado');
    });

    // 2. Probar generación de Agenda Diaria con intervalo de 15 min y 60 min
    console.log('\n🔹 2. Probando generación de Agenda con intervalos de 15 min y 60 min...');
    await als.run({ clinicId: 1, isOwner: true, roleName: 'propietario' }, async () => {
      const result15 = await pdfService.generateAgendaPDF({
        date: testDate,
        slotDuration: 15,
        mode: 'daily',
      });
      assert(Buffer.isBuffer(result15.buffer) && result15.buffer.length > 1000, 'PDF de 15 min generado exitosamente');
      assert(result15.buffer.slice(0, 5).toString('utf-8') === '%PDF-', 'Cabecera %PDF- válida en 15 min');

      const result60 = await pdfService.generateAgendaPDF({
        date: testDate,
        slotDuration: 60,
        mode: 'daily',
      });
      assert(Buffer.isBuffer(result60.buffer) && result60.buffer.length > 1000, 'PDF de 60 min generado exitosamente');
      assert(result60.buffer.slice(0, 5).toString('utf-8') === '%PDF-', 'Cabecera %PDF- válida en 60 min');
    });

    // 3. Probar múltiples citas simultáneas (4 citas al mismo tiempo en 12:30 para un doctor)
    console.log('\n🔹 3. Probando caso de múltiples citas simultáneas (4 citas en 12:30)...');
    let testDoctorId = null;
    let createdApptIds = [];
    let createdPatientIds = [];

    await als.run({ clinicId: 1, isOwner: true, roleName: 'propietario' }, async () => {
      // Buscar doctor para el test
      const docRes = await query('SELECT id FROM doctors WHERE clinic_id = 1 AND deleted_at IS NULL LIMIT 1');
      if (docRes.rows.length === 0) {
        throw new Error('No se encontró ningún doctor en la clínica 1');
      }
      testDoctorId = docRes.rows[0].id;

      // Obtener status ID programada
      const stRes = await query("SELECT id FROM appointment_status WHERE name = 'programada' LIMIT 1");
      const statusId = stRes.rows[0]?.id || 1;

      // Crear 4 pacientes de prueba con custom_id específico
      const patientData = [
        { first: 'Juan', last: 'Mederos', phone: '600111222', custom_id: '0001-2026-XUQ' },
        { first: 'Fernando', last: 'Lopez', phone: '600333444', custom_id: '0002-2026-XUQ' },
        { first: 'Maria', last: 'José', phone: '600555666', custom_id: '0003-2026-XUQ' },
        { first: 'Carlos', last: 'Ruiz', phone: '600777888', custom_id: '0004-2026-XUQ' },
      ];

      for (const p of patientData) {
        const insPat = await query(
          `INSERT INTO patients (clinic_id, first_name, last_name, phone, custom_id, created_at, updated_at)
           VALUES (1, $1, $2, $3, $4, NOW(), NOW()) RETURNING id`,
          [p.first, p.last, p.phone, p.custom_id]
        );
        createdPatientIds.push(insPat.rows[0].id);
      }

      // Crear 4 citas en 12:30
      const times = [
        { start: '12:30:00', end: '13:00:00', reason: 'Revisión periódica' },
        { start: '12:30:00', end: '12:45:00', reason: 'Ajuste de ortodoncia' },
        { start: '12:30:00', end: '12:45:00', reason: 'Retirada de puntos' },
        { start: '12:30:00', end: '12:45:00', reason: 'Urgencia menor' },
      ];

      for (let i = 0; i < 4; i++) {
        const insAppt = await query(
          `INSERT INTO appointments (clinic_id, doctor_id, patient_id, status_id, appointment_date, start_time, end_time, reason, gabinete, created_at, updated_at)
           VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()) RETURNING id`,
          [testDoctorId, createdPatientIds[i], statusId, testDate, times[i].start, times[i].end, times[i].reason, `Gabinete ${i + 1}`]
        );
        createdApptIds.push(insAppt.rows[0].id);
      }

      // Generar PDF para la fecha con las 4 citas simultáneas
      const multiResult = await pdfService.generateAgendaPDF({
        date: testDate,
        slotDuration: 30,
        doctorId: testDoctorId,
        mode: 'daily',
      });

      assert(Buffer.isBuffer(multiResult.buffer), 'PDF con 4 citas simultáneas generado como Buffer');
      assert(multiResult.buffer.length > 2000, `Tamaño del PDF con múltiples citas consistente (${multiResult.buffer.length} bytes)`);
      const pdfHeader = multiResult.buffer.slice(0, 5).toString('utf-8');
      assert(pdfHeader === '%PDF-', 'Cabecera %PDF- intacta para citas simultáneas');

      // Probar también con intervalo de 15 minutos para las mismas citas
      const multi15Result = await pdfService.generateAgendaPDF({
        date: testDate,
        slotDuration: 15,
        doctorId: testDoctorId,
        mode: 'daily',
      });
      assert(Buffer.isBuffer(multi15Result.buffer), 'PDF con citas simultáneas en intervalo de 15 min generado exitosamente');

      // 3.5. Probar que una cita de 90 min (10:00 - 11:30) ocupa todos sus slots respectivos
      console.log('\n🔹 3.5. Probando que una cita de 90 min aparece en todos los slots que ocupa...');
      const longAppt = { start_time: '10:00:00', end_time: '11:30:00' };
      const range = pdfService._getAppointmentRange(longAppt, 30);
      assert(range.s === '10:00' && range.e === '11:30', 'Rango de cita calculado correctamente: 10:00 - 11:30');

      const testSlots30 = [
        { label: '09:30', nextLabel: '10:00' },
        { label: '10:00', nextLabel: '10:30' },
        { label: '10:30', nextLabel: '11:00' },
        { label: '11:00', nextLabel: '11:30' },
        { label: '11:30', nextLabel: '12:00' },
      ];
      const matches30 = testSlots30.map(slot => range.s < slot.nextLabel && range.e > slot.label);
      assert(matches30[0] === false, 'Slot 09:30 - 10:00 no incluye la cita');
      assert(matches30[1] === true, 'Slot 10:00 - 10:30 incluye la cita (inicio)');
      assert(matches30[2] === true, 'Slot 10:30 - 11:00 incluye la cita (en curso)');
      assert(matches30[3] === true, 'Slot 11:00 - 11:30 incluye la cita (en curso final)');
      assert(matches30[4] === false, 'Slot 11:30 - 12:00 no incluye la cita');
    });

    // 4. Probar generación de Agenda Semanal (Landscape)
    console.log('\n🔹 4. Probando generación de Agenda Semanal en formato Horizontal...');
    await als.run({ clinicId: 1, isOwner: true, roleName: 'propietario' }, async () => {
      // Validar normalizador de fechas formatToYMD
      assert(pdfService.formatToYMD('2026-09-14') === '2026-09-14', 'formatToYMD normaliza string YYYY-MM-DD');
      assert(pdfService.formatToYMD('2026-09-14T00:00:00.000Z') === '2026-09-14', 'formatToYMD normaliza string ISO');
      assert(pdfService.formatToYMD(new Date('2026-09-14T12:00:00')) === '2026-09-14', 'formatToYMD normaliza objeto Date');

      const weeklyResult = await pdfService.generateAgendaPDF({
        date: testDate,
        slotDuration: 30,
        doctorId: testDoctorId,
        mode: 'weekly',
      });

      assert(Buffer.isBuffer(weeklyResult.buffer), 'Buffer de agenda semanal generado correctamente');
      assert(weeklyResult.buffer.length > 2000, `Tamaño consistente de agenda semanal (${weeklyResult.buffer.length} bytes)`);
      assert(weeklyResult.filename.startsWith('Agenda_Semanal_'), `Nombre correcto de agenda semanal: ${weeklyResult.filename}`);
      assert(weeklyResult.documentNumber === 'AGE-SEM', 'Código de documento AGE-SEM asignado');

      // Probar scope: 'both' para toda la clínica
      const weeklyBoth = await pdfService.generateAgendaPDF({
        date: testDate,
        slotDuration: 30,
        mode: 'weekly',
        scope: 'both',
      });
      assert(Buffer.isBuffer(weeklyBoth.buffer) && weeklyBoth.buffer.length > 3000, 'Agenda semanal scope=both generada');

      // Probar scope: 'doctors'
      const weeklyDoctors = await pdfService.generateAgendaPDF({
        date: testDate,
        slotDuration: 30,
        mode: 'weekly',
        scope: 'doctors',
      });
      assert(Buffer.isBuffer(weeklyDoctors.buffer) && weeklyDoctors.buffer.length > 2000, 'Agenda semanal scope=doctors generada');

      // Probar scope: 'general'
      const weeklyGeneral = await pdfService.generateAgendaPDF({
        date: testDate,
        slotDuration: 30,
        mode: 'weekly',
        scope: 'general',
      });
      assert(Buffer.isBuffer(weeklyGeneral.buffer) && weeklyGeneral.buffer.length > 2000, 'Agenda semanal scope=general generada');
    });

    // 5. Probar el controlador HTTP getAgendaPDF
    console.log('\n🔹 5. Probando controlador getAgendaPDF (vía API HTTP)...');
    await als.run({ clinicId: 1, isOwner: true, roleName: 'propietario' }, async () => {
      const req = {
        query: { date: testDate, slot_duration: '30', mode: 'daily' },
      };
      let headersSet = {};
      let sentBuffer = null;
      const res = {
        setHeader(name, value) {
          headersSet[name] = value;
        },
        send(buffer) {
          sentBuffer = buffer;
          return this;
        },
      };

      await getAgendaPDF(req, res, (err) => {
        if (err) throw err;
      });

      assert(headersSet['Content-Type'] === 'application/pdf', `Content-Type correcto: ${headersSet['Content-Type']}`);
      assert(headersSet['Content-Disposition'].includes('inline; filename="Agenda_Dia_'), `Content-Disposition inline correcto: ${headersSet['Content-Disposition']}`);
      assert(Buffer.isBuffer(sentBuffer) && sentBuffer.length > 1000, 'Buffer enviado por el controlador es válido');

      // Probar getAgendaPDF semanal con scope='doctors'
      let weeklyHeaders = {};
      let weeklySentBuffer = null;
      const resWeekly = {
        setHeader(name, value) {
          weeklyHeaders[name] = value;
        },
        send(buffer) {
          weeklySentBuffer = buffer;
          return this;
        },
      };
      await getAgendaPDF({ query: { date: testDate, slot_duration: '30', mode: 'weekly', scope: 'doctors' } }, resWeekly, (err) => {
        if (err) throw err;
      });
      assert(weeklyHeaders['Content-Disposition'].includes('inline; filename="Agenda_Semanal_'), 'Content-Disposition semanal correcto');
      assert(Buffer.isBuffer(weeklySentBuffer) && weeklySentBuffer.length > 2000, 'Buffer semanal enviado por el controlador es válido');
    });

    // Limpieza de datos de prueba
    console.log('\n🔹 [CLEANUP] Eliminando citas y pacientes de prueba...');
    if (createdApptIds.length > 0) {
      await query('DELETE FROM appointments WHERE id = ANY($1)', [createdApptIds]);
    }
    if (createdPatientIds.length > 0) {
      await query('DELETE FROM patients WHERE id = ANY($1)', [createdPatientIds]);
    }
    console.log('✅ [CLEANUP] Limpieza completada con éxito.');

  } catch (error) {
    console.error('❌ Error inesperado durante las pruebas:', error);
    failed++;
  }

  console.log('\n=============================================================');
  console.log(`  📊 RESULTADOS: ${passed} PRUEBAS EXITOSAS, ${failed} FALLIDAS`);
  console.log('=============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runAgendaPdfTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
