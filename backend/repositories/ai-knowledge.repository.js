// ============================================
// Repositorio de la Base de Conocimiento RAG de IA
// Aislamiento estricto por clinic_id
// ============================================
import { query } from '../database/pool.js';

class AIKnowledgeRepository {
  /**
   * Obtiene todos los artículos activos para una clínica.
   */
  async findByClinic(clinicId) {
    const res = await query(
      `SELECT id, clinic_id, category, title, content, keywords, is_active, updated_at
       FROM ai_knowledge_base
       WHERE clinic_id = $1 AND is_active = TRUE
       ORDER BY category ASC, id ASC`,
      [clinicId]
    );
    return res.rows;
  }

  /**
   * Busca artículos relevantes según términos o palabras clave.
   */
  async searchRelevant(clinicId, userQueryText = '') {
    const clean = (userQueryText || '').toLowerCase().trim();
    const words = clean.split(/\s+/).filter(w => w.length > 2);

    const res = await query(
      `SELECT id, clinic_id, category, title, content, keywords
       FROM ai_knowledge_base
       WHERE clinic_id = $1 AND is_active = TRUE`,
      [clinicId]
    );

    if (words.length === 0) return res.rows;

    // Puntuación de relevancia por coincidencia en título, contenido o keywords
    const scored = res.rows.map(item => {
      let score = 0;
      const titleLower = item.title.toLowerCase();
      const contentLower = item.content.toLowerCase();
      const keywords = Array.isArray(item.keywords) ? item.keywords : [];

      for (const w of words) {
        if (titleLower.includes(w)) score += 5;
        if (contentLower.includes(w)) score += 2;
        if (keywords.some(k => k.toLowerCase().includes(w))) score += 4;
      }
      return { ...item, score };
    });

    return scored.sort((a, b) => b.score - a.score).filter(item => item.score > 0);
  }

  /**
   * Crea un nuevo artículo en la base de conocimiento.
   */
  async create({ clinicId, category, title, content, keywords = [] }) {
    const res = await query(
      `INSERT INTO ai_knowledge_base (clinic_id, category, title, content, keywords)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [clinicId, category, title, content, keywords]
    );
    return res.rows[0];
  }

  /**
   * Actualiza un artículo existente.
   */
  async update(id, clinicId, { category, title, content, keywords, is_active }) {
    const res = await query(
      `UPDATE ai_knowledge_base
       SET category = COALESCE($1, category),
           title = COALESCE($2, title),
           content = COALESCE($3, content),
           keywords = COALESCE($4, keywords),
           is_active = COALESCE($5, is_active),
           updated_at = NOW()
       WHERE id = $6 AND clinic_id = $7
       RETURNING *`,
      [category, title, content, keywords, is_active, id, clinicId]
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
