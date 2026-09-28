// ============================================
// Servicio de Agendamiento Inteligente de Primeras Visitas
// Especialización estricta por sede:
// - Sede 1 (Xúquer - Dental): Exclusivamente Dra. Sonia Primeras Visitas en franjas de 15 minutos.
// - Sede 2 (Castellón - Estética): Especialista de Estética de Castellón.
// Regla: El paciente SOLO recibe la hora de llegada (sin duración de consulta).
// ============================================
import { query } from '../database/pool.js';
import appointmentService from './appointment.service.js';
import holidayService from './holiday.service.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../utils/errors.js';

class AIBookingService {
  /**
   * Resuelve el doctor responsable de las primeras visitas según la clínica.
   * Xúquer (ID 1) = Exclusivamente Dra. Sonia Primeras Visitas (15 min).
   * Otras clínicas = Especialista de esa clínica (ej. Estética Castellón).
   */
  async getFirstVisitDoctorForClinic(clinicId = 1) {
    const cid = parseInt(clinicId, 10) || 1;

    if (cid === 1) {
      // Sede 1: Xúquer (Dental)
      const res = await query(
        `SELECT d.id, d.consultation_duration, d.specialty, d.color,
                u.first_name, u.last_name, u.email, u.phone
         FROM doctors d
         JOIN users u ON d.user_id = u.id
         WHERE u.clinic_id = 1 
           AND (u.first_name ILIKE '%Sonia%' OR d.specialty ILIKE '%Primeras Visitas%')
           AND d.deleted_at IS NULL
         LIMIT 1`
      );

      if (res.rows.length > 0) {
        return {
          doctor: res.rows[0],
          slotDurationMinutes: 15, // Franja estricta de 15 minutos
          clinicType: 'DENTAL',
          welcomeFocus: 'primera revisión dental gratuita',
          doctorTitle: 'Dra. Sonia Primeras Visitas',
        };
      }
    }

    // Sede 2 u otras: Especialista médico/estético de esa sede (NUNCA Dra. Sonia)
    const otherRes = await query(
      `SELECT d.id, d.consultation_duration, d.specialty, d.color,
              u.first_name, u.last_name, u.email, u.phone
       FROM doctors d
       JOIN users u ON d.user_id = u.id
       WHERE u.clinic_id = $1 
         AND u.first_name NOT ILIKE '%Sonia%'
         AND d.deleted_at IS NULL
       ORDER BY d.id ASC
       LIMIT 1`,
      [cid]
    );

    const doc = otherRes.rows[0] || null;
    return {
      doctor: doc,
      slotDurationMinutes: doc?.consultation_duration || 30,
      clinicType: cid === 2 ? 'ESTETICA' : 'GENERAL',
      welcomeFocus: cid === 2 ? 'primera consulta de valoración estética' : 'primera visita',
      doctorTitle: doc ? `${doc.first_name} ${doc.last_name}` : 'nuestro especialista',
    };
  }

  /**
   * Obtiene franjas disponibles para una fecha específica.
   * Para Dra. Sonia en Xúquer: evalúa franjas de 15 minutos exactos.
   */
  async getAvailableSlots(clinicId = 1, targetDateStr = null) {
    const cid = parseInt(clinicId, 10) || 1;
    const docInfo = await this.getFirstVisitDoctorForClinic(cid);

    if (!docInfo.doctor) {
      return { availableSlots: [], message: 'No hay especialista configurado para esta clínica.' };
    }

    const doctorId = docInfo.doctor.id;
    const slotMinutes = docInfo.slotDurationMinutes; // 15 min en Xúquer

    // Fecha objetivo (si no se indica, mañana o siguiente día laborable)
    let targetDate = targetDateStr;
    if (!targetDate) {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      targetDate = d.toISOString().split('T')[0];
    }

    // Verificar si es fin de semana o festivo
    const dateObj = new Date(targetDate + 'T12:00:00');
    const dow = dateObj.getDay(); // 0 = Domingo, 6 = Sábado
    if (dow === 0 || dow === 6) {
      return { availableSlots: [], isHolidayOrWeekend: true, reason: 'Fin de semana' };
    }

    const holiday = await holidayService.isHoliday(cid, targetDate);
    if (holiday) {
      return { availableSlots: [], isHolidayOrWeekend: true, reason: `Festivo: ${holiday.name}` };
    }

    // Obtener horario del doctor para este día de la semana
    const schedRes = await query(
      `SELECT start_time, end_time, break_start, break_end 
       FROM doctor_schedules 
       WHERE doctor_id = $1 AND day_of_week = $2 AND is_active = TRUE`,
      [doctorId, dow]
    );

    if (schedRes.rows.length === 0) {
      return { availableSlots: [], message: 'El doctor no pasa consulta en este día de la semana.' };
    }

    const sched = schedRes.rows[0];
    const startTimeStr = String(sched.start_time).substring(0, 5); // "09:00"
    const endTimeStr = String(sched.end_time).substring(0, 5);     // "20:00"
    const breakStartStr = sched.break_start ? String(sched.break_start).substring(0, 5) : null;
    const breakEndStr = sched.break_end ? String(sched.break_end).substring(0, 5) : null;

    // Obtener citas ya ocupadas para este doctor en esta fecha
    const apptsRes = await query(
      `SELECT start_time, end_time
       FROM appointments
       WHERE clinic_id = $1 
         AND doctor_id = $2 
         AND appointment_date = $3 
         AND deleted_at IS NULL
         AND status_id NOT IN (SELECT id FROM appointment_status WHERE name = 'cancelada')`,
      [cid, doctorId, targetDate]
    );

    const bookedRanges = apptsRes.rows.map(a => ({
      start: String(a.start_time).substring(0, 5),
      end: String(a.end_time).substring(0, 5),
    }));

    // Generar franjas (slots)
    const slots = [];
    const [startH, startM] = startTimeStr.split(':').map(Number);
    const [endH, endM] = endTimeStr.split(':').map(Number);

    let currentMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    const breakStartMin = breakStartStr ? parseInt(breakStartStr.split(':')[0]) * 60 + parseInt(breakStartStr.split(':')[1]) : null;
    const breakEndMin = breakEndStr ? parseInt(breakEndStr.split(':')[0]) * 60 + parseInt(breakEndStr.split(':')[1]) : null;

    while (currentMinutes + slotMinutes <= endMinutes) {
      // Excluir descanso
      if (breakStartMin !== null && breakEndMin !== null) {
        if (currentMinutes >= breakStartMin && currentMinutes < breakEndMin) {
          currentMinutes += slotMinutes;
          continue;
        }
      }

      const slotH = Math.floor(currentMinutes / 60).toString().padStart(2, '0');
      const slotM = (currentMinutes % 60).toString().padStart(2, '0');
      const slotTimeStr = `${slotH}:${slotM}`;

      const slotEndMin = currentMinutes + slotMinutes;
      const slotEndH = Math.floor(slotEndMin / 60).toString().padStart(2, '0');
      const slotEndM = (slotEndMin % 60).toString().padStart(2, '0');
      const slotEndTimeStr = `${slotEndH}:${slotEndM}`;

      // Verificar solapamiento con citas existentes
      const isBooked = bookedRanges.some(b => {
        return (slotTimeStr >= b.start && slotTimeStr < b.end) ||
               (slotEndTimeStr > b.start && slotEndTimeStr <= b.end);
      });

      if (!isBooked) {
        slots.push({
          time: slotTimeStr,
          formattedArrival: `a las ${slotTimeStr}h`, // Solo hora de llegada
          date: targetDate,
        });
      }

      currentMinutes += slotMinutes;
    }

    return {
      clinicId: cid,
      doctorTitle: docInfo.doctorTitle,
      date: targetDate,
      slotDurationMinutes: slotMinutes,
      availableSlots: slots,
    };
  }

  /**
   * Realiza la reserva formal de una primera visita para el paciente / lead.
   * Regla de Negocio: En Xúquer se asocia siempre a Dra. Sonia con 15 minutos.
   */
  async bookFirstVisit({ clinicId = 1, patientId = null, guestName = null, phone = null, appointmentDate, startTime }) {
    const cid = parseInt(clinicId, 10) || 1;
    const docInfo = await this.getFirstVisitDoctorForClinic(cid);

    if (!docInfo.doctor) {
      throw new AppError('No se encontró el especialista de primera visita para esta sede.', 404);
    }

    const duration = docInfo.slotDurationMinutes; // 15 minutos en Xúquer
    const [h, m] = startTime.split(':').map(Number);
    const endMinutes = h * 60 + m + duration;
    const endH = Math.floor(endMinutes / 60).toString().padStart(2, '0');
    const endM = (endMinutes % 60).toString().padStart(2, '0');
    const endTime = `${endH}:${endM}:00`;

    // Obtener status 'programada'
    const statusRes = await query(`SELECT id FROM appointment_status WHERE name = 'programada' LIMIT 1`);
    const statusId = statusRes.rows[0]?.id || 1;

    // Buscar o asignar gabinete 1 por defecto para primeras visitas
    const cabinetRes = await query(`SELECT id FROM cabinets WHERE clinic_id = $1 AND is_active = TRUE ORDER BY id ASC LIMIT 1`, [cid]);
    const cabinetId = cabinetRes.rows[0]?.id || null;

    // Insertar cita en appointments
    const insertRes = await query(
      `INSERT INTO appointments (
         clinic_id, patient_id, doctor_id, cabinet_id, appointment_date,
         start_time, end_time, duration, status_id, reason, notes, guest_name, created_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, (SELECT user_id FROM doctors WHERE id = $3))
       RETURNING *`,
      [
        cid,
        patientId,
        docInfo.doctor.id,
        cabinetId,
        appointmentDate,
        `${startTime}:00`,
        endTime,
        duration,
        statusId,
        cid === 1 ? 'Primera Revisión Gratuita' : 'Primera Consulta de Valoración Estética',
        `Cita concertada automáticamente por el asistente de IA Sofía para ${docInfo.doctorTitle}. Contacto: ${phone || ''}`,
        guestName,
      ]
    );

    const appt = insertRes.rows[0];
    logger.info(`[AI_BOOKING] Primera visita #${appt.id} agendada para ${guestName || 'Paciente #' + patientId} con ${docInfo.doctorTitle} el ${appointmentDate} a las ${startTime}h.`);

    return {
      appointmentId: appt.id,
      doctorName: docInfo.doctorTitle,
      date: appointmentDate,
      arrivalTime: startTime, // El paciente solo necesita saber esta hora
      messageForPatient: `✅ Su cita ha quedado reservada con éxito. Le esperamos el ${appointmentDate} a las ${startTime}h en nuestra clínica.`,
    };
  }
}

export default new AIBookingService();
