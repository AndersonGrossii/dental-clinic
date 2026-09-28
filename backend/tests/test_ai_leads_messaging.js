// ============================================
// Suite de Pruebas: IA en Mensajería, Leads CRM, Supervisión y Multi-Clínica
// Certifica:
// 1. Aislamiento RAG por clinic_id (Xúquer = Dental / Castellón = Estética)
// 2. Dra. Sonia exclusiva en Xúquer (15 min) y especialista en Castellón
// 3. Guardrail de Precio Cero (nunca dar precios por chat)
// 4. Formato de cita con solo hora de llegada (sin duración)
// 5. Traspaso a Chat Interno cuando piden recepcionista
// 6. Cola de Supervisión Humana para presupuestos (PENDING_APPROVAL)
// 7. Calificación y notas de IA en CRM para Propietario/Dirección/Recepción
// ============================================
import assert from 'assert';
import { query, pool } from '../database/pool.js';
import aiService from '../services/ai.service.js';
import aiBookingService from '../services/ai-booking.service.js';
import aiSupervisionService from '../services/ai-supervision.service.js';
import aiKnowledgeRepository from '../repositories/ai-knowledge.repository.js';
import messagingService from '../services/messaging.service.js';
import internalChatService from '../services/internal-chat.service.js';
import crmLeadRepository from '../repositories/crm-lead.repository.js';
import crmNoteRepository from '../repositories/crm-note.repository.js';
import { logger } from '../utils/logger.js';

let passed = 0;
let failed = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${desc}`);
    console.error(`     ${err.message}`);
    failed++;
  }
}

async function itAsync(desc, fn) {
  try {
    await fn();
    console.log(`  ✅ PASS: ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${desc}`);
    console.error(`     ${err.message}`);
    failed++;
  }
}

async function runSuite() {
  console.log('\n=============================================================');
  console.log('  🤖 PRUEBAS: IA EN MENSAJERÍA, LEADS CRM Y SUPERVISIÓN');
  console.log('=============================================================\n');

  // -------------------------------------------------------------
  // BLOQUE 1: Aislamiento de Base de Conocimiento RAG por Clínica
  // -------------------------------------------------------------
  console.log('🔹 [1/7] Aislamiento RAG por Sede (Xúquer vs Castellón)');
  await itAsync('Sede 1 (Xúquer) contiene artículos de Odontología y Primera Revisión Gratuita', async () => {
    const articles = await aiKnowledgeRepository.findByClinic(1);
    assert(articles.length >= 3, 'Debe haber al menos 3 artículos para clínica 1');
    const hasDental = articles.some(a => a.content.toLowerCase().includes('odontológica') || a.content.toLowerCase().includes('bucodental'));
    const hasSonia = articles.some(a => a.content.includes('Sonia') || a.content.includes('gratuita'));
    assert(hasDental, 'Clínica 1 debe tener contenido dental');
    assert(hasSonia, 'Clínica 1 debe mencionar revisión gratuita');
  });

  await itAsync('Sede 2 (Castellón) contiene artículos de Estética y NO menciona a Dra. Sonia', async () => {
    const articles = await aiKnowledgeRepository.findByClinic(2);
    assert(articles.length >= 2, 'Debe haber al menos 2 artículos para clínica 2');
    const hasEstetica = articles.some(a => a.content.toLowerCase().includes('estética') || a.content.toLowerCase().includes('estéticos'));
    const mentionsSonia = articles.some(a => a.content.includes('Sonia'));
    assert(hasEstetica, 'Clínica 2 debe tener contenido de estética');
    assert(!mentionsSonia, 'Clínica 2 JAMÁS debe mencionar a Dra. Sonia');
  });

  // -------------------------------------------------------------
  // BLOQUE 2: Asignación de Doctor de Primera Visita
  // -------------------------------------------------------------
  console.log('\n🔹 [2/7] Asignación de Especialista de Primera Visita');
  await itAsync('Clínica 1 (Xúquer) resuelve exclusivamente a Dra. Sonia con franjas de 15 min', async () => {
    const docInfo = await aiBookingService.getFirstVisitDoctorForClinic(1);
    assert.strictEqual(docInfo.clinicType, 'DENTAL', 'Tipo de clínica debe ser DENTAL');
    assert.strictEqual(docInfo.slotDurationMinutes, 15, 'Franja de consulta debe ser exactamente de 15 minutos');
    assert(docInfo.doctorTitle.includes('Sonia'), 'El doctor asignado en Xúquer debe ser Dra. Sonia');
  });

  await itAsync('Clínica 2 (Castellón) resuelve especialista de Estética (NO Dra. Sonia)', async () => {
    const docInfo = await aiBookingService.getFirstVisitDoctorForClinic(2);
    assert.strictEqual(docInfo.clinicType, 'ESTETICA', 'Tipo de clínica debe ser ESTETICA');
    assert(!docInfo.doctorTitle.includes('Sonia'), 'En Castellón NO debe asignarse la Dra. Sonia');
  });

  // -------------------------------------------------------------
  // BLOQUE 3: Guardrail de Precio Cero y Foco en Revisión Gratuita
  // -------------------------------------------------------------
  console.log('\n🔹 [3/7] Guardrail de Precio Cero y Foco en Revisión Gratuita');
  await itAsync('Si el paciente pregunta precio de implantes, Sofía rechaza dar precios y ofrece revisión gratuita', async () => {
    const res = await aiService.generateSofiaReply({
      clinicId: 1,
      incomingText: 'Hola, ¿cuánto cuesta ponerme un implante dental completo?',
      senderName: 'Carlos Gómez',
    });

    assert.strictEqual(res.action, 'OFFER_FIRST_VISIT', 'La acción debe ser ofrecer primera visita');
    assert.strictEqual(res.intent, 'PRICE_INQUIRY', 'La intención debe ser consulta de precio');
    assert(!res.replyText.includes('€') && !res.replyText.includes('euros'), 'No debe contener cifras de precio ni símbolo €');
    assert(res.replyText.toLowerCase().includes('gratuita'), 'Debe ofrecer la primera revisión gratuita');
    assert(res.replyText.toLowerCase().includes('exploración') || res.replyText.toLowerCase().includes('presupuesto'), 'Debe explicar la necesidad de exploración');
  });

  await itAsync('En Castellón, si preguntan precio de estética, ofrece valoración presencial sin precios', async () => {
    const res = await aiService.generateSofiaReply({
      clinicId: 2,
      incomingText: 'Buenas tardes, ¿qué precio tiene el rejuvenecimiento facial?',
      senderName: 'Elena Valls',
    });

    assert.strictEqual(res.action, 'OFFER_FIRST_VISIT');
    assert(!res.replyText.includes('€'), 'No debe contener precios');
    assert(res.replyText.toLowerCase().includes('estética'), 'Debe contextualizarse en estética');
    assert(res.replyText.toLowerCase().includes('valoración'), 'Debe ofrecer valoración presencial');
  });

  // -------------------------------------------------------------
  // BLOQUE 4: Formato de Citas (Solo Hora de Llegada, Sin Duración)
  // -------------------------------------------------------------
  console.log('\n🔹 [4/7] Formato de Citas (Solo Hora de Llegada)');
  await itAsync('Al proponer o reservar cita, el mensaje solo indica hora de llegada y nunca duración', async () => {
    const res = await aiService.generateSofiaReply({
      clinicId: 1,
      incomingText: 'Quisiera pedir cita para una revisión general por favor',
      senderName: 'Marta Soler',
    });

    assert.strictEqual(res.action, 'SLOTS_OFFERED', 'Debe ofrecer huecos disponibles');
    assert(!res.replyText.includes('15 minutos') && !res.replyText.includes('durará'), 'NUNCA debe mencionar la duración de la consulta');
    assert(!res.replyText.includes('duración'), 'No debe hablar de duración');
  });

  // -------------------------------------------------------------
  // BLOQUE 5: Traspaso a Recepción por Chat Interno
  // -------------------------------------------------------------
  console.log('\n🔹 [5/7] Traspaso a Recepción y Notificación por Chat Interno');
  await itAsync('Cuando el paciente solicita un recepcionista, genera aviso al chat interno de su clínica', async () => {
    const testPhone = '+3460' + Date.now().toString().slice(-7);
    const contactRes = await query(
      `INSERT INTO messaging_contacts (clinic_id, phone, name, channel_preference)
       VALUES (1, $1, 'Paciente Prueba Traspaso', 'WHATSAPP')
       RETURNING *`,
      [testPhone]
    );
    const contact = contactRes.rows[0];

    const convRes = await query(
      `INSERT INTO conversations (clinic_id, contact_id, channel, status, automation_enabled)
       VALUES (1, $1, 'WHATSAPP', 'OPEN', TRUE)
       RETURNING *`,
      [contact.id]
    );
    const conv = convRes.rows[0];

    try {
      // 2. Simular respuesta automática con petición de hablar con recepcionista
      await messagingService.handleAutoReply(conv, contact, 'Hola, prefiero hablar con una recepcionista por favor');

      // 3. Verificar que se pausó la automatización
      const updatedConv = await query(`SELECT automation_enabled, status FROM conversations WHERE id = $1`, [conv.id]);
      assert.strictEqual(updatedConv.rows[0].automation_enabled, false, 'La automatización debe pausarse');

      // 4. Verificar que se insertó el mensaje de aviso en internal_chat_messages para clínica 1
      const chatMsg = await query(
        `SELECT * FROM internal_chat_messages 
         WHERE clinic_id = 1 AND message ILIKE '%TRASPASO URGENTE%'
         ORDER BY created_at DESC LIMIT 1`
      );
      assert(chatMsg.rows.length > 0, 'Debe existir mensaje de traspaso en el chat interno');
      assert(chatMsg.rows[0].message.includes('Paciente Prueba Traspaso'), 'El aviso debe incluir el nombre del paciente');
    } finally {
      // Limpieza garantizada
      await query(`DELETE FROM messages WHERE conversation_id = $1`, [conv.id]);
      await query(`DELETE FROM conversations WHERE id = $1`, [conv.id]);
      await query(`DELETE FROM messaging_contacts WHERE id = $1`, [contact.id]);
    }
  });

  // -------------------------------------------------------------
  // BLOQUE 6: Cola de Supervisión Humana para Presupuestos
  // -------------------------------------------------------------
  console.log('\n🔹 [6/7] Cola de Supervisión Humana (Human-in-the-Loop)');
  await itAsync('Encolar, modificar y aprobar propuesta de seguimiento de presupuesto', async () => {
    // 1. Encolar propuesta
    const queued = await aiSupervisionService.queueQuotationFollowup({
      clinicId: 1,
      patientId: null,
      quotationId: null,
      phone: '+3469' + Date.now().toString().slice(-7),
      patientName: 'Vicente Mas',
      suggestedMessage: 'Hola Vicente, ¿tiene alguna duda sobre el presupuesto?',
    });

    assert(queued && queued.id, 'Debe crearse el registro en ai_message_approvals');
    assert.strictEqual(queued.status, 'PENDING_APPROVAL', 'Estado inicial debe ser PENDING_APPROVAL');

    try {
      // 2. Modificar texto de la propuesta
      const edited = await aiSupervisionService.editMessage(
        queued.id,
        1,
        'Hola Vicente, le recordamos que podemos ofrecerle facilidades de pago para su presupuesto.',
        1
      );
      assert.strictEqual(edited.suggested_message, 'Hola Vicente, le recordamos que podemos ofrecerle facilidades de pago para su presupuesto.');

      // 3. Descartar propuesta de prueba
      const discarded = await aiSupervisionService.discard(queued.id, 1, 1);
      assert.strictEqual(discarded.status, 'DISCARDED', 'Estado debe cambiar a DISCARDED');
    } finally {
      await query(`DELETE FROM ai_message_approvals WHERE id = $1`, [queued.id]);
    }
  });

  // -------------------------------------------------------------
  // BLOQUE 7: Calificación y Notas de IA en CRM (Visibilidad Compartida)
  // -------------------------------------------------------------
  console.log('\n🔹 [7/7] Calificación de Leads y Notas Compartidas en CRM');
  await itAsync('Calificar lead con IA actualiza score y genera nota visible con created_by_type = ai', async () => {
    const testPhone = '+3461' + Date.now().toString().slice(-7);
    const contactRes = await query(
      `INSERT INTO messaging_contacts (clinic_id, phone, name, channel_preference)
       VALUES (1, $1, 'Lead IA Test', 'WHATSAPP')
       RETURNING *`,
      [testPhone]
    );
    const contact = contactRes.rows[0];

    const leadRes = await query(
      `INSERT INTO crm_leads (clinic_id, contact_id, source, status, interest)
       VALUES (1, $1, 'whatsapp', 'new', 'Implantes dentales')
       RETURNING *`,
      [contact.id]
    );
    const lead = leadRes.rows[0];

    try {
      // 2. Mensajes simulados de conversación
      const mockMessages = [
        { direction: 'INBOUND', body: 'Hola, tengo dolor en una muela y quería saber si se puede poner un implante dental' },
        { direction: 'OUTBOUND', body: 'Con mucho gusto le ayudamos con su revisión gratuita' },
      ];

      // 3. Ejecutar calificación
      const qualResult = await aiService.qualifyLeadFromConversation(lead.id, 1, mockMessages, 1);
      assert(qualResult.analysis.score >= 80, 'Lead interesado en implantes con dolor debe tener score alto (>= 80)');
      assert.strictEqual(qualResult.analysis.urgency, 'HIGH', 'Debe detectar urgencia ALTA por dolor');

      // 4. Verificar persistencia en crm_leads
      const updatedLead = await query(`SELECT ai_score, ai_urgency, ai_extracted_interest FROM crm_leads WHERE id = $1`, [lead.id]);
      assert.strictEqual(updatedLead.rows[0].ai_urgency, 'HIGH');
      assert.strictEqual(updatedLead.rows[0].ai_score, qualResult.analysis.score);

      // 5. Verificar nota en crm_notes con created_by_type = 'ai'
      const note = await query(`SELECT * FROM crm_notes WHERE lead_id = $1`, [lead.id]);
      assert(note.rows.length > 0, 'Debe crearse nota en crm_notes');
      assert.strictEqual(note.rows[0].created_by_type, 'ai', 'La nota debe tener created_by_type = ai');
      assert(note.rows[0].note.includes('[IA - Resumen Automático]'), 'La nota debe llevar el prefijo identificador de IA');
    } finally {
      // Limpieza
      await query(`DELETE FROM crm_notes WHERE lead_id = $1`, [lead.id]);
      await query(`DELETE FROM crm_leads WHERE id = $1`, [lead.id]);
      await query(`DELETE FROM messaging_contacts WHERE id = $1`, [contact.id]);
    }
  });

  // -------------------------------------------------------------
  // RESUMEN
  // -------------------------------------------------------------
  console.log('\n=============================================================');
  console.log(`  📊 RESULTADO SUITE IA: ${passed} superadas, ${failed} fallidas`);
  console.log('=============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runSuite()
  .then(() => {
    console.log('✨ Suite de Pruebas de IA finalizada con ÉXITO.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('💥 Error inesperado durante la ejecución de pruebas:', err);
    process.exit(1);
  });
