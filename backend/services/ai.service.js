// ============================================
// Servicio Unificado de Inteligencia Artificial (AI Copilot Hub)
// Asistente Sofía — Clínica Vides Dental
// - 100% Español Europeo (Castellano de España)
// - Guardrail estricto de Precio Cero (nunca dar precios)
// - Foco absoluto en Primera Revisión / Valoración Gratuita
// - Límite de responsabilidad administrativa (sin consultas médicas)
// - Agendamiento con Dra. Sonia (Xúquer, 15m) o Estética (Castellón)
// - Detección de clínica abierta para ofrecer hablar con recepcionista
// - Traspaso inmediato por Chat Interno
// ============================================
import { query } from '../database/pool.js';
import aiKnowledgeRepository from '../repositories/ai-knowledge.repository.js';
import aiBookingService from './ai-booking.service.js';
import aiToolsService from './ai-tools.service.js';
import holidayService from './holiday.service.js';
import crmLeadRepository from '../repositories/crm-lead.repository.js';
import crmNoteRepository from '../repositories/crm-note.repository.js';
import { logger } from '../utils/logger.js';

class AIService {
  constructor() {
    this.provider = process.env.AI_PROVIDER || 'local'; // 'local' | 'groq' | 'gemini' | 'openai' | 'deepseek'
    this.groqApiKey = process.env.GROQ_API_KEY || '';
    this.geminiApiKey = process.env.GEMINI_API_KEY || '';
    this.openaiApiKey = process.env.OPENAI_API_KEY || '';
    this.deepseekApiKey = process.env.DEEPSEEK_API_KEY || '';
  }

  /**
   * Resuelve el proveedor activo basándose en las API keys disponibles o configuración explícita.
   */
  getActiveProvider() {
    if (this.openaiApiKey && (this.provider === 'openai' || !this.provider)) return 'openai';
    if (this.deepseekApiKey && (this.provider === 'deepseek' || !this.provider)) return 'deepseek';
    if (this.groqApiKey && (this.provider === 'groq' || !this.provider)) return 'groq';
    if (this.geminiApiKey && (this.provider === 'gemini' || !this.provider)) return 'gemini';
    return 'local';
  }

  /**
   * Determina si la clínica está abierta en este momento exacto.
   * Por defecto: Lunes a Viernes de 09:00 a 20:00, excluyendo fines de semana y festivos.
   */
  async isClinicOpenNow(clinicId = 1) {
    const cid = parseInt(clinicId, 10) || 1;
    const now = new Date();

    // Obtener hora local de España (Europe/Madrid)
    const madridTimeStr = now.toLocaleTimeString('es-ES', { timeZone: 'Europe/Madrid', hour12: false });
    const madridDateStr = now.toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).split('/').reverse().join('-');

    const [h, m] = madridTimeStr.split(':').map(Number);
    const currentMin = h * 60 + m;

    // Día de la semana (0=Dom, 6=Sáb)
    const dow = now.getDay();
    if (dow === 0 || dow === 6) {
      return { isOpen: false, reason: 'Fin de semana', openingHoursText: 'lunes a viernes de 09:00 a 20:00' };
    }

    // Verificar festivos oficiales o locales de la clínica
    const holiday = await holidayService.isHoliday(cid, madridDateStr);
    if (holiday) {
      return { isOpen: false, reason: `Festivo (${holiday.name})`, openingHoursText: 'lunes a viernes de 09:00 a 20:00' };
    }

    // Horario laboral estándar: 09:00 (540 min) a 20:00 (1200 min)
    const isOpen = currentMin >= 540 && currentMin < 1200;
    return {
      isOpen,
      openingHoursText: 'lunes a viernes de 09:00 a 20:00',
      currentTime: madridTimeStr.substring(0, 5),
    };
  }

  /**
   * Clasifica la intención del mensaje del paciente de forma rápida y determinista.
   * Taxonomía según AI_RAG_RESTRUCTURE_PLAN:
   * - TRANSFER_TO_HUMAN
   * - URGENT
   * - PRICE_INQUIRY
   * - CONFIRM / CANCEL
   * - BOOKING
   * - LOCATION
   * - OPENING_HOURS
   * - FIRST_VISIT
   * - TREATMENT_INFORMATION
   * - INFO / GREETING
   */
  async classifyIntent(messageText) {
    const text = (messageText || '').trim();
    const lower = text.toLowerCase();

    // 1. Detección de petición de hablar con una persona / recepcionista
    const wantsHuman = [
      'recepcionista', 'persona', 'humano', 'alguien', 'charlar', 'atendente',
      'hablar con alguien', 'operador', 'secretaria', 'asesor', 'atencion humana',
      'pasame con', 'pásame con', 'quiero hablar', 'puedo hablar', 'hablar con una persona'
    ].some(k => lower.includes(k));

    if (wantsHuman) {
      return { intent: 'TRANSFER_TO_HUMAN', confidence: 0.99, provider: 'heuristic' };
    }

    // 2. Detección de urgencia clínica médica
    const isUrgent = [
      'dolor', 'urgencia', 'emergencia', 'sangrado', 'hinchazon', 'hinchazón',
      'infeccion', 'infección', 'fiebre', 'roto', 'caido', 'accidente', 'fuerte',
      'sangrando', 'flemón', 'flemon', 'golpe', 'muela'
    ].some(w => lower.includes(w));

    if (isUrgent) {
      return { intent: 'URGENT', confidence: 0.98, provider: 'heuristic' };
    }

    // 3. Detección de consulta de precios (activar guardrail de precio cero)
    const asksPrice = [
      'precio', 'precios', 'cuanto cuesta', 'cuánto cuesta', 'tarifa', 'tarifas',
      'presupuesto', 'coste', 'costo', 'costaria', 'costaría', 'cuanto costaria', 'cuánto costaría',
      'cuanto vale', 'cuánto vale', 'valor',
      'cuanto saldria', 'cuánto saldría', 'promocion', 'descuento'
    ].some(k => lower.includes(k)) || /\b(?:precio|precios|tarifa|tarifas|presupuesto|cost[eo]|costar[íi]a)\b/i.test(lower);

    if (asksPrice) {
      return { intent: 'PRICE_INQUIRY', confidence: 0.97, provider: 'heuristic' };
    }

    // 4. Detección de confirmación, reagendamiento y cancelación
    const words = lower.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ').split(/\s+/).filter(Boolean);
    const isConfirm = ['1', '1️⃣', 'si', 'sí', 'sim', 'confirmo', 'confirmar', 'confirmado', 'ok', 'estare', 'estarei', 'estoy', 'voy', 'perfecto', 'claro'].some(
      w => words.includes(w) || lower === w
    );
    const isReschedule = [
      'cambiar cita', 'cambiar mi cita', 'cambiar la cita', 'reagendar', 'reprogramar',
      'cambiar de dia', 'cambiar de día', 'cambiar de hora', 'mover cita', 'mover mi cita',
      'otro dia', 'otro día', 'otra hora', 'cambiarla para', 'cambiarla de dia', 'cambiarla de día', 'cambiarla'
    ].some(k => lower.includes(k)) || /\b(?:cambiar\w*|reagendar|reprogramar|posponer)\b/i.test(lower);

    const isCancel = [
      '2', '2️⃣', 'cancelar', 'cancelo', 'cancelar mi cita', 'cancelar la cita',
      'no podre ir', 'no podré ir', 'no voy a poder ir', 'no podre asistir', 'no podré asistir',
      'imposible asistir', 'anular cita', 'anular mi cita'
    ].some(w => words.includes(w) || lower.includes(w));

    if (isReschedule) return { intent: 'RESCHEDULE', confidence: 0.98, provider: 'heuristic' };
    if (isCancel && !isConfirm) return { intent: 'CANCEL', confidence: 0.98, provider: 'heuristic' };
    if (isConfirm && !isCancel) return { intent: 'CONFIRM', confidence: 0.99, provider: 'heuristic' };

    // 5. Detección de ubicación / cómo llegar
    const isLocation = [
      'donde estan', 'dónde están', 'donde estais', 'dónde estáis', 'donde queda', 'dónde queda',
      'ubicacion', 'ubicación', 'direccion', 'dirección', 'como llegar', 'cómo llegar',
      'donde se encuentran', 'en que calle', 'en qué calle'
    ].some(k => lower.includes(k));

    if (isLocation) {
      return { intent: 'LOCATION', confidence: 0.96, provider: 'heuristic' };
    }

    // 6. Detección de horarios de apertura / cierre
    const isOpeningHours = [
      'horario', 'horarios', 'a que hora abren', 'a qué hora abren', 'a que hora abris', 'a qué hora abrís',
      'a que hora cierran', 'a qué hora cierran', 'estan abiertos', 'están abiertos', 'estais abiertos', 'estáis abiertos',
      'cuando abren', 'cuándo abren', 'abren los sabados', 'abren los sábados'
    ].some(k => lower.includes(k));

    if (isOpeningHours) {
      return { intent: 'OPENING_HOURS', confidence: 0.95, provider: 'heuristic' };
    }

    // 7. Detección de primera visita / revisión gratuita
    const isFirstVisit = [
      'primera visita', 'primera revision', 'primera revisión', 'primera consulta',
      'primera cita', 'revision gratuita', 'revisión gratuita', 'revision gratis', 'revisión gratis'
    ].some(k => lower.includes(k));

    if (isFirstVisit) {
      return { intent: 'FIRST_VISIT', confidence: 0.95, provider: 'heuristic' };
    }

    // 8. Detección de consulta sobre citas propias del paciente
    const isMyAppointment = [
      'mi cita', 'mis citas', 'mi proxima cita', 'mi próxima cita',
      'cuando es mi cita', 'cuándo es mi cita', 'a que hora es mi cita', 'a qué hora es mi cita',
      'a que hora tengo cita', 'a qué hora tengo cita', 'cuando tengo que ir', 'cuándo tengo que ir',
      'que dia tengo cita', 'qué día tengo cita', 'tengo cita', 'tengo alguna cita', 'tengo citas',
      'mis citas agendadas', 'citas pendientes', 'recordarme mi cita', 'recordarme cuándo', 'recordarme cuando'
    ].some(k => lower.includes(k)) || /\b(?:mi|mis|tengo|recordar\w*)\s+(?:alguna\s+)?(?:pr[oó]xima\s+)?citas?\b/i.test(lower) || /\bcu[aá]ndo\s+(?:es|tengo)\s+(?:mi|alguna)\s+cita\b/i.test(lower);

    if (isMyAppointment) {
      return { intent: 'MY_APPOINTMENTS', confidence: 0.96, provider: 'heuristic' };
    }

    // 9. Detección de consulta sobre el cuadro médico o doctores
    const isDoctorInquiry = [
      'que doctor', 'qué doctor', 'que doctores', 'qué doctores', 'quien atiende', 'quién atiende',
      'quien me atiende', 'quién me atiende', 'que especialista', 'qué especialista', 'que especialistas', 'qué especialistas',
      'cuadro medico', 'cuadro médico', 'equipo medico', 'equipo médico', 'doctores atienden', 'especialistas atienden',
      'doctores o especialistas', 'especialistas y doctores'
    ].some(k => lower.includes(k));

    if (isDoctorInquiry) {
      return { intent: 'DOCTOR_INQUIRY', confidence: 0.93, provider: 'heuristic' };
    }

    // 10. Detección de intención de cita / agendar
    const wantsBooking = [
      'cita', 'citas', 'agendar', 'pedir cita', 'reservar', 'hora',
      'hueco', 'cuando puedo ir', 'cuándo puedo ir', 'disponibilidad'
    ].some(k => lower.includes(k));

    if (wantsBooking) {
      return { intent: 'BOOKING', confidence: 0.95, provider: 'heuristic' };
    }

    // 9. Detección de información sobre tratamientos clínicos específicos
    const isTreatment = [
      'implante', 'implantes', 'ortodoncia', 'invisalign', 'brackets',
      'blanqueamiento', 'carillas', 'limpieza', 'endodoncia', 'protesis', 'prótesis',
      'estetica', 'estética', 'rejuvenecimiento', 'arrugas', 'acido hialuronico', 'ácido hialurónico'
    ].some(k => lower.includes(k));

    if (isTreatment) {
      return { intent: 'TREATMENT_INFORMATION', confidence: 0.92, provider: 'heuristic' };
    }

    return { intent: 'INFO', confidence: 0.85, provider: 'heuristic' };
  }

  /**
   * Extrae el nombre de la persona si se presenta en el texto o si responde a la pregunta de nombre.
   */
  extractInformedName(text, wasAskedForName = false) {
    if (!text) return null;
    const clean = text.trim();

    // 1. Patrón explícito de presentación: "Me llamo X", "Mi nombre es X", "Soy X", "Dime X"
    const introMatch = clean.match(/(?:me\s+llamo|mi\s+nombre\s+es|soy|puedes\s+llamarme|me\s+llaman|dime)\s+([A-Za-zÁÉÍÓÚáéíóúñÑüÜ\s]{2,40})/i);
    if (introMatch) {
      let rawName = introMatch[1].trim();
      rawName = rawName.split(/\b(y\s+|pero\s+|que\s+|quería|queria|tengo|para|por|de|solo|quisiera|aqui|aquí)\b/i)[0].trim();
      rawName = rawName.replace(/[.,;:!?]+$/, '').trim();
      const forbidden = /^(un|una|el|la|de|paciente|cliente|nuevo|amigo|amiga)$/i;
      if (rawName.length >= 2 && !forbidden.test(rawName)) {
        return this.formatName(rawName);
      }
    }

    // 2. Si el bot preguntó previamente el nombre o si el texto es muy breve (1 a 4 palabras solo letras)
    const words = clean.replace(/[.,;:!?¿¡]/g, '').trim().split(/\s+/);
    const stopWords = new Set([
      'si', 'sí', 'no', 'hola', 'buenas', 'buenos', 'dias', 'días', 'tardes', 'noches',
      'ok', 'vale', 'bien', 'gracias', 'precio', 'precios', 'cita', 'citas', 'implante',
      'implantes', 'ortodoncia', 'invisalign', 'blanqueamiento', 'cuanto', 'cuánto', 'cuesta',
      'urgencia', 'dolor', 'recepcionista', 'persona', 'humano', 'queria', 'quería', 'saber',
      'informacion', 'información', 'consulta', 'horario', 'abierto', 'cerrado', 'muela',
      'coste', 'costo', 'presupuesto', 'atencion', 'atención'
    ]);

    if (words.length >= 1 && words.length <= 4) {
      const isAllLetters = words.every(w => /^[A-Za-zÁÉÍÓÚáéíóúñÑüÜ]+$/.test(w));
      const hasStopWord = words.some(w => stopWords.has(w.toLowerCase()));

      if (isAllLetters && !hasStopWord && (wasAskedForName || words.length <= 3)) {
        return this.formatName(words.join(' '));
      }
    }

    return null;
  }

  formatName(name) {
    return name
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  /**
   * Ensambla el contexto estructurado según la especificación de AI_RAG_RESTRUCTURE_PLAN:
   * SYSTEM POLICY + INTENT + CONVERSATION CONTEXT + TOP RAG RESULTS + TOOL RESULTS + CRM CONTEXT
   */
  assembleRAGContext({
    clinicId = 1,
    incomingText = '',
    intentData = { intent: 'INFO', confidence: 0.8 },
    clinicStatus = { isOpen: true, openingHoursText: '09:00 a 20:00' },
    docInfo = {},
    ragResults = { articles: [], topMatch: null, confidence: 'NONE' },
    patient = { name: null, firstName: null, isConfirmed: false },
    slots = [],
    patientAppointments = null,
    clinicDoctors = null,
    requiredToolResult = null,
    conversationHistory = [],
  }) {
    const cid = parseInt(clinicId, 10) || 1;
    const topMatch = ragResults.topMatch || null;

    return {
      systemPolicy: {
        role: 'Sofia, asistente virtual y recepcionista',
        clinicId: cid,
        clinicName: cid === 1 ? 'Clínica Vides Dental Xúquer' : 'Clínica de Estética Castellón',
        clinicLocation: cid === 1 ? 'Alcàntera de Xúquer, Valencia' : 'Cabanes, Castellón',
        clinicType: cid === 1 ? 'DENTAL' : 'ESTETICA',
        tone: 'Español de España (castellano), profesional, cálido, conciso, humano, nunca robótico',
        zeroPricePolicy: true,
        humanTransferAvailable: clinicStatus.isOpen,
        openingHoursText: clinicStatus.openingHoursText,
      },
      intent: intentData.intent,
      patient: {
        name: patient.name || null,
        firstName: patient.firstName || null,
        isConfirmed: Boolean(patient.isConfirmed),
      },
      rag: {
        confidence: ragResults.confidence || 'NONE',
        topMatch: topMatch ? {
          id: topMatch.id,
          title: topMatch.title,
          category: topMatch.category,
          content: topMatch.content,
          doNotSay: topMatch.do_not_say || null,
          nextAction: topMatch.next_action || null,
        } : null,
        articles: (ragResults.articles || []).map(a => ({
          id: a.id,
          title: a.title,
          category: a.category,
          content: a.content,
          doNotSay: a.do_not_say || null,
          nextAction: a.next_action || null,
        })),
        doNotSay: topMatch?.do_not_say || null,
        nextAction: topMatch?.next_action || null,
      },
      tools: {
        clinicStatus,
        docInfo,
        slots: slots || [],
        patientAppointments: patientAppointments || null,
        clinicDoctors: clinicDoctors || null,
        requiredToolResult: requiredToolResult || null,
      },
      conversation: {
        lastUserMessage: incomingText,
        history: (conversationHistory || []).slice(-4),
      },
    };
  }

  /**
   * Construye el System Prompt estructurado para LLMs externos (Groq, OpenAI, Gemini, DeepSeek).
   */
  buildSystemPrompt(ctx) {
    const { systemPolicy, rag, tools, patient } = ctx;
    const clinicName = systemPolicy.clinicName;

    let prompt = `Eres Sofía, recepcionista y asistente virtual de atención al paciente de ${clinicName} (${systemPolicy.clinicLocation}).\n`;
    prompt += `Tu tono debe ser: ${systemPolicy.tone}.\n\n`;

    prompt += `POLÍTICAS Y GUARDRAILS DEONTOLÓGICOS OBLIGATORIOS:\n`;
    prompt += `1. POLÍTICA DE PRECIO CERO: NUNCA des cifras monetarias, precios cerrados, tarifas ni presupuestos por chat. Explica que cada paciente y anatomía son únicos y requieren exploración clínica presencial. La primera consulta de valoración es totalmente gratuita y sin compromiso.\n`;
    prompt += `2. NO DIAGNOSTICAR: Nunca diagnostiques enfermedades ni prescribas tratamientos a distancia.\n`;
    prompt += `3. GROUNDING ESTRICTO EN RAG: Basa tus respuestas ÚNICAMENTE en la Base de Conocimiento Oficial Aprobada provista a continuación. Nunca inventes coberturas, mutuas ni condiciones no especificadas.\n`;
    prompt += `4. REGLA DE NO-INVENCIÓN: Si no tienes información en el conocimiento oficial sobre lo preguntado, indica amablemente que el equipo de recepción lo verificará en persona o por teléfono, y ofrece la primera visita gratuita.\n`;
    prompt += `5. AVANZAR LA CONVERSACIÓN: Termina siempre con un único paso siguiente claro (ej. ofrecer primera visita presencial o consultar disponibilidad horaria).\n\n`;

    if (patient.firstName) {
      prompt += `El paciente se llama: ${patient.firstName}.\n\n`;
    }

    prompt += `BASE DE CONOCIMIENTO OFICIAL APROBADA (RAG):\n`;
    if (rag.articles && rag.articles.length > 0) {
      rag.articles.forEach((art, idx) => {
        prompt += `--- ARTÍCULO ${idx + 1} ---\n`;
        prompt += `Título: ${art.title} (${art.category})\n`;
        prompt += `Contenido Oficial: ${art.content}\n`;
        if (art.nextAction) prompt += `Acción recomendada: ${art.nextAction}\n`;
        if (art.doNotSay) prompt += `Prohibido decir: ${art.doNotSay}\n`;
      });
    } else {
      prompt += `(No se encontraron artículos oficiales específicos para esta consulta. Aplica la regla de no-invención y ofrece contactar con recepción).\n`;
    }

    if (tools.slots && tools.slots.length > 0) {
      prompt += `\nDISPONIBILIDAD DE AGENDA REAL (TOOLS):\n`;
      tools.slots.slice(0, 2).forEach(s => {
        prompt += `* Próximo ${s.date} a las ${s.formattedArrival || s.time}\n`;
      });
      prompt += `IMPORTANTE: Menciona únicamente la hora de llegada, jamás hables de la duración de la cita.\n`;
    }

    if (tools.patientAppointments?.upcoming && tools.patientAppointments.upcoming.length > 0) {
      prompt += `\nCITAS ACTIVAS DEL PACIENTE EN EL SISTEMA (TOOLS):\n`;
      tools.patientAppointments.upcoming.forEach(a => {
        prompt += `* Cita el ${a.date} a las ${a.formattedArrival || a.time} con ${a.doctorName} (Estado: ${a.status})\n`;
      });
    }

    if (tools.clinicDoctors?.doctors && tools.clinicDoctors.doctors.length > 0) {
      prompt += `\nCUADRO MÉDICO REAL DE LA SEDE (TOOLS):\n`;
      tools.clinicDoctors.doctors.forEach(d => {
        prompt += `* ${d.name} (${d.specialty || 'Especialista'})\n`;
      });
    }

    return prompt;
  }

  /**
   * Invoca al proveedor LLM activo con timeout estricto y validación de guardrails post-generación.
   */
  async callLLMProvider({ structuredContext, systemPrompt, userMessage }) {
    const provider = this.getActiveProvider();
    if (provider === 'local') return null;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      let url = '';
      let headers = { 'Content-Type': 'application/json' };
      let body = {};

      if (provider === 'groq') {
        url = 'https://api.groq.com/openai/v1/chat/completions';
        headers['Authorization'] = `Bearer ${this.groqApiKey}`;
        body = {
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ],
          temperature: 0.2,
          max_tokens: 300,
        };
      } else if (provider === 'openai') {
        url = 'https://api.openai.com/v1/chat/completions';
        headers['Authorization'] = `Bearer ${this.openaiApiKey}`;
        body = {
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ],
          temperature: 0.2,
          max_tokens: 300,
        };
      } else if (provider === 'deepseek') {
        url = 'https://api.deepseek.com/chat/completions';
        headers['Authorization'] = `Bearer ${this.deepseekApiKey}`;
        body = {
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ],
          temperature: 0.2,
          max_tokens: 300,
        };
      } else if (provider === 'gemini') {
        url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.geminiApiKey}`;
        body = {
          contents: [
            {
              role: 'user',
              parts: [{ text: `${systemPrompt}\n\n[MENSAJE DEL PACIENTE]: ${userMessage}` }]
            }
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 300,
          }
        };
      }

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        logger.warn(`[AI_PROVIDER] Fallo HTTP en proveedor ${provider}: status ${res.status}`);
        return null;
      }

      const data = await res.json();
      let generatedText = '';
      if (provider === 'gemini') {
        generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      } else {
        generatedText = data.choices?.[0]?.message?.content || '';
      }

      generatedText = generatedText.trim();
      if (!generatedText) return null;

      // GUARDRAIL DE PRECIO CERO: Rechazar si menciona números como precio
      if (/\b\d+\s*(?:€|euros?|dolares|usd)\b/i.test(generatedText) || /cuesta\s+\d+/i.test(generatedText)) {
        logger.warn(`[AI_GUARDRAIL] Salida de LLM ${provider} violó guardrail de precio cero. Fallback determinista activado.`);
        return null;
      }

      // GUARDRAIL DE NO DECIR: Verificar restricciones específicas
      if (structuredContext.rag.doNotSay && generatedText.toLowerCase().includes(structuredContext.rag.doNotSay.toLowerCase())) {
        logger.warn(`[AI_GUARDRAIL] Salida de LLM violó directriz do_not_say. Fallback determinista activado.`);
        return null;
      }

      return {
        replyText: generatedText,
        provider,
      };
    } catch (err) {
      logger.warn(`[AI_PROVIDER] Excepción en llamada a ${provider} (${err.message}). Activando fallback determinista.`);
      return null;
    }
  }

  /**
   * Generador determinista de respuestas fundamentadas en RAG (Fallback y modo local).
   * Implementa 100% de los guardrails clínicos y las reglas de negocio.
   */
  synthesizeDeterministicReply(ctx) {
    const { systemPolicy, intent, patient, rag, tools } = ctx;
    const cid = systemPolicy.clinicId;
    const firstName = patient.firstName;
    const topMatch = rag.topMatch;
    const ragConfidence = rag.confidence;
    const slots = tools.slots || [];
    const docInfo = tools.docInfo || {};

    const greetingPrefix = firstName ? `Hola ${firstName}, ` : 'Hola, ';
    const humanOption = tools.clinicStatus?.isOpen
      ? `\n\nSi en algún momento desea hablar con un recepcionista, solo indíquemelo y le transferiré de inmediato.`
      : `\n\n(Nuestro equipo de recepción está disponible de ${tools.clinicStatus?.openingHoursText || 'lunes a viernes de 09:00 a 20:00'}. Si lo desea, puede dejarme su consulta y le contactaremos a primera hora).`;

    const askNamePhrase = (!patient.isConfirmed)
      ? ' Por cierto, para poder dirigirnos adecuadamente a usted, ¿con quién tengo el gusto de hablar?'
      : '';

    // 1. TRANSFER_TO_HUMAN
    if (intent === 'TRANSFER_TO_HUMAN') {
      const politeAddress = firstName ? `${firstName}` : 'con gusto';
      return {
        replyText: `Por supuesto, ${politeAddress}. He avisado a nuestro equipo de recepción. En unos instantes una de nuestras compañeras continuará la conversación con usted por este mismo chat. ¡Muchas gracias por su paciencia!`,
        action: 'TRANSFER_TO_HUMAN',
        intent,
      };
    }

    // 2. URGENT
    if (intent === 'URGENT') {
      const address = firstName ? `, ${firstName}` : '';
      return {
        replyText: `Comprendo la situación${address}. Ante un cuadro de molestia aguda o urgencia, es prioritario que le valore nuestro equipo presencialmente. Estoy avisando de inmediato a nuestra recepción para que le den prioridad en la agenda hoy mismo. Un recepcionista continuará el chat con usted ahora mismo.`,
        action: 'TRANSFER_TO_HUMAN',
        intent,
        isUrgent: true,
      };
    }

    // 3. PRICE_INQUIRY (Guardrail de Precio Cero)
    if (intent === 'PRICE_INQUIRY') {
      const clinicFocus = cid === 1 ? 'salud bucodental' : 'medicina estética y tratamientos faciales';

      if (docInfo?.isReturningPatient) {
        return {
          replyText: `${greetingPrefix}gracias por consultarnos. Para darle un presupuesto exacto adaptado a su historial clínico con ${docInfo.doctorTitle || 'su doctor habitual'}, le recomendamos una cita de revisión presencial en la clínica.\n\n¿Le gustaría que le reservemos un hueco con ${docInfo.doctorTitle || 'su especialista'} esta semana?${askNamePhrase}${humanOption}`,
          action: 'OFFER_FIRST_VISIT',
          intent,
        };
      }

      const visitFocus = cid === 1
        ? 'ofrecemos una primera consulta de revisión y diagnóstico totalmente gratuita y sin compromiso'
        : 'ofrecemos una primera consulta de valoración estética personalizada sin compromiso';

      return {
        replyText: `${greetingPrefix}gracias por consultarnos. Cada persona y cada anatomía son únicas, y por rigor y ética profesional en ${clinicFocus} no facilitamos tarifas cerradas por chat sin una exploración previa.\n\nPor ello, en Clínica Vides Dental ${visitFocus}, donde el especialista examinará su caso y le entregará un presupuesto exacto y transparente en mano.\n\n¿Le gustaría que le reservemos un hueco esta semana?${askNamePhrase}${humanOption}`,
        action: 'OFFER_FIRST_VISIT',
        intent,
      };
    }

    // 4. LOCATION (RAG Grounding)
    if (intent === 'LOCATION') {
      const locationText = topMatch && ragConfidence !== 'NONE'
        ? topMatch.content
        : (cid === 1 
            ? 'Clínica Vides Dental Xúquer está situada en Av. Reforma 1234, Alcàntera de Xúquer, Valencia.' 
            : 'Nuestra clínica de estética en Castellón está situada en Calle Cabanes 123, Cabanes, Castellón.');

      return {
        replyText: `${greetingPrefix}${locationText}\n\n¿Desea que le agendemos una cita para visitarnos o necesita alguna indicación sobre cómo llegar?${askNamePhrase}${humanOption}`,
        action: 'LOCATION_PROVIDED',
        intent,
      };
    }

    // 5. OPENING_HOURS (RAG Grounding)
    if (intent === 'OPENING_HOURS') {
      const hoursText = topMatch && ragConfidence !== 'NONE'
        ? topMatch.content
        : (cid === 1
            ? 'Clínica Vides Dental Xúquer está abierta de lunes a viernes en horario ininterrumpido de 09:00 a 20:00.'
            : 'Nuestra clínica de estética en Castellón atiende de lunes a viernes de 10:00 a 19:00.');

      return {
        replyText: `${greetingPrefix}${hoursText}\n\n¿En qué franja horaria le vendría mejor agendar su cita?${askNamePhrase}${humanOption}`,
        action: 'HOURS_PROVIDED',
        intent,
      };
    }

    // 6. TREATMENT_INFORMATION (RAG Grounding)
    if (intent === 'TREATMENT_INFORMATION') {
      let treatmentText = topMatch && ragConfidence !== 'NONE' ? topMatch.content : '';
      if (!treatmentText) {
        treatmentText = cid === 1
          ? 'Ofrecemos atención odontológica integral: implantología dental, ortodoncia invisible y brackets, estética dental y carillas, blanqueamiento dental en clínica, prótesis dentales fijas y removibles, periodoncia, endodoncia y limpiezas profesionales.'
          : 'Disponemos de tratamientos de medicina estética facial y corporal, armonización facial, rejuvenecimiento cutáneo, bioestimulación y cuidados dermocosméticos avanzados.';
      }

      const freeVisitReminder = cid === 1
        ? 'Le recordamos que disponemos de una primera consulta de revisión y diagnóstico totalmente gratuita y sin compromiso.'
        : 'Disponemos de una primera consulta de valoración personalizada sin compromiso.';

      return {
        replyText: `${greetingPrefix}${treatmentText}\n\n${freeVisitReminder}\n\n¿Le gustaría que le reservemos un hueco para valorar su caso de forma personalizada?${askNamePhrase}${humanOption}`,
        action: 'TREATMENT_INFO_PROVIDED',
        intent,
      };
    }

    // 7. BOOKING / FIRST_VISIT (Combina RAG + Tools de Slots)
    if (intent === 'BOOKING' || intent === 'FIRST_VISIT') {
      let slotProposal = '';
      if (slots.length >= 2) {
        slotProposal = ` Disponemos, por ejemplo, de hueco el próximo ${slots[0].date} ${slots[0].formattedArrival || slots[0].time} o ${slots[1].formattedArrival || slots[1].time}.`;
      } else if (slots.length === 1) {
        slotProposal = ` Disponemos de hueco el próximo ${slots[0].date} ${slots[0].formattedArrival || slots[0].time}.`;
      }

      if (docInfo?.isReturningPatient) {
        return {
          replyText: `¡Qué alegría saludarle de nuevo${firstName ? ', ' + firstName : ''}! Para su cita de seguimiento y revisión con ${docInfo.doctorTitle || 'su especialista habitual'}${slotProposal}\n\n¿Le vendría bien alguna de estas horas, o prefiere otro día?${askNamePhrase}${humanOption}`,
          action: 'SLOTS_OFFERED',
          intent,
          slots,
        };
      }

      if (cid === 1) {
        return {
          replyText: `¡Con mucho gusto${firstName ? ', ' + firstName : ''}! La primera revisión diagnóstica en Clínica Vides Dental Xúquer es totalmente gratuita y será atendida por nuestro equipo.${slotProposal}\n\n¿Le vendría bien alguna de estas horas, o prefiere otro día?${askNamePhrase}${humanOption}`,
          action: 'SLOTS_OFFERED',
          intent,
          slots,
        };
      } else {
        return {
          replyText: `¡Con mucho gusto${firstName ? ', ' + firstName : ''}! En nuestra clínica de estética de Castellón coordinamos una primera consulta de valoración con nuestro especialista para estudiar sus necesidades.${slotProposal}\n\n¿Le viene bien alguna de estas opciones?${askNamePhrase}${humanOption}`,
          action: 'SLOTS_OFFERED',
          intent,
          slots,
        };
      }
    }

    // 7b. MY_APPOINTMENTS (Tool Grounding - Citas activas del paciente)
    if (intent === 'MY_APPOINTMENTS') {
      const apptData = tools.patientAppointments || (tools.requiredToolResult?.tool === 'patient_appointments_tool' ? tools.requiredToolResult.data : null);
      if (apptData && apptData.count > 0 && apptData.nextAppointment) {
        const next = apptData.nextAppointment;
        const apptDetails = `su próxima cita está programada para el ${next.date} a las ${next.formattedArrival || next.time} con ${next.doctorName} (${next.treatment || 'Consulta'}).`;
        return {
          replyText: `${greetingPrefix}${apptDetails}\n\nLe recordamos acudir con unos minutos de antelación. Si necesita modificarla o cancelarla, indíquemelo para avisar a recepción.${askNamePhrase}${humanOption}`,
          action: 'APPOINTMENTS_CHECKED',
          intent,
          appointments: apptData.appointments,
        };
      } else {
        return {
          replyText: `${greetingPrefix}no hemos localizado ninguna cita activa o próxima programada en el sistema para sus datos de contacto en Clínica Vides.\n\n¿Desea que le agendemos una cita o prefiere que un recepcionista verifique su ficha médica?${askNamePhrase}${humanOption}`,
          action: 'NO_APPOINTMENTS_FOUND',
          intent,
        };
      }
    }

    // 7c. DOCTOR_INQUIRY (Tool Grounding - Cuadro médico y especialistas)
    if (intent === 'DOCTOR_INQUIRY') {
      const docsData = tools.clinicDoctors || (tools.requiredToolResult?.tool === 'doctor_catalog_tool' ? tools.requiredToolResult.data : null);
      if (docsData && docsData.doctors && docsData.doctors.length > 0) {
        const docList = docsData.doctors.map(d => `${d.name} (${d.specialty || 'Especialista'})`).join(', ');
        const firstDoc = docsData.firstVisitDoctor ? docsData.firstVisitDoctor.name : null;
        const firstDocPhrase = firstDoc ? ` Para su primera visita y diagnóstico, habitualmente le atenderá ${firstDoc}.` : '';

        return {
          replyText: `${greetingPrefix}nuestro equipo asistencial y médico está formado por profesionales colegiados: ${docList}.${firstDocPhrase}\n\n¿Desea que le reservemos una consulta de valoración presencial?${askNamePhrase}${humanOption}`,
          action: 'DOCTORS_PROVIDED',
          intent,
          doctors: docsData.doctors,
        };
      } else {
        const fallbackText = cid === 1
          ? 'En Clínica Vides Dental Xúquer contamos con un equipo multidisciplinar colegiado especializado en implantología, ortodoncia y estética dental, liderado en primera consulta por la Dra. Sonia Vides.'
          : 'En nuestra clínica de Castellón contamos con profesionales médicos especializados en medicina estética y armonización facial.';
        return {
          replyText: `${greetingPrefix}${fallbackText}\n\n¿Desea que le agendemos una consulta de valoración presencial?${askNamePhrase}${humanOption}`,
          action: 'DOCTORS_PROVIDED',
          intent,
        };
      }
    }

    // 7d. RESCHEDULE (Reagendamiento interactivo)
    if (intent === 'RESCHEDULE') {
      const apptData = tools.patientAppointments || (tools.requiredToolResult?.tool === 'patient_appointments_tool' ? tools.requiredToolResult.data : null);
      if (apptData && apptData.count > 0 && apptData.nextAppointment) {
        const next = apptData.nextAppointment;
        let slotProposal = '';
        if (slots.length >= 2) {
          slotProposal = ` Disponemos, por ejemplo, de hueco el próximo ${slots[0].date} ${slots[0].formattedArrival || slots[0].time} o ${slots[1].formattedArrival || slots[1].time}.`;
        } else if (slots.length === 1) {
          slotProposal = ` Disponemos de hueco el próximo ${slots[0].date} ${slots[0].formattedArrival || slots[0].time}.`;
        }

        return {
          replyText: `${greetingPrefix}comprendo perfectamente. Tiene programada su próxima cita para el ${next.date} a las ${next.formattedArrival || next.time} con ${next.doctorName}.${slotProposal}\n\n¿Le vendría bien alguna de estas opciones para realizar el cambio, o prefiere otro día?${askNamePhrase}${humanOption}`,
          action: 'RESCHEDULE_PROPOSED',
          intent,
          appointmentId: next.id,
          slots,
        };
      } else {
        let slotProposal = '';
        if (slots.length >= 1) {
          slotProposal = ` Disponemos, por ejemplo, de hueco el próximo ${slots[0].date} ${slots[0].formattedArrival || slots[0].time}.`;
        }
        return {
          replyText: `${greetingPrefix}no hemos localizado ninguna cita activa en nuestro sistema para poder cambiar la fecha. Si lo desea, podemos reservarle directamente una primera visita diagnóstica gratuita.${slotProposal}\n\n¿Le gustaría que le agendemos un hueco?${askNamePhrase}${humanOption}`,
          action: 'NO_APPOINTMENT_TO_RESCHEDULE',
          intent,
          slots,
        };
      }
    }

    // 7e. CANCEL (Cancelación determinista de cita)
    if (intent === 'CANCEL') {
      const apptData = tools.patientAppointments || (tools.requiredToolResult?.tool === 'patient_appointments_tool' ? tools.requiredToolResult.data : null);
      if (apptData && apptData.count > 0 && apptData.nextAppointment) {
        const next = apptData.nextAppointment;
        return {
          replyText: `${greetingPrefix}hemos localizado su cita programada para el ${next.date} a las ${next.formattedArrival || next.time} con ${next.doctorName}. La hemos cancelado en nuestra agenda y liberado el hueco correspondiente.\n\nCuando desee retomar su atención o buscar una nueva fecha, solo indíquemelo por este chat. ¡Muchas gracias por avisarnos!${askNamePhrase}${humanOption}`,
          action: 'APPOINTMENT_CANCELLED',
          intent,
          appointmentId: next.id,
          date: next.date,
          time: next.time,
        };
      } else {
        return {
          replyText: `${greetingPrefix}no consta ninguna cita activa o próxima programada a su nombre en el sistema para poder cancelar.\n\nSi necesita cualquier otra gestión o desea concertar una nueva cita, quedo a su entera disposición.${askNamePhrase}${humanOption}`,
          action: 'NO_APPOINTMENT_TO_CANCEL',
          intent,
        };
      }
    }

    // 8. RAG GROUNDING PARA CUALQUIER OTRA CONSULTA CON CONFIANZA HIGH O MEDIUM
    if (topMatch && (ragConfidence === 'HIGH' || ragConfidence === 'MEDIUM')) {
      let knowledgeText = topMatch.content;
      if (ragConfidence === 'MEDIUM') {
        knowledgeText += `\n\n(Para cualquier detalle técnico o particular adicional, nuestro equipo de recepción estará encantado de precisárselo en consulta).`;
      }

      const nextAct = topMatch.nextAction
        ? `\n\n${topMatch.nextAction}`
        : (cid === 1
            ? `\n\nLe recordamos que disponemos de una primera consulta de revisión y diagnóstico gratuita. ¿Desea que le agendemos un hueco?`
            : `\n\n¿Desea que le coordinemos una cita de valoración presencial?`);

      return {
        replyText: `${greetingPrefix}${knowledgeText}${nextAct}${askNamePhrase}${humanOption}`,
        action: 'KNOWLEDGE_PROVIDED',
        intent,
      };
    }

    // 9. GUARDRAIL DE NO INVENCIÓN (Rule 10: DO NOT INVENT) para consultas sustantivas sin conocimiento RAG (LOW o NONE)
    const lastMsg = (ctx.conversation?.lastUserMessage || '').toLowerCase();
    const isSubstantiveQuestion = lastMsg.includes('?') ||
      /^(que|qué|como|cómo|donde|dónde|cuando|cuándo|teneis|tenéis|tienen|haceis|hacéis|hacen|trabajais|trabajáis|trabajan|aceptais|aceptáis|aceptan|puedo|se puede)/i.test(lastMsg);

    if (isSubstantiveQuestion && ragConfidence === 'NONE') {
      const noInventText = cid === 1
        ? `Para ofrecerle la información exacta y personalizada sobre ese aspecto en Clínica Vides Dental Xúquer, nuestro equipo de recepción puede confirmarle todos los detalles directamente. ¿Desea que le comunique con una recepcionista o le gustaría que le reservemos un hueco para una primera consulta de valoración gratuita?`
        : `Para ofrecerle la información más precisa sobre ese aspecto en nuestra clínica de Castellón, nuestro equipo de recepción puede orientarle detalladamente. ¿Desea que le comunique con una recepcionista o prefiere coordinar una primera consulta de valoración presencial?`;

      return {
        replyText: `${greetingPrefix}${noInventText}${askNamePhrase}${humanOption}`,
        action: 'LOW_CONFIDENCE_ESCALATION',
        intent,
      };
    }

    // 10. Saludo general de cortesía
    if (docInfo?.isReturningPatient) {
      return {
        replyText: `${greetingPrefix}qué alegría saludarle de nuevo en Clínica Vides. Le atiende Sofía. ¿En qué podemos ayudarle hoy con su tratamiento o desea reservar una cita con ${docInfo.doctorTitle || 'su doctor habitual'}?${askNamePhrase}${humanOption}`,
        action: 'GENERAL_GREETING',
        intent,
      };
    }

    if (cid === 1) {
      return {
        replyText: `${greetingPrefix}le atiende Sofía, asistente de Clínica Vides Dental Xúquer. Estamos a su disposición para el cuidado de su salud bucodental. Le recordamos que dispone de una primera revisión diagnóstica gratuita en nuestra clínica.\n\n¿Le gustaría reservar una cita de revisión o consultar alguna duda sobre nuestros tratamientos?${askNamePhrase}${humanOption}`,
        action: 'GENERAL_GREETING',
        intent,
      };
    } else {
      return {
        replyText: `${greetingPrefix}le atiende Sofía de nuestra Clínica de Estética en Castellón. Estamos a su disposición para asesorarle en tratamientos médico-estéticos faciales y corporales. Disponemos de una primera consulta de valoración presencial para estudiar su caso.\n\n¿Desea que le coordinemos una cita de valoración?${askNamePhrase}${humanOption}`,
        action: 'GENERAL_GREETING',
        intent,
      };
    }
  }

  /**
   * Genera la respuesta inteligente de Sofía para WhatsApp / Instagram.
   * Reglas de oro:
   * - NUNCA da precios.
   * - En Xúquer: Primera revisión gratuita con Dra. Sonia (15 min). Solo comunica hora de llegada.
   * - En Castellón: Primera valoración con especialista de estética. Solo comunica hora de llegada.
   * - Si la clínica está abierta: ofrece la opción de transferir a un recepcionista.
   * - Pregunta cortésmente el nombre y utiliza el nombre que el paciente informe.
   */
  async generateSofiaReply({
    clinicId = 1,
    incomingText = '',
    senderName = '',
    senderPhone = null,
    isNameConfirmed = false,
    confirmedName = null,
    conversationHistory = []
  }) {
    const cid = parseInt(clinicId, 10) || 1;
    const text = (incomingText || '').trim();

    // Comprobar si el último mensaje saliente de Sofía preguntó el nombre
    const lastOutbound = [...conversationHistory].reverse().find(m => m.direction === 'OUTBOUND')?.body || '';
    const wasAskedForName = /con quién tengo el gusto|su nombre|cómo dirigirnos|indicarme su nombre/i.test(lastOutbound);

    // Intentar extraer el nombre informado por el usuario
    const detectedName = this.extractInformedName(text, wasAskedForName);
    const hasConfirmedName = Boolean(isNameConfirmed && confirmedName) || Boolean(detectedName);
    const effectiveName = detectedName || confirmedName || null;
    const firstName = effectiveName ? effectiveName.split(' ')[0] : null;

    // 1. Analizar intención, horario de la clínica y búsqueda guiada en la Base de Conocimiento RAG
    const [intentData, clinicStatus, docInfo] = await Promise.all([
      this.classifyIntent(text),
      this.isClinicOpenNow(cid),
      aiBookingService.getDoctorForPatient({ clinicId: cid, phone: senderPhone }),
    ]);

    // Búsqueda RAG orientada a intención y sinónimos (Top-K = 3)
    const ragResults = await aiKnowledgeRepository.searchRelevant(cid, text, {
      intent: intentData.intent,
      topK: 3,
      minScore: 4,
    });
    const topMatch = ragResults.topMatch || null;
    const ragConfidence = ragResults.confidence || 'NONE';
    const ragContext = {
      articles: ragResults.articles || [],
      topMatchTitle: topMatch?.title || null,
      confidence: ragConfidence,
      intent: intentData.intent,
    };

    // Si el usuario SOLO nos proporcionó su nombre (o respondió a la pregunta de nombre)
    if (detectedName && (intentData.intent === 'INFO' || wasAskedForName) && text.length <= 40) {
      const greeting = `¡Mucho gusto, ${firstName}! Es un placer saludarle.`;
      const offer = cid === 1
        ? `En Clínica Vides Dental Xúquer estamos a su entera disposición para cuidar de su salud bucodental. Le recordamos que disponemos de una primera consulta de revisión y diagnóstico totalmente gratuita y sin compromiso.\n\n¿En qué podemos ayudarle hoy o le gustaría que le reservemos un hueco para su revisión?`
        : `En nuestra clínica de estética de Castellón estamos a su disposición para asesorarle en tratamientos médico-estéticos faciales y corporales. Disponemos de una primera consulta de valoración presencial sin compromiso.\n\n¿Desea que le coordinemos una cita de valoración?`;

      const humanOption = clinicStatus.isOpen
        ? `\n\nSi en algún momento desea hablar con un recepcionista, solo indíquemelo y le transferiré de inmediato.`
        : `\n\n(Nuestro equipo de recepción está disponible de ${clinicStatus.openingHoursText}. Si lo desea, puede dejarme su consulta y le contactaremos a primera hora).`;

      return {
        replyText: `${greeting} ${offer}${humanOption}`,
        action: 'NAME_ACKNOWLEDGED',
        intent: 'NAME_PROVIDED',
        detectedName,
        isNameConfirmed: true,
        ragContext,
      };
    }

    // Obtener disponibilidad de franjas si la intención es de agendamiento o reagendamiento
    let slots = [];
    if (intentData.intent === 'BOOKING' || intentData.intent === 'FIRST_VISIT' || intentData.intent === 'RESCHEDULE') {
      const slotsData = await aiBookingService.getAvailableSlots(cid, null, { phone: senderPhone });
      slots = (slotsData.availableSlots || []).slice(0, 2);
    }

    // Dynamic Tool Grounding según la intención detectada
    let patientAppointments = null;
    if (intentData.intent === 'MY_APPOINTMENTS' || intentData.intent === 'RESCHEDULE' || intentData.intent === 'CANCEL') {
      patientAppointments = await aiToolsService.getPatientAppointments({ clinicId: cid, phone: senderPhone });
    }

    let clinicDoctors = null;
    if (intentData.intent === 'DOCTOR_INQUIRY') {
      clinicDoctors = await aiToolsService.getClinicDoctors({ clinicId: cid });
    }

    // Ejecutar required_tool definido en el artículo RAG si existe y no está ya cubierto por la intención
    let requiredToolResult = null;
    const requiredToolName = topMatch?.metadata?.required_tool || topMatch?.required_tool;
    if (requiredToolName && !['MY_APPOINTMENTS', 'DOCTOR_INQUIRY', 'RESCHEDULE', 'CANCEL'].includes(intentData.intent)) {
      requiredToolResult = await aiToolsService.executeTool(requiredToolName, { clinicId: cid, phone: senderPhone });
      if (requiredToolName === 'availability_tool' && slots.length === 0 && requiredToolResult?.data?.availableSlots) {
        slots = requiredToolResult.data.availableSlots.slice(0, 2);
      }
      if (requiredToolName === 'doctor_catalog_tool' && !clinicDoctors && requiredToolResult?.data) {
        clinicDoctors = requiredToolResult.data;
      }
      if (requiredToolName === 'patient_appointments_tool' && !patientAppointments && requiredToolResult?.data) {
        patientAppointments = requiredToolResult.data;
      }
    }

    // Determinar qué herramienta principal se utilizó
    const toolExecuted = (intentData.intent === 'MY_APPOINTMENTS' || intentData.intent === 'CANCEL')
      ? 'patient_appointments_tool'
      : (intentData.intent === 'DOCTOR_INQUIRY'
          ? 'doctor_catalog_tool'
          : (intentData.intent === 'RESCHEDULE'
              ? 'reschedule_tool'
              : (requiredToolResult?.tool || (slots.length > 0 ? 'availability_tool' : null))));

    // Ensamblar contexto RAG estructurado
    const structuredContext = this.assembleRAGContext({
      clinicId: cid,
      incomingText: text,
      intentData,
      clinicStatus,
      docInfo,
      ragResults,
      patient: { name: effectiveName, firstName, isConfirmed: hasConfirmedName, phone: senderPhone },
      slots,
      patientAppointments,
      clinicDoctors,
      requiredToolResult,
      conversationHistory,
    });

    // Síntesis con proveedor LLM si está configurado y no es traspaso directo
    let llmReply = null;
    if (this.getActiveProvider() !== 'local' && !['TRANSFER_TO_HUMAN', 'URGENT', 'CANCEL'].includes(intentData.intent)) {
      const systemPrompt = this.buildSystemPrompt(structuredContext);
      llmReply = await this.callLLMProvider({
        structuredContext,
        systemPrompt,
        userMessage: text,
      });
    }

    if (llmReply && llmReply.replyText) {
      return {
        replyText: llmReply.replyText,
        action: topMatch ? 'KNOWLEDGE_PROVIDED' : 'GENERAL_GREETING',
        intent: intentData.intent,
        detectedName,
        isNameConfirmed: Boolean(effectiveName),
        ragContext,
        provider: llmReply.provider,
        groundedInRag: Boolean(topMatch),
        toolExecuted,
        structuredContext,
      };
    }

    // Fallback a generador determinista fundamentado en RAG y Tools
    const deterministic = this.synthesizeDeterministicReply(structuredContext);

    // Si la acción determinista fue cancelar una cita activa, ejecutar la cancelación en BD
    if (deterministic.action === 'APPOINTMENT_CANCELLED' && deterministic.appointmentId) {
      await aiBookingService.cancelAppointment({
        clinicId: cid,
        appointmentId: deterministic.appointmentId,
        phone: senderPhone,
        reason: 'Cancelado por el paciente por chat',
      });
    }

    return {
      replyText: deterministic.replyText,
      action: deterministic.action,
      intent: deterministic.intent,
      detectedName,
      isNameConfirmed: Boolean(effectiveName),
      ragContext,
      slots: deterministic.slots || undefined,
      appointments: deterministic.appointments || patientAppointments?.appointments || undefined,
      appointmentId: deterministic.appointmentId || undefined,
      doctors: deterministic.doctors || clinicDoctors?.doctors || undefined,
      isUrgent: deterministic.isUrgent || undefined,
      provider: 'local_rag_grounded',
      groundedInRag: Boolean(topMatch && ragConfidence !== 'NONE'),
      toolExecuted,
      structuredContext,
    };
  }

  /**
   * Genera 2 sugerencias de respuesta rápida para la recepcionista en el Copilot del chat.
   */
  async suggestCopilotReplies({ clinicId = 1, messages = [] }) {
    const cid = parseInt(clinicId, 10) || 1;
    const lastPatientMsg = [...messages].reverse().find(m => m.direction === 'INBOUND')?.body || '';
    const lower = lastPatientMsg.toLowerCase();

    if (cid === 1) {
      if (lower.includes('precio') || lower.includes('cuanto') || lower.includes('coste')) {
        return {
          suggestions: [
            'Hola, en Clínica Vides Dental no damos precios sin examen clínico previo. Le invitamos a una primera revisión gratuita donde el doctor le dará su presupuesto exacto.',
            'Cada boca es única y requiere diagnóstico presencial. ¿Le reservamos una cita de valoración gratuita esta semana sin ningún compromiso?',
          ],
        };
      }
      return {
        suggestions: [
          'Hola, le confirmamos que disponemos de hueco para su primera revisión gratuita. ¿Le vendría bien pasar por la clínica por la mañana o por la tarde?',
          'Con mucho gusto le ayudamos con su cita. Le esperamos en nuestra clínica para valorar su caso de forma personalizada.',
        ],
      };
    }

    // Castellón (Estética)
    return {
      suggestions: [
        'Hola, para asesorarle adecuadamente le invitamos a una primera consulta de valoración estética presencial en nuestra clínica de Castellón.',
        'Cada tratamiento se adapta a sus facciones y objetivos. ¿Le viene bien una cita de valoración esta semana?',
      ],
    };
  }

  /**
   * Resume una conversación de WhatsApp/Instagram para registrar en el CRM.
   */
  async summarizeConversationForCRM({ clinicId = 1, messages = [] }) {
    const inboundTexts = messages.filter(m => m.direction === 'INBOUND').map(m => m.body).join(' ');
    const lower = inboundTexts.toLowerCase();

    let serviceInterest = 'Revisión General';
    let urgency = 'LOW';
    let score = 50;

    if (lower.includes('implante')) {
      serviceInterest = 'Implantes Dentales';
      score = 85;
    } else if (lower.includes('ortodoncia') || lower.includes('invisalign') || lower.includes('brackets')) {
      serviceInterest = 'Ortodoncia / Alineadores';
      score = 80;
    } else if (lower.includes('blanqueamiento') || lower.includes('estetica') || lower.includes('estética')) {
      serviceInterest = 'Estética Dental';
      score = 70;
    }

    if (lower.includes('dolor') || lower.includes('muela') || lower.includes('urgencia') || lower.includes('sangrado') || lower.includes('flemón') || lower.includes('flemon')) {
      urgency = 'HIGH';
      score = Math.max(score, 90);
    }

    const summary = `Contacto interesado en ${serviceInterest}. Canal omnicanal atendido por IA. Objetivo: agendar 1ª revisión gratuita.`;

    return {
      summary,
      serviceInterest,
      urgency,
      score,
      recommendedAction: 'Agendar 1ª Revisión Gratuita',
    };
  }

  /**
   * Califica automáticamente un lead del CRM y añade nota comercial con visibilidad compartida.
   */
  async qualifyLeadFromConversation(leadId, clinicId, messages = [], authorUserId = null) {
    const cid = parseInt(clinicId, 10) || 1;
    const analysis = await this.summarizeConversationForCRM({ clinicId: cid, messages });

    // 1. Actualizar campos de IA en crm_leads
    await query(
      `UPDATE crm_leads
       SET ai_score = $1,
           ai_urgency = $2,
           ai_summary = $3,
           ai_extracted_interest = $4,
           ai_recommended_action = $5,
           ai_last_analyzed_at = NOW(),
           updated_at = NOW()
       WHERE id = $6 AND clinic_id = $7`,
      [analysis.score, analysis.urgency, analysis.summary, analysis.serviceInterest, analysis.recommendedAction, leadId, cid]
    );

    // 2. Insertar nota en crm_notes identificada como IA
    // Si no hay authorUserId, usamos el ID del usuario del lead o 1 (administrador del sistema)
    let fallbackAuthorId = authorUserId;
    if (!fallbackAuthorId) {
      const leadRes = await query(`SELECT assigned_user_id FROM crm_leads WHERE id = $1`, [leadId]);
      fallbackAuthorId = leadRes.rows[0]?.assigned_user_id || 1;
    }

    const noteText = `🤖 [IA - Resumen Automático]: Lead interesado en ${analysis.serviceInterest}. Nivel de urgencia: ${analysis.urgency}. Puntuación de intención: ${analysis.score}/100. Meta recomendada: ${analysis.recommendedAction}.`;

    const noteRes = await query(
      `INSERT INTO crm_notes (clinic_id, lead_id, contact_id, author_id, note, created_by_type)
       VALUES ($1, $2, (SELECT contact_id FROM crm_leads WHERE id = $2), $3, $4, 'ai')
       RETURNING *`,
      [cid, leadId, fallbackAuthorId, noteText]
    );

    logger.info(`[AI_CRM] Lead #${leadId} calificado con éxito (Score: ${analysis.score}). Nota #${noteRes.rows[0]?.id} creada.`);
    return { leadId, analysis, note: noteRes.rows[0] };
  }

  /**
   * Genera el Briefing Inteligente Matinal para el equipo de recepción.
   */
  async generateReceptionBriefing({ date, appointments = [], pendingConfirmations = [], recalls = [], stats = {} }) {
    const apptCount = appointments.length;
    const confirmedCount = appointments.filter(a => a.status_name === 'confirmada' || a.status === 'CONFIRMED').length;
    const pendingCount = pendingConfirmations.length;
    const recallCount = recalls.length;

    let summaryText = `### ☀️ Briefing Operativo del Día (${date})\n\n`;
    summaryText += `* **Total de Consultas:** ${apptCount} pacientes agendados hoy.\n`;
    summaryText += `* **Estado de Confirmación:** ${confirmedCount} confirmadas, **${pendingCount} pendientes de confirmar**.\n`;
    summaryText += `* **Oportunidades de Retención (Recall):** ${recallCount} pacientes listos para contactar (limpiezas semestrales / revisiones).\n\n`;

    if (pendingCount > 0) {
      summaryText += `⚠️ **Atención Recomendada:** Existen ${pendingCount} consultas sin confirmación para hoy. Se sugiere verificar el canal de WhatsApp o realizar llamada telefónica.\n`;
    } else {
      summaryText += `✅ **Agenda Óptima:** Todas las consultas del día han sido confirmadas por los pacientes.\n`;
    }

    if (recallCount > 0) {
      summaryText += `💡 **Acción Proactiva:** Ejecuta el disparo de recall para activar los ${recallCount} pacientes en fecha de revisión preventiva.\n`;
    }

    return {
      date,
      summary: summaryText,
      metrics: {
        totalAppointments: apptCount,
        confirmed: confirmedCount,
        pendingConfirmations: pendingCount,
        recallsAvailable: recallCount,
      },
      provider: this.getActiveProvider(),
    };
  }

  /**
   * Genera una explicación amable de un presupuesto (sin reemplazar el documento oficial).
   */
  async generatePatientQuotationExplanation({ patientName, items = [], totalAmount = 0 }) {
    const firstName = (patientName || 'Estimado/a paciente').split(' ')[0];
    const itemsList = items.map(i => `• ${i.treatment_name || 'Procedimiento'}`).join('\n');

    const message = `¡Hola ${firstName}! 🦷✨\n\nAdjuntamos la propuesta de tratamiento personalizada que preparamos para el cuidado de tu salud bucodental:\n\n${itemsList}\n\nContamos con opciones de financiación a tu medida y facilidades de pago. ¿Te gustaría que coordinemos tu primera sesión?`;

    return {
      message,
      provider: this.getActiveProvider(),
    };
  }
}

export default new AIService();
