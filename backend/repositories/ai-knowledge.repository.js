// ============================================
// Repositorio de la Base de Conocimiento RAG de IA
// Aislamiento estricto por clinic_id
// Soporte semántico: Synonyms, Intents, Priority, Top-K y Confidence Scoring
// ============================================
import { query } from '../database/pool.js';

class AIKnowledgeRepository {
  /**
   * Obtiene todos los artículos activos para una clínica con metadatos completos.
   */
  async findByClinic(clinicId) {
    const res = await query(
      `SELECT id, clinic_id, category, title, content, keywords, synonyms, intent, priority,
              required_tool, do_not_say, next_action, is_active, updated_at
       FROM ai_knowledge_base
       WHERE clinic_id = $1 AND is_active = TRUE
       ORDER BY priority DESC, category ASC, id ASC`,
      [clinicId]
    );
    return res.rows;
  }

  /**
   * Búsqueda guiada por intención, sinónimos y relevancia ponderada (Top-K & Confidence).
   * 
   * @param {number} clinicId - ID de la clínica (aislamiento estricto)
   * @param {string} userQueryText - Texto de entrada del paciente
   * @param {object} options - { intent, category, topK, minScore }
   * @returns {Array & { articles: Array, topMatch: object|null, confidence: string, intent: string|null, totalFound: number }}
   */
  async searchRelevant(clinicId, userQueryText = '', options = {}) {
    const clean = (userQueryText || '').toLowerCase().trim();
    // Remover signos de puntuación comunes para tokenización
    const normalized = clean.replace(/[¿?¡!.,;:()\[\]{}"'\-_/]/g, ' ');
    const STOPWORDS = new Set([
      'con', 'por', 'para', 'que', 'los', 'las', 'una', 'uno', 'del', 'les', 'mas', 'más',
      'pero', 'sus', 'como', 'cómo', 'cual', 'cuál', 'donde', 'dónde', 'este', 'esta', 'estos',
      'estas', 'todo', 'toda', 'todos', 'todas', 'sobre', 'entre', 'hacer', 'haceis', 'hacéis'
    ]);
    const words = normalized.split(/\s+/).filter(w => w.length > 2 && !STOPWORDS.has(w));

    const targetIntent = options.intent || null;
    const targetCategory = options.category || null;
    const topK = parseInt(options.topK, 10) || 3;
    const minScore = options.minScore !== undefined ? options.minScore : 4;

    const res = await query(
      `SELECT id, clinic_id, category, title, content, keywords, synonyms, intent, priority,
              required_tool, do_not_say, next_action
       FROM ai_knowledge_base
       WHERE clinic_id = $1 AND is_active = TRUE`,
      [clinicId]
    );

    if (res.rows.length === 0) {
      const empty = [];
      empty.articles = [];
      empty.topMatch = null;
      empty.confidence = 'NONE';
      empty.intent = targetIntent;
      empty.totalFound = 0;
      return empty;
    }

    // Puntuación ponderada multicapa
    const scored = res.rows.map(item => {
      let score = 0;
      const titleLower = (item.title || '').toLowerCase();
      const contentLower = (item.content || '').toLowerCase();
      const titleWords = titleLower.replace(/[¿?¡!.,;:()\[\]{}"'\-_/]/g, ' ').split(/\s+/);
      const contentWords = contentLower.replace(/[¿?¡!.,;:()\[\]{}"'\-_/]/g, ' ').split(/\s+/);
      const keywords = Array.isArray(item.keywords) ? item.keywords.map(k => String(k).toLowerCase()) : [];
      const synonyms = Array.isArray(item.synonyms) ? item.synonyms.map(s => String(s).toLowerCase()) : [];
      const itemIntent = item.intent || null;
      const itemCategory = item.category || null;
      const priority = parseInt(item.priority, 10) || 1;

      // 1. Alineación con la intención detectada (+12 pts)
      if (targetIntent && itemIntent && itemIntent.toUpperCase() === targetIntent.toUpperCase()) {
        score += 12;
      }

      // 2. Alineación con categoría solicitada (+8 pts)
      if (targetCategory && itemCategory && itemCategory.toLowerCase() === targetCategory.toLowerCase()) {
        score += 8;
      }

      // 3. Coincidencia de frase exacta en título o sinónimos (+10 pts)
      if (clean.length > 4 && titleLower.includes(clean)) {
        score += 10;
      }
      for (const syn of synonyms) {
        if (syn.length > 3 && (clean.includes(syn) || syn.includes(clean))) {
          score += 10;
          break;
        }
      }

      // 4. Coincidencia palabra por palabra exacta o raíz significativa (>4 caracteres)
      for (const w of words) {
        if (titleWords.some(tw => tw === w || (w.length > 4 && tw.startsWith(w)))) score += 6;
        if (contentWords.some(cw => cw === w || (w.length > 5 && cw.startsWith(w)))) score += 2;
        if (keywords.some(k => k === w || (w.length > 4 && k.includes(w)))) score += 5;
        if (synonyms.some(s => s === w || s.split(/\s+/).includes(w) || (w.length > 4 && s.includes(w)))) score += 6;
      }

      // 5. Impulso por prioridad editorial del artículo (solo si hubo coincidencia previa real)
      if (score > 0) {
        score += priority * 2;
      }

      return {
        ...item,
        score,
      };
    });

    // Filtrar por umbral mínimo de relevancia y ordenar descendentemente
    const filtered = scored
      .filter(item => item.score >= minScore)
      .sort((a, b) => b.score - a.score);

    const topResults = filtered.slice(0, topK);
    const topScore = topResults[0]?.score || 0;

    // Clasificación de confianza de la recuperación
    let confidence = 'NONE';
    if (topScore >= 20) {
      confidence = 'HIGH';
    } else if (topScore >= 12) {
      confidence = 'MEDIUM';
    } else if (topScore >= minScore) {
      confidence = 'LOW';
    }

    const output = topResults;
    output.articles = topResults;
    output.topMatch = topResults[0] || null;
    output.confidence = confidence;
    output.intent = targetIntent;
    output.totalFound = topResults.length;

    return output;
  }

  /**
   * Crea un nuevo artículo en la base de conocimiento con metadatos semánticos.
   */
  async create({
    clinicId,
    category,
    title,
    content,
    keywords = [],
    synonyms = [],
    intent = null,
    priority = 1,
    required_tool = null,
    do_not_say = null,
    next_action = null,
  }) {
    const res = await query(
      `INSERT INTO ai_knowledge_base (
         clinic_id, category, title, content, keywords, synonyms, intent, priority,
         required_tool, do_not_say, next_action
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        clinicId,
        category,
        title,
        content,
        keywords,
        synonyms,
        intent,
        priority,
        required_tool,
        do_not_say,
        next_action,
      ]
    );
    return res.rows[0];
  }

  /**
   * Actualiza un artículo existente.
   */
  async update(id, clinicId, data) {
    const {
      category,
      title,
      content,
      keywords,
      synonyms,
      intent,
      priority,
      required_tool,
      do_not_say,
      next_action,
      is_active,
    } = data;

    const res = await query(
      `UPDATE ai_knowledge_base
       SET category = COALESCE($1, category),
           title = COALESCE($2, title),
           content = COALESCE($3, content),
           keywords = COALESCE($4, keywords),
           synonyms = COALESCE($5, synonyms),
           intent = COALESCE($6, intent),
           priority = COALESCE($7, priority),
           required_tool = COALESCE($8, required_tool),
           do_not_say = COALESCE($9, do_not_say),
           next_action = COALESCE($10, next_action),
           is_active = COALESCE($11, is_active),
           updated_at = NOW()
       WHERE id = $12 AND clinic_id = $13
       RETURNING *`,
      [
        category,
        title,
        content,
        keywords,
        synonyms,
        intent,
        priority,
        required_tool,
        do_not_say,
        next_action,
        is_active,
        id,
        clinicId,
      ]
    );
    return res.rows[0] || null;
  }

  /**
   * Elimina un artículo.
   */
  async delete(id, clinicId) {
    const res = await query(
      `DELETE FROM ai_knowledge_base WHERE id = $1 AND clinic_id = $2 RETURNING id`,
      [id, clinicId]
    );
    return res.rows.length > 0;
  }
}

export default new AIKnowledgeRepository();
