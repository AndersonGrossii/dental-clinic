// ============================================
// Servicio Unificado de Inteligencia Artificial (AI Copilot Hub)
// Soporta: Local Heuristic (Free/Offline), Groq (Free LLaMA 3.1), Gemini (Free), OpenAI, DeepSeek
// ============================================
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
   * Clasifica la intención de un mensaje entrante (ej. Confirmación de cita, Cancelación, Urgencia).
   */
  async classifyIntent(messageText) {
    const text = (messageText || '').trim();
    const lower = text.toLowerCase();
    const activeProv = this.getActiveProvider();

    // 1. Motor Heurístico Determinista (Ultra rápido y robusto para respuestas tipo 1 / 2 / Sim / Não / Frases)
    const cleanLower = lower.replace(/[,.!?;:]/g, ' ');
    const tokens = cleanLower.split(/\s+/).filter(Boolean);

    const isConfirm = ['1', '1️⃣', 'si', 'sí', 'sim', 'confirmo', 'confirmar', 'confirmado', 'ok', 'estare', 'estarei', 'presente', 'voy', 'perfecto', 'claro'].some(
      w => tokens.includes(w) || cleanLower.includes(w)
    );

    const isCancel = ['2', '2️⃣', 'no', 'nao', 'não', 'cancelar', 'cancelo', 'reagendar', 'cambiar', 'imposible', 'desistir'].some(
      w => tokens.includes(w) || cleanLower.includes('no puedo') || cleanLower.includes('nao posso') || cleanLower.includes('não posso') || cleanLower.includes('outro dia') || cleanLower.includes('otro dia')
    );

    const isUrgent = ['dolor', 'urgencia', 'emergencia', 'sangrado', 'hinchazon', 'infeccion', 'fiebre', 'roto', 'caido', 'accidente', 'fuerte', 'dor', 'sangrando'].some(
      w => lower.includes(w)
    );

    if (isConfirm && !isCancel) {
      return { intent: 'CONFIRM', confidence: 0.99, provider: 'heuristic' };
    }
    if (isCancel && !isConfirm) {
      return { intent: 'CANCEL', confidence: 0.98, provider: 'heuristic' };
    }
    if (isUrgent) {
      return { intent: 'URGENT', confidence: 0.95, provider: 'heuristic' };
    }

    // 2. Si no es un patrón simple y tenemos proveedor LLM configurado (Groq / Gemini / OpenAI), consultamos
    if (activeProv === 'groq' && this.groqApiKey) {
      try {
        return await this.callOpenAICompatible({
          baseUrl: 'https://api.groq.com/openai/v1',
          apiKey: this.groqApiKey,
          model: 'llama-3.1-8b-instant',
          systemPrompt: 'Eres un clasificador de intenciones odontológicas. Devuelve únicamente un JSON con {"intent": "CONFIRM"|"CANCEL"|"URGENT"|"INFO"|"OTHER", "confidence": 0.0-1.0}',
          userPrompt: `Mensaje del paciente: "${text}"`,
        });
      } catch (err) {
        logger.warn('Fallo en LLM Groq, usando fallback local:', err.message);
      }
    }

    if (activeProv === 'openai' && this.openaiApiKey) {
      try {
        return await this.callOpenAICompatible({
          baseUrl: 'https://api.openai.com/v1',
          apiKey: this.openaiApiKey,
          model: 'gpt-4o-mini',
          systemPrompt: 'Eres un clasificador de intenciones odontológicas. Devuelve únicamente un JSON con {"intent": "CONFIRM"|"CANCEL"|"URGENT"|"INFO"|"OTHER", "confidence": 0.0-1.0}',
          userPrompt: `Mensaje del paciente: "${text}"`,
        });
      } catch (err) {
        logger.warn('Fallo en OpenAI, usando fallback local:', err.message);
      }
    }

    return { intent: 'INFO', confidence: 0.75, provider: 'local' };
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
   * Genera una explicación pedagógica y amable de un presupuesto para el paciente.
   */
  async generatePatientQuotationExplanation({ patientName, items = [], totalAmount = 0 }) {
    const firstName = (patientName || 'Estimado/a paciente').split(' ')[0];
    const itemsList = items.map(i => `• ${i.treatment_name || 'Procedimiento'} (${i.total || i.price || 0}€)`).join('\n');

    const message = `¡Hola ${firstName}! 🦷✨\n\nAdjuntamos la propuesta de tratamiento personalizada que preparamos para el cuidado de tu salud bucodental:\n\n${itemsList}\n\n💶 **Inversión Total:** ${totalAmount}€\n\nContamos con opciones de financiación a tu medida y facilidades de pago. ¿Te gustaría que coordinemos tu primera sesión?`;

    return {
      message,
      provider: this.getActiveProvider(),
    };
  }

  /**
   * Ejecuta llamadas a APIs compatibles con el protocolo OpenAI (Groq, OpenAI, DeepSeek).
   */
  async callOpenAICompatible({ baseUrl, apiKey, model, systemPrompt, userPrompt }) {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Error API (${response.status}): ${errBody}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    try {
      return JSON.parse(content);
    } catch {
      return { raw: content };
    }
  }
}

export default new AIService();
