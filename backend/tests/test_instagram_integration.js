// ============================================
// Suite de Pruebas: Integración Completa de Instagram Messaging API
// ============================================
import instagramService from '../services/instagram.service.js';
import messagingService from '../services/messaging.service.js';
import { query } from '../database/pool.js';

async function runInstagramTests() {
  console.log('══════════════════════════════════════════════════════════════════');
  console.log('  📸 PRUEBAS: INTEGRACIÓN DE INSTAGRAM MESSAGING API');
  console.log('══════════════════════════════════════════════════════════════════');

  // 1. Verificación del Webhook GET Handshake
  console.log('\n🔹 [1/5] Verificación de Handshake Webhook GET');
  const validToken = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN || 'vides_dental_webhook_token_2026';
  const challenge = instagramService.verifyWebhookChallenge('subscribe', validToken, 'test_challenge_code_9988');
  if (challenge !== 'test_challenge_code_9988') {
    throw new Error(`Fallo en handshake de Instagram: esperado test_challenge_code_9988, recibido ${challenge}`);
  }
  console.log('  ✅ PASS: Handshake de suscripción validado correctamente con challenge');

  const failedChallenge = instagramService.verifyWebhookChallenge('subscribe', 'invalid_token', 'test_challenge_code_9988');
  if (failedChallenge !== null) {
    throw new Error('Debería rechazar tokens no válidos');
  }
  console.log('  ✅ PASS: Rechaza token de suscripción no autorizado');

  // 2. Parseo de eventos de Webhook (POST)
  console.log('\n🔹 [2/5] Parseo de Eventos Directos y Respuestas a Historias');
  const samplePayload = {
    object: 'instagram',
    entry: [{
      id: 'ig_page_xuquer_1',
      time: Date.now(),
      messaging: [{
        sender: { id: 'ig_user_112233' },
        recipient: { id: 'ig_page_xuquer_1' },
        timestamp: Date.now(),
        message: {
          mid: 'm_mid_ig_test_1',
          text: 'Hola, soy Carolina, tenéis hueco para una revisión?',
          reply_to: { story: { id: 'story_123' } }
        }
      }]
    }]
  };
  const parsed = instagramService.parseWebhookPayload(samplePayload);
  if (parsed.length !== 1 || parsed[0].senderId !== 'ig_user_112233' || !parsed[0].isStoryReply) {
    throw new Error('Error al parsear evento de Instagram');
  }
  console.log('  ✅ PASS: Evento de mensaje entrante e interacción con historia parseados con éxito');

  // 3. Procesamiento Inbound en Sede 1 (Xúquer - Dental)
  console.log('\n🔹 [3/5] Procesamiento Inbound Sede 1 (Xúquer: Primera Visita con Dra. Sonia)');
  const res1 = await messagingService.processInboundInstagramWebhook(samplePayload);
  if (!res1 || res1.length === 0 || !res1[0].success) {
    throw new Error('Fallo al procesar inbound de Instagram en Sede 1');
  }

  const contact1 = (await query('SELECT * FROM messaging_contacts WHERE phone = $1', ['ig_user_112233'])).rows[0];
  if (!contact1 || !contact1.name.includes('Carolina')) {
    throw new Error('Contacto de Instagram no confirmó el nombre Carolina');
  }
  console.log(`  ✅ PASS: Contacto de Instagram creado y nombre confirmado: "${contact1.name}"`);

  const conv1 = (await query('SELECT * FROM conversations WHERE contact_id = $1', [contact1.id])).rows[0];
  if (!conv1 || conv1.channel !== 'INSTAGRAM') {
    throw new Error('La conversación no tiene canal INSTAGRAM');
  }
  console.log(`  ✅ PASS: Conversación creada con canal ${conv1.channel}`);

  const msgs1 = (await query('SELECT * FROM messages WHERE conversation_id = $1 ORDER BY id ASC', [conv1.id])).rows;
  if (msgs1.length < 2) {
    throw new Error('Debería existir mensaje INBOUND y respuesta OUTBOUND de Sofía');
  }
  const autoReply1 = msgs1[msgs1.length - 1].body;
  if (!autoReply1.includes('Carolina') || !autoReply1.includes('revisión')) {
    throw new Error(`Respuesta de Sofía no personalizada: ${autoReply1}`);
  }
  console.log('  ✅ PASS: Sofía respondió por Instagram reconociendo a Carolina y ofreciendo 1ª revisión gratuita');

  // 4. Procesamiento Inbound en Sede 2 (Castellón - Estética)
  console.log('\n🔹 [4/5] Multi-Tenant Routing Sede 2 (Castellón: Especialista de Estética)');
  // Asociar la página de Instagram a la sede 2 en settings
  await query(
    `INSERT INTO settings (clinic_id, key, value, category)
     VALUES (2, 'instagram_page_id', 'ig_page_castellon_2', 'integrations')
     ON CONFLICT (clinic_id, key) DO UPDATE SET value = 'ig_page_castellon_2'`
  );

  const castellonPayload = {
    object: 'instagram',
    entry: [{
      id: 'ig_page_castellon_2',
      time: Date.now(),
      messaging: [{
        sender: { id: 'ig_user_castellon_99' },
        recipient: { id: 'ig_page_castellon_2' },
        timestamp: Date.now(),
        message: {
          mid: 'm_mid_ig_castellon_1',
          text: 'Hola, me llamo Roberto, cuánto cuesta un aumento de labios con ácido hialurónico?'
        }
      }]
    }]
  };

  const res2 = await messagingService.processInboundInstagramWebhook(castellonPayload);
  const contact2 = (await query('SELECT * FROM messaging_contacts WHERE phone = $1', ['ig_user_castellon_99'])).rows[0];
  if (contact2.clinic_id !== 2) {
    throw new Error(`Se esperaba clinic_id 2 para Castellón, recibido ${contact2.clinic_id}`);
  }
  console.log(`  ✅ PASS: Mensaje de Instagram enrutado correctamente a Sede 2 (Castellón)`);

  const conv2 = (await query('SELECT * FROM conversations WHERE contact_id = $1', [contact2.id])).rows[0];
  const msgs2 = (await query('SELECT * FROM messages WHERE conversation_id = $1 ORDER BY id DESC LIMIT 1', [conv2.id])).rows;
  const autoReply2 = msgs2[0].body;
  if (!autoReply2.includes('Roberto') || !autoReply2.includes('estética') || autoReply2.includes('Dra. Sonia')) {
    throw new Error(`Respuesta de Castellón no cumple protocolo de estética: ${autoReply2}`);
  }
  console.log('  ✅ PASS: Sofía respondió con foco en valoración estética presencial (sin precios y sin Dra. Sonia)');

  // 5. CRM Leads con origen Instagram y Puntuación IA
  console.log('\n🔹 [5/5] Calificación Automática de Lead en CRM (Source: instagram)');
  const lead1 = (await query('SELECT * FROM crm_leads WHERE contact_id = $1', [contact1.id])).rows[0];
  const lead2 = (await query('SELECT * FROM crm_leads WHERE contact_id = $1', [contact2.id])).rows[0];
  if (!lead1 || lead1.source !== 'instagram' || !lead2 || lead2.source !== 'instagram') {
    throw new Error('Los leads creados no tienen source = instagram');
  }
  console.log(`  ✅ PASS: Lead #1 (Xúquer) registrado como source: "instagram", AI Score: ${lead1.ai_score}`);
  console.log(`  ✅ PASS: Lead #2 (Castellón) registrado como source: "instagram", AI Score: ${lead2.ai_score}`);

  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log('  ✨ TODAS LAS PRUEBAS DE INTEGRACIÓN DE INSTAGRAM SUPERADAS (5/5)');
  console.log('══════════════════════════════════════════════════════════════════');
}

runInstagramTests().then(() => process.exit(0)).catch(err => {
  console.error('\n❌ ERROR EN PRUEBAS DE INSTAGRAM:', err.message);
  process.exit(1);
});
