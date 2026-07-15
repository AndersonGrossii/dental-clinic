// ============================================
// Repositorio de Doctores
// ============================================
import { BaseRepository } from './base.repository.js';
import { query, scopeClinic } from '../database/pool.js';

export class DoctorRepository extends BaseRepository {
  constructor() {
    super('doctors');
  }

  /**
   * Obtiene todos los doctores con información de sus cuentas de usuario.
   */
  async findAllWithUsers({ limit = 20, offset = 0 } = {}) {
    const conditions = ['d.deleted_at IS NULL', 'u.deleted_at IS NULL'];
    const params = [];
    scopeClinic(conditions, params, 'd');

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await query(
      `SELECT COUNT(*) AS total FROM doctors d INNER JOIN users u ON d.user_id = u.id ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total, 10);

    const dataResult = await query(
      `SELECT d.id, d.specialty, d.license_number, d.bio, d.consultation_duration, d.color, d.created_at,
              u.first_name, u.last_name, u.email, u.phone, u.avatar_url, u.is_active
       FROM doctors d
       INNER JOIN users u ON d.user_id = u.id
       ${whereClause}
       ORDER BY u.last_name ASC, u.first_name ASC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    return { rows: dataResult.rows, total };
  }

  /**
   * Busca un doctor por su ID de usuario.
   */
  async findByUserId(userId) {
    const conditions = ['d.user_id = $1', 'd.deleted_at IS NULL'];
    const params = [userId];
    scopeClinic(conditions, params, 'd');

    const result = await query(
      `SELECT d.*, u.first_name, u.last_name, u.email, u.phone, u.avatar_url, u.is_active
       FROM doctors d
       INNER JOIN users u ON d.user_id = u.id
       WHERE ${conditions.join(' AND ')}`,
      params
    );
    return result.rows[0] || null;
  }

  /**
   * Busca un doctor por su ID propio.
   */
  async findByIdWithUser(id) {
    const conditions = ['d.id = $1', 'd.deleted_at IS NULL'];
    const params = [id];
    scopeClinic(conditions, params, 'd');

    const result = await query(
      `SELECT d.*, u.first_name, u.last_name, u.email, u.phone, u.avatar_url, u.is_active
       FROM doctors d
       INNER JOIN users u ON d.user_id = u.id
       WHERE ${conditions.join(' AND ')}`,
      params
    );
    return result.rows[0] || null;
  }

  /**
   * Obtiene el horario semanal de un doctor.
   */
  async getSchedule(doctorId) {
    const conditions = ['doctor_id = $1', 'is_active = TRUE'];
    const params = [doctorId];
    scopeClinic(conditions, params);

    const result = await query(
      `SELECT * FROM doctor_schedules
       WHERE ${conditions.join(' AND ')}
       ORDER BY day_of_week ASC`,
      params
    );
    return result.rows;
  }

  /**
   * Actualiza el horario semanal de un doctor.
   */
  async updateSchedule(doctorId, dayOfWeek, scheduleData) {
    const { start_time, end_time, break_start, break_end, is_active } = scheduleData;
    const clinicId = this.getClinicId();
    const result = await query(
      `INSERT INTO doctor_schedules (doctor_id, day_of_week, start_time, end_time, break_start, break_end, is_active${clinicId ? ', clinic_id' : ''})
       VALUES ($1, $2, $3, $4, $5, $6, $7${clinicId ? ', $8' : ''})
       ON CONFLICT (doctor_id, day_of_week) DO UPDATE
       SET start_time = EXCLUDED.start_time,
           end_time = EXCLUDED.end_time,
           break_start = EXCLUDED.break_start,
           break_end = EXCLUDED.break_end,
           is_active = EXCLUDED.is_active,
           updated_at = NOW()
       RETURNING *`,
      clinicId
        ? [doctorId, dayOfWeek, start_time, end_time, break_start || null, break_end || null, is_active !== false, clinicId]
        : [doctorId, dayOfWeek, start_time, end_time, break_start || null, break_end || null, is_active !== false]
    );
    return result.rows[0];
  }

  /**
   * Obtiene los días no disponibles de un doctor en un rango.
   */
  async getUnavailability(doctorId, startDate, endDate) {
    const conditions = ['doctor_id = $1', 'start_date <= $2', 'end_date >= $3'];
    const params = [doctorId, endDate, startDate];
    scopeClinic(conditions, params);

    const result = await query(
      `SELECT * FROM doctor_unavailability
       WHERE ${conditions.join(' AND ')}
       ORDER BY start_date ASC`,
      params
    );
    return result.rows;
  }

  /**
   * Agrega una fecha/rango no disponible.
   */
  async addUnavailability(doctorId, unavailabilityData) {
    const { start_date, end_date, reason, type } = unavailabilityData;
    const clinicId = this.getClinicId();
    const result = await query(
      `INSERT INTO doctor_unavailability (doctor_id, start_date, end_date, reason, type${clinicId ? ', clinic_id' : ''})
       VALUES ($1, $2, $3, $4, $5${clinicId ? ', $6' : ''})
       RETURNING *`,
      clinicId
        ? [doctorId, start_date, end_date, reason || null, type || 'vacaciones', clinicId]
        : [doctorId, start_date, end_date, reason || null, type || 'vacaciones']
    );
    return result.rows[0];
  }

  /**
   * Elimina un registro de no disponibilidad.
   */
  async removeUnavailability(id, doctorId) {
    const conditions = ['id = $1', 'doctor_id = $2'];
    const params = [id, doctorId];
    scopeClinic(conditions, params);

    const result = await query(
      `DELETE FROM doctor_unavailability WHERE ${conditions.join(' AND ')}`,
      params
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
    const clinicId = this.getClinicId();

    const result = await query(
      `WITH new_user AS (
         INSERT INTO users (role_id, first_name, last_name, email, password_hash, phone, is_active ${clinicId ? ', clinic_id' : ''})
         VALUES ($1, $2, $3, $4, $5, $6, TRUE ${clinicId ? ', $12' : ''})
         RETURNING id, role_id, first_name, last_name, email, phone, is_active, created_at
       )
       INSERT INTO doctors (user_id, specialty, license_number, bio, consultation_duration, color ${clinicId ? ', clinic_id' : ''})
       VALUES ((SELECT id FROM new_user), $7, $8, $9, $10, $11 ${clinicId ? ', $12' : ''})
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
      ].concat(clinicId ? [clinicId] : [])
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

      const conditions = [`id = $${docKeys.length + 1}`, 'deleted_at IS NULL'];
      const dcParams = [doctorId];
      scopeClinic(conditions, dcParams);

      await query(
        `UPDATE doctors
         SET ${docSetClause}, updated_at = NOW()
         WHERE ${conditions.join(' AND ')}`,
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

    const conditions = ['id = $1', 'deleted_at IS NULL'];
    const params = [doctorId];
    scopeClinic(conditions, params);

    await query(
      `UPDATE doctors SET deleted_at = NOW() WHERE ${conditions.join(' AND ')}`,
      params
    );

    await query(
      `UPDATE users SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL`,
      [doctor.user_id]
    );

    return true;
  }
}

export default new DoctorRepository();
