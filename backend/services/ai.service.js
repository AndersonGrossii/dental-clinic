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
      'presupuesto', 'coste', 'costo', 'cuanto vale', 'cuánto vale', 'valor',
      'cuanto saldria', 'cuánto saldría', 'promocion', 'descuento'
    ].some(k => lower.includes(k));

    if (asksPrice) {
      return { intent: 'PRICE_INQUIRY', confidence: 0.97, provider: 'heuristic' };
    }

    // 4. Detección de confirmación / cancelación
    const words = lower.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ').split(/\s+/).filter(Boolean);
    const isConfirm = ['1', '1️⃣', 'si', 'sí', 'sim', 'confirmo', 'confirmar', 'confirmado', 'ok', 'estare', 'estarei', 'estoy', 'voy', 'perfecto', 'claro'].some(
      w => words.includes(w) || lower === w
    );
    const isCancel = ['2', '2️⃣', 'no', 'nao', 'não', 'cancelar', 'cancelo', 'reagendar', 'cambiar', 'imposible', 'no puedo'].some(
      w => words.includes(w) || lower.includes('no puedo') || lower.includes('otro dia') || lower.includes('otro día')
    );

    if (isConfirm && !isCancel) return { intent: 'CONFIRM', confidence: 0.99, provider: 'heuristic' };
    if (isCancel && !isConfirm) return { intent: 'CANCEL', confidence: 0.98, provider: 'heuristic' };

    // 5. Detección de intención de cita / agendar
    const wantsBooking = [
      'cita', 'citas', 'agendar', 'pedir cita', 'reservar', 'hora', 'horario',
      'hueco', 'visita', 'primera visita', 'revision', 'revisión', 'consulta',
      'cuando puedo ir', 'cuándo puedo ir', 'disponibilidad'
    ].some(k => lower.includes(k));

    if (wantsBooking) {
      return { intent: 'BOOKING', confidence: 0.95, provider: 'heuristic' };
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

    // Pregunta cortés para solicitar el nombre si aún no se conoce formalmente
    const askNamePhrase = (!hasConfirmedName)
      ? ' Por cierto, para poder dirigirnos adecuadamente a usted, ¿con quién tengo el gusto de hablar?'
      : '';

    // 1. Analizar intención y horario de la clínica
    const [intentData, clinicStatus, docInfo, knowledge] = await Promise.all([
      this.classifyIntent(text),
      this.isClinicOpenNow(cid),
      aiBookingService.getFirstVisitDoctorForClinic(cid),
      aiKnowledgeRepository.findByClinic(cid),
    ]);

    // Opción de recepcionista si la clínica está abierta
    const humanOption = clinicStatus.isOpen
      ? `\n\nSi en algún momento desea hablar con un recepcionista, solo indíquemelo y le transferiré de inmediato.`
      : `\n\n(Nuestro equipo de recepción está disponible de ${clinicStatus.openingHoursText}. Si lo desea, puede dejarme su consulta y le contactaremos a primera hora).`;

    // Si el usuario SOLO nos proporcionó su nombre (o respondió a la pregunta de nombre)
    if (detectedName && (intentData.intent === 'INFO' || wasAskedForName) && text.length <= 40) {
      const greeting = `¡Mucho gusto, ${firstName}! Es un placer saludarle.`;
      const offer = cid === 1
        ? `En Clínica Vides Dental Xúquer estamos a su entera disposición para cuidar de su salud bucodental. Le recordamos que disponemos de una primera consulta de revisión y diagnóstico totalmente gratuita y sin compromiso.\n\n¿En qué podemos ayudarle hoy o le gustaría que le reservemos un hueco para su revisión?`
        : `En nuestra clínica de estética de Castellón estamos a su disposición para asesorarle en tratamientos médico-estéticos faciales y corporales. Disponemos de una primera consulta de valoración presencial sin compromiso.\n\n¿Desea que le coordinemos una cita de valoración?`;

      return {
        replyText: `${greeting} ${offer}${humanOption}`,
        action: 'NAME_ACKNOWLEDGED',
        intent: 'NAME_PROVIDED',
        detectedName,
        isNameConfirmed: true,
      };
    }

    // Prefijo de saludo según si se conoce el nombre informado
    const greetingPrefix = firstName
      ? (detectedName ? `¡Encantada de saludarle, ${firstName}! ` : `Hola ${firstName}, `)
      : 'Hola, ';

    // 2. CASO A: Paciente pide recepcionista humano
    if (intentData.intent === 'TRANSFER_TO_HUMAN') {
      const politeAddress = firstName ? `${firstName}` : 'con gusto';
      return {
        replyText: `Por supuesto, ${politeAddress}. He avisado a nuestro equipo de recepción. En unos instantes una de nuestras compañeras continuará la conversación con usted por este mismo chat. ¡Muchas gracias por su paciencia!`,
        action: 'TRANSFER_TO_HUMAN',
        intent: intentData.intent,
        detectedName,
        isNameConfirmed: Boolean(effectiveName),
      };
    }

    // 3. CASO B: Urgencia médica o dolor agudo
    if (intentData.intent === 'URGENT') {
      const address = firstName ? `, ${firstName}` : '';
      return {
        replyText: `Comprendo la situación${address}. Ante un cuadro de molestia aguda o urgencia, es prioritario que le valore nuestro equipo presencialmente. Estoy avisando de inmediato a nuestra recepción para que le den prioridad en la agenda hoy mismo. Un recepcionista continuará el chat con usted ahora mismo.`,
        action: 'TRANSFER_TO_HUMAN',
        intent: intentData.intent,
        isUrgent: true,
        detectedName,
        isNameConfirmed: Boolean(effectiveName),
      };
    }

    // 4. CASO C: Pregunta por precio (Guardrail de Precio Cero)
    if (intentData.intent === 'PRICE_INQUIRY') {
      const clinicFocus = cid === 1 ? 'salud bucodental' : 'medicina estética y tratamientos faciales';
      const visitFocus = cid === 1
        ? 'ofrecemos una primera consulta de revisión y diagnóstico totalmente gratuita y sin compromiso'
        : 'ofrecemos una primera consulta de valoración estética personalizada sin compromiso';

      return {
        replyText: `${greetingPrefix}gracias por consultarnos. Cada persona y cada anatomía son únicas, y por rigor y ética profesional en ${clinicFocus} no facilitamos tarifas cerradas por chat sin una exploración previa.\n\nPor ello, en Clínica Vides Dental ${visitFocus}, donde el especialista examinará su caso y le entregará un presupuesto exacto y transparente en mano.\n\n¿Le gustaría que le reservemos un hueco esta semana?${askNamePhrase}${humanOption}`,
        action: 'OFFER_FIRST_VISIT',
        intent: intentData.intent,
        detectedName,
        isNameConfirmed: Boolean(effectiveName),
      };
    }

    // 5. CASO D: Intención de agendar o pedir cita
    if (intentData.intent === 'BOOKING') {
      const slotsData = await aiBookingService.getAvailableSlots(cid);
      const slots = (slotsData.availableSlots || []).slice(0, 2);

      let slotProposal = '';
      if (slots.length >= 2) {
        slotProposal = ` Disponemos, por ejemplo, de hueco el próximo ${slots[0].date} ${slots[0].formattedArrival} o ${slots[1].formattedArrival}.`;
      } else if (slots.length === 1) {
        slotProposal = ` Disponemos de hueco el próximo ${slots[0].date} ${slots[0].formattedArrival}.`;
      }

      if (cid === 1) {
        return {
          replyText: `¡Con mucho gusto${firstName ? ', ' + firstName : ''}! La primera revisión diagnóstica en Clínica Vides Dental Xúquer es totalmente gratuita y será atendida por nuestro equipo.${slotProposal}\n\n¿Le vendría bien alguna de estas horas, o prefiere otro día?${askNamePhrase}${humanOption}`,
          action: 'SLOTS_OFFERED',
          intent: intentData.intent,
          slots,
          detectedName,
          isNameConfirmed: Boolean(effectiveName),
        };
      } else {
        return {
          replyText: `¡Con mucho gusto${firstName ? ', ' + firstName : ''}! En nuestra clínica de estética de Castellón coordinamos una primera consulta de valoración con nuestro especialista para estudiar sus necesidades.${slotProposal}\n\n¿Le viene bien alguna de estas opciones?${askNamePhrase}${humanOption}`,
          action: 'SLOTS_OFFERED',
          intent: intentData.intent,
          slots,
          detectedName,
          isNameConfirmed: Boolean(effectiveName),
        };
      }
    }

    // 6. CASO E: Saludo o información general (RAG Contextual)
    if (cid === 1) {
      return {
        replyText: `${greetingPrefix}le atiende Sofía, asistente de Clínica Vides Dental Xúquer. Estamos a su disposición para el cuidado de su salud bucodental. Le recordamos que dispone de una primera revisión diagnóstica gratuita en nuestra clínica.\n\n¿Le gustaría reservar una cita de revisión o consultar alguna duda sobre nuestros tratamientos?${askNamePhrase}${humanOption}`,
        action: 'GENERAL_GREETING',
        intent: intentData.intent,
        detectedName,
        isNameConfirmed: Boolean(effectiveName),
      };
    } else {
      return {
        replyText: `${greetingPrefix}le atiende Sofía de nuestra Clínica de Estética en Castellón. Estamos a su disposición para asesorarle en tratamientos médico-estéticos faciales y corporales. Disponemos de una primera consulta de valoración presencial para estudiar su caso.\n\n¿Desea que le coordinemos una cita de valoración?${askNamePhrase}${humanOption}`,
        action: 'GENERAL_GREETING',
        intent: intentData.intent,
        detectedName,
        isNameConfirmed: Boolean(effectiveName),
      };
    }
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
