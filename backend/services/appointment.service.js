// ============================================
// Servicio de Citas — Lógica de negocio
// ============================================
import appointmentRepository from '../repositories/appointment.repository.js';
import notificationService from './notification.service.js';
import { query } from '../database/pool.js';
import { AppError } from '../utils/errors.js';
import { toAppointmentDTO, toCalendarEventDTO } from '../dtos/appointment.dto.js';
import { formatDateSQL } from '../utils/date.js';

/**
 * Servicio que encapsula la lógica de negocio para la gestión de citas.
 */
class AppointmentService {
  /**
   * Obtiene todas las citas con paginación y filtros.
   * @param {object} options - { limit, offset, sortBy, sortOrder, filters }
   * @returns {Promise<{ data: Array, total: number }>}
   */
  async getAll(options) {
    const { rows, total } = await appointmentRepository.findAllWithDetails(options);
    const data = rows.map(toAppointmentDTO);
    return { data, total };
  }

  /**
   * Obtiene una cita por ID con todos los detalles.
   * @param {number} id - ID de la cita
   * @returns {Promise<object>}
   * @throws {AppError} Si la cita no existe
   */
  async getById(id) {
    const appointment = await appointmentRepository.findByIdWithDetails(id);
    if (!appointment) {
      throw new AppError('Cita no encontrada.', 404);
    }
    return toAppointmentDTO(appointment);
  }

  /**
   * Crea una nueva cita validando conflictos de horario.
   * @param {object} data - Datos de la cita
   * @param {number} userId - ID del usuario que crea la cita
   * @returns {Promise<object>}
   * @throws {AppError} Si hay conflicto de horario
   */
  async create(data, userId) {
    // Verificar que el paciente existe
    const patientResult = await query(
      'SELECT id, first_name, last_name FROM patients WHERE id = $1 AND deleted_at IS NULL',
      [data.patient_id]
    );
    if (patientResult.rows.length === 0) {
      throw new AppError('El paciente seleccionado no existe.', 404);
    }

    // Verificar que el doctor existe
    const doctorResult = await query(
      `SELECT d.id, u.first_name, u.last_name, d.user_id
       FROM doctors d
       INNER JOIN users u ON d.user_id = u.id
       WHERE d.id = $1 AND d.deleted_at IS NULL`,
      [data.doctor_id]
    );
    if (doctorResult.rows.length === 0) {
      throw new AppError('El doctor seleccionado no existe.', 404);
    }

    // Verificar conflicto de horario
    const conflict = await appointmentRepository.checkConflict(
      data.doctor_id,
      data.appointment_date,
      data.start_time,
      data.end_time
    );
    if (conflict) {
      throw new AppError(
        `Conflicto de horario: el doctor ya tiene una cita con ${conflict.patient_name} de ${conflict.start_time} a ${conflict.end_time}.`,
        409
      );
    }

    // Obtener el estado "programada" por defecto
    const statusResult = await query(
      "SELECT id FROM appointment_status WHERE name = 'programada'",
    );
    const statusId = statusResult.rows[0]?.id || 1;

    // Verificar si es primera visita del paciente
    const previousVisits = await query(
      'SELECT COUNT(*) AS total FROM appointments WHERE patient_id = $1 AND deleted_at IS NULL',
      [data.patient_id]
    );
    const isFirstVisit = parseInt(previousVisits.rows[0].total, 10) === 0;

    // Crear la cita
    const appointmentData = {
      patient_id: data.patient_id,
      doctor_id: data.doctor_id,
      status_id: statusId,
      treatment_id: data.treatment_id || null,
      appointment_date: data.appointment_date,
      start_time: data.start_time,
      end_time: data.end_time,
      reason: data.reason || null,
      notes: data.notes || null,
      is_first_visit: isFirstVisit,
      created_by: userId,
    };

    const created = await appointmentRepository.create(appointmentData);

    // Crear notificación para el doctor
    const doctor = doctorResult.rows[0];
    const patient = patientResult.rows[0];
    try {
      await notificationService.create({
        user_id: doctor.user_id,
        title: 'Nueva cita programada',
        message: `Se ha programado una cita con ${patient.first_name} ${patient.last_name} para el ${data.appointment_date} a las ${data.start_time}.`,
        type: 'info',
        reference_type: 'appointment',
        reference_id: created.id,
      });
    } catch {
      // No fallar la creación si la notificación falla
    }

    // Retornar la cita con detalles completos
    return this.getById(created.id);
  }

  /**
   * Actualiza una cita existente. Valida conflictos si se cambia el horario.
   * @param {number} id - ID de la cita
   * @param {object} data - Datos a actualizar
   * @returns {Promise<object>}
   * @throws {AppError} Si la cita no existe o hay conflicto
   */
  async update(id, data) {
    const existing = await appointmentRepository.findById(id);
    if (!existing) {
      throw new AppError('Cita no encontrada.', 404);
    }

    // Si se cambia horario o doctor, verificar conflictos
    const doctorId = data.doctor_id || existing.doctor_id;
    const appointmentDate = data.appointment_date || formatDateSQL(existing.appointment_date);
    const startTime = data.start_time || existing.start_time;
    const endTime = data.end_time || existing.end_time;

    const timeChanged =
      data.doctor_id || data.appointment_date || data.start_time || data.end_time;

    if (timeChanged) {
      const conflict = await appointmentRepository.checkConflict(
        doctorId,
        appointmentDate,
        startTime,
        endTime,
        id
      );
      if (conflict) {
        throw new AppError(
          `Conflicto de horario: el doctor ya tiene una cita con ${conflict.patient_name} de ${conflict.start_time} a ${conflict.end_time}.`,
          409
        );
      }
    }

    // Construir datos de actualización (solo campos proporcionados)
    const updateData = {};
    const allowedFields = [
      'patient_id', 'doctor_id', 'appointment_date', 'start_time',
      'end_time', 'treatment_id', 'reason', 'notes',
    ];
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        updateData[field] = data[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      throw new AppError('No se proporcionaron datos para actualizar.', 400);
    }

    await appointmentRepository.update(id, updateData);
    return this.getById(id);
  }

  /**
   * Actualiza el estado de una cita con validación de transición.
   * Flujo: programada → confirmada → en_consulta → completada
   * Estados finales alternativos: cancelada, no_asistio
   * @param {number} id - ID de la cita
   * @param {string} statusName - Nombre del nuevo estado
   * @param {string|null} reason - Motivo (para cancelación)
   * @returns {Promise<object>}
   * @throws {AppError} Si la transición no es válida
   */
  async updateStatus(id, statusName, reason = null) {
    const existing = await appointmentRepository.findByIdWithDetails(id);
    if (!existing) {
      throw new AppError('Cita no encontrada.', 404);
    }

    // Definir transiciones de estado válidas
    const validTransitions = {
      programada: ['confirmada', 'cancelada', 'no_asistio'],
      confirmada: ['en_consulta', 'cancelada', 'no_asistio'],
      en_consulta: ['completada', 'cancelada'],
      completada: [],
      cancelada: ['programada', 'confirmada', 'en_consulta', 'completada', 'no_asistio'],
      no_asistio: ['programada'],
    };

    const currentStatus = existing.status_name;
    const allowed = validTransitions[currentStatus] || [];

    if (!allowed.includes(statusName)) {
      throw new AppError(
        `No se puede cambiar el estado de "${currentStatus}" a "${statusName}". Transiciones permitidas: ${allowed.join(', ') || 'ninguna'}.`,
        400
      );
    }

    // Obtener el ID del nuevo estado
    const statusResult = await query(
      'SELECT id FROM appointment_status WHERE name = $1',
      [statusName]
    );
    if (statusResult.rows.length === 0) {
      throw new AppError(`Estado "${statusName}" no encontrado en el sistema.`, 400);
    }

    const updateData = { status_id: statusResult.rows[0].id };

    if (statusName === 'cancelada' && reason) {
      updateData.cancellation_reason = reason;
    } else if (currentStatus === 'cancelada' && statusName !== 'cancelada') {
      updateData.cancellation_reason = null;
    }

    await appointmentRepository.update(id, updateData);

    // Notificar cancelación
    if (statusName === 'cancelada') {
      try {
        // Obtener user_id del doctor para notificar
        const doctorUserResult = await query(
          'SELECT user_id FROM doctors WHERE id = $1',
          [existing.doctor_id]
        );
        if (doctorUserResult.rows[0]) {
          await notificationService.createAppointmentCancellation(
            doctorUserResult.rows[0].user_id,
            existing
          );
        }
      } catch {
        // No fallar el cambio de estado si la notificación falla
      }
    }

    return this.getById(id);
  }

  /**
   * Cancela una cita manteniendola visible en la agenda.
   * @param {number} id - ID de la cita
   * @returns {Promise<object>}
   * @throws {AppError} Si la cita no existe
   */
  async delete(id) {
    const existing = await appointmentRepository.findById(id);
    if (!existing) {
      throw new AppError('Cita no encontrada.', 404);
    }

    const statusResult = await query(
      "SELECT id FROM appointment_status WHERE name = 'cancelada'"
    );
    const cancelledStatusId = statusResult.rows[0]?.id;
    if (!cancelledStatusId) {
      throw new AppError('Estado "cancelada" no encontrado en el sistema.', 500);
    }

    await appointmentRepository.update(id, { status_id: cancelledStatusId });
    return this.getById(id);
  }

  /**
   * Obtiene citas para vista de calendario en un rango de fechas.
   * @param {string} startDate - Fecha inicio YYYY-MM-DD
   * @param {string} endDate - Fecha fin YYYY-MM-DD
   * @param {number|null} doctorId - ID del doctor (opcional)
   * @returns {Promise<Array>}
   */
  async getCalendar(startDate, endDate, doctorId = null) {
    if (!startDate || !endDate) {
      throw new AppError('Las fechas de inicio y fin son obligatorias.', 400);
    }
    const rows = await appointmentRepository.findByDateRange(startDate, endDate, doctorId);
    return rows.map(toCalendarEventDTO);
  }

  /**
   * Obtiene las citas de hoy para un doctor específico o todos.
   * @param {number|null} doctorId - ID del doctor (opcional)
   * @returns {Promise<Array>}
   */
  async getTodayAppointments(doctorId = null) {
    const today = formatDateSQL(new Date());
    if (doctorId) {
      const rows = await appointmentRepository.findByDoctorAndDate(doctorId, today);
      return rows.map(toAppointmentDTO);
    }
    // Si no se especifica doctor, obtener todas las citas de hoy
    const rows = await appointmentRepository.findByDateRange(today, today);
    return rows.map(toCalendarEventDTO);
  }

  /**
   * Obtiene estadísticas del dashboard de citas.
   * @returns {Promise<object>}
   */
  async getStats(doctorId = null) {
    const stats = await appointmentRepository.getStats(doctorId);
    return {
      todayTotal: parseInt(stats.today_total, 10),
      todayCompleted: parseInt(stats.today_completed, 10),
      upcoming: parseInt(stats.upcoming, 10),
      todayCancelled: parseInt(stats.today_cancelled, 10),
    };
  }
}

export default new AppointmentService();
