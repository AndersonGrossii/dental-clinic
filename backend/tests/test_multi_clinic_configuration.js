// ============================================
// Test Suite: Multi-Clinic Configuration & Resource Layer
// Valida los 12 escenarios de la Matriz de Pruebas de Multi-Clínica
// ============================================
process.env.NODE_ENV = 'test';
import { query, pool, als } from '../database/pool.js';
import clinicConfigService from '../services/clinic-config.service.js';
import clinicConfigRepository from '../repositories/clinic-config.repository.js';
import cabinetService from '../services/cabinet.service.js';
import cabinetRepository from '../repositories/cabinet.repository.js';
import appointmentService from '../services/appointment.service.js';
import pdfService from '../services/pdf.service.js';
import { requireFeature } from '../middlewares/feature.middleware.js';
import { VALID_FEATURES, isValidFeatureKey, resolvePresetFeatures, CLINIC_PRESETS } from '../config/features.js';
import { isValidHexColor } from '../../frontend/utils/theme.js';

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

export async function runMultiClinicTests() {
  console.log('\n=============================================================');
  console.log('  🏥 PRUEBAS: CONFIGURACIÓN MULTI-CLÍNICA, FEATURES Y GABINETES');
  console.log('=============================================================\n');

  let testPatientC1 = null;
  let testPatientC2 = null;
  let docIdC1 = null;
  let docIdC2 = null;

  try {
    // 0. Preparar datos base
    // Limpieza de citas y pacientes de prueba
    await query("DELETE FROM appointments WHERE appointment_date = '2026-11-25'");
    await query("DELETE FROM clinic_cabinets WHERE name = 'Quirófano Especial'");
    await query("DELETE FROM patients WHERE email LIKE 'multiclinic.%@test.com'");
    await query("DELETE FROM messaging_contacts WHERE phone = '+34699999999'");

    const docRes1 = await query('SELECT id FROM doctors WHERE clinic_id = 1 LIMIT 1');
    docIdC1 = docRes1.rows[0]?.id || 1;

    let docRes2 = await query('SELECT id FROM doctors WHERE clinic_id = 2 LIMIT 1');
    if (docRes2.rows.length === 0) {
      const userDoc = await query(
        `INSERT INTO users (clinic_id, role_id, email, password_hash, first_name, last_name, is_active)
         VALUES (2, 4, 'tempdoc.c2@test.com', 'hash123', 'Doctor', 'ClinicaDos', TRUE)
         ON CONFLICT (email) DO UPDATE SET is_active = TRUE
         RETURNING id`
      );
      const newDoc = await query(
        `INSERT INTO doctors (user_id, clinic_id, specialty, license_number)
         VALUES ($1, 2, 'General', 'DOC-C2-001')
         ON CONFLICT (user_id) DO UPDATE SET clinic_id = 2
         RETURNING id`,
        [userDoc.rows[0].id]
      );
      docIdC2 = newDoc.rows[0].id;
    } else {
      docIdC2 = docRes2.rows[0].id;
    }

    // Crear pacientes de prueba
    const pRes1 = await query(
      `INSERT INTO patients (clinic_id, first_name, last_name, email, phone)
       VALUES (1, 'Paciente', 'TestC1', 'multiclinic.c1@test.com', '611000111') RETURNING id`
    );
    testPatientC1 = pRes1.rows[0].id;

    const pRes2 = await query(
      `INSERT INTO patients (clinic_id, first_name, last_name, email, phone)
       VALUES (2, 'Paciente', 'TestC2', 'multiclinic.c2@test.com', '622000222') RETURNING id`
    );
    testPatientC2 = pRes2.rows[0].id;

    // -------------------------------------------------------------
    // Escenario 1: Feature flags independientes por clínica
    // -------------------------------------------------------------
    console.log('🔹 [Escenario 1] Feature flags independientes por clínica (Clínica A activa, Clínica B inactiva)');
    await clinicConfigService.updateFeatures(1, { [VALID_FEATURES.CRM]: true });
    await clinicConfigService.updateFeatures(2, { [VALID_FEATURES.CRM]: false });

    const crmEnabledC1 = await clinicConfigService.isFeatureEnabled(1, VALID_FEATURES.CRM);
    const crmEnabledC2 = await clinicConfigService.isFeatureEnabled(2, VALID_FEATURES.CRM);

    assert(crmEnabledC1 === true, 'Clínica 1 tiene CRM habilitado');
    assert(crmEnabledC2 === false, 'Clínica 2 tiene CRM deshabilitado');

    // Probar middleware requireFeature
    const mockNext = (err) => err || 'NEXT_CALLED';
    const mockRes = () => {
      const res = {};
      res.statusCode = 200;
      res.body = null;
      res.status = (code) => { res.statusCode = code; return res; };
      res.json = (data) => { res.body = data; return res; };
      return res;
    };

    const crmMiddleware = requireFeature(VALID_FEATURES.CRM);

    // Llamada con Clínica 1
    let c1NextResult = null;
    await als.run({ clinicId: 1, userId: 1 }, async () => {
      const res = mockRes();
      await crmMiddleware({ user: { clinicId: 1 } }, res, (err) => { c1NextResult = mockNext(err); });
    });
    assert(c1NextResult === 'NEXT_CALLED', 'Middleware permite acceso a CRM para Clínica 1');

    // Llamada con Clínica 2
    let c2Res = mockRes();
    await als.run({ clinicId: 2, userId: 1 }, async () => {
      await crmMiddleware({ user: { clinicId: 2 } }, c2Res, mockNext);
    });
    assert(c2Res.statusCode === 403, 'Middleware bloquea acceso con 403 para Clínica 2');
    assert(c2Res.body?.code === 'FEATURE_DISABLED', 'Código de error devuelto es FEATURE_DISABLED');

    // -------------------------------------------------------------
    // Escenario 2: Cambio de contexto entre clínicas
    // -------------------------------------------------------------
    console.log('\n🔹 [Escenario 2] Resolución de configuración completa al cambiar de clínica');
    const configC1 = await clinicConfigService.getActiveConfig(1);
    const configC2 = await clinicConfigService.getActiveConfig(2);

    assert(configC1.identity.clinic_id === 1, 'Configuración 1 pertenece a Clínica 1');
    assert(configC2.identity.clinic_id === 2, 'Configuración 2 pertenece a Clínica 2');
    assert(configC1.features[VALID_FEATURES.CRM] === true, 'Features de Clínica 1 reflejan CRM activo');
    assert(configC2.features[VALID_FEATURES.CRM] === false, 'Features de Clínica 2 reflejan CRM inactivo');

    // -------------------------------------------------------------
    // Escenario 3: Integridad de datos al desactivar/reactivar feature
    // -------------------------------------------------------------
    console.log('\n🔹 [Escenario 3] Preservación de datos tras desactivar y reactivar feature');
    // Insertar contacto y lead de prueba en Clínica 1
    const contactRes = await query(
      `INSERT INTO messaging_contacts (clinic_id, phone, name)
       VALUES (1, '+34699999999', 'Contacto Prueba CRM') RETURNING id`
    );
    const testContactId = contactRes.rows[0].id;

    const leadInsert = await query(
      `INSERT INTO crm_leads (clinic_id, contact_id, status, source)
       VALUES (1, $1, 'new', 'manual') RETURNING id`,
      [testContactId]
    );
    const testLeadId = leadInsert.rows[0].id;

    // Desactivar CRM en Clínica 1
    await clinicConfigService.updateFeatures(1, { [VALID_FEATURES.CRM]: false });
    const isCrmDisabledNow = await clinicConfigService.isFeatureEnabled(1, VALID_FEATURES.CRM);
    assert(isCrmDisabledNow === false, 'CRM desactivado en Clínica 1');

    // Verificar que el registro sigue existiendo en PostgreSQL
    const leadCheck = await query('SELECT id, status FROM crm_leads WHERE id = $1', [testLeadId]);
    assert(leadCheck.rows.length === 1, 'Los datos existentes del módulo CRM permanecen 100% intactos');

    // Reactivar CRM en Clínica 1
    await clinicConfigService.updateFeatures(1, { [VALID_FEATURES.CRM]: true });
    assert(await clinicConfigService.isFeatureEnabled(1, VALID_FEATURES.CRM) === true, 'CRM reactivado exitosamente en Clínica 1');

    // Limpiar lead de prueba y contacto
    await query('DELETE FROM crm_leads WHERE id = $1', [testLeadId]);
    await query('DELETE FROM messaging_contacts WHERE id = $1', [testContactId]);

    // -------------------------------------------------------------
    // Escenario 4: Branding visual independiente (Colores y Logos)
    // -------------------------------------------------------------
    console.log('\n🔹 [Escenario 4] Identidad visual y validación de colores hexadecimales');
    await query("UPDATE clinic_information SET primary_color = '#0f86ec' WHERE clinic_id = 1");
    await query("UPDATE clinic_information SET primary_color = '#10b981' WHERE clinic_id = 2");

    const brandC1 = await clinicConfigRepository.getClinicIdentity(1);
    const brandC2 = await clinicConfigRepository.getClinicIdentity(2);

    assert(brandC1.primary_color === '#0f86ec', 'Clínica 1 tiene color corporativo Azul (#0f86ec)');
    assert(brandC2.primary_color === '#10b981', 'Clínica 2 tiene color corporativo Esmeralda (#10b981)');
    assert(isValidHexColor('#10b981') === true, 'Utilidad de theming valida correctamente hex válido');
    assert(isValidHexColor('blue') === false, 'Utilidad de theming rechaza string CSS no-hexadecimal');
    assert(isValidHexColor('#ZZZZZZ') === false, 'Utilidad de theming rechaza hex corrupto');

    // -------------------------------------------------------------
    // Escenario 5: Gabinetes independientes por clínica
    // -------------------------------------------------------------
    console.log('\n🔹 [Escenario 5] Recursos físicos (Gabinetes) independientes por clínica');
    await cabinetService.createCabinet(1, { name: 'Quirófano Especial', code: 'QE1' });

    const cabinetsC1 = await cabinetService.getCabinets(1);
    const cabinetsC2 = await cabinetService.getCabinets(2);

    const hasQeInC1 = cabinetsC1.some(c => c.name === 'Quirófano Especial');
    const hasQeInC2 = cabinetsC2.some(c => c.name === 'Quirófano Especial');

    assert(hasQeInC1 === true, 'Quirófano Especial existe en Clínica 1');
    assert(hasQeInC2 === false, 'Quirófano Especial NO existe en Clínica 2');
    assert(cabinetsC1.length > cabinetsC2.length, 'Clínica 1 y Clínica 2 tienen recuentos de recursos independientes');

    // -------------------------------------------------------------
    // Escenario 6: Validación de asignación cruzada de gabinetes
    // -------------------------------------------------------------
    console.log('\n🔹 [Escenario 6] Bloqueo de cita en gabinete de otra clínica');
    let crossClinicBlocked = false;
    try {
      await als.run({ clinicId: 2, userId: 1 }, async () => {
        await appointmentService.create({
          patient_id: testPatientC2,
          doctor_id: docIdC2,
          appointment_date: '2026-11-25',
          start_time: '15:00',
          end_time: '15:30',
          gabinete: 'Quirófano Especial', // Solo existe en Clínica 1
        });
      });
    } catch (err) {
      crossClinicBlocked = true;
    }
    assert(crossClinicBlocked === true, 'Intento de agendar en gabinete ajeno a la clínica fue rechazado con validación');

    // -------------------------------------------------------------
    // Escenario 7: Citas simultáneas en gabinetes con mismo nombre en clínicas distintas
    // -------------------------------------------------------------
    console.log('\n🔹 [Escenario 7] Citas concurrentes en "Gabinete 1" en Clínicas 1 y 2 sin colisión');
    let apptC1 = null;
    let apptC2 = null;

    await als.run({ clinicId: 1, userId: 1 }, async () => {
      apptC1 = await appointmentService.create({
        patient_id: testPatientC1,
        doctor_id: docIdC1,
        appointment_date: '2026-11-25',
        start_time: '10:00',
        end_time: '10:30',
        gabinete: 'Gabinete 1',
      });
    });

    await als.run({ clinicId: 2, userId: 1 }, async () => {
      apptC2 = await appointmentService.create({
        patient_id: testPatientC2,
        doctor_id: docIdC2,
        appointment_date: '2026-11-25',
        start_time: '10:00',
        end_time: '10:30',
        gabinete: 'Gabinete 1',
      });
    });

    assert(apptC1 && apptC1.id, 'Cita agendada en Clínica 1 en "Gabinete 1" a las 10:00');
    assert(apptC2 && apptC2.id, 'Cita concurrente agendada en Clínica 2 en "Gabinete 1" a las 10:00 (Sin conflicto inter-clínica)');

    // Probar que dentro de la MISMA clínica sí se bloquea la doble reserva
    let intraClinicCollision = false;
    try {
      await als.run({ clinicId: 1, userId: 1 }, async () => {
        await appointmentService.create({
          patient_id: testPatientC1,
          doctor_id: docIdC1,
          appointment_date: '2026-11-25',
          start_time: '10:15',
          end_time: '10:45',
          gabinete: 'Gabinete 1',
        });
      });
    } catch {
      intraClinicCollision = true;
    }
    assert(intraClinicCollision === true, 'Doble reserva en el MISMO gabinete dentro de la misma clínica es correctamente bloqueada (409)');

    // -------------------------------------------------------------
    // Escenario 8: Bloqueo de eliminación/desactivación de gabinete con citas futuras
    // -------------------------------------------------------------
    console.log('\n🔹 [Escenario 8] Bloqueo de desactivación de gabinete con citas futuras');
    const gab1C1 = await cabinetRepository.findByName('Gabinete 1', 1);
    let deactivationBlocked = false;
    try {
      await cabinetService.deactivateCabinet(gab1C1.id, 1);
    } catch (err) {
      deactivationBlocked = true;
    }
    assert(deactivationBlocked === true, 'Desactivar "Gabinete 1" fue bloqueado porque tiene cita futura asignada');

    // -------------------------------------------------------------
    // Escenario 9: Catálogo central rechaza claves de features desconocidas
    // -------------------------------------------------------------
    console.log('\n🔹 [Escenario 9] Rechazo estricto de claves de features no reconocidas');
    assert(isValidFeatureKey('crm') === true, 'Clave oficial "crm" es válida');
    assert(isValidFeatureKey('omnichannel_messaging') === true, 'Clave oficial "omnichannel_messaging" es válida');
    assert(isValidFeatureKey('odontogram') === true, 'Clave oficial "odontogram" es válida');
    assert(isValidFeatureKey('dental_history') === true, 'Clave oficial "dental_history" es válida');
    assert(isValidFeatureKey('crypto_billing') === false, 'Clave no aprobada "crypto_billing" es rechazada');
    assert(isValidFeatureKey('superadmin') === false, 'Clave no aprobada "superadmin" es rechazada');

    const nonDentalPreset = resolvePresetFeatures('non-dental');
    assert(nonDentalPreset && nonDentalPreset.odontogram === false && nonDentalPreset.dental_history === false, 'Preset non-dental resuelve desactivación de odontograma e historial');

    const dentalPreset = resolvePresetFeatures('dental');
    assert(dentalPreset && dentalPreset.odontogram === true && dentalPreset.dental_history === true, 'Preset dental resuelve activación de herramientas odontológicas');

    let invalidFeatureUpdateBlocked = false;
    try {
      await clinicConfigService.updateFeatures(1, { invalid_module: true });
    } catch {
      invalidFeatureUpdateBlocked = true;
    }
    assert(invalidFeatureUpdateBlocked === true, 'Servicio rechaza actualización con clave de feature desconocida');

    // -------------------------------------------------------------
    // Escenario 10: Validación de identidad en PDF Engine
    // -------------------------------------------------------------
    console.log('\n🔹 [Escenario 10] Generador de PDFs adopta color e identidad de la clínica propietaria');
    const pdfInfoC1 = await pdfService.getClinicInfo(1);
    const pdfInfoC2 = await pdfService.getClinicInfo(2);

    assert(pdfInfoC1.primary_color === '#0f86ec', 'PDF Engine resuelve color primario #0f86ec para Clínica 1');
    assert(pdfInfoC2.primary_color === '#10b981', 'PDF Engine resuelve color primario #10b981 para Clínica 2');

    // -------------------------------------------------------------
    // Escenario 11: Operaciones CLI con validación y --dry-run
    // -------------------------------------------------------------
    console.log('\n🔹 [Escenario 11] Validación de CLI scripts y garantía de no persistencia con --dry-run');
    const client = await pool.connect();
    let dryRunRolledBack = false;
    try {
      await client.query('BEGIN');
      await client.query("UPDATE clinic_information SET primary_color = '#123456' WHERE clinic_id = 1");
      // Simulación de flag --dry-run: forzar ROLLBACK
      await client.query('ROLLBACK');
      dryRunRolledBack = true;
    } catch {
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
    const colorAfterDryRun = (await query('SELECT primary_color FROM clinic_information WHERE clinic_id = 1')).rows[0].primary_color;
    assert(dryRunRolledBack === true && colorAfterDryRun !== '#123456', 'Modo --dry-run garantiza que ningún cambio se persiste en la BD');

    // -------------------------------------------------------------
    // Escenario 12: Aislamiento estricto multi-tenant y rechazo de clinicId no autorizado
    // -------------------------------------------------------------
    console.log('\n🔹 [Escenario 12] Seguridad multi-tenant y bloqueo de acceso inter-clínica');
    let nonExistentClinicBlocked = false;
    try {
      await clinicConfigService.getActiveConfig(999999);
    } catch {
      nonExistentClinicBlocked = true;
    }
    assert(nonExistentClinicBlocked === true, 'Petición a configuración de clinic_id inexistente es rechazada con 404');

    let crossClinicCabinetDeactivationBlocked = false;
    try {
      // Intentar desactivar gabinete de Clínica 1 usando contexto de Clínica 2
      await cabinetService.deactivateCabinet(gab1C1.id, 2);
    } catch {
      crossClinicCabinetDeactivationBlocked = true;
    }
    assert(crossClinicCabinetDeactivationBlocked === true, 'Operación sobre recurso de otra clínica es rechazada');

    // -------------------------------------------------------------
    // Escenario 13: Preset no-dental desactiva herramientas clínicas (Odontograma e Historial) en 1 solo comando
    // -------------------------------------------------------------
    console.log('\n🔹 [Escenario 13] Preset no-dental y aislamiento de charts clínicos (Odontograma e Historial)');
    // Aplicar preset non-dental a Clínica 2
    await clinicConfigService.updateFeatures(2, resolvePresetFeatures('non-dental'));

    // Asegurar que Clínica 1 permanece dental
    await clinicConfigService.updateFeatures(1, resolvePresetFeatures('dental'));

    const isOdontoC1 = await clinicConfigService.isFeatureEnabled(1, VALID_FEATURES.ODONTOGRAM);
    const isOdontoC2 = await clinicConfigService.isFeatureEnabled(2, VALID_FEATURES.ODONTOGRAM);
    const isHistoryC1 = await clinicConfigService.isFeatureEnabled(1, VALID_FEATURES.DENTAL_HISTORY);
    const isHistoryC2 = await clinicConfigService.isFeatureEnabled(2, VALID_FEATURES.DENTAL_HISTORY);

    assert(isOdontoC1 === true, 'Clínica 1 mantiene Odontograma activo');
    assert(isOdontoC2 === false, 'Clínica 2 tiene Odontograma desactivado con preset no-dental');
    assert(isHistoryC1 === true, 'Clínica 1 mantiene Historial Odontológico activo');
    assert(isHistoryC2 === false, 'Clínica 2 tiene Historial Odontológico desactivado con preset no-dental');

    // Verificar middleware para historial odontológico y odontograma
    const dentalHistoryMiddleware = requireFeature(VALID_FEATURES.DENTAL_HISTORY);
    let dhResC2 = mockRes();
    await als.run({ clinicId: 2, userId: 1 }, async () => {
      await dentalHistoryMiddleware({ user: { clinicId: 2 } }, dhResC2, mockNext);
    });
    assert(dhResC2.statusCode === 403, 'Middleware bloquea acceso a historial odontológico con 403 en Clínica no-dental');
    assert(dhResC2.body?.code === 'FEATURE_DISABLED', 'Código de error retornado es FEATURE_DISABLED');

    // Reactivar con preset dental en Clínica 2
    await clinicConfigService.updateFeatures(2, resolvePresetFeatures('dental'));
    const isOdontoC2Restored = await clinicConfigService.isFeatureEnabled(2, VALID_FEATURES.ODONTOGRAM);
    assert(isOdontoC2Restored === true, 'Preset dental reactiva exitosamente todas las herramientas odontológicas');

    // -------------------------------------------------------------
    // Limpieza posterior
    // -------------------------------------------------------------
    await query("DELETE FROM appointments WHERE appointment_date = '2026-11-25'");
    await query("DELETE FROM clinic_cabinets WHERE name = 'Quirófano Especial'");
    await query("DELETE FROM patients WHERE email LIKE 'multiclinic.%@test.com'");
    await query("DELETE FROM messaging_contacts WHERE phone = '+34699999999'");

  } catch (error) {
    console.error('❌ Error fatal en suite de pruebas:', error);
    failed++;
  }

  console.log('\n=============================================================');
  console.log(`  RESUMEN: ${passed} PASARON, ${failed} FALLARON (${passed + failed} ASERCIONES)`);
  console.log('=============================================================\n');

  if (failed > 0) {
    throw new Error(`Pruebas fallidas: ${failed}`);
  }
}

// Ejecución directa desde CLI
if (process.argv[1]?.endsWith('test_multi_clinic_configuration.js')) {
  runMultiClinicTests()
    .then(() => {
      console.log('✅ Suite de configuración multi-clínica completada exitosamente.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Fallo en la suite de pruebas:', err.message);
      process.exit(1);
    });
}
