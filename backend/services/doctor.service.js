// ============================================
// Servicio de Doctores
// ============================================
import bcrypt from 'bcryptjs';
import doctorRepository from '../repositories/doctor.repository.js';
import userRepository from '../repositories/user.repository.js';
import appointmentRepository from '../repositories/appointment.repository.js';
import { query } from '../database/pool.js';
import config from '../config/app.js';
import { AppError } from '../utils/errors.js';
import { buildPaginationMeta } from '../utils/pagination.js';
import { logger } from '../utils/logger.js';

class DoctorService {
  /**
   * Obtiene todos los doctores con paginación.
   */
  async getAll({ page = 1, limit = 20 } = {}) {
    const offset = (page - 1) * limit;
    const { rows, total } = await doctorRepository.findAllWithUsers({ limit, offset });
    const pagination = buildPaginationMeta(total, page, limit);
    return { doctors: rows, pagination };
  }

  /**
   * Obtiene un doctor por su ID.
   */
  async getById(id) {
    const doctor = await doctorRepository.findByIdWithUser(id);
    if (!doctor) {
      throw new AppError('Doctor no encontrado', 404);
    }
    return doctor;
  }

  /**
   * Obtiene el horario semanal de un doctor.
   */
  async getSchedule(doctorId) {
    await this.getById(doctorId); // Validar existencia
    return await doctorRepository.getSchedule(doctorId);
  }

  /**
   * Actualiza el horario de un doctor.
   */
  async updateSchedule(doctorId, scheduleArray) {
    await this.getById(doctorId);
    const results = [];
    for (const item of scheduleArray) {
      const { day_of_week, start_time, end_time, break_start, break_end, is_active } = item;
      if (day_of_week === undefined || day_of_week < 0 || day_of_week > 6) {
        throw new AppError('Día de la semana inválido', 400);
      }
      const res = await doctorRepository.updateSchedule(doctorId, day_of_week, {
        start_time,
        end_time,
        break_start,
        break_end,
        is_active,
      });
      results.push(res);
    }
    return results;
  }

  /**
   * Agrega días de no disponibilidad.
   */
  async addUnavailability(doctorId, data) {
    await this.getById(doctorId);
    return await doctorRepository.addUnavailability(doctorId, data);
  }

  /**
   * Elimina no disponibilidad.
   */
  async removeUnavailability(id, doctorId) {
    await this.getById(doctorId);
    const success = await doctorRepository.removeUnavailability(id, doctorId);
    if (!success) {
      throw new AppError('Registro de no disponibilidad no encontrado', 404);
    }
    return true;
  }

  /**
   * Obtiene la no disponibilidad de un doctor en un rango de fechas.
   */
  async getUnavailability(doctorId, dateFrom, dateTo) {
    await this.getById(doctorId);
    return await doctorRepository.getUnavailability(doctorId, dateFrom, dateTo);
  }

  /**
   * Crea un nuevo doctor con su cuenta de usuario.
   * @param {object} data - { firstName, lastName, email, password, phone, specialty, licenseNumber, bio, consultationDuration, color }
   * @returns {Promise<object>}
   * @throws {AppError} Si el email ya está registrado
   */
  async create(data) {
    const existingUser = await userRepository.findByEmail(data.email);
    if (existingUser) {
      throw new AppError('Ya existe un usuario con ese correo electrónico.', 409);
    }

    const roleResult = await query(
      "SELECT id FROM roles WHERE name = 'doctor'"
    );
    const roleId = roleResult.rows[0]?.id;
    if (!roleId) {
      throw new AppError('Rol de doctor no encontrado en el sistema.', 500);
    }

    const passwordHash = await bcrypt.hash(data.password, config.bcrypt.saltRounds);

    const userData = {
      role_id: roleId,
      first_name: data.firstName,
      last_name: data.lastName,
      email: data.email,
      password_hash: passwordHash,
      phone: data.phone || null,
    };

    const doctorData = {
      specialty: data.specialty,
      license_number: data.licenseNumber || null,
      bio: data.bio || null,
      consultation_duration: data.consultationDuration || 30,
      color: data.color || '#0891b2',
    };

    const doctor = await doctorRepository.createDoctorTransaction(userData, doctorData);
    const fullDoctor = await this.getById(doctor.id);

    logger.info(`Doctor creado: ${fullDoctor.first_name} ${fullDoctor.last_name} (ID: ${doctor.id})`);

    return fullDoctor;
  }

  /**
   * Actualiza un doctor existente y su cuenta de usuario.
   * @param {number} id - ID del doctor
   * @param {object} data - Campos a actualizar
   * @returns {Promise<object>}
   * @throws {AppError} Si no existe o el email está duplicado
   */
  async update(id, data) {
    const existing = await doctorRepository.findByIdWithUser(id);
    if (!existing) {
      throw new AppError('Doctor no encontrado.', 404);
    }

    if (data.email && data.email !== existing.email) {
      const emailInUse = await userRepository.findByEmail(data.email);
      if (emailInUse) {
        throw new AppError('Ya existe un usuario con ese correo electrónico.', 409);
      }
    }

    const userData = {};
    if (data.firstName !== undefined) userData.first_name = data.firstName;
    if (data.lastName !== undefined) userData.last_name = data.lastName;
    if (data.email !== undefined) userData.email = data.email;
    if (data.phone !== undefined) userData.phone = data.phone;

    const doctorData = {};
    if (data.specialty !== undefined) doctorData.specialty = data.specialty;
    if (data.licenseNumber !== undefined) doctorData.license_number = data.licenseNumber;
    if (data.bio !== undefined) doctorData.bio = data.bio;
    if (data.consultationDuration !== undefined) doctorData.consultation_duration = data.consultationDuration;
    if (data.color !== undefined) doctorData.color = data.color;

    if (Object.keys(userData).length === 0 && Object.keys(doctorData).length === 0) {
      throw new AppError('No se proporcionaron datos para actualizar.', 400);
    }

    const updated = await doctorRepository.updateDoctorTransaction(id, userData, doctorData);
    logger.info(`Doctor actualizado: ID ${id}`);
    return updated;
  }

  /**
   * Elimina un doctor (soft delete).
   * @param {number} id - ID del doctor
   * @returns {Promise<boolean>}
   * @throws {AppError} Si no existe
   */
  async delete(id) {
    const existing = await doctorRepository.findByIdWithUser(id);
    if (!existing) {
      throw new AppError('Doctor no encontrado.', 404);
    }

    const deleted = await doctorRepository.softDeleteDoctor(id);
    if (!deleted) {
      throw new AppError('No se pudo eliminar el doctor.', 500);
    }

    logger.info(`Doctor eliminado (soft): ID ${id}`);
    return true;
  }

  /**
   * Calcula los intervalos de disponibilidad de un doctor en una fecha específica.
   */
  async getAvailability(doctorId, dateString) {
    const doctor = await this.getById(doctorId);
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      throw new AppError('Fecha inválida', 400);
    }

    const dayOfWeek = date.getDay(); // 0 = Domingo, 1 = Lunes, ...
    
    // 1. Obtener horario para ese día de la semana
    const schedules = await doctorRepository.getSchedule(doctorId);
    const daySchedule = schedules.find(s => s.day_of_week === dayOfWeek);

    if (!daySchedule || !daySchedule.is_active) {
      return []; // No trabaja este día
    }

    // 2. Verificar si está de vacaciones o no disponible
    const unavailability = await doctorRepository.getUnavailability(doctorId, dateString, dateString);
    if (unavailability.length > 0) {
      return []; // No disponible este día
    }

    // 3. Obtener citas agendadas para este día
    const appointments = await appointmentRepository.findByDoctorAndDate(doctorId, dateString);

    // 4. Calcular slots disponibles
    const duration = doctor.consultation_duration || 30; // Minutos
    const slots = [];
    
    const [startHour, startMin] = daySchedule.start_time.split(':').map(Number);
    const [endHour, endMin] = daySchedule.end_time.split(':').map(Number);
    
    let current = new Date(date);
    current.setHours(startHour, startMin, 0, 0);

    const end = new Date(date);
    end.setHours(endHour, endMin, 0, 0);

    let breakStart = null;
    let breakEnd = null;

    if (daySchedule.break_start && daySchedule.break_end) {
      const [bsHour, bsMin] = daySchedule.break_start.split(':').map(Number);
      const [beHour, beMin] = daySchedule.break_end.split(':').map(Number);
      breakStart = new Date(date);
      breakStart.setHours(bsHour, bsMin, 0, 0);
      breakEnd = new Date(date);
      breakEnd.setHours(beHour, beMin, 0, 0);
    }

    while (current < end) {
      const slotEnd = new Date(current.getTime() + duration * 60000);
      
      if (slotEnd > end) break;

      // Verificar si cae en horario de comida/descanso
      const isBreak = breakStart && breakEnd && (current >= breakStart && current < breakEnd || slotEnd > breakStart && slotEnd <= breakEnd);

      if (!isBreak) {
        const slotStartStr = current.toTimeString().substring(0, 5);
        const slotEndStr = slotEnd.toTimeString().substring(0, 5);

        // Verificar si se traslapa con alguna cita
        const isOverlap = appointments.some(app => {
          // Las citas tienen campos start_time y end_time (formato 'HH:MM:SS' o similar)
          const appStart = app.start_time.substring(0, 5);
          const appEnd = app.end_time.substring(0, 5);
          
          return (slotStartStr >= appStart && slotStartStr < appEnd) ||
                 (slotEndStr > appStart && slotEndStr <= appEnd) ||
                 (slotStartStr <= appStart && slotEndStr >= appEnd);
        });

        if (!isOverlap) {
          slots.push({
            start_time: slotStartStr,
            end_time: slotEndStr,
          });
        }
      }

      current = new Date(current.getTime() + duration * 60000);
    }

    return slots;
  }
}

export default new DoctorService();
