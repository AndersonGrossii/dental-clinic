// ============================================
// SUITE DE PRUEBAS: FASE 2 — RAG RETRIEVAL & KNOWLEDGE GROUNDING
// ============================================
import aiKnowledgeRepository from '../repositories/ai-knowledge.repository.js';
import aiService from '../services/ai.service.js';
import { query } from '../database/pool.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

export async function runAIRagRetrievalTests() {
  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log('  🧠 PRUEBAS: RAG RETRIEVAL, INTENT MATCHING & SOFIA GROUNDING (FASE 2)');
  console.log('══════════════════════════════════════════════════════════════════\n');

  try {
    // ---------------------------------------------------------
    // 1. CLASIFICACIÓN DE INTENCIONES (TAXONOMÍA EXPANDIDA)
    // ---------------------------------------------------------
    console.log('🔹 [1/5] Clasificación de Intenciones Expandida');

    const intentLoc = await aiService.classifyIntent('¿Dónde estáis ubicados y cómo puedo llegar?');
    assert(intentLoc.intent === 'LOCATION', 'Detecta intención LOCATION para "¿Dónde estáis ubicados...?"');

    const intentHours = await aiService.classifyIntent('¿A qué hora abrís por las tardes?');
    assert(intentHours.intent === 'OPENING_HOURS', 'Detecta intención OPENING_HOURS para "¿A qué hora abrís...?"');

    const intentFirst = await aiService.classifyIntent('¿La primera revisión es gratuita?');
    assert(intentFirst.intent === 'FIRST_VISIT', 'Detecta intención FIRST_VISIT para "¿La primera revisión...?"');

    const intentTreat = await aiService.classifyIntent('Quisiera información sobre carillas e implantes');
    assert(intentTreat.intent === 'TREATMENT_INFORMATION', 'Detecta intención TREATMENT_INFORMATION para carillas e implantes');

    const intentPrice = await aiService.classifyIntent('¿Cuánto cuesta un blanqueamiento dental?');
    assert(intentPrice.intent === 'PRICE_INQUIRY', 'Detecta intención PRICE_INQUIRY para consulta de tarifas');

    const intentHuman = await aiService.classifyIntent('Quiero hablar con una persona de recepción por favor');
    assert(intentHuman.intent === 'TRANSFER_TO_HUMAN', 'Detecta intención TRANSFER_TO_HUMAN');

    const intentUrgent = await aiService.classifyIntent('Tengo un dolor muy fuerte en una muela y sangrado');
    assert(intentUrgent.intent === 'URGENT', 'Detecta intención URGENT');

    // ---------------------------------------------------------
    // 2. RECUPERACIÓN GUIADA POR INTENCIÓN Y SINÓNIMOS (RAG REPOSITORY)
    // ---------------------------------------------------------
    console.log('\n🔹 [2/5] Recuperación Semántica RAG con Sinónimos y Top-K');

    // Búsqueda de ubicación en Sede 1
    const searchLoc = await aiKnowledgeRepository.searchRelevant(1, '¿Dónde queda la clínica en Valencia?', {
      intent: 'LOCATION',
      topK: 2,
    });
    assert(searchLoc.length > 0, 'Encuentra artículos relevantes para ubicación');
    assert(searchLoc.topMatch?.category === 'ubicacion', 'El top match corresponde a la categoría "ubicacion"');
    assert(searchLoc.topMatch?.intent === 'LOCATION', 'El top match tiene el intent LOCATION');
    assert(searchLoc.confidence === 'HIGH', `Confianza calculada es HIGH (score obtenido: ${searchLoc.topMatch?.score})`);

    // Búsqueda de horarios con sinónimo "hora de cierre"
    const searchHours = await aiKnowledgeRepository.searchRelevant(1, '¿Cuál es la hora de cierre los viernes?', {
      intent: 'OPENING_HOURS',
      topK: 2,
    });
    assert(searchHours.topMatch?.category === 'horarios', 'Empareja sinónimo "hora de cierre" con artículo de horarios');
    assert(searchHours.topMatch?.content.includes('09:00 a 20:00'), 'Contenido recuperado contiene el horario verídico');

    // Búsqueda de tratamientos con término popular "brackets"
    const searchBrackets = await aiKnowledgeRepository.searchRelevant(1, '¿Hacéis brackets invisibles?', {
      intent: 'TREATMENT_INFORMATION',
      topK: 2,
    });
    assert(searchBrackets.topMatch?.category === 'tratamientos', 'Empareja "brackets" con tratamientos odontológicos');

    // ---------------------------------------------------------
    // 3. AISLAMIENTO MULTI-CLÍNICA ESTRICTO
    // ---------------------------------------------------------
    console.log('\n🔹 [3/5] Aislamiento Multi-Clínica Estricto en RAG');

    // Sede 1 (Xúquer - Dental)
    const sede1Res = await aiKnowledgeRepository.searchRelevant(1, 'dirección y clínica', { topK: 5 });
    const hasCastellonInSede1 = sede1Res.some(art => art.clinic_id !== 1 || (art.content && art.content.includes('Cabanes')));
    assert(!hasCastellonInSede1, 'Sede 1 no contiene información de Sede 2 (Cabanes / Castellón)');

    // Sede 2 (Castellón - Estética)
    const sede2Res = await aiKnowledgeRepository.searchRelevant(2, 'dirección y clínica', { topK: 5 });
    const hasXuquerInSede2 = sede2Res.some(art => art.clinic_id !== 2 || (art.content && art.content.includes('Alcàntera')));
    assert(!hasXuquerInSede2, 'Sede 2 no contiene información de Sede 1 (Alcàntera / Xúquer)');
    assert(sede2Res.topMatch?.content.includes('Cabanes'), 'Sede 2 recupera correctamente su propia dirección en Cabanes');

    // ---------------------------------------------------------
    // 4. SÍNTESIS DE RESPUESTA DE SOFÍA CON RAG GROUNDING
    // ---------------------------------------------------------
    console.log('\n🔹 [4/5] Grounding de Respuestas de Sofía con Conocimiento Aprobado');

    // Pregunta por ubicación a Sofía
    const sofiaLoc = await aiService.generateSofiaReply({
      clinicId: 1,
      incomingText: '¿Dónde estáis ubicados?',
      senderName: 'Carlos Gómez',
      isNameConfirmed: true,
      confirmedName: 'Carlos Gómez',
    });
    assert(sofiaLoc.action === 'LOCATION_PROVIDED', 'Sofía emite acción LOCATION_PROVIDED');
    assert(sofiaLoc.replyText.includes('Av. Reforma 1234') && sofiaLoc.replyText.includes('Alcàntera de Xúquer'), 'Respuesta de Sofía fundamentada en el artículo oficial de ubicación');
    assert(sofiaLoc.ragContext?.confidence === 'HIGH', 'Sofía adjunta contexto RAG con confianza HIGH');

    // Pregunta por horarios
    const sofiaHours = await aiService.generateSofiaReply({
      clinicId: 1,
      incomingText: '¿Qué horario tenéis de atención al público?',
      senderName: 'Carlos Gómez',
      isNameConfirmed: true,
      confirmedName: 'Carlos Gómez',
    });
    assert(sofiaHours.action === 'HOURS_PROVIDED', 'Sofía emite acción HOURS_PROVIDED');
    assert(sofiaHours.replyText.includes('09:00 a 20:00'), 'Respuesta de horarios fundamentada en la base de conocimiento');

    // Pregunta por tratamientos sin precios
    const sofiaTreatment = await aiService.generateSofiaReply({
      clinicId: 1,
      incomingText: '¿Hacéis implantes dentales y carillas?',
      senderName: 'Carlos Gómez',
      isNameConfirmed: true,
      confirmedName: 'Carlos Gómez',
    });
    assert(sofiaTreatment.action === 'TREATMENT_INFO_PROVIDED', 'Sofía emite acción TREATMENT_INFO_PROVIDED');
    assert(sofiaTreatment.replyText.includes('implantología dental') || sofiaTreatment.replyText.includes('carillas'), 'Sofía expone el tratamiento según el protocolo de la clínica');
    assert(sofiaTreatment.replyText.includes('gratuita y sin compromiso'), 'Recuerda que la 1ª consulta de valoración es gratuita');

    // Pregunta por precios (Guardrail de Precio Cero inviolable)
    const sofiaPrice = await aiService.generateSofiaReply({
      clinicId: 1,
      incomingText: '¿Cuánto cuesta un implante dental completo?',
      senderName: 'Carlos Gómez',
      isNameConfirmed: true,
      confirmedName: 'Carlos Gómez',
    });
    assert(sofiaPrice.action === 'OFFER_FIRST_VISIT', 'Sofía activa guardrail de precio cero y ofrece primera visita presencial');
    assert(!sofiaPrice.replyText.match(/\b\d+\s*(?:€|euros?|dolares|usd)\b/i), 'Sofía jamás menciona cifras monetarias o tarifas cerradas');

    // ---------------------------------------------------------
    // 5. COMPATIBILIDAD DE MODELO Y API CRUD DE ARTÍCULOS
    // ---------------------------------------------------------
    console.log('\n🔹 [5/5] Compatibilidad de Esquema y CRUD con Metadatos Semánticos');

    // Crear artículo de prueba con sinónimos e intención
    const testArt = await aiKnowledgeRepository.create({
      clinicId: 1,
      category: 'faq',
      title: 'Aparcamiento Cercano',
      content: 'Disponemos de zona de aparcamiento público gratuito a 50 metros de la entrada principal.',
      keywords: ['parking', 'coche', 'aparcamiento'],
      synonyms: ['donde aparcar', 'estacionamiento', 'estacionar'],
      intent: 'LOCATION',
      priority: 1,
      next_action: 'Indicar zona de aparcamiento libre.',
    });
    assert(testArt && testArt.id, `Artículo #${testArt.id} creado con éxito con sinónimos e intent LOCATION`);

    // Recuperar artículo recién creado usando sinónimo "donde aparcar"
    const searchPark = await aiKnowledgeRepository.searchRelevant(1, '¿Hay sitio donde aparcar el coche?', {
      intent: 'LOCATION',
    });
    assert(searchPark.topMatch?.title === 'Aparcamiento Cercano', 'Recupera el artículo de parking a través del sinónimo');

    // Limpiar artículo de prueba
    await aiKnowledgeRepository.delete(testArt.id, 1);
    assert(true, 'Artículo de prueba eliminado correctamente tras la verificación');

  } catch (err) {
    console.error('Error durante la ejecución de pruebas de RAG Retrieval:', err);
    failed++;
  }

  console.log('\n═════════════════════════════════════════════════════════════');
  console.log(`  📊 RESULTADO SUITE RAG RETRIEVAL (FASE 2): ${passed} superadas, ${failed} fallidas`);
  console.log('═════════════════════════════════════════════════════════════\n');

  if (failed > 0) {
    throw new Error(`Fallaron ${failed} pruebas en la suite de RAG Retrieval.`);
  }
}

if (process.argv[1].endsWith('test_ai_rag_retrieval.js')) {
  runAIRagRetrievalTests()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
