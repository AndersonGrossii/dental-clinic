// ============================================
// Repositorio de Mensajería Unificada y WhatsApp
// ============================================
import { BaseRepository } from './base.repository.js';
import { query } from '../database/pool.js';

export class MessagingRepository extends BaseRepository {
  constructor() {
    super('messages');
  }

  /**
   * Busca o crea un contacto por número de teléfono en la clínica activa.
   */
  async findOrCreateContact(clinicId, phone, name = null, externalId = null) {
    const cleanPhone = phone.trim();
    // 1. Buscar si ya existe el contacto
    const findRes = await query(
      `SELECT * FROM messaging_contacts 
       WHERE clinic_id = $1 AND phone = $2 AND deleted_at IS NULL`,
      [clinicId, cleanPhone]
    );

    if (findRes.rows.length > 0) {
      const contact = findRes.rows[0];
      // Si recibimos un nombre nuevo o externalId y no los tiene, actualizar
      if ((name && !contact.name) || (externalId && !contact.external_id)) {
        const updateRes = await query(
          `UPDATE messaging_contacts 
           SET name = COALESCE($1, name), external_id = COALESCE($2, external_id), updated_at = NOW() 
           WHERE id = $3 RETURNING *`,
          [name, externalId, contact.id]
        );
        return updateRes.rows[0];
      }
      return contact;
    }

    // 2. Si no existe, intentar asociar automáticamente con un paciente existente por teléfono
    const patientMatch = await query(
      `SELECT id, first_name, last_name FROM patients 
       WHERE clinic_id = $1 AND deleted_at IS NULL 
       AND (REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '+', '') LIKE '%' || $2 || '%' 
            OR $2 LIKE '%' || REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '+', '') || '%')
       LIMIT 1`,
      [clinicId, cleanPhone.replace(/[\s\-+]/g, '')]
    );

    const linkedPatientId = patientMatch.rows[0]?.id || null;
    const finalName = name || (patientMatch.rows[0] ? `${patientMatch.rows[0].first_name} ${patientMatch.rows[0].last_name}` : cleanPhone);

    const insertRes = await query(
      `INSERT INTO messaging_contacts (clinic_id, phone, name, external_id, patient_id)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (clinic_id, phone) DO UPDATE 
       SET updated_at = NOW()
       RETURNING *`,
      [clinicId, cleanPhone, finalName, externalId, linkedPatientId]
    );

    return insertRes.rows[0];
  }

  /**
   * Busca o crea una conversación activa para un contacto.
   */
  async findOrCreateConversation(clinicId, contactId, channel = 'WHATSAPP') {
    const findRes = await query(
      `SELECT c.*, mc.phone AS contact_phone, mc.name AS contact_name, mc.patient_id,
              p.first_name AS patient_first_name, p.last_name AS patient_last_name, p.custom_id AS patient_custom_id
       FROM conversations c
       JOIN messaging_contacts mc ON c.contact_id = mc.id
       LEFT JOIN patients p ON mc.patient_id = p.id
       WHERE c.clinic_id = $1 AND c.contact_id = $2 AND c.channel = $3 AND c.deleted_at IS NULL`,
      [clinicId, contactId, channel]
    );

    if (findRes.rows.length > 0) {
      return findRes.rows[0];
    }

    const insertRes = await query(
      `INSERT INTO conversations (clinic_id, contact_id, channel, status, unread_count, automation_enabled)
       VALUES ($1, $2, $3, 'OPEN', 0, TRUE)
       ON CONFLICT (clinic_id, contact_id, channel) DO UPDATE
       SET updated_at = NOW()
       RETURNING *`,
      [clinicId, contactId, channel]
    );

    return this.getConversationById(insertRes.rows[0].id, clinicId);
  }

  /**
   * Obtiene una conversación por ID con metadatos de contacto y paciente.
   */
  async getConversationById(id, clinicId = null) {
    const targetClinicId = clinicId || this.getClinicId();
    const params = [id];
    let sql = `
      SELECT c.*, 
             mc.phone AS contact_phone, 
             mc.name AS contact_name, 
             mc.external_id AS contact_external_id,
             mc.patient_id,
             p.first_name AS patient_first_name, 
             p.last_name AS patient_last_name, 
             p.custom_id AS patient_custom_id,
             u.first_name AS assigned_first_name,
             u.last_name AS assigned_last_name
      FROM conversations c
      JOIN messaging_contacts mc ON c.contact_id = mc.id
      LEFT JOIN patients p ON mc.patient_id = p.id
      LEFT JOIN users u ON c.assigned_user_id = u.id
      WHERE c.id = $1 AND c.deleted_at IS NULL
    `;

    if (targetClinicId) {
      sql += ` AND c.clinic_id = $2`;
      params.push(targetClinicId);
    }

    const result = await query(sql, params);
    return result.rows[0] || null;
  }

  /**
   * Lista conversaciones filtradas y paginadas.
   */
  async getConversations({ clinicId = null, channel = null, status = null, search = null, limit = 20, offset = 0 } = {}) {
    const targetClinicId = clinicId || this.getClinicId();
    const conditions = ['c.deleted_at IS NULL'];
    const params = [];
    let paramIndex = 1;

    if (targetClinicId) {
      conditions.push(`c.clinic_id = $${paramIndex++}`);
      params.push(targetClinicId);
    }

    if (channel) {
      conditions.push(`c.channel = $${paramIndex++}`);
      params.push(channel);
    }

    if (status) {
      conditions.push(`c.status = $${paramIndex++}`);
      params.push(status);
    }

    if (search) {
      conditions.push(`(mc.name ILIKE $${paramIndex} OR mc.phone ILIKE $${paramIndex} OR p.first_name ILIKE $${paramIndex} OR p.last_name ILIKE $${paramIndex} OR p.custom_id ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await query(
      `SELECT COUNT(*) AS total 
       FROM conversations c
       JOIN messaging_contacts mc ON c.contact_id = mc.id
       LEFT JOIN patients p ON mc.patient_id = p.id
       ${whereClause}`,
      params
    );

    const total = parseInt(countRes.rows[0].total, 10);

    const listRes = await query(
      `SELECT c.*, 
              mc.phone AS contact_phone, 
              mc.name AS contact_name, 
              mc.patient_id,
              p.first_name AS patient_first_name, 
              p.last_name AS patient_last_name, 
              p.custom_id AS patient_custom_id
       FROM conversations c
       JOIN messaging_contacts mc ON c.contact_id = mc.id
       LEFT JOIN patients p ON mc.patient_id = p.id
       ${whereClause}
       ORDER BY c.last_message_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    return { rows: listRes.rows, total };
  }

  /**
   * Obtiene los mensajes de una conversación.
   */
  async getMessagesByConversation(conversationId, { limit = 50, beforeId = null } = {}) {
    const conditions = ['conversation_id = $1', 'deleted_at IS NULL'];
    const params = [conversationId];
    let paramIndex = 2;

    if (beforeId) {
      conditions.push(`id < $${paramIndex++}`);
      params.push(beforeId);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const result = await query(
      `SELECT * FROM messages
       ${whereClause}
       ORDER BY created_at ASC
       LIMIT $${paramIndex}`,
      [...params, limit]
    );

    return result.rows;
  }

  /**
   * Crea un nuevo registro de mensaje y actualiza la conversación.
   */
  async createMessage({ conversationId, clinicId, direction, messageType = 'TEXT', body, externalId = null, status = 'DELIVERED', rawPayload = null }) {
    const result = await query(
      `INSERT INTO messages (conversation_id, clinic_id, direction, message_type, body, external_id, status, raw_payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [conversationId, clinicId, direction, messageType, body, externalId, status, rawPayload ? JSON.stringify(rawPayload) : null]
    );

    const message = result.rows[0];

    // Actualizar metadatos de la conversación
    const preview = body.length > 80 ? body.substring(0, 77) + '...' : body;
    const isUnreadIncrement = direction === 'INBOUND' ? 1 : 0;

    await query(
      `UPDATE conversations 
       SET last_message_at = NOW(), 
           last_message_preview = $1,
           unread_count = unread_count + $2,
           updated_at = NOW()
       WHERE id = $3`,
      [preview, isUnreadIncrement, conversationId]
    );

    return message;
  }

  /**
   * Marca los mensajes de una conversación como leídos.
   */
  async markConversationAsRead(conversationId, clinicId = null) {
    const targetClinicId = clinicId || this.getClinicId();
    const params = [conversationId];
    let sql = `UPDATE conversations SET unread_count = 0, updated_at = NOW() WHERE id = $1`;
    if (targetClinicId) {
      sql += ` AND clinic_id = $2`;
      params.push(targetClinicId);
    }
    await query(sql, params);
  }

  /**
   * Actualiza el estado de automatización (Human Takeover).
   */
  async setAutomationEnabled(conversationId, enabled, clinicId = null) {
    const targetClinicId = clinicId || this.getClinicId();
    const params = [enabled, conversationId];
    let sql = `UPDATE conversations SET automation_enabled = $1, updated_at = NOW() WHERE id = $2`;
    if (targetClinicId) {
      sql += ` AND clinic_id = $3`;
      params.push(targetClinicId);
    }
    sql += ` RETURNING *`;
    const res = await query(sql, params);
    return res.rows[0] || null;
  }

  /**
   * Actualiza el estado de la conversación (OPEN, PENDING, CLOSED).
   */
  async setConversationStatus(conversationId, status, clinicId = null) {
    const targetClinicId = clinicId || this.getClinicId();
    const params = [status, conversationId];
    let sql = `UPDATE conversations SET status = $1, updated_at = NOW() WHERE id = $2`;
    if (targetClinicId) {
      sql += ` AND clinic_id = $3`;
      params.push(targetClinicId);
    }
    sql += ` RETURNING *`;
    const res = await query(sql, params);
    return res.rows[0] || null;
  }

  /**
   * Vincula un contacto de mensajería con un paciente del sistema.
   */
  async linkContactToPatient(contactId, patientId, clinicId = null) {
    const targetClinicId = clinicId || this.getClinicId();
    const params = [patientId, contactId];
    let sql = `UPDATE messaging_contacts SET patient_id = $1, updated_at = NOW() WHERE id = $2`;
    if (targetClinicId) {
      sql += ` AND clinic_id = $3`;
      params.push(targetClinicId);
    }
    sql += ` RETURNING *`;
    const res = await query(sql, params);
    return res.rows[0] || null;
  }

  /**
   * Obtiene las plantillas de mensajería activas para la clínica.
   */
  async getTemplates(clinicId = null) {
    const targetClinicId = clinicId || this.getClinicId();
    const params = [];
    let sql = `SELECT * FROM messaging_templates WHERE is_active = TRUE AND deleted_at IS NULL`;
    if (targetClinicId) {
      sql += ` AND clinic_id = $1`;
      params.push(targetClinicId);
    }
    sql += ` ORDER BY name ASC`;
    const res = await query(sql, params);
    return res.rows;
  }

  /**
   * Obtiene estadísticas del centro de mensajería.
   */
  async getStats(clinicId = null) {
    const targetClinicId = clinicId || this.getClinicId();
    const params = [];
    let clinicFilter = '';
    if (targetClinicId) {
      clinicFilter = `WHERE clinic_id = $1 AND deleted_at IS NULL`;
      params.push(targetClinicId);
    } else {
      clinicFilter = `WHERE deleted_at IS NULL`;
    }

    const res = await query(
      `SELECT 
         COUNT(*) AS total_conversations,
         COUNT(*) FILTER (WHERE status = 'OPEN') AS open_conversations,
         COALESCE(SUM(unread_count), 0) AS total_unread
       FROM conversations
       ${clinicFilter}`,
      params
    );

    return res.rows[0] || { total_conversations: 0, open_conversations: 0, total_unread: 0 };
  }
}

export default new MessagingRepository();
