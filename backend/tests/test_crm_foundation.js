// ============================================
// Suite de Pruebas Automatizadas: CRM Foundation & Commercial Pipeline
// Verifica catálogos, RBAC, aislamiento multi-tenant, ciclo de vida de leads,
// oportunidades, separación de notas clínicas y trazabilidad de actividades.
// ============================================
process.env.NODE_ENV = 'test';
import { query, als } from '../database/pool.js';
import crmService from '../services/crm.service.js';
import crmLeadRepository from '../repositories/crm-lead.repository.js';
import crmOpportunityRepository from '../repositories/crm-opportunity.repository.js';
import crmNoteRepository from '../repositories/crm-note.repository.js';
import crmActivityRepository from '../repositories/crm-activity.repository.js';
import { staffOnly } from '../middlewares/role.middleware.js';
import * as crmController from '../controllers/crm.controller.js';

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

async function runCrmFoundationTests() {
  console.log('\n=============================================================');
  console.log('  🎯 PRUEBAS: DOMINIO CRM, PIPELINE COMERCIAL & SEGURIDAD');
  console.log('=============================================================\n');

  try {
    // Limpieza preventiva de datos de test previos
    await query("DELETE FROM crm_activities WHERE title LIKE '%TestCRM%' OR title LIKE '%Lead convertido%'");
    await query("DELETE FROM crm_notes WHERE note LIKE '%Test CRM%'");
    await query("DELETE FROM crm_opportunities WHERE name LIKE 'Test Oportunidad%' OR name LIKE '%TestCRM%'");
    await query("DELETE FROM crm_leads WHERE interest LIKE '%TestCRM%'");
    await query("DELETE FROM messaging_contacts WHERE phone LIKE '999999%'");
    await query("DELETE FROM patients WHERE email LIKE '%@testcrm.com' OR first_name LIKE 'TestCRM%' OR last_name LIKE '%TestCRM%'");

    // -----------------------------------------------------------------
    // 1. Catálogos y Esquema de Base de Datos
    // -----------------------------------------------------------------
    console.log('🔹 [1/8] Verificación de Catálogos, Tablas y Permisos CRM');
    const sourcesRes = await query('SELECT code, name FROM crm_lead_sources ORDER BY code');
    assert(sourcesRes.rows.length >= 5, 'Fuentes de Lead precargadas en crm_lead_sources', `(${sourcesRes.rows.length} orígenes encontrados)`);

    const sourceCodes = sourcesRes.rows.map(s => s.code);
    assert(sourceCodes.includes('whatsapp') && sourceCodes.includes('instagram') && sourceCodes.includes('manual'), 'Contiene fuentes whatsapp, instagram y manual');

    // Verificar permisos asignados a roles de staff
    const permsRes = await query(`
      SELECT p.name, r.name AS role_name
      FROM role_permissions rp
      JOIN permissions p ON p.id = rp.permission_id
      JOIN roles r ON r.id = rp.role_id
      WHERE p.module = 'crm'
    `);
    assert(permsRes.rows.length > 0, 'Permisos del módulo CRM configurados en role_permissions');

    const roleNamesWithCrm = [...new Set(permsRes.rows.map(r => r.role_name))];
    assert(
      !roleNamesWithCrm.includes('doctor') && !roleNamesWithCrm.includes('higienista'),
      'Doctores e higienistas NO poseen permisos CRM en la base de datos',
      `Roles con acceso: ${roleNamesWithCrm.join(', ')}`
    );

    // -----------------------------------------------------------------
    // 2. Control de Acceso RBAC (Middleware staffOnly)
    // -----------------------------------------------------------------
    console.log('\n🔹 [2/8] Verificación de Control de Acceso RBAC (staffOnly)');
    let doctorBlocked = false;
    let hygienistBlocked = false;
    let receptionistAllowed = false;
    let ownerAllowed = false;

    const mockRes = (onStatus) => ({
      status: (code) => {
        onStatus(code);
        return { json: () => {} };
      }
    });

    // Probar Doctor
    staffOnly(
      { user: { roleName: 'doctor' } },
      mockRes((code) => { if (code === 403) doctorBlocked = true; }),
      () => {}
    );
    assert(doctorBlocked, 'Doctor bloqueado con HTTP 403 Forbidden');

    // Probar Higienista
    staffOnly(
      { user: { roleName: 'higienista' } },
      mockRes((code) => { if (code === 403) hygienistBlocked = true; }),
      () => {}
    );
    assert(hygienistBlocked, 'Higienista bloqueado con HTTP 403 Forbidden');

    // Probar Recepcionista
    staffOnly(
      { user: { roleName: 'recepcionista' } },
      mockRes(() => {}),
      () => { receptionistAllowed = true; }
    );
    assert(receptionistAllowed, 'Recepcionista permitido para operar en el CRM');

    // Probar Propietario
    staffOnly(
      { user: { roleName: 'propietario' } },
      mockRes(() => {}),
      () => { ownerAllowed = true; }
    );
    assert(ownerAllowed, 'Propietario permitido para operar en el CRM');

    // -----------------------------------------------------------------
    // 3. Creación de Lead e Identidad Única de Contacto (Clínica 1)
    // -----------------------------------------------------------------
    console.log('\n🔹 [3/8] Creación de Lead y Reutilización de Identidad de Contacto');
    let leadC1 = null;
    let contactC1 = null;

    await als.run({ clinicId: 1, userId: 1 }, async () => {
      leadC1 = await crmService.createLead({
        clinicId: 1,
        phone: '999999001',
        name: 'Carlos Santana Prospecto',
        email: 'carlos.santana@testcrm.com',
        source: 'whatsapp',
        status: 'new',
        interest: 'Tratamiento Ortodoncia Invisible TestCRM',
        notes: 'Interesado en presupuesto de Invisalign',
        userId: 1,
      });

      assert(leadC1 && leadC1.id, 'Lead creado exitosamente en Clínica 1', `(Lead ID: ${leadC1.id})`);
      assert(leadC1.contact_id, 'Lead vinculado a contacto en messaging_contacts', `(Contact ID: ${leadC1.contact_id})`);
      assert(leadC1.status === 'new', 'Estado inicial del Lead es "new"');

      contactC1 = leadC1.contact_id;

      // 3.1. Verificación de Detección de Duplicados (checkDuplicate)
      const dupCheckPhone = await crmService.checkDuplicate({ phone: '999999001' }, 1);
      assert(dupCheckPhone.exists === true, 'checkDuplicate detecta existencia por teléfono');
      assert(dupCheckPhone.activeLead && dupCheckPhone.activeLead.id === leadC1.id, 'checkDuplicate retorna el lead activo existente');
      assert(dupCheckPhone.contact && dupCheckPhone.contact.id === contactC1, 'checkDuplicate retorna el contacto existente');

      const dupCheckEmail = await crmService.checkDuplicate({ email: 'carlos.santana@testcrm.com' }, 1);
      assert(dupCheckEmail.exists === true, 'checkDuplicate detecta existencia por email');
      assert(dupCheckEmail.activeLead && dupCheckEmail.activeLead.id === leadC1.id, 'checkDuplicate retorna lead activo por email');

      const dupCheckNone = await crmService.checkDuplicate({ phone: '999000111' }, 1);
      assert(dupCheckNone.exists === false && dupCheckNone.patient === null && dupCheckNone.activeLead === null, 'checkDuplicate retorna exists: false para teléfono inexistente');

      // 3.2. Bloqueo de creación de Lead duplicado cuando ya existe uno activo (allowDuplicate !== true)
      let duplicateBlocked = false;
      try {
        await crmService.createLead({
          clinicId: 1,
          phone: '999999001',
          name: 'Carlos Santana Prospecto',
          source: 'instagram',
          status: 'contacted',
          interest: 'Implante Dental TestCRM',
          userId: 1,
        });
      } catch (err) {
        duplicateBlocked = (err.name === 'ValidationError' || err.statusCode === 400) && err.message.includes('Ya existe un lead activo');
      }
      assert(duplicateBlocked, 'Rechaza creación de lead duplicado con ValidationError si allowDuplicate no es true');

      // 3.3. Creación permitida cuando se especifica explícitamente allowDuplicate: true
      const leadC1Second = await crmService.createLead({
        clinicId: 1,
        phone: '999999001',
        name: 'Carlos Santana Prospecto',
        source: 'instagram',
        status: 'contacted',
        interest: 'Implante Dental TestCRM',
        userId: 1,
        allowDuplicate: true,
      });

      assert(
        leadC1Second.contact_id === contactC1,
        'Identidad compartida: reutiliza el mismo contact_id sin duplicar contacto',
        `(Contact ID: ${leadC1Second.contact_id})`
      );

      // 3.4. Detección y vinculación automática a Paciente existente
      const pTestRes = await query(
        `INSERT INTO patients (clinic_id, first_name, last_name, phone, email, created_at, updated_at)
         VALUES (1, 'PacienteExistente', 'TestCRM', '999999099', 'existente@testcrm.com', NOW(), NOW())
         RETURNING id, custom_id`
      );
      const existingPatId = pTestRes.rows[0].id;

      const dupCheckPatient = await crmService.checkDuplicate({ phone: '999999099' }, 1);
      assert(dupCheckPatient.exists === true, 'checkDuplicate detecta paciente preexistente');
      assert(dupCheckPatient.patient && dupCheckPatient.patient.id === existingPatId, 'checkDuplicate retorna datos de paciente existente');

      const leadWithAutoPatient = await crmService.createLead({
        clinicId: 1,
        phone: '999999099',
        name: 'Paciente Existente Lead',
        source: 'manual',
        interest: 'Revision TestCRM',
        userId: 1,
        estimated_value: 1250.00,
        notes: 'Nota para el paciente existente Test CRM',
      });
      assert(leadWithAutoPatient.patient_id === existingPatId, 'createLead vincula automáticamente patient_id si el paciente ya existe');
      assert(leadWithAutoPatient.status === 'converted', 'El lead se marca automáticamente como "converted" para no quedar frío en nuevos');
      assert(leadWithAutoPatient.convertedToOpportunity === true, 'createLead marca la bandera convertedToOpportunity');
      assert(leadWithAutoPatient.isPatient === true, 'createLead marca la bandera isPatient');
      assert(leadWithAutoPatient.opportunity && leadWithAutoPatient.opportunity.patient_id === existingPatId, 'Oportunidad creada automáticamente vinculada al paciente existente');
      assert(parseFloat(leadWithAutoPatient.opportunity.estimated_value) === 1250.00, 'Oportunidad creada con el valor estimado asignado');

      // Verificar que la oportunidad existe en la base de datos crm_opportunities
      const dbOpp = await crmOpportunityRepository.findById(leadWithAutoPatient.opportunity.id);
      assert(dbOpp && dbOpp.patient_id === existingPatId, 'Oportunidad persistida en crm_opportunities con patient_id correcto');
      assert(dbOpp.status === 'open', 'Oportunidad creada con estado "open"');
      assert(dbOpp.lead_id === leadWithAutoPatient.id, 'Oportunidad vinculada al lead_id');

      // Verificar que la nota fue vinculada a la oportunidad
      const oppNotes = await query('SELECT * FROM crm_notes WHERE opportunity_id = $1', [dbOpp.id]);
      assert(oppNotes.rows.length > 0 && oppNotes.rows[0].note.includes('Test CRM'), 'Nota comercial vinculada a la nueva oportunidad');

      // Verificar que se registró la actividad de auditoría en crm_activities
      const autoLeadActivities = await crmActivityRepository.findByLeadId(leadWithAutoPatient.id, 1);
      const hasOppActivity = autoLeadActivities.some(a => a.activity_type === 'OPPORTUNITY_CREATED_FOR_PATIENT');
      assert(hasOppActivity, 'Actividad OPPORTUNITY_CREATED_FOR_PATIENT registrada en auditoría del CRM');

      // 3.5. Verificación del Controlador checkDuplicate (HTTP API endpoint)
      let controllerCheckSuccess = false;
      let controllerCheckData = null;
      await crmController.checkDuplicate(
        { query: { phone: '999999001' }, user: { clinicId: 1, id: 1 } },
        {
          status: (code) => ({
            json: (payload) => {
              if (code === 200 && payload.success) {
                controllerCheckSuccess = true;
                controllerCheckData = payload.data;
              }
            }
          })
        },
        () => {}
      );
      assert(controllerCheckSuccess && controllerCheckData?.exists === true, 'Controlador checkDuplicate responde HTTP 200 con payload estructurado');
    });

    // -----------------------------------------------------------------
    // 4. Transiciones de Estado del Lead y Timestamps de Conversión
    // -----------------------------------------------------------------
    console.log('\n🔹 [4/8] Transiciones de Estado y Métricas del Embudo');
    await als.run({ clinicId: 1, userId: 1 }, async () => {
      // Pasar a contactado
      const contacted = await crmService.updateLeadStatus(leadC1.id, 'contacted', { userId: 1, clinicId: 1 });
      assert(contacted.status === 'contacted', 'Lead actualizado a estado "contacted"');

      // Pasar a cita programada
      const scheduled = await crmService.updateLeadStatus(leadC1.id, 'appointment_scheduled', { userId: 1, clinicId: 1 });
      assert(scheduled.status === 'appointment_scheduled', 'Lead actualizado a estado "appointment_scheduled"');

      // Convertir a paciente
      const converted = await crmService.updateLeadStatus(leadC1.id, 'converted', { userId: 1, clinicId: 1 });
      assert(converted.status === 'converted', 'Lead convertido exitosamente ("converted")');
      assert(converted.converted_at !== null, 'Timestamp converted_at registrado adecuadamente');

      // Crear otro lead y marcarlo como perdido con motivo
      const lostLead = await crmService.createLead({
        clinicId: 1,
        phone: '999999002',
        name: 'Lead Perdido Test',
        source: 'website',
        status: 'contacted',
        interest: 'Blanqueamiento TestCRM',
        userId: 1,
      });

      const updatedLost = await crmService.updateLeadStatus(lostLead.id, 'lost', {
        lossReason: 'Precio fuera de presupuesto',
        userId: 1,
        clinicId: 1,
      });
      assert(updatedLost.status === 'lost', 'Lead marcado como "lost"');
      assert(updatedLost.loss_reason === 'Precio fuera de presupuesto', 'Motivo de pérdida registrado');
      assert(updatedLost.lost_at !== null, 'Timestamp lost_at registrado');
    });

    // -----------------------------------------------------------------
    // 5. Oportunidades Comerciales y Trazabilidad de Pipeline
    // -----------------------------------------------------------------
    console.log('\n🔹 [5/8] Oportunidades Comerciales (Pipeline de Ventas)');
    let oppC1 = null;

    await als.run({ clinicId: 1, userId: 1 }, async () => {
      oppC1 = await crmService.createOpportunity({
        clinicId: 1,
        contactId: contactC1,
        leadId: leadC1.id,
        name: 'Test Oportunidad Ortodoncia Completa',
        estimatedValue: 3500.00,
        status: 'open',
        serviceInterest: 'Ortodoncia Invisible',
        userId: 1,
      });

      assert(oppC1 && oppC1.id, 'Oportunidad creada en Clínica 1', `(ID: ${oppC1.id}, Valor: ${oppC1.estimated_value}€)`);
      assert(oppC1.status === 'open', 'Estado inicial de la oportunidad establecido ("open")');

      // Actualizar a ganada (won)
      const wonOpp = await crmService.updateOpportunityStatus(oppC1.id, 'won', { userId: 1, clinicId: 1 });
      assert(wonOpp.status === 'won', 'Oportunidad actualizada a estado "won"');
      assert(wonOpp.won_at !== null, 'Timestamp won_at registrado');
    });

    // -----------------------------------------------------------------
    // 6. Separación Estricta: Notas de CRM vs Historia Clínica & Auditoría
    // -----------------------------------------------------------------
    console.log('\n🔹 [6/8] Separación Estricta de Notas Comerciales y Actividades');
    await als.run({ clinicId: 1, userId: 1 }, async () => {
      const crmNote = await crmService.addNote({
        clinicId: 1,
        contactId: contactC1,
        leadId: leadC1.id,
        opportunityId: oppC1.id,
        authorId: 1,
        note: 'Test CRM: Paciente solicita pagar en 12 cuotas sin intereses',
      });

      assert(crmNote && crmNote.id, 'Nota comercial de CRM creada', `(ID: ${crmNote.id})`);

      // Verificar que la nota NO existe en la tabla de historia clínica / clinical notes
      const clinicalCheck = await query(
        "SELECT * FROM medical_history WHERE notes LIKE '%Test CRM: Paciente solicita%'"
      );
      assert(clinicalCheck.rows.length === 0, 'La nota comercial NO contaminó la historia clínica (medical_history)');

      // Verificar registro de actividades en crm_activities
      const activities = await crmActivityRepository.findByLeadId(leadC1.id, 1);
      assert(activities.length >= 3, 'Actividades registradas en auditoría del CRM', `(${activities.length} eventos registrados)`);
      
      const activityTypes = activities.map(a => a.activity_type);
      assert(activityTypes.includes('LEAD_CREATED'), 'Registro de auditoría incluye LEAD_CREATED');
      assert(activityTypes.includes('STATUS_CHANGED'), 'Registro de auditoría incluye STATUS_CHANGED');
    });

    // -----------------------------------------------------------------
    // 7. Aislamiento Multi-Tenant (Clínica 1 vs Clínica 2)
    // -----------------------------------------------------------------
    console.log('\n🔹 [7/8] Aislamiento Multi-Tenant entre Clínicas (Tenant Boundaries)');
    await als.run({ clinicId: 2, userId: 2 }, async () => {
      // Clínica 2 busca el lead de Clínica 1: debe devolver NotFound o null
      let clinic2LeadFound = false;
      try {
        await crmService.getLeadById(leadC1.id, 2);
        clinic2LeadFound = true;
      } catch (err) {
        assert(err.message.includes('no encontrado') || err.statusCode === 404, 'Clínica 2 recibe 404 al intentar ver Lead de Clínica 1');
      }
      assert(!clinic2LeadFound, 'Lead de Clínica 1 es INVISIBLE para Clínica 2');

      // Intentar actualizar estado desde Clínica 2
      let clinic2UpdateSucceeded = false;
      try {
        await crmService.updateLeadStatus(leadC1.id, 'lost', { clinicId: 2, userId: 2 });
        clinic2UpdateSucceeded = true;
      } catch (err) {
        assert(err.message.includes('no encontrado') || err.statusCode === 404, 'Clínica 2 no puede mutar estado de Lead de Clínica 1');
      }
      assert(!clinic2UpdateSucceeded, 'Inmutabilidad cross-tenant garantizada');

      // Listar leads en Clínica 2 no debe incluir el lead de Clínica 1
      const clinic2Leads = await crmLeadRepository.findAllWithDetails({ clinicId: 2 });
      const containsLeadC1 = clinic2Leads.rows.some(l => l.id === leadC1.id);
      assert(!containsLeadC1, 'Listado de leads de Clínica 2 NO contiene leads de Clínica 1');
    });

    // -----------------------------------------------------------------
    // 8. Conversión de Lead a Paciente (convertToPatient & Casos de Error)
    // -----------------------------------------------------------------
    console.log('\n🔹 [8/8] Conversión de Lead a Paciente (convertToPatient & Casos de Error)');
    await als.run({ clinicId: 1, userId: 1 }, async () => {
      // 8.1. Conversión creando un NUEVO paciente
      const leadForNewPatient = await crmService.createLead({
        clinicId: 1,
        phone: '999999004',
        name: 'Lucía Navarro Lead',
        email: 'lucia.navarro@testcrm.com',
        source: 'whatsapp',
        status: 'qualified',
        interest: 'Carillas Dentales TestCRM',
        notes: 'Desea estudio de estética dental',
        userId: 1,
      });

      // Crear oportunidad vinculada al lead antes de convertir
      const oppBeforeConvert = await crmService.createOpportunity({
        clinicId: 1,
        contactId: leadForNewPatient.contact_id,
        leadId: leadForNewPatient.id,
        name: 'Carillas de Porcelana TestCRM',
        estimatedValue: 2400.00,
        status: 'open',
        userId: 1,
      });

      // Convertir a nuevo paciente
      const conversionResult = await crmService.convertToPatient(
        leadForNewPatient.id,
        {
          patientData: {
            first_name: 'Lucía',
            last_name: 'Navarro TestCRM',
            phone: '999999004',
            email: 'lucia.navarro@testcrm.com',
          },
        },
        1,
        1
      );

      assert(conversionResult && conversionResult.patient_id, 'Lead convertido exitosamente a nuevo paciente');
      assert(conversionResult.status === 'converted', 'Estado del lead actualizado a "converted"');
      assert(conversionResult.converted_at !== null, 'Timestamp converted_at establecido');
      assert(Boolean(conversionResult.patient?.custom_id), 'Expediente clínico generado con custom_id automático', `(${conversionResult.patient?.custom_id})`);

      // Verificar que el contacto de mensajería quedó enlazado al nuevo paciente
      const updatedContact = await query('SELECT patient_id FROM messaging_contacts WHERE id = $1', [leadForNewPatient.contact_id]);
      assert(updatedContact.rows[0]?.patient_id === conversionResult.patient_id, 'Contacto de mensajería vinculado al nuevo paciente');

      // Verificar que la oportunidad vinculada al lead heredó el patient_id
      const updatedOpp = await crmOpportunityRepository.findById(oppBeforeConvert.id);
      assert(updatedOpp.patient_id === conversionResult.patient_id, 'Oportunidad comercial vinculada al nuevo paciente automáticamente');

      // 8.2. Conversión VINCULANDO a un paciente preexistente
      const leadForExisting = await crmService.createLead({
        clinicId: 1,
        phone: '999999005',
        name: 'Mario Conde Lead',
        source: 'instagram',
        status: 'contacted',
        interest: 'Implante Dental TestCRM',
        userId: 1,
      });

      const linkedConversion = await crmService.convertToPatient(
        leadForExisting.id,
        { patientId: conversionResult.patient_id },
        1,
        1
      );

      assert(linkedConversion.status === 'converted', 'Lead vinculado exitosamente a paciente preexistente ("converted")');
      assert(linkedConversion.patient_id === conversionResult.patient_id, 'Lead enlazado al ID del paciente preexistente correcto');

      // 8.3. Verificación de auditoría de conversión en crm_activities
      const convertActivities = await crmActivityRepository.findByLeadId(leadForNewPatient.id, 1);
      const hasConversionActivity = convertActivities.some(a => a.activity_type === 'LEAD_CONVERTED_TO_PATIENT');
      assert(hasConversionActivity, 'Actividad de auditoría LEAD_CONVERTED_TO_PATIENT registrada correctamente');

      // 8.4. Casos de Error y Validaciones Robustas
      // Caso 1: Lead inexistente
      let nonExistentFailed = false;
      try {
        await crmService.convertToPatient(999999, { patientId: conversionResult.patient_id }, 1, 1);
      } catch (err) {
        nonExistentFailed = err.statusCode === 404 || err.message.includes('no encontrado');
      }
      assert(nonExistentFailed, 'Rechaza conversión de lead inexistente con 404');

      // Caso 2: Falta de nombre o apellidos al crear paciente nuevo
      let missingNameFailed = false;
      try {
        await crmService.convertToPatient(
          leadC1.id,
          { patientData: { phone: '123456789' } },
          1,
          1
        );
      } catch (err) {
        missingNameFailed = err.statusCode === 400 || err.message.includes('requeridos');
      }
      assert(missingNameFailed, 'Rechaza creación de paciente sin nombre o apellidos con 400 ValidationError');

      // Caso 3: Violación cross-tenant (Clínica 2 intenta convertir lead de Clínica 1)
      let crossTenantConvertFailed = false;
      try {
        await crmService.convertToPatient(
          leadForNewPatient.id,
          { patientId: conversionResult.patient_id },
          2,
          2
        );
      } catch (err) {
        crossTenantConvertFailed = err.statusCode === 404 || err.message.includes('no encontrado');
      }
      assert(crossTenantConvertFailed, 'Bloquea conversión cross-tenant de lead ajeno');

      // Caso 4: Vincular a un paciente que pertenece a otra clínica
      let crossTenantPatientFailed = false;
      try {
        // Asumiendo que existe un paciente en clínica 2 o creando un mock ID cross-tenant
        const c2PatientRes = await query('SELECT id FROM patients WHERE clinic_id = 2 LIMIT 1');
        const c2PatientId = c2PatientRes.rows[0]?.id || 999998;
        await crmService.convertToPatient(
          leadC1.id,
          { patientId: c2PatientId },
          1,
          1
        );
      } catch (err) {
        crossTenantPatientFailed = err.statusCode === 404 || err.message.includes('no encontrado');
      }
      assert(crossTenantPatientFailed, 'Bloquea vinculación a paciente de otra clínica (aislamiento estricto)');

      // 8.5. Prueba del Controlador HTTP (crmController.convertToPatient)
      let controller400Caught = false;
      await crmController.convertToPatient(
        { params: { id: 'invalido' }, body: {}, user: { clinicId: 1, id: 1 } },
        {
          status: (code) => {
            if (code === 400) controller400Caught = true;
            return { json: () => {} };
          }
        },
        (err) => {
          if (err && (err.statusCode === 400 || err.name === 'ValidationError')) {
            controller400Caught = true;
          }
        }
      );
      assert(controller400Caught, 'Controlador responde HTTP 400 ante ID de lead no numérico');
    });

    // Limpieza final de datos de prueba
    await query("DELETE FROM crm_activities WHERE title LIKE '%TestCRM%' OR title LIKE '%Lead convertido%'");
    await query("DELETE FROM crm_notes WHERE note LIKE '%Test CRM%'");
    await query("DELETE FROM crm_opportunities WHERE name LIKE '%TestCRM%'");
    await query("DELETE FROM crm_leads WHERE interest LIKE '%TestCRM%'");
    await query("DELETE FROM messaging_contacts WHERE phone LIKE '999999%'");
    await query("DELETE FROM patients WHERE email LIKE '%@testcrm.com' OR first_name LIKE 'TestCRM%' OR last_name LIKE '%TestCRM%'");

    // -----------------------------------------------------------------
    // Resumen de la Suite
    // -----------------------------------------------------------------
    console.log('\n═════════════════════════════════════════════════════════════');
    console.log(`  📊 RESULTADO SUITE CRM: ${passed} superadas, ${failed} fallidas`);
    console.log('═════════════════════════════════════════════════════════════\n');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('💥 Error inesperado durante la ejecución de pruebas CRM:', err);
    process.exit(1);
  }
}

runCrmFoundationTests();
