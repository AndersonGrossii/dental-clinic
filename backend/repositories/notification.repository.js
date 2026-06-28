// ============================================
// Repositorio de Notificaciones — Operaciones de datos
// ============================================
import { query } from '../database/pool.js';
import { BaseRepository } from './base.repository.js';

/**
 * Repositorio para la gestión de notificaciones del sistema.
 * Extiende el repositorio base con consultas especializadas.
 */
class NotificationRepository extends BaseRepository {
  constructor() {
    super('notifications');
  }

  /**
   * Obtiene las notificaciones de un usuario con paginación.
   * Ordenadas por fecha de creación descendente.
   * @param {number} userId - ID del usuario
   * @param {object} options - Opciones de paginación
   * @returns {Promise<{ rows: Array, total: number }>}
   */
  async findByUser(userId, { limit = 20, offset = 0 } = {}) {
    // Contar total
    const countResult = await query(
      `SELECT COUNT(*) AS total
       FROM notifications
       WHERE user_id = $1`,
      [userId]
    );
    const total = parseInt(countResult.rows[0].total, 10);

    // Obtener datos paginados
    const dataResult = await query(
      `SELECT
         id, user_id, title, message, type,
         reference_type, reference_id,
         is_read, read_at, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return { rows: dataResult.rows, total };
  }

  /**
   * Cuenta las notificaciones no leídas de un usuario.
   * @param {number} userId - ID del usuario
   * @returns {Promise<number>}
   */
  async countUnread(userId) {
    const result = await query(
      `SELECT COUNT(*) AS total
       FROM notifications
       WHERE user_id = $1 AND is_read = FALSE`,
      [userId]
    );
    return parseInt(result.rows[0].total, 10);
  }

  /**
   * Marca una notificación como leída.
   * @param {number} id - ID de la notificación
   * @param {number} userId - ID del usuario (verificación de propiedad)
   * @returns {Promise<object|null>}
   */
  async markAsRead(id, userId) {
    const result = await query(
      `UPDATE notifications
       SET is_read = TRUE, read_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, userId]
    );
    return result.rows[0] || null;
  }

  /**
   * Marca todas las notificaciones de un usuario como leídas.
   * @param {number} userId - ID del usuario
   * @returns {Promise<number>} Cantidad de notificaciones actualizadas
   */
  async markAllAsRead(userId) {
    const result = await query(
      `UPDATE notifications
       SET is_read = TRUE, read_at = NOW()
       WHERE user_id = $1 AND is_read = FALSE`,
      [userId]
    );
    return result.rowCount;
  }

  /**
   * Crea una nueva notificación.
   * @param {object} data - { user_id, title, message, type, reference_type, reference_id }
   * @returns {Promise<object>}
   */
  async createNotification(data) {
    const result = await query(
      `INSERT INTO notifications (user_id, title, message, type, reference_type, reference_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        data.user_id,
        data.title,
        data.message,
        data.type || 'info',
        data.reference_type || null,
        data.reference_id || null,
      ]
    );
    return result.rows[0];
  }
}

export default new NotificationRepository();
