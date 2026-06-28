// ============================================
// Repositorio de Doctores
// ============================================
import { BaseRepository } from './base.repository.js';
import { query } from '../database/pool.js';

export class DoctorRepository extends BaseRepository {
  constructor() {
    super('doctors');
  }

  /**
   * Obtiene todos los doctores con información de sus cuentas de usuario.
   */
  async findAllWithUsers({ limit = 20, offset = 0 } = {}) {
    const countResult = await query(
      `SELECT COUNT(*) AS total FROM doctors d WHERE d.deleted_at IS NULL`
    );
    const total = parseInt(countResult.rows[0].total, 10);

    const dataResult = await query(
      `SELECT d.id, d.specialty, d.license_number, d.bio, d.consultation_duration, d.color, d.created_at,
              u.first_name, u.last_name, u.email, u.phone, u.avatar_url, u.is_active
       FROM doctors d
       INNER JOIN users u ON d.user_id = u.id
       WHERE d.deleted_at IS NULL AND u.deleted_at IS NULL
       ORDER BY u.last_name ASC, u.first_name ASC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    return { rows: dataResult.rows, total };
  }

  /**
   * Busca un doctor por su ID de usuario.
   */
  async findByUserId(userId) {
    const result = await query(
      `SELECT d.*, u.first_name, u.last_name, u.email, u.phone, u.avatar_url, u.is_active
       FROM doctors d
       INNER JOIN users u ON d.user_id = u.id
       WHERE d.user_id = $1 AND d.deleted_at IS NULL`,
      [userId]
    );
    return result.rows[0] || null;
  }

  /**
   * Busca un doctor por su ID propio.
   */
  async findByIdWithUser(id) {
    const result = await query(
      `SELECT d.*, u.first_name, u.last_name, u.email, u.phone, u.avatar_url, u.is_active
       FROM doctors d
       INNER JOIN users u ON d.user_id = u.id
       WHERE d.id = $1 AND d.deleted_at IS NULL`,
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Obtiene el horario semanal de un doctor.
   */
  async getSchedule(doctorId) {
    const result = await query(
      `SELECT * FROM doctor_schedules
       WHERE doctor_id = $1 AND is_active = TRUE
       ORDER BY day_of_week ASC`,
      [doctorId]
    );
    return result.rows;
  }

  /**
   * Actualiza el horario semanal de un doctor.
   */
  async updateSchedule(doctorId, dayOfWeek, scheduleData) {
    const { start_time, end_time, break_start, break_end, is_active } = scheduleData;
    const result = await query(
      `INSERT INTO doctor_schedules (doctor_id, day_of_week, start_time, end_time, break_start, break_end, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (doctor_id, day_of_week) DO UPDATE
       SET start_time = EXCLUDED.start_time,
           end_time = EXCLUDED.end_time,
           break_start = EXCLUDED.break_start,
           break_end = EXCLUDED.break_end,
           is_active = EXCLUDED.is_active,
           updated_at = NOW()
       RETURNING *`,
      [doctorId, dayOfWeek, start_time, end_time, break_start || null, break_end || null, is_active !== false]
    );
    return result.rows[0];
  }

  /**
   * Obtiene los días no disponibles de un doctor en un rango.
   */
  async getUnavailability(doctorId, startDate, endDate) {
    const result = await query(
      `SELECT * FROM doctor_unavailability
       WHERE doctor_id = $1 AND start_date <= $2 AND end_date >= $3
       ORDER BY start_date ASC`,
      [doctorId, endDate, startDate]
    );
    return result.rows;
  }

  /**
   * Agrega una fecha/rango no disponible.
   */
  async addUnavailability(doctorId, unavailabilityData) {
    const { start_date, end_date, reason, type } = unavailabilityData;
    const result = await query(
      `INSERT INTO doctor_unavailability (doctor_id, start_date, end_date, reason, type)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [doctorId, start_date, end_date, reason || null, type || 'vacaciones']
    );
    return result.rows[0];
  }

  /**
   * Elimina un registro de no disponibilidad.
   */
  async removeUnavailability(id, doctorId) {
    const result = await query(
      `DELETE FROM doctor_unavailability WHERE id = $1 AND doctor_id = $2`,
      [id, doctorId]
    );
    return result.rowCount > 0;
  }

  /**
   * Crea un usuario y su perfil de doctor en una transacción.
   * @param {object} userData - Datos del usuario (role_id, first_name, last_name, email, password_hash, phone)
   * @param {object} doctorData - Datos del doctor (specialty, license_number, bio, consultation_duration, color)
   * @returns {Promise<object>} - Doctor con datos del usuario
   */
  async createDoctorTransaction(userData, doctorData) {
    const result = await query(
      `WITH new_user AS (
         INSERT INTO users (role_id, first_name, last_name, email, password_hash, phone, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, TRUE)
         RETURNING id, role_id, first_name, last_name, email, phone, is_active, created_at
       )
       INSERT INTO doctors (user_id, specialty, license_number, bio, consultation_duration, color)
       VALUES ((SELECT id FROM new_user), $7, $8, $9, $10, $11)
       RETURNING id, user_id, specialty, license_number, bio, consultation_duration, color, created_at`,
      [
        userData.role_id,
        userData.first_name,
        userData.last_name,
        userData.email,
        userData.password_hash,
        userData.phone || null,
        doctorData.specialty,
        doctorData.license_number || null,
        doctorData.bio || null,
        doctorData.consultation_duration || 30,
        doctorData.color || '#0891b2',
      ]
    );
    return result.rows[0];
  }

  /**
   * Actualiza un doctor y su usuario asociado.
   * @param {number} doctorId - ID del doctor
   * @param {object} userData - Campos a actualizar en users
   * @param {object} doctorData - Campos a actualizar en doctors
   * @returns {Promise<object|null>}
   */
  async updateDoctorTransaction(doctorId, userData, doctorData) {
    // Actualizar usuario
    if (Object.keys(userData).length > 0) {
      const userKeys = Object.keys(userData);
      const userValues = Object.values(userData);
      const userSetClause = userKeys.map((key, i) => `${key} = $${i + 1}`).join(', ');

      await query(
        `UPDATE users
         SET ${userSetClause}, updated_at = NOW()
         WHERE id = (SELECT user_id FROM doctors WHERE id = $${userKeys.length + 1})
           AND deleted_at IS NULL`,
        [...userValues, doctorId]
      );
    }

    // Actualizar doctor
    if (Object.keys(doctorData).length > 0) {
      const docKeys = Object.keys(doctorData);
      const docValues = Object.values(doctorData);
      const docSetClause = docKeys.map((key, i) => `${key} = $${i + 1}`).join(', ');

      await query(
        `UPDATE doctors
         SET ${docSetClause}, updated_at = NOW()
         WHERE id = $${docKeys.length + 1} AND deleted_at IS NULL`,
        [...docValues, doctorId]
      );
    }

    return this.findByIdWithUser(doctorId);
  }

  /**
   * Elimina un doctor y su usuario (soft delete).
   * @param {number} doctorId - ID del doctor
   * @returns {Promise<boolean>}
   */
  async softDeleteDoctor(doctorId) {
    const doctor = await this.findById(doctorId);
    if (!doctor) return false;

    await query(
      `UPDATE doctors SET deleted_at = NOW() WHERE id = $1`,
      [doctorId]
    );

    await query(
      `UPDATE users SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL`,
      [doctor.user_id]
    );

    return true;
  }
}

export default new DoctorRepository();
