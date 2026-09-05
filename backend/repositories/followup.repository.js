// ============================================
// Repositorio de Seguimientos de Pacientes
// ============================================
import { BaseRepository } from './base.repository.js';
import { query } from '../database/pool.js';

export class FollowupRepository extends BaseRepository {
  constructor() {
    super('patient_followups');
  }

  /**
   * Obtiene seguimientos filtrados con información del paciente y usuario asignado.
   */
  async findFollowups({ clinicId = null, userId = null, patientId = null, startDate = null, endDate = null, status = null, assignedUserId = null } = {}) {
    const targetClinicId = clinicId || this.getClinicId();
    const conditions = ['f.deleted_at IS NULL'];
    const params = [];
    let paramIndex = 1;

    if (targetClinicId) {
      conditions.push(`f.clinic_id = $${paramIndex++}`);
      params.push(targetClinicId);
    }

    if (patientId) {
      conditions.push(`f.patient_id = $${paramIndex++}`);
      params.push(patientId);
    }

    if (startDate) {
      conditions.push(`f.followup_date >= $${paramIndex++}`);
      params.push(startDate);
    }

    if (endDate) {
      conditions.push(`f.followup_date <= $${paramIndex++}`);
      params.push(endDate);
    }

    if (status) {
      conditions.push(`f.status = $${paramIndex++}`);
      params.push(status);
    }

    if (userId) {
      conditions.push(`(
        f.is_team_visible = TRUE
        OR f.created_by_user_id = $${paramIndex}
        OR f.assigned_to_user_id = $${paramIndex}
        OR $${paramIndex} = ANY(f.assigned_user_ids)
      )`);
      params.push(userId);
      paramIndex++;
    }

    if (assignedUserId) {
      conditions.push(`(f.assigned_to_user_id = $${paramIndex} OR $${paramIndex} = ANY(f.assigned_user_ids))`);
      params.push(assignedUserId);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
      SELECT f.*,
             p.first_name AS patient_first_name,
             p.last_name AS patient_last_name,
             p.custom_id AS patient_custom_id,
             p.phone AS patient_phone,
             u.first_name AS assigned_first_name,
             u.last_name AS assigned_last_name,
             u_cr.first_name AS author_first_name,
             u_cr.last_name AS author_last_name
      FROM patient_followups f
      LEFT JOIN patients p ON f.patient_id = p.id
      LEFT JOIN users u ON f.assigned_to_user_id = u.id
      LEFT JOIN users u_cr ON f.created_by_user_id = u_cr.id
      ${whereClause}
      ORDER BY f.followup_date ASC, f.created_at ASC
    `;

    const result = await query(sql, params);
    return result.rows;
  }

  /**
   * Actualiza el estado de un seguimiento.
   */
  async updateStatus(id, status, clinicId = null) {
    const targetClinicId = clinicId || this.getClinicId();
    const params = [status, id];
    let sql = `UPDATE patient_followups SET status = $1, updated_at = NOW() WHERE id = $2 AND deleted_at IS NULL`;
    if (targetClinicId) {
      sql += ` AND clinic_id = $3`;
      params.push(targetClinicId);
    }
    sql += ` RETURNING *`;
    const res = await query(sql, params);
    return res.rows[0] || null;
  }
}

export default new FollowupRepository();
