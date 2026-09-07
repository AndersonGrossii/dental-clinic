// ============================================
// Suite de Pruebas: Festivos y Jornadas de Fin de Semana
// ============================================
process.env.NODE_ENV = 'test';
import { query, als } from '../database/pool.js';
import holidayService from '../services/holiday.service.js';
import doctorService from '../services/doctor.service.js';
import appointmentService from '../services/appointment.service.js';
import patientService from '../services/patient.service.js';

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

const toYMD = (d) => {
  if (!d) return '';
  if (typeof d === 'string') return d.slice(0, 10);
  if (d instanceof Date) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return String(d).slice(0, 10);
};

async function runTests() {
  console.log('\n=============================================================');
  console.log('  🎉 PRUEBAS: DÍAS FESTIVOS, ALCÀNTERA DE XÚQUER Y FIN DE SEMANA');
  console.log('=============================================================\n');

  await als.run({ clinicId: 1, userId: 1 }, async () => {
    let doctorId = null;
    let ownerAppt = null;
    let weekendAppt = null;
    let workday = null;
    let patient = null;
    let customHoliday = null;

    try {
      // 1. Verificación de festivos precargados para 2026 y 2027
      console.log('🔹 [1/5] Verificación de Festivos Oficiales Pre-cargados');
      const holidays2026 = await holidayService.getHolidays(1, '2026-01-01', '2026-12-31');
      assert(holidays2026.length >= 14, 'Existen al menos 14 festivos oficiales para 2026 en clínica #1', `(Total: ${holidays2026.length})`);

      const sanJose = holidays2026.find(h => toYMD(h.holiday_date) === '2026-03-19');
      assert(sanJose && sanJose.name.includes('San José'), 'Festivo autonómico San José (19 de Marzo) presente', `(${sanJose?.name})`);

      const sanVicente = holidays2026.find(h => toYMD(h.holiday_date) === '2026-04-13');
      assert(sanVicente && sanVicente.name.includes('San Vicente Ferrer'), 'Festivo local San Vicente Ferrer (Alcàntera de Xúquer) presente', `(${sanVicente?.name})`);

      const fiestasPatronales = holidays2026.find(h => toYMD(h.holiday_date) === '2026-09-04');
      assert(fiestasPatronales && fiestasPatronales.scope === 'LOCAL', 'Festivo local Fiestas Patronales (Alcàntera de Xúquer) presente', `(${fiestasPatronales?.name})`);

      const holidays2027 = await holidayService.getHolidays(1, '2027-01-01', '2027-12-31');
      assert(holidays2027.length >= 14, 'Existen al menos 14 festivos oficiales para 2027 en clínica #1', `(Total: ${holidays2027.length})`);

      // 2. Comprobar bloqueo de citas en días festivos
      console.log('\n🔹 [2/5] Bloqueo de Citas en Días Festivos');
      const docRes = await query('SELECT id FROM doctors WHERE clinic_id = 1 LIMIT 1');
      doctorId = docRes.rows[0]?.id;
      assert(doctorId, 'Doctor disponible para pruebas', `(ID: ${doctorId})`);

      // Limpiar citas previas de prueba en esa fecha
      await query("DELETE FROM appointments WHERE appointment_date IN ('2026-05-01', '2026-05-09')");

      // Crear paciente de prueba
      patient = await patientService.create({
        first_name: 'Test',
        last_name: 'Festivo',
        email: `test.holiday.${Date.now()}@clinic.com`,
        phone: '611222333'
      }, 1);

      // Intento de agendar en festivo (2026-05-01 Fiesta del Trabajo) con rol recepcionista (userId: 2)
      let blockedRegular = false;
      try {
        await appointmentService.create({
          patient_id: patient.id,
          doctor_id: doctorId,
          appointment_date: '2026-05-01',
          start_time: '10:00',
          end_time: '10:30',
          reason: 'Consulta en festivo'
        }, 2); // userId 2 = recepcionista
      } catch (err) {
        blockedRegular = true;
        assert(err.message.includes('festivo'), 'Recepcionista bloqueado al agendar en festivo', `(Mensaje: ${err.message})`);
      }
      assert(blockedRegular, 'La agenda rechaza citas en festivos para personal regular');

      // Intento con rol 'propietario' (userId: 1) en festivo -> debe permitirse
      ownerAppt = await appointmentService.create({
        patient_id: patient.id,
        doctor_id: doctorId,
        appointment_date: '2026-05-01',
        start_time: '10:00',
        end_time: '10:30',
        reason: 'Urgencia autorizada por propietario'
      }, 1); // userId 1 = propietario
      assert(ownerAppt && ownerAppt.id, 'Propietario puede agendar excepcionalmente en día festivo', `(Cita ID: ${ownerAppt.id})`);

      // 3. Comprobar bloqueo de fines de semana
      console.log('\n🔹 [3/5] Bloqueo y Habilitación de Fines de Semana');
      // Sábado 2026-05-09 con recepcionista (userId: 2)
      let blockedWeekend = false;
      try {
        await appointmentService.create({
          patient_id: patient.id,
          doctor_id: doctorId,
          appointment_date: '2026-05-09',
          start_time: '10:00',
          end_time: '10:30',
          reason: 'Consulta sábado regular'
        }, 2);
      } catch (err) {
        blockedWeekend = true;
        assert(err.message.includes('fin de semana'), 'Recepcionista bloqueado en fin de semana', `(Mensaje: ${err.message})`);
      }
      assert(blockedWeekend, 'La agenda rechaza citas en fin de semana para personal regular');

      // 4. Habilitar fin de semana mediante doctor_workdays y verificar fallback de horario regular
      console.log('\n🔹 [4/5] Habilitación de Jornada de Fin de Semana y Fallback de Horarios');
      const currentSchedule = await doctorService.getSchedule(doctorId);
      assert(Array.isArray(currentSchedule), 'Horario regular del doctor consultado');

      // Habilitar sábado 2026-05-09 para el doctor
      workday = await doctorService.addWorkday(doctorId, {
        work_date: '2026-05-09',
        start_time: '09:00',
        end_time: '14:00',
        notes: 'Jornada especial fin de semana aprobada'
      });
      assert(workday && workday.work_date, 'Jornada de sábado registrada en doctor_workdays', `(Fecha: ${toYMD(workday.work_date)})`);

      // Propietario agenda cita en el sábado habilitado
      weekendAppt = await appointmentService.create({
        patient_id: patient.id,
        doctor_id: doctorId,
        appointment_date: '2026-05-09',
        start_time: '09:30',
        end_time: '10:00',
        reason: 'Atención sábado habilitado'
      }, 1);
      assert(weekendAppt && weekendAppt.id, 'Cita de sábado agendada con éxito por el propietario', `(Cita ID: ${weekendAppt.id})`);

      // Verificar que el horario regular de lunes (p. ej. 2026-05-11) NO se rompió por tener un workday asignado
      const mondayAvailability = await doctorService.getAvailability(doctorId, '2026-05-11');
      assert(Array.isArray(mondayAvailability) && mondayAvailability.length > 0, 
        'Disponibilidad del lunes regular preservada con fallback exitoso', 
        `(${mondayAvailability.length} slots calculados)`
      );

      // 5. Gestión CRUD de Festivos
      console.log('\n🔹 [5/5] Gestión de Festivos Personalizados (CRUD)');
      customHoliday = await holidayService.createHoliday(1, {
        holiday_date: '2026-07-20',
        name: 'Día de Confraternidad Clínica',
        scope: 'CLINICA',
        description: 'Cierre anual del equipo',
        is_full_day: true
      }, 1);
      assert(customHoliday && customHoliday.id, 'Festivo personalizado creado con éxito', `(ID: ${customHoliday.id})`);

      const isHol = await holidayService.isHoliday(1, '2026-07-20');
      assert(isHol && isHol.name === 'Día de Confraternidad Clínica', 'isHoliday detecta el nuevo festivo');

      await holidayService.deleteHoliday(customHoliday.id, 1);
      const afterDel = await holidayService.isHoliday(1, '2026-07-20');
      assert(afterDel === null, 'Festivo eliminado exitosamente de la base de datos');

    } catch (error) {
      console.error('Error fatal durante la prueba:', error);
      failed++;
    } finally {
      // Limpieza de datos de prueba
      if (ownerAppt?.id) await query('DELETE FROM appointments WHERE id = $1', [ownerAppt.id]);
      if (weekendAppt?.id) await query('DELETE FROM appointments WHERE id = $1', [weekendAppt.id]);
      if (workday?.id && doctorId) await doctorService.removeWorkday(workday.id, doctorId);
      if (patient?.id) await query('DELETE FROM patients WHERE id = $1', [patient.id]);
      if (customHoliday?.id) await query('DELETE FROM clinic_holidays WHERE id = $1', [customHoliday.id]);
    }
  });

  console.log('\n=============================================================');
  console.log(`  RESUMEN: ${passed} pasadas, ${failed} fallidas`);
  console.log('=============================================================\n');

  if (failed > 0) process.exit(1);
  else process.exit(0);
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
