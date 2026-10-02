// ==============================================================================
// Test Suite: RAG Grounding, Prompt Synthesis & Sofia Response Policies (Fase 3)
// Valida que las respuestas de Sofía consumen efectivamente la base de conocimiento,
// aplican los guardrails deontológicos, obedecen las directrices de confianza y fusionan
// RAG con herramientas dinámicas de agenda.
// ==============================================================================
import assert from 'assert';
import aiService from '../services/ai.service.js';
import aiKnowledgeRepository from '../repositories/ai-knowledge.repository.js';
import aiBookingService from '../services/ai-booking.service.js';
import { query } from '../database/pool.js';

let passed = 0;
let failed = 0;

function report(name, condition) {
  if (condition) {
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${name}`);
    failed++;
  }
}

async function runSuite() {
  console.log('\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║  🧠 SUITE FASE 3: RAG GROUNDING, PROMPT SYNTHESIS & POLICIES     ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  try {
    // -------------------------------------------------------------
    // 1. ENSAMBLADO DEL CONTEXTO RAG ESTRUCTURADO (assembleRAGContext)
    // -------------------------------------------------------------
    console.log('🔹 [1/6] Ensamblado de Contexto Estructurado (assembleRAGContext)');
    
    const sampleRagResults = {
      articles: [
        {
          id: 1,
          title: 'Ubicación Xúquer',
          category: 'ubicacion',
          content: 'Av. Reforma 1234, Alcàntera de Xúquer',
          do_not_say: 'No prometer parking privado',
          next_action: 'Ofrecer indicaciones para llegar.',
        }
      ],
      topMatch: {
        id: 1,
        title: 'Ubicación Xúquer',
        category: 'ubicacion',
        content: 'Av. Reforma 1234, Alcàntera de Xúquer',
        do_not_say: 'No prometer parking privado',
        next_action: 'Ofrecer indicaciones para llegar.',
      },
      confidence: 'HIGH',
    };

    const ctxXuquer = aiService.assembleRAGContext({
      clinicId: 1,
      incomingText: '¿Dónde está la clínica?',
      intentData: { intent: 'LOCATION', confidence: 0.95 },
      ragResults: sampleRagResults,
      patient: { name: 'Juan García', firstName: 'Juan', isConfirmed: true },
    });

    report('Contexto incluye política de Clínica 1 (Dental Xúquer)', ctxXuquer.systemPolicy.clinicName.includes('Xúquer') && ctxXuquer.systemPolicy.clinicType === 'DENTAL');
    report('Contexto incorpora guardrail de precio cero como incondicional', ctxXuquer.systemPolicy.zeroPricePolicy === true);
    report('Contexto preserva topMatch con doNotSay y nextAction', ctxXuquer.rag.topMatch?.doNotSay === 'No prometer parking privado' && ctxXuquer.rag.topMatch?.nextAction === 'Ofrecer indicaciones para llegar.');
    report('Contexto extrae correctamente el nombre de pila del paciente', ctxXuquer.patient.firstName === 'Juan');

    const ctxCastellon = aiService.assembleRAGContext({
      clinicId: 2,
      incomingText: 'Información estética',
      intentData: { intent: 'INFO', confidence: 0.8 },
      ragResults: { articles: [], topMatch: null, confidence: 'NONE' },
    });
    report('Contexto en sede 2 aplica estrictamente a Medicina Estética Castellón', ctxCastellon.systemPolicy.clinicType === 'ESTETICA');

    // -------------------------------------------------------------
    // 2. CONSTRUCCIÓN DEL SYSTEM PROMPT PARA LLM (buildSystemPrompt)
    // -------------------------------------------------------------
    console.log('\n🔹 [2/6] Síntesis del System Prompt Oficial (buildSystemPrompt)');
    const prompt = aiService.buildSystemPrompt(ctxXuquer);

    report('Prompt incluye rol de Sofía e identidad de la clínica', prompt.includes('Sofía') && prompt.includes('Clínica Vides Dental Xúquer'));
    report('Prompt estipula explícitamente la POLÍTICA DE PRECIO CERO', prompt.includes('POLÍTICA DE PRECIO CERO') && prompt.includes('NUNCA'));
    report('Prompt estipula la REGLA DE NO-INVENCIÓN', prompt.includes('REGLA DE NO-INVENCIÓN'));
    report('Prompt inyecta los artículos de la Base de Conocimiento Oficial Aprobada', prompt.includes('Av. Reforma 1234') && prompt.includes('No prometer parking privado'));

    // -------------------------------------------------------------
    // 3. GROUNDING DE PREGUNTAS FRECUENTES (KNOWLEDGE_PROVIDED)
    // -------------------------------------------------------------
    console.log('\n🔹 [3/6] Grounding de FAQ y Artículos Específicos (KNOWLEDGE_PROVIDED)');

    // Crear artículo específico de financiación
    const finArt = await aiKnowledgeRepository.create({
      clinicId: 1,
      category: 'faq',
      title: 'Financiación sin Intereses',
      content: 'Ofrecemos facilidades de pago y financiación a medida hasta en 24 meses sin intereses con las principales entidades bancarias.',
      keywords: ['financiacion', 'financiación', 'pagos', 'cuotas', 'plazos'],
      synonyms: ['financiar', 'pagar a plazos', 'facilidades de pago', 'meses sin intereses'],
      intent: 'INFO',
      priority: 2,
      do_not_say: 'No prometer aprobación bancaria sin estudio financiero previo.',
      next_action: 'Preguntar si desea que nuestro equipo de recepción le detalle las condiciones de financiación.',
    });

    const sofiaFin = await aiService.generateSofiaReply({
      clinicId: 1,
      incomingText: '¿Tenéis opciones para financiar los tratamientos?',
      senderName: 'Laura Pérez',
      isNameConfirmed: true,
      confirmedName: 'Laura Pérez',
    });

    report('Sofía emite acción KNOWLEDGE_PROVIDED para FAQ en base de datos', sofiaFin.action === 'KNOWLEDGE_PROVIDED');
    report('Respuesta contiene el texto oficial aprobado de financiación', sofiaFin.replyText.includes('hasta en 24 meses sin intereses'));
    report('Respuesta incorpora la acción recomendada (next_action) de la clínica', sofiaFin.replyText.includes('condiciones de financiación'));
    report('Contexto RAG refleja confianza alta o media', sofiaFin.ragContext?.confidence === 'HIGH' || sofiaFin.ragContext?.confidence === 'MEDIUM');

    // Limpieza
    await aiKnowledgeRepository.delete(finArt.id, 1);

    // -------------------------------------------------------------
    // 4. RESPUESTA GRADUAL SEGÚN CONFIANZA Y GUARDRAIL DE NO INVENCIÓN
    // -------------------------------------------------------------
    console.log('\n🔹 [4/6] Niveles de Confianza y Regla de No Invención (Rule 10: DO NOT INVENT)');

    // Consulta de algo que NO existe en la base de datos de la clínica
    const sofiaUnknown = await aiService.generateSofiaReply({
      clinicId: 1,
      incomingText: '¿Hacéis sesiones de acupuntura con cuencos tibetanos y aromaterapia?',
      senderName: 'Pedro Ramos',
      isNameConfirmed: true,
      confirmedName: 'Pedro Ramos',
    });

    report('Sofía activa LOW_CONFIDENCE_ESCALATION ante consulta de servicio desconocido', sofiaUnknown.action === 'LOW_CONFIDENCE_ESCALATION');
    report('Sofía se niega a inventar y remite cortésmente a la recepción', sofiaUnknown.replyText.includes('recepción') && sofiaUnknown.replyText.includes('confirmarle todos los detalles'));
    report('Sofía mantiene la oferta de primera consulta presencial de valoración', sofiaUnknown.replyText.includes('primera consulta') || sofiaUnknown.replyText.includes('revisión'));

    // -------------------------------------------------------------
    // 5. FUSIÓN DE RAG + HERRAMIENTAS DINÁMICAS DE AGENDA
    // -------------------------------------------------------------
    console.log('\n🔹 [5/6] Fusión de RAG (1ª Visita Gratuita) + Tools (Disponibilidad Real)');

    const sofiaBooking = await aiService.generateSofiaReply({
      clinicId: 1,
      incomingText: 'Buenas tardes, me gustaría agendar una primera cita para revisión dental',
      senderName: 'Beatriz Costa',
      isNameConfirmed: true,
      confirmedName: 'Beatriz Costa',
    });

    report('Sofía emite acción SLOTS_OFFERED para agendamiento', sofiaBooking.action === 'SLOTS_OFFERED');
    report('Fundamenta en la 1ª consulta gratuita de revisión y diagnóstico de Xúquer', sofiaBooking.replyText.includes('primera revisión diagnóstica') && sofiaBooking.replyText.includes('gratuita'));
    report('Muestra únicamente la hora de llegada de las franjas y nunca la duración interna', !sofiaBooking.replyText.includes('15 minutos') && !sofiaBooking.replyText.includes('durará'));
    report('Adjunta slots reales extraídos del servicio de agenda', Array.isArray(sofiaBooking.slots) && sofiaBooking.slots.length > 0);

    // -------------------------------------------------------------
    // 6. CONTROL DE PRECIOS Y AISLAMIENTO DE SEDE
    // -------------------------------------------------------------
    console.log('\n🔹 [6/6] Guardrail de Precio Cero Inviolable y Aislamiento de Sede');

    const priceXuquer = await aiService.generateSofiaReply({
      clinicId: 1,
      incomingText: '¿Cuánto cuesta un blanqueamiento dental en clínica?',
      senderName: 'Marcos Gil',
    });
    report('En Xúquer activa OFFER_FIRST_VISIT ante precios', priceXuquer.action === 'OFFER_FIRST_VISIT');
    report('Jamás menciona símbolos de precio ni tarifas numéricas', !priceXuquer.replyText.match(/\b\d+\s*(?:€|euros?|dolares|usd)\b/i));
    report('Remite a la primera revisión gratuita presencial para presupuesto formal', priceXuquer.replyText.includes('gratuita') && priceXuquer.replyText.includes('presupuesto exacto'));

    const priceCastellon = await aiService.generateSofiaReply({
      clinicId: 2,
      incomingText: '¿Cuál es el precio del ácido hialurónico para labios?',
      senderName: 'Lucía Sanz',
    });
    report('En Castellón contextualiza en medicina estética', priceCastellon.replyText.includes('estética') || priceCastellon.replyText.includes('faciales'));
    report('En Castellón JAMÁS menciona a Dra. Sonia', !priceCastellon.replyText.includes('Sonia'));
    report('En Castellón ofrece valoración estética personalizada sin precio cerrado', priceCastellon.replyText.includes('valoración'));

  } catch (err) {
    console.error('❌ Error fatal en test suite de RAG Grounding:', err);
    failed++;
  }

  console.log('\n═════════════════════════════════════════════════════════════');
  console.log(`  📊 RESULTADO SUITE RAG GROUNDING: ${passed} superadas, ${failed} fallidas`);
  console.log('═════════════════════════════════════════════════════════════\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runSuite().then(() => {
  process.exit(0);
});
