// ============================================
// Repositorio de Tareas del Equipo Clínico
// ============================================
import { BaseRepository } from './base.repository.js';
import { query } from '../database/pool.js';

export class TaskRepository extends BaseRepository {
  constructor() {
    super('tasks');
  }

  /**
   * Obtiene tareas con joins a usuarios y pacientes.
   */
  async findTasks({ clinicId = null, userId = null, startDate = null, endDate = null, status = null, priority = null, assignedUserId = null } = {}) {
    const targetClinicId = clinicId || this.getClinicId();
    const conditions = ['t.deleted_at IS NULL'];
    const params = [];
    let paramIndex = 1;

    if (targetClinicId) {
      conditions.push(`t.clinic_id = $${paramIndex++}`);
      params.push(targetClinicId);
    }

    if (startDate) {
      conditions.push(`t.due_date >= $${paramIndex++}`);
      params.push(startDate);
    }

    if (endDate) {
      conditions.push(`t.due_date <= $${paramIndex++}`);
      params.push(endDate);
    }

    if (status) {
      conditions.push(`t.status = $${paramIndex++}`);
      params.push(status);
    }

    if (priority) {
      conditions.push(`t.priority = $${paramIndex++}`);
      params.push(priority);
    }

    if (userId) {
      conditions.push(`(
        t.is_team_visible = TRUE
        OR t.created_by_user_id = $${paramIndex}
        OR t.assigned_to_user_id = $${paramIndex}
        OR $${paramIndex} = ANY(t.assigned_user_ids)
      )`);
      params.push(userId);
      paramIndex++;
    }

    if (assignedUserId) {
      conditions.push(`(t.assigned_to_user_id = $${paramIndex} OR $${paramIndex} = ANY(t.assigned_user_ids))`);
      params.push(assignedUserId);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
      SELECT t.*,
             u_asg.first_name AS assigned_first_name,
             u_asg.last_name AS assigned_last_name,
             u_cr.first_name AS created_by_first_name,
             u_cr.last_name AS created_by_last_name,
             p.first_name AS patient_first_name,
             p.last_name AS patient_last_name,
             p.custom_id AS patient_custom_id
      FROM tasks t
      LEFT JOIN users u_asg ON t.assigned_to_user_id = u_asg.id
      LEFT JOIN users u_cr ON t.created_by_user_id = u_cr.id
      LEFT JOIN patients p ON t.patient_id = p.id
      ${whereClause}
      ORDER BY t.due_date ASC, t.due_time ASC NULLS LAST, t.created_at ASC
    `;

    const result = await query(sql, params);
    return result.rows;
  }

  /**
   * Obtiene una tarea por ID con metadatos.
   */
  async getTaskById(id, clinicId = null) {
    const targetClinicId = clinicId || this.getClinicId();
    const params = [id];
    let sql = `
      SELECT t.*,
             u_asg.first_name AS assigned_first_name,
             u_asg.last_name AS assigned_last_name,
             u_cr.first_name AS created_by_first_name,
             u_cr.last_name AS created_by_last_name,
             p.first_name AS patient_first_name,
             p.last_name AS patient_last_name,
             p.custom_id AS patient_custom_id
      FROM tasks t
      LEFT JOIN users u_asg ON t.assigned_to_user_id = u_asg.id
      LEFT JOIN users u_cr ON t.created_by_user_id = u_cr.id
      LEFT JOIN patients p ON t.patient_id = p.id
      WHERE t.id = $1 AND t.deleted_at IS NULL
    `;

    if (targetClinicId) {
      sql += ` AND t.clinic_id = $2`;
      params.push(targetClinicId);
    }

    const result = await query(sql, params);
    return result.rows[0] || null;
  }

  /**
   * Actualiza el estado de una tarea.
   */
  async updateStatus(id, status, clinicId = null) {
    const targetClinicId = clinicId || this.getClinicId();
    const params = [status, id];
    let sql = `UPDATE tasks SET status = $1, updated_at = NOW() WHERE id = $2 AND deleted_at IS NULL`;
    if (targetClinicId) {
      sql += ` AND clinic_id = $3`;
      params.push(targetClinicId);
    }
    sql += ` RETURNING *`;
    const res = await query(sql, params);
    return res.rows[0] || null;
  }
}

export default new TaskRepository();
