// ============================================
// Prueba de Aislamiento Multi-Tenant (Cross-Clinic Security Isolation)
// Verifica que los datos de la Clínica 1 son inaccesibles e inmutables desde la Clínica 2
// ============================================
process.env.NODE_ENV = 'test';
import { query, als } from '../database/pool.js';
import patientService from '../services/patient.service.js';
import appointmentService from '../services/appointment.service.js';

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

async function runIsolationTests() {
  console.log('\n=============================================================');
  console.log('  🔒 PRUEBAS: AISLAMIENTO MULTI-TENANT Y SEGURIDAD ENTRE CLÍNICAS');
  console.log('=============================================================\n');

  let patientC1 = null;
  let apptC1 = null;

  try {
    // Limpieza preventiva de pruebas anteriores
    await query("DELETE FROM appointments WHERE appointment_date = '2026-11-20'");
    await query("DELETE FROM patients WHERE email LIKE 'isolation.%@clinic1.com'");

    // -----------------------------------------------------------------
    // 1. Crear datos de prueba en Clínica 1
    // -----------------------------------------------------------------
    console.log('🔹 [1/4] Creación de Paciente y Cita en Clínica #1 (Vides Dental Xuquer)');
    await als.run({ clinicId: 1, userId: 1 }, async () => {
      const uniqueSuffix = Date.now();
      patientC1 = await patientService.create({
        first_name: 'Aislamiento',
        last_name: `ClinicaUno_${uniqueSuffix}`,
        dni: `ISOL${uniqueSuffix.toString().slice(-5)}`,
        phone: '699000111',
        email: `isolation.${uniqueSuffix}@clinic1.com`,
      });
      assert(patientC1 && patientC1.id, 'Paciente creado en Clínica #1', `(ID: ${patientC1.id})`);

      // Obtener doctor disponible en Clínica 1
      const docRes = await query('SELECT id FROM doctors WHERE clinic_id = 1 LIMIT 1');
      const doctorId = docRes.rows[0]?.id || 1;

      // Crear cita para el paciente en Clínica 1
      apptC1 = await appointmentService.create({
        patient_id: patientC1.id,
        doctor_id: doctorId,
        appointment_date: '2026-11-20',
        start_time: '11:00',
        end_time: '11:30',
        reason: 'Revisión de Aislamiento Tenant',
        cabinet: 'Gabinete 1',
      });
      assert(apptC1 && apptC1.id, 'Cita médica creada en Clínica #1', `(Cita ID: ${apptC1.id})`);
    });

    // -----------------------------------------------------------------
    // 2. Intentar leer datos de Clínica 1 desde el contexto de Clínica 2
    // -----------------------------------------------------------------
    console.log('\n🔹 [2/4] Verificación de Aislamiento de Lectura desde Clínica #2 (Vides Dental Cabanes)');
    await als.run({ clinicId: 2, userId: 2 }, async () => {
      // 2a. Intento de leer paciente de Clínica 1 por ID directo
      let readPatientFailed = false;
      try {
        const readResult = await patientService.getById(patientC1.id);
        if (!readResult) readPatientFailed = true;
      } catch (err) {
        readPatientFailed = true;
      }
      assert(readPatientFailed, 'Usuario en Clínica #2 NO puede leer expediente de paciente de Clínica #1');

      // 2b. Intento de listar pacientes en Clínica 2 (el de Clínica 1 no debe aparecer)
      const listC2 = await patientService.getAll({ limit: 100 });
      const patientRows = listC2?.rows || listC2?.data || (Array.isArray(listC2) ? listC2 : []);
      const foundInList = patientRows.some(p => p.id === patientC1.id);
      assert(!foundInList, 'Paciente de Clínica #1 NO aparece en el listado general de Clínica #2');

      // 2c. Intento de leer cita de Clínica 1 por ID directo
      let readApptFailed = false;
      try {
        const readAppt = await appointmentService.getById(apptC1.id);
        if (!readAppt) readApptFailed = true;
      } catch (err) {
        readApptFailed = true;
      }
      assert(readApptFailed, 'Usuario en Clínica #2 NO puede leer cita de Clínica #1');

      // 2d. Intento de listar citas en Clínica 2
      const apptListC2 = await appointmentService.getAll({ limit: 100 });
      const apptRows = apptListC2?.data || apptListC2?.rows || (Array.isArray(apptListC2) ? apptListC2 : []);
      const foundApptInList = apptRows.some(a => a.id === apptC1.id);
      assert(!foundApptInList, 'Cita de Clínica #1 NO aparece en la agenda de Clínica #2');
    });

    // -----------------------------------------------------------------
    // 3. Intentar mutar datos de Clínica 1 desde el contexto de Clínica 2
    // -----------------------------------------------------------------
    console.log('\n🔹 [3/4] Verificación de Aislamiento de Escritura/Modificación desde Clínica #2');
    await als.run({ clinicId: 2, userId: 2 }, async () => {
      // 3a. Intento de modificar paciente de Clínica 1 desde Clínica 2
      let updateFailed = false;
      try {
        await patientService.update(patientC1.id, { first_name: 'HackeadoDesdeClinica2' });
      } catch (err) {
        updateFailed = true;
      }
      assert(updateFailed, 'Usuario en Clínica #2 NO puede modificar paciente de Clínica #1');

      // 3b. Intento de eliminar paciente de Clínica 1 desde Clínica 2
      let deleteFailed = false;
      try {
        await patientService.delete(patientC1.id);
      } catch (err) {
        deleteFailed = true;
      }
      assert(deleteFailed, 'Usuario en Clínica #2 NO puede eliminar paciente de Clínica #1');

      // 3c. Intento de cancelar cita de Clínica 1 desde Clínica 2
      let cancelApptFailed = false;
      try {
        await appointmentService.delete(apptC1.id);
      } catch (err) {
        cancelApptFailed = true;
      }
      assert(cancelApptFailed, 'Usuario en Clínica #2 NO puede cancelar cita de Clínica #1');
    });

    // -----------------------------------------------------------------
    // 4. Limpieza y Teardown
    // -----------------------------------------------------------------
    console.log('\n🔹 [4/4] Limpieza de Registros de Prueba de Aislamiento');
    await als.run({ clinicId: 1, userId: 1 }, async () => {
      if (apptC1 && apptC1.id) {
        await query('DELETE FROM appointments WHERE id = $1', [apptC1.id]);
        assert(true, 'Cita de prueba de aislamiento eliminada correctamente');
      }
      if (patientC1 && patientC1.id) {
        await query('DELETE FROM patients WHERE id = $1', [patientC1.id]);
        assert(true, 'Paciente de prueba de aislamiento limpiado correctamente');
      }
    });

    console.log('\n=============================================================');
    console.log(`  📊 RESULTADOS AISLAMIENTO: ${passed} PRUEBAS EXITOSAS, ${failed} FALLIDAS`);
    console.log('=============================================================\n');

    return { passed, failed };
  } catch (err) {
    console.error('\n❌ ERROR FATAL EN PRUEBA DE AISLAMIENTO:', err);
    // Limpieza de emergencia
    if (patientC1 && patientC1.id) {
      await query('DELETE FROM patients WHERE id = $1', [patientC1.id]).catch(() => {});
    }
    return { passed, failed: failed + 1 };
  }
}

// Ejecutar si se invoca directamente
if (process.argv[1]?.endsWith('test_multi_tenant_isolation.js')) {
  runIsolationTests().then(({ failed }) => {
    process.exit(failed > 0 ? 1 : 0);
  });
}

export default runIsolationTests;
