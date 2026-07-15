// ============================================
// Repositorio de Citas — Operaciones de datos
// ============================================
import { query, scopeClinic } from '../database/pool.js';
import { BaseRepository } from './base.repository.js';

/**
 * Repositorio para la gestión de citas odontológicas.
 * Extiende el repositorio base con consultas especializadas.
 */
class AppointmentRepository extends BaseRepository {
  constructor() {
    super('appointments');
  }

  /**
   * Obtiene todas las citas con detalles de paciente, doctor, estado y tratamiento.
   * @param {object} options - Opciones de paginación y filtros
   * @returns {Promise<{ rows: Array, total: number }>}
   */
  async findAllWithDetails({ limit = 20, offset = 0, sortBy = 'a.appointment_date', sortOrder = 'DESC', filters = {} } = {}) {
    const conditions = [
      'a.deleted_at IS NULL',
      'u.is_active = TRUE',
      `NOT EXISTS (
        SELECT 1 
        FROM doctor_unavailability du 
        WHERE du.doctor_id = a.doctor_id 
          AND a.appointment_date >= du.start_date 
          AND a.appointment_date <= du.end_date
      )`
    ];
    const params = [];

    // Aplicar scoping de clínica
    scopeClinic(conditions, params, 'a');
    
    let paramIndex = params.length + 1;

    if (filters.doctor_id) {
      conditions.push(`a.doctor_id = $${paramIndex++}`);
      params.push(filters.doctor_id);
    }

    if (filters.patient_id) {
      conditions.push(`a.patient_id = $${paramIndex++}`);
      params.push(filters.patient_id);
    }

    if (filters.status_id) {
      conditions.push(`a.status_id = $${paramIndex++}`);
      params.push(filters.status_id);
    }

    if (filters.date_from) {
      conditions.push(`a.appointment_date >= $${paramIndex++}`);
      params.push(filters.date_from);
    }

    if (filters.date_to) {
      conditions.push(`a.appointment_date <= $${paramIndex++}`);
      params.push(filters.date_to);
    }

    if (filters.search) {
      conditions.push(`(CONCAT(p.first_name, ' ', p.last_name) ILIKE $${paramIndex} OR p.phone ILIKE $${paramIndex})`);
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    if (filters.time_from) {
      conditions.push(`a.start_time >= $${paramIndex++}`);
      params.push(filters.time_from);
    }

    if (filters.time_to) {
      conditions.push(`a.end_time <= $${paramIndex++}`);
      params.push(filters.time_to);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Validar sortBy
    const allowedSortFields = [
      'a.appointment_date', 'a.start_time', 'a.created_at',
      'patient_name', 'doctor_name', 'status_label',
    ];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'a.appointment_date';
    const safeSortOrder = sortOrder === 'ASC' ? 'ASC' : 'DESC';

    const countResult = await query(
      `SELECT COUNT(*) AS total
       FROM appointments a
       INNER JOIN patients p ON a.patient_id = p.id
       INNER JOIN doctors d ON a.doctor_id = d.id
       INNER JOIN users u ON d.user_id = u.id
       ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total, 10);

    // Obtener datos con JOINs
    const dataResult = await query(
      `SELECT
         a.id,
         a.patient_id,
         a.doctor_id,
         a.status_id,
         a.treatment_id,
         a.appointment_date,
         a.start_time,
         a.end_time,
         a.reason,
         a.notes,
         a.gabinete,
         a.cancellation_reason,
         a.is_first_visit,
         a.created_at,
         a.updated_at,
         p.first_name AS patient_first_name,
         p.last_name AS patient_last_name,
         CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
         p.phone AS patient_phone,
         u.first_name AS doctor_first_name,
         u.last_name AS doctor_last_name,
         CONCAT(u.first_name, ' ', u.last_name) AS doctor_name,
         d.specialty AS doctor_specialty,
         d.color AS doctor_color,
         s.name AS status_name,
         s.label AS status_label,
         s.color AS status_color,
         t.name AS treatment_name
       FROM appointments a
       INNER JOIN patients p ON a.patient_id = p.id
       INNER JOIN doctors d ON a.doctor_id = d.id
       INNER JOIN users u ON d.user_id = u.id
       INNER JOIN appointment_status s ON a.status_id = s.id
       LEFT JOIN treatments t ON a.treatment_id = t.id
       ${whereClause}
       ORDER BY ${safeSortBy} ${safeSortOrder}, a.start_time ASC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    return { rows: dataResult.rows, total };
  }

  /**
   * Obtiene una cita por ID con todos los detalles relacionados.
   * @param {number} id - ID de la cita
   * @returns {Promise<object|null>}
   */
  async findByIdWithDetails(id) {
    const conditions = ['a.id = $1', 'a.deleted_at IS NULL'];
    const params = [id];
    scopeClinic(conditions, params, 'a');

    const result = await query(
      `SELECT
         a.id,
         a.patient_id,
         a.doctor_id,
         a.status_id,
         a.treatment_id,
         a.appointment_date,
         a.start_time,
         a.end_time,
         a.reason,
         a.notes,
         a.gabinete,
         a.cancellation_reason,
         a.is_first_visit,
         a.created_by,
         a.created_at,
         a.updated_at,
         p.first_name AS patient_first_name,
         p.last_name AS patient_last_name,
         CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
         p.phone AS patient_phone,
         p.email AS patient_email,
         p.dni AS patient_dni,
         u.first_name AS doctor_first_name,
         u.last_name AS doctor_last_name,
         CONCAT(u.first_name, ' ', u.last_name) AS doctor_name,
         d.specialty AS doctor_specialty,
         d.color AS doctor_color,
         s.name AS status_name,
         s.label AS status_label,
         s.color AS status_color,
         t.name AS treatment_name,
         t.default_price AS treatment_price,
         t.duration_minutes AS treatment_duration
       FROM appointments a
       INNER JOIN patients p ON a.patient_id = p.id
       INNER JOIN doctors d ON a.doctor_id = d.id
       INNER JOIN users u ON d.user_id = u.id
       INNER JOIN appointment_status s ON a.status_id = s.id
       LEFT JOIN treatments t ON a.treatment_id = t.id
       WHERE ${conditions.join(' AND ')}`,
      params
    );
    return result.rows[0] || null;
  }

  /**
   * Obtiene todas las citas de un doctor en una fecha específica.
   * @param {number} doctorId - ID del doctor
   * @param {string} date - Fecha en formato YYYY-MM-DD
   * @returns {Promise<Array>}
   */
  async findByDoctorAndDate(doctorId, date) {
    const conditions = ['a.doctor_id = $1', 'a.appointment_date = $2', 'a.deleted_at IS NULL'];
    const params = [doctorId, date];
    scopeClinic(conditions, params, 'a');

    const result = await query(
      `SELECT
         a.id,
         a.patient_id,
         a.start_time,
         a.end_time,
         a.reason,
         a.notes,
         a.gabinete,
         a.status_id,
         a.treatment_id,
         CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
         p.phone AS patient_phone,
         s.name AS status_name,
         s.label AS status_label,
         s.color AS status_color,
         t.name AS treatment_name
       FROM appointments a
       INNER JOIN patients p ON a.patient_id = p.id
       INNER JOIN appointment_status s ON a.status_id = s.id
       LEFT JOIN treatments t ON a.treatment_id = t.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY a.start_time ASC`,
      params
    );
    return result.rows;
  }

  /**
   * Obtiene citas en un rango de fechas, opcionalmente filtrado por doctor.
   * Útil para vistas de calendario.
   * @param {string} startDate - Fecha inicio YYYY-MM-DD
   * @param {string} endDate - Fecha fin YYYY-MM-DD
   * @param {number|null} doctorId - ID del doctor (opcional)
   * @returns {Promise<Array>}
   */
  async findByDateRange(startDate, endDate, doctorId = null) {
    const conditions = [
      'a.deleted_at IS NULL',
      'u.is_active = TRUE',
      `NOT EXISTS (
        SELECT 1 
        FROM doctor_unavailability du 
        WHERE du.doctor_id = a.doctor_id 
          AND a.appointment_date >= du.start_date 
          AND a.appointment_date <= du.end_date
      )`
    ];
    const params = [];

    scopeClinic(conditions, params, 'a');

    conditions.push(`a.appointment_date >= $${params.length + 1}`);
    params.push(startDate);
    conditions.push(`a.appointment_date <= $${params.length + 1}`);
    params.push(endDate);

    if (doctorId) {
      conditions.push(`a.doctor_id = $${params.length + 1}`);
      params.push(doctorId);
    }

    const result = await query(
      `SELECT
         a.id,
         a.patient_id,
         a.doctor_id,
         a.status_id,
         a.treatment_id,
         a.appointment_date,
         a.start_time,
         a.end_time,
         a.reason,
         a.gabinete,
         a.is_first_visit,
         CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
         CONCAT(u.first_name, ' ', u.last_name) AS doctor_name,
         d.color AS doctor_color,
         d.specialty AS doctor_specialty,
         s.name AS status_name,
         s.label AS status_label,
         s.color AS status_color,
         t.name AS treatment_name
       FROM appointments a
       INNER JOIN patients p ON a.patient_id = p.id
       INNER JOIN doctors d ON a.doctor_id = d.id
       INNER JOIN users u ON d.user_id = u.id
       INNER JOIN appointment_status s ON a.status_id = s.id
       LEFT JOIN treatments t ON a.treatment_id = t.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY a.appointment_date ASC, a.start_time ASC`,
      params
    );
    return result.rows;
  }

  /**
   * Obtiene estadísticas de citas para el dashboard.
   * @returns {Promise<object>}
   */
  async getStats(doctorId = null) {
    const conditions = ['a.deleted_at IS NULL'];
    const params = [];
    scopeClinic(conditions, params, 'a');

    if (doctorId) {
      conditions.push(`a.doctor_id = $${params.length + 1}`);
      params.push(doctorId);
    }

    const baseFilter = conditions.join(' AND ');

    const result = await query(
      `SELECT
         COUNT(*) FILTER (
           WHERE ${baseFilter} AND a.appointment_date = CURRENT_DATE
         ) AS today_total,
         COUNT(*) FILTER (
           WHERE ${baseFilter}
             AND a.appointment_date = CURRENT_DATE
             AND a.status_id = (SELECT id FROM appointment_status WHERE name = 'completada')
         ) AS today_completed,
         COUNT(*) FILTER (
           WHERE ${baseFilter}
             AND a.appointment_date >= CURRENT_DATE
             AND a.status_id IN (
               SELECT id FROM appointment_status WHERE name IN ('programada', 'confirmada')
             )
         ) AS upcoming,
         COUNT(*) FILTER (
           WHERE ${baseFilter}
             AND a.appointment_date = CURRENT_DATE
             AND a.status_id = (SELECT id FROM appointment_status WHERE name = 'cancelada')
         ) AS today_cancelled
       FROM appointments a`,
      params
    );
    return result.rows[0];
  }

  /**
   * Verifica si existe un conflicto de horario para un doctor.
   * @param {number} doctorId - ID del doctor
   * @param {string} date - Fecha YYYY-MM-DD
   * @param {string} startTime - Hora inicio HH:mm
   * @param {string} endTime - Hora fin HH:mm
   * @param {number|null} excludeId - ID de cita a excluir (para actualizaciones)
   * @returns {Promise<object|null>} Cita conflictiva o null
   */
  async checkConflict(doctorId, date, startTime, endTime, excludeId = null) {
    const conditions = ['a.deleted_at IS NULL'];
    const params = [];

    scopeClinic(conditions, params, 'a');

    conditions.push(`a.doctor_id = $${params.length + 1}`);
    params.push(doctorId);
    conditions.push(`a.appointment_date = $${params.length + 1}`);
    params.push(date);
    conditions.push(`(a.start_time < $${params.length + 2} AND a.end_time > $${params.length + 1})`);
    params.push(startTime, endTime);
    conditions.push(`a.status_id NOT IN (SELECT id FROM appointment_status WHERE name IN ('cancelada', 'no_asistio'))`);

    if (excludeId) {
      conditions.push(`a.id != $${params.length + 1}`);
      params.push(excludeId);
    }

    const result = await query(
      `SELECT a.id, a.start_time, a.end_time,
              CONCAT(p.first_name, ' ', p.last_name) AS patient_name
       FROM appointments a
       INNER JOIN patients p ON a.patient_id = p.id
       WHERE ${conditions.join(' AND ')}
       LIMIT 1`,
      params
    );
    return result.rows[0] || null;
  }

  /**
   * Verifica si existe un conflicto de horario para un gabinete.
   * @param {string} gabinete - Nombre del gabinete
   * @param {string} date - Fecha YYYY-MM-DD
   * @param {string} startTime - Hora inicio HH:mm
   * @param {string} endTime - Hora fin HH:mm
   * @param {number|null} excludeId - ID de cita a excluir (para actualizaciones)
   * @returns {Promise<object|null>} Cita conflictiva o null
   */
  async checkCabinetConflict(gabinete, date, startTime, endTime, excludeId = null) {
    const conditions = ['a.deleted_at IS NULL'];
    const params = [];

    scopeClinic(conditions, params, 'a');

    conditions.push(`a.gabinete = $${params.length + 1}`);
    params.push(gabinete);
    conditions.push(`a.appointment_date = $${params.length + 1}`);
    params.push(date);
    conditions.push(`(a.start_time < $${params.length + 2} AND a.end_time > $${params.length + 1})`);
    params.push(startTime, endTime);
    conditions.push(`a.status_id NOT IN (SELECT id FROM appointment_status WHERE name IN ('cancelada', 'no_asistio'))`);

    if (excludeId) {
      conditions.push(`a.id != $${params.length + 1}`);
      params.push(excludeId);
    }

    const result = await query(
      `SELECT a.id, a.start_time, a.end_time,
              CONCAT(p.first_name, ' ', p.last_name) AS patient_name
       FROM appointments a
       INNER JOIN patients p ON a.patient_id = p.id
       WHERE ${conditions.join(' AND ')}
       LIMIT 1`,
      params
    );
    return result.rows[0] || null;
  }
}

export default new AppointmentRepository();
