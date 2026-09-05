// ============================================
// Repositorio de Chat Interno de Personal
// ============================================
import { query } from '../database/pool.js';
import { BaseRepository } from './base.repository.js';

class InternalChatRepository extends BaseRepository {
  constructor() {
    super('internal_chat_messages');
  }

  /**
   * Obtiene los mensajes del canal general de la clínica (solo del día actual).
   */
  async findGeneralMessages({ clinicId, limit = 100 } = {}) {
    const targetClinicId = clinicId || this.getClinicId();
    const sql = `
      SELECT m.*,
             u.first_name AS sender_first_name,
             u.last_name AS sender_last_name,
             r.name AS sender_role
      FROM internal_chat_messages m
      JOIN users u ON m.sender_id = u.id
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE m.clinic_id = $1
        AND m.recipient_id IS NULL
        AND m.created_at >= CURRENT_DATE
      ORDER BY m.created_at ASC
      LIMIT $2;
    `;
    const result = await query(sql, [targetClinicId, limit]);
    return result.rows;
  }

  /**
   * Obtiene los mensajes directos (1 a 1) entre dos usuarios (solo del día actual).
   */
  async findDirectMessages({ clinicId, userId1, userId2, limit = 100 } = {}) {
    const targetClinicId = clinicId || this.getClinicId();
    const sql = `
      SELECT m.*,
             u.first_name AS sender_first_name,
             u.last_name AS sender_last_name,
             r.name AS sender_role
      FROM internal_chat_messages m
      JOIN users u ON m.sender_id = u.id
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE m.clinic_id = $1
        AND ((m.sender_id = $2 AND m.recipient_id = $3) OR (m.sender_id = $3 AND m.recipient_id = $2))
        AND m.created_at >= CURRENT_DATE
      ORDER BY m.created_at ASC
      LIMIT $4;
    `;
    const result = await query(sql, [targetClinicId, userId1, userId2, limit]);
    return result.rows;
  }

  /**
   * Inserta un nuevo mensaje y retorna datos completos con emisor.
   */
  async createChatMessage({ clinicId, senderId, recipientId = null, message }) {
    const targetClinicId = clinicId || this.getClinicId();
    const insertSql = `
      INSERT INTO internal_chat_messages (clinic_id, sender_id, recipient_id, message)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;
    const insertResult = await query(insertSql, [targetClinicId, senderId, recipientId, message]);
    const createdMsg = insertResult.rows[0];

    // Obtener detalles del autor para el payload en vivo
    const detailSql = `
      SELECT m.*,
             u.first_name AS sender_first_name,
             u.last_name AS sender_last_name,
             r.name AS sender_role
      FROM internal_chat_messages m
      JOIN users u ON m.sender_id = u.id
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE m.id = $1;
    `;
    const detailResult = await query(detailSql, [createdMsg.id]);
    return detailResult.rows[0];
  }

  /**
   * Marca como leídos los mensajes directos recibidos de un emisor específico.
   */
  async markDirectAsRead({ clinicId, recipientId, senderId }) {
    const targetClinicId = clinicId || this.getClinicId();
    const sql = `
      UPDATE internal_chat_messages
      SET is_read = TRUE
      WHERE clinic_id = $1
        AND recipient_id = $2
        AND sender_id = $3
        AND is_read = FALSE;
    `;
    const result = await query(sql, [targetClinicId, recipientId, senderId]);
    return result.rowCount;
  }

  /**
   * Registra o actualiza la última lectura del canal general para un usuario.
   */
  async markGeneralAsRead({ clinicId, userId }) {
    const targetClinicId = clinicId || this.getClinicId();
    const sql = `
      INSERT INTO internal_chat_reads (user_id, clinic_id, last_general_read_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (user_id, clinic_id)
      DO UPDATE SET last_general_read_at = NOW();
    `;
    await query(sql, [userId, targetClinicId]);
    return true;
  }

  /**
   * Obtiene el resumen de mensajes no leídos del usuario (Canal General + Directos por emisor).
   */
  async getUnreadCounts({ clinicId, userId }) {
    const targetClinicId = clinicId || this.getClinicId();

    // 1. No leídos en Canal General
    const generalSql = `
      SELECT COUNT(*)::int AS unread_count
      FROM internal_chat_messages m
      WHERE m.clinic_id = $1
        AND m.recipient_id IS NULL
        AND m.sender_id != $2
        AND m.created_at >= CURRENT_DATE
        AND m.created_at > COALESCE(
          (SELECT last_general_read_at FROM internal_chat_reads WHERE user_id = $2 AND clinic_id = $1),
          '1970-01-01'::timestamp
        );
    `;
    const generalRes = await query(generalSql, [targetClinicId, userId]);
    const generalUnread = generalRes.rows[0]?.unread_count || 0;

    // 2. No leídos en Mensajes Directos (agrupados por emisor)
    const directSql = `
      SELECT sender_id, COUNT(*)::int AS unread_count
      FROM internal_chat_messages
      WHERE clinic_id = $1
        AND recipient_id = $2
        AND is_read = FALSE
        AND created_at >= CURRENT_DATE
      GROUP BY sender_id;
    `;
    const directRes = await query(directSql, [targetClinicId, userId]);
    const directUnreadMap = {};
    let directTotal = 0;
    directRes.rows.forEach(r => {
      directUnreadMap[r.sender_id] = r.unread_count;
      directTotal += r.unread_count;
    });

    return {
      general: generalUnread,
      directs: directUnreadMap,
      total: generalUnread + directTotal,
    };
  }

  /**
   * Purgado de mensajes anteriores al día actual (expirados a medianoche).
   */
  async purgeExpiredMessages() {
    const sql = `
      DELETE FROM internal_chat_messages
      WHERE created_at < CURRENT_DATE;
    `;
    const result = await query(sql);
    return result.rowCount;
  }
}

export default new InternalChatRepository();
