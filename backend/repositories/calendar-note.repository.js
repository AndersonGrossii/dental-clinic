// ============================================
// Repositorio de Notas de Calendario
// ============================================
import { BaseRepository } from './base.repository.js';
import { query } from '../database/pool.js';

export class CalendarNoteRepository extends BaseRepository {
  constructor() {
    super('calendar_notes');
  }

  /**
   * Obtiene las notas visibles para un usuario o clínica en un rango de fechas.
   */
  async findNotes({ clinicId = null, userId = null, startDate = null, endDate = null } = {}) {
    const targetClinicId = clinicId || this.getClinicId();
    const conditions = ['n.deleted_at IS NULL'];
    const params = [];
    let paramIndex = 1;

    if (targetClinicId) {
      conditions.push(`n.clinic_id = $${paramIndex++}`);
      params.push(targetClinicId);
    }

    if (startDate) {
      conditions.push(`n.note_date >= $${paramIndex++}`);
      params.push(startDate);
    }

    if (endDate) {
      conditions.push(`n.note_date <= $${paramIndex++}`);
      params.push(endDate);
    }

    // Visibilidad: O bien es visible para todo el equipo (is_team_visible = true) o pertenece al usuario emisor/receptor
    if (userId) {
      conditions.push(`(
        n.is_team_visible = TRUE
        OR n.user_id = $${paramIndex}
        OR n.assigned_to_user_id = $${paramIndex}
        OR $${paramIndex} = ANY(n.assigned_user_ids)
      )`);
      params.push(userId);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
      SELECT n.*,
             u.first_name AS author_first_name,
             u.last_name AS author_last_name,
             u_asg.first_name AS assigned_first_name,
             u_asg.last_name AS assigned_last_name
      FROM calendar_notes n
      LEFT JOIN users u ON n.user_id = u.id
      LEFT JOIN users u_asg ON n.assigned_to_user_id = u_asg.id
      ${whereClause}
      ORDER BY n.is_pinned DESC, n.note_date ASC, n.created_at ASC
    `;

    const result = await query(sql, params);
    return result.rows;
  }
}

export default new CalendarNoteRepository();
