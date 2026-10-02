// ============================================
// Servicio de Agendamiento Inteligente y Flujo de Citas (Fase 5)
// Especialización estricta por sede:
// - Sede 1 (Xúquer - Dental): Dra. Sonia Primeras Visitas (15 min) / Revisión diagnóstica.
// - Sede 2 (Castellón - Estética): Especialista de Estética de Castellón.
// Regla Inviolable: El paciente SOLO recibe la hora de llegada (sin duración interna).
// Capacidades de Fase 5:
// - Identificación y vinculación de paciente
// - Identificación de servicio clínico solicitado
// - Búsqueda avanzada de franjas (siguiente día laborable y franja mañana/tarde)
// - Revalidación estricta ante colisiones (concurrencia)
// - Creación y confirmación
// - Reagendamiento determinista (RESCHEDULE)
// - Cancelación determinista (CANCEL)
// ============================================
import { query } from '../database/pool.js';
import holidayService from './holiday.service.js';
import eventStreamService from './event-stream.service.js';
import aiCrmWorkflowService from './ai-crm-workflow.service.js';
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
      doctorTitle: doc ? `Dr/a. ${doc.first_name} ${doc.last_name}` : 'nuestro especialista',
    };
  }

  /**
   * Resuelve el doctor adecuado para un paciente según su historial y condición:
   * - Pacientes antiguos / recurrentes: NUNCA se agendan con Dra. Sonia (exclusiva de primeras visitas en Xúquer).
   *   Se examina su historial de citas para encontrar el doctor con el que se atienden habitualmente.
   *   Si no tienen historial con otro doctor pero ya están registrados como pacientes, se asigna al especialista clínico general/principal.
   *   Se marca is_first_visit = FALSE.
   * - Pacientes nuevos: Se asigna al especialista de primera visita (Dra. Sonia en Xúquer) con is_first_visit = TRUE.
   */
  async getDoctorForPatient({ clinicId = 1, patientId = null, phone = null }) {
    const cid = parseInt(clinicId, 10) || 1;
    let resolvedPatient = null;

    // 1. Localizar paciente si se proporcionó ID
    if (patientId) {
      const pRes = await query(
        `SELECT id, first_name, last_name, phone FROM patients WHERE id = $1 AND clinic_id = $2 AND deleted_at IS NULL`,
        [patientId, cid]
      );
      if (pRes.rows.length > 0) resolvedPatient = pRes.rows[0];
    }

    // 2. Si no se localizó por ID, buscar por teléfono en patients
    if (!resolvedPatient && phone) {
      const cleanPhone = phone.replace(/\D/g, '').slice(-9);
      if (cleanPhone.length >= 6) {
        const pRes = await query(
          `SELECT id, first_name, last_name, phone 
           FROM patients 
           WHERE clinic_id = $1 AND deleted_at IS NULL 
             AND REGEXP_REPLACE(COALESCE(phone, ''), '\\D', '', 'g') LIKE '%' || $2
           ORDER BY id DESC LIMIT 1`,
          [cid, cleanPhone]
        );
        if (pRes.rows.length > 0) resolvedPatient = pRes.rows[0];
      }
    }

    // Si es un paciente existente (paciente antiguo)
    if (resolvedPatient) {
      // 3. Revisar su historial de citas en esta clínica con especialistas regulares (EXCLUYENDO Dra. Sonia)
      const cleanPhone = phone ? phone.replace(/\D/g, '').slice(-9) : (resolvedPatient.phone ? resolvedPatient.phone.replace(/\D/g, '').slice(-9) : '');
      const histParams = [cid, resolvedPatient.id];
      let phoneCond = '';
      if (cleanPhone.length >= 6) {
        histParams.push(cleanPhone);
        phoneCond = ` OR REGEXP_REPLACE(COALESCE(a.guest_phone, ''), '\\D', '', 'g') LIKE '%' || $${histParams.length}`;
      }

      const historyRes = await query(
        `SELECT a.doctor_id, COUNT(*) AS visit_count, MAX(a.appointment_date) AS last_visit,
                d.consultation_duration, d.specialty, d.color,
                u.first_name, u.last_name, u.email, u.phone AS doctor_phone
         FROM appointments a
         JOIN doctors d ON a.doctor_id = d.id
         JOIN users u ON d.user_id = u.id
         WHERE a.clinic_id = $1
           AND (a.patient_id = $2${phoneCond})
           AND a.deleted_at IS NULL
           AND u.first_name NOT ILIKE '%Sonia%'
           AND d.specialty NOT ILIKE '%Primeras Visitas%'
         GROUP BY a.doctor_id, d.consultation_duration, d.specialty, d.color, u.first_name, u.last_name, u.email, u.phone
         ORDER BY visit_count DESC, last_visit DESC
         LIMIT 1`,
        histParams
      );

      if (historyRes.rows.length > 0) {
        const row = historyRes.rows[0];
        return {
          isReturningPatient: true,
          isFirstVisit: false,
          patientId: resolvedPatient.id,
          patientName: `${resolvedPatient.first_name} ${resolvedPatient.last_name}`.trim(),
          doctor: {
            id: row.doctor_id,
            consultation_duration: row.consultation_duration,
            specialty: row.specialty,
            color: row.color,
            first_name: row.first_name,
            last_name: row.last_name,
            email: row.email,
            phone: row.doctor_phone,
          },
          slotDurationMinutes: row.consultation_duration || 30,
          clinicType: cid === 2 ? 'ESTETICA' : 'DENTAL',
          welcomeFocus: 'consulta de seguimiento y revisión con su especialista habitual',
          doctorTitle: `Dr/a. ${row.first_name} ${row.last_name}`,
          habitualDoctorName: `${row.first_name} ${row.last_name}`,
          visitCount: parseInt(row.visit_count, 10),
        };
      }

      // Si es un paciente registrado pero aún no ha tenido citas con un doctor regular
      // (por ejemplo, solo tuvo primera visita con Dra. Sonia, o fue dado de alta directamente):
      // Asignar al doctor regular principal de la sede (NUNCA Dra. Sonia)
      const regularDocRes = await query(
        `SELECT d.id, d.consultation_duration, d.specialty, d.color,
                u.first_name, u.last_name, u.email, u.phone AS doctor_phone
         FROM doctors d
         JOIN users u ON d.user_id = u.id
         WHERE u.clinic_id = $1
           AND u.first_name NOT ILIKE '%Sonia%'
           AND d.specialty NOT ILIKE '%Primeras Visitas%'
           AND d.deleted_at IS NULL
         ORDER BY d.id ASC
         LIMIT 1`,
        [cid]
      );

      const regDoc = regularDocRes.rows[0] || null;
      return {
        isReturningPatient: true,
        isFirstVisit: false,
        patientId: resolvedPatient.id,
        patientName: `${resolvedPatient.first_name} ${resolvedPatient.last_name}`.trim(),
        doctor: regDoc,
        slotDurationMinutes: regDoc?.consultation_duration || 30,
        clinicType: cid === 2 ? 'ESTETICA' : 'DENTAL',
        welcomeFocus: 'consulta de revisión y seguimiento clínico',
        doctorTitle: regDoc ? `Dr/a. ${regDoc.first_name} ${regDoc.last_name}` : 'nuestro especialista',
        habitualDoctorName: regDoc ? `${regDoc.first_name} ${regDoc.last_name}` : null,
        visitCount: 0,
      };
    }

    // 4. Si el paciente NO existe: es un paciente nuevo -> Dra. Sonia (Xúquer) o especialista de primera visita
    const firstVisitInfo = await this.getFirstVisitDoctorForClinic(cid);
    return {
      isReturningPatient: false,
      isFirstVisit: true,
      patientId: null,
      patientName: null,
      ...firstVisitInfo,
      habitualDoctorName: null,
      visitCount: 0,
    };
  }

  /**
   * Resuelve o crea un paciente de forma determinista para la clínica.
   * Evita pacientes huérfanos y vincula siempre un patient_id.
   */
  async resolveOrCreatePatient({ clinicId = 1, patientId = null, name = null, phone = null, dni = null }) {
    const cid = parseInt(clinicId, 10) || 1;

    // 1. Si ya se provee patientId, validar pertenencia
    if (patientId) {
      const check = await query(
        `SELECT id, first_name, last_name, phone FROM patients WHERE id = $1 AND clinic_id = $2 AND deleted_at IS NULL`,
        [patientId, cid]
      );
      if (check.rows.length > 0) return check.rows[0].id;
    }

    // 2. Buscar por teléfono o DNI existente en la clínica
    if (phone || dni) {
      const cleanPhone = phone ? phone.replace(/\D/g, '').slice(-9) : null;
      const cleanDni = dni ? dni.trim().toUpperCase() : null;

      let sql = `SELECT id FROM patients WHERE clinic_id = $1 AND deleted_at IS NULL AND (`;
      const params = [cid];
      const conds = [];
      if (cleanPhone) {
        params.push(`%${cleanPhone}`);
        conds.push(`REGEXP_REPLACE(phone, '[^0-9]', '', 'g') LIKE $${params.length}`);
      }
      if (cleanDni) {
        params.push(cleanDni);
        conds.push(`UPPER(dni) = $${params.length}`);
      }
      sql += conds.join(' OR ') + `) LIMIT 1`;

      const found = await query(sql, params);
      if (found.rows.length > 0) {
        return found.rows[0].id;
      }
    }

    // 3. Si no existe y tenemos nombre y teléfono, dar de alta como paciente formal
    if (name && phone) {
      const parts = name.trim().split(/\s+/);
      const firstName = parts[0] || 'Paciente';
      const lastName = parts.slice(1).join(' ') || 'Registrado Chat';

      const ins = await query(
        `INSERT INTO patients (clinic_id, first_name, last_name, phone, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         RETURNING id`,
        [cid, firstName, lastName, phone]
      );
      return ins.rows[0].id;
    }

    return null;
  }

  /**
   * Identifica el servicio clínico solicitado por el paciente en lenguaje natural.
   */
  identifyServiceRequested(incomingText = '', clinicId = 1) {
    const text = (incomingText || '').toLowerCase();
    const cid = parseInt(clinicId, 10) || 1;

    if (text.includes('limpieza') || text.includes('higiene') || text.includes('sarro')) {
      return {
        serviceType: 'LIMPIEZA',
        serviceName: 'Limpieza e Higiene Dental',
        reason: 'Primera Revisión y Limpieza Dental',
      };
    }

    if (text.includes('ortodoncia') || text.includes('invisalign') || text.includes('bracket') || text.includes('alineador')) {
      return {
        serviceType: 'ORTODONCIA',
        serviceName: 'Ortodoncia / Alineadores',
        reason: 'Primera Valoración de Ortodoncia',
      };
    }

    if (text.includes('implante') || text.includes('corona') || text.includes('tornillo') || text.includes('prótesis') || text.includes('protesis')) {
      return {
        serviceType: 'IMPLANTOLOGIA',
        serviceName: 'Implantología y Prótesis Dental',
        reason: 'Primera Consulta Diagnóstica de Implantes',
      };
    }

    if (text.includes('blanqueamiento') || text.includes('carilla') || text.includes('estética dental') || text.includes('estetica dental')) {
      return {
        serviceType: 'ESTETICA_DENTAL',
        serviceName: 'Estética Dental y Blanqueamiento',
        reason: 'Primera Consulta de Estética Dental',
      };
    }

    if (text.includes('acido') || text.includes('ácido') || text.includes('hialuronico') || text.includes('hialurónico') ||
        text.includes('botox') || text.includes('labio') || text.includes('arruga') || text.includes('facial') ||
        text.includes('rejuvenecimiento') || text.includes('armonizacion') || text.includes('armonización')) {
      return {
        serviceType: 'ESTETICA_FACIAL',
        serviceName: 'Medicina Estética y Tratamiento Facial',
        reason: 'Primera Consulta de Valoración Estética Personalizada',
      };
    }

    if (text.includes('dolor') || text.includes('urgencia') || text.includes('muela') || text.includes('flemon') || text.includes('flemón') || text.includes('roto')) {
      return {
        serviceType: 'URGENCIA',
        serviceName: 'Atención Urgente / Diagnóstico Rápido',
        reason: 'Revisión Prioritaria por Molestia Dental',
      };
    }

    return {
      serviceType: 'REVISION_GENERAL',
      serviceName: cid === 1 ? 'Primera Revisión Diagnóstica' : 'Primera Consulta de Valoración Estética',
      reason: cid === 1 ? 'Primera Revisión Gratuita' : 'Primera Consulta de Valoración Estética',
    };
  }

  /**
   * Obtiene franjas disponibles para una fecha específica o el siguiente día hábil.
   * Soporta filtrado por franja horaria (timeframe: 'morning' | 'afternoon').
   */
  async getAvailableSlots(clinicId = 1, targetDateStr = null, options = {}) {
    const cid = parseInt(clinicId, 10) || 1;

    let docInfo = null;

    // 1. Si se especificó doctorId explícito
    if (options.doctorId) {
      const docRes = await query(
        `SELECT d.id, d.consultation_duration, d.specialty, d.color,
                u.first_name, u.last_name, u.email, u.phone
         FROM doctors d
         JOIN users u ON d.user_id = u.id
         WHERE d.id = $1 AND u.clinic_id = $2 AND d.deleted_at IS NULL`,
        [options.doctorId, cid]
      );
      if (docRes.rows.length > 0) {
        const d = docRes.rows[0];
        docInfo = {
          doctor: d,
          slotDurationMinutes: d.consultation_duration || 30,
          doctorTitle: `Dr/a. ${d.first_name} ${d.last_name}`,
          isReturningPatient: true,
          isFirstVisit: false,
        };
      }
    }

    // 2. Si viene teléfono o patientId, resolver doctor del paciente (habitual vs primera visita)
    if (!docInfo && (options.patientId || options.phone)) {
      docInfo = await this.getDoctorForPatient({
        clinicId: cid,
        patientId: options.patientId || null,
        phone: options.phone || null,
      });
    }

    // 3. Fallback: doctor de primera visita según sede
    if (!docInfo) {
      docInfo = await this.getFirstVisitDoctorForClinic(cid);
    }

    if (!docInfo.doctor) {
      return { availableSlots: [], message: 'No hay especialista configurado para esta clínica.' };
    }

    const doctorId = docInfo.doctor.id;
    const slotMinutes = docInfo.slotDurationMinutes; // 15 min en Xúquer (primeras visitas) o duración habitual

    // Función interna para evaluar un día específico
    const evaluateDate = async (checkDateStr) => {
      const dateObj = new Date(checkDateStr + 'T12:00:00');
      const dow = dateObj.getDay(); // 0 = Domingo, 6 = Sábado
      if (dow === 0 || dow === 6) {
        return { availableSlots: [], isHolidayOrWeekend: true, reason: 'Fin de semana' };
      }

      const holiday = await holidayService.isHoliday(cid, checkDateStr);
      if (holiday) {
        return { availableSlots: [], isHolidayOrWeekend: true, reason: `Festivo: ${holiday.name}` };
      }

      // Horario del doctor para este día de la semana
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
      const startTimeStr = String(sched.start_time).substring(0, 5);
      const endTimeStr = String(sched.end_time).substring(0, 5);
      const breakStartStr = sched.break_start ? String(sched.break_start).substring(0, 5) : null;
      const breakEndStr = sched.break_end ? String(sched.break_end).substring(0, 5) : null;

      // Citas ocupadas en esa fecha
      const apptsRes = await query(
        `SELECT start_time, end_time
         FROM appointments
         WHERE clinic_id = $1 
           AND doctor_id = $2 
           AND appointment_date = $3 
           AND deleted_at IS NULL
           AND status_id NOT IN (SELECT id FROM appointment_status WHERE name = 'cancelada')`,
        [cid, doctorId, checkDateStr]
      );

      const bookedRanges = apptsRes.rows.map(a => ({
        start: String(a.start_time).substring(0, 5),
        end: String(a.end_time).substring(0, 5),
      }));

      // Generar franjas
      const daySlots = [];
      const [startH, startM] = startTimeStr.split(':').map(Number);
      const [endH, endM] = endTimeStr.split(':').map(Number);

      let currentMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      const breakStartMin = breakStartStr ? parseInt(breakStartStr.split(':')[0]) * 60 + parseInt(breakStartStr.split(':')[1]) : null;
      const breakEndMin = breakEndStr ? parseInt(breakEndStr.split(':')[0]) * 60 + parseInt(breakEndStr.split(':')[1]) : null;

      while (currentMinutes + slotMinutes <= endMinutes) {
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

        // Filtrar por preferencia de franja (morning vs afternoon) si se solicitó
        const hourNum = parseInt(slotH, 10);
        let matchesTimeframe = true;
        if (options.timeframe === 'morning' && hourNum >= 14) matchesTimeframe = false;
        if (options.timeframe === 'afternoon' && hourNum < 15) matchesTimeframe = false;

        if (matchesTimeframe) {
          const isBooked = bookedRanges.some(b => {
            return (slotTimeStr >= b.start && slotTimeStr < b.end) ||
                   (slotEndTimeStr > b.start && slotEndTimeStr <= b.end);
          });

          if (!isBooked) {
            daySlots.push({
              time: slotTimeStr,
              formattedArrival: `a las ${slotTimeStr}h`,
              date: checkDateStr,
            });
          }
        }

        currentMinutes += slotMinutes;
      }

      return {
        availableSlots: daySlots,
        date: checkDateStr,
      };
    };

    // Si se especifica una fecha explícita, evaluarla directamente
    if (targetDateStr) {
      const singleRes = await evaluateDate(targetDateStr);
      return {
        clinicId: cid,
        doctorId: docInfo.doctor?.id,
        doctorTitle: docInfo.doctorTitle,
        isReturningPatient: Boolean(docInfo.isReturningPatient),
        isFirstVisit: Boolean(docInfo.isFirstVisit !== false),
        date: targetDateStr,
        slotDurationMinutes: slotMinutes,
        availableSlots: singleRes.availableSlots || [],
        isHolidayOrWeekend: Boolean(singleRes.isHolidayOrWeekend),
        reason: singleRes.reason || null,
        timeframe: options.timeframe || null,
      };
    }

    // Si no se especifica fecha, avanzar día a día hasta encontrar el próximo día laborable con franjas
    const startDate = new Date();
    for (let dayOffset = 1; dayOffset <= 7; dayOffset++) {
      const cur = new Date(startDate);
      cur.setDate(cur.getDate() + dayOffset);
      const checkStr = cur.toISOString().split('T')[0];

      const res = await evaluateDate(checkStr);
      if (res.availableSlots && res.availableSlots.length > 0) {
        return {
          clinicId: cid,
          doctorId: docInfo.doctor?.id,
          doctorTitle: docInfo.doctorTitle,
          isReturningPatient: Boolean(docInfo.isReturningPatient),
          isFirstVisit: Boolean(docInfo.isFirstVisit !== false),
          date: checkStr,
          slotDurationMinutes: slotMinutes,
          availableSlots: res.availableSlots,
          timeframe: options.timeframe || null,
        };
      }
    }

    // Si en 7 días no hubo franjas, devolver fecha de mañana como referencia
    const fallbackD = new Date();
    fallbackD.setDate(fallbackD.getDate() + 1);
    const fallbackStr = fallbackD.toISOString().split('T')[0];
    return {
      clinicId: cid,
      doctorId: docInfo.doctor?.id,
      doctorTitle: docInfo.doctorTitle,
      isReturningPatient: Boolean(docInfo.isReturningPatient),
      isFirstVisit: Boolean(docInfo.isFirstVisit !== false),
      date: fallbackStr,
      slotDurationMinutes: slotMinutes,
      availableSlots: [],
      message: 'No se encontraron huecos libres en los próximos días.',
    };
  }

  /**
   * Realiza la reserva formal de una primera visita para el paciente / lead.
   * Regla de Negocio: En Xúquer se asocia siempre a Dra. Sonia con 15 minutos.
   */
  async bookFirstVisit({
    clinicId = 1,
    patientId = null,
    guestName = null,
    phone = null,
    appointmentDate,
    startTime,
    serviceRequested = null,
    doctorId = null,
    isFirstVisit = null,
  }) {
    const cid = parseInt(clinicId, 10) || 1;

    // 1. Determinar doctor según si el paciente ya existía previamente o es nuevo
    let docInfo = null;
    if (doctorId) {
      const docRes = await query(
        `SELECT d.id, d.consultation_duration, d.specialty, d.color,
                u.first_name, u.last_name, u.email, u.phone
         FROM doctors d
         JOIN users u ON d.user_id = u.id
         WHERE d.id = $1 AND u.clinic_id = $2 AND d.deleted_at IS NULL`,
        [doctorId, cid]
      );
      if (docRes.rows.length > 0) {
        const d = docRes.rows[0];
        docInfo = {
          doctor: d,
          slotDurationMinutes: d.consultation_duration || 30,
          doctorTitle: `Dr/a. ${d.first_name} ${d.last_name}`,
          isReturningPatient: true,
          isFirstVisit: false,
        };
      }
    }

    if (!docInfo) {
      docInfo = await this.getDoctorForPatient({
        clinicId: cid,
        patientId, // Usar patientId previo a creación para distinguir paciente nuevo de antiguo
        phone,
      });
    }

    // 2. Resolver o vincular paciente automáticamente en tabla patients
    const resolvedPatientId = await this.resolveOrCreatePatient({
      clinicId: cid,
      patientId,
      name: guestName,
      phone,
    });

    if (!docInfo.doctor) {
      throw new AppError('No se encontró el especialista adecuado para esta consulta en la sede.', 404);
    }

    const duration = docInfo.slotDurationMinutes;
    const [h, m] = startTime.split(':').map(Number);
    const endMinutes = h * 60 + m + duration;
    const endH = Math.floor(endMinutes / 60).toString().padStart(2, '0');
    const endM = (endMinutes % 60).toString().padStart(2, '0');
    const endTime = `${endH}:${endM}:00`;

    // 3. Determinar motivo del servicio solicitado
    const serviceInfo = this.identifyServiceRequested(serviceRequested || '', cid);

    // 4. Revalidación atómica contra colisiones
    const collisionCheck = await query(
      `SELECT id FROM appointments 
       WHERE clinic_id = $1 AND doctor_id = $2 AND appointment_date = $3
         AND start_time = $4 AND deleted_at IS NULL
         AND status_id NOT IN (SELECT id FROM appointment_status WHERE name = 'cancelada')`,
      [cid, docInfo.doctor.id, appointmentDate, `${startTime}:00`]
    );

    if (collisionCheck.rows.length > 0) {
      throw new AppError('La franja seleccionada ya ha sido reservada por otro paciente.', 409);
    }

    // Obtener status 'programada'
    const statusRes = await query(`SELECT id FROM appointment_status WHERE name = 'programada' LIMIT 1`);
    const statusId = statusRes.rows[0]?.id || 1;

    const finalIsFirstVisit = isFirstVisit !== null && isFirstVisit !== undefined
      ? Boolean(isFirstVisit)
      : (!docInfo.isReturningPatient);

    const notesText = docInfo.isReturningPatient
      ? `Cita de seguimiento concertada automáticamente por el asistente de IA Sofía para ${docInfo.doctorTitle}. Servicio: ${serviceInfo.serviceName}. Contacto: ${phone || ''}`
      : `Cita concertada automáticamente por el asistente de IA Sofía para ${docInfo.doctorTitle}. Servicio: ${serviceInfo.serviceName}. Contacto: ${phone || ''}`;

    // Insertar cita en appointments
    const insertRes = await query(
      `INSERT INTO appointments (
         clinic_id, patient_id, doctor_id, appointment_date,
         start_time, end_time, status_id, reason, notes, guest_name, guest_phone, is_first_visit, gabinete, created_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'Gabinete 1', (SELECT user_id FROM doctors WHERE id = $3))
       RETURNING *`,
      [
        cid,
        resolvedPatientId,
        docInfo.doctor.id,
        appointmentDate,
        `${startTime}:00`,
        endTime,
        statusId,
        serviceInfo.reason,
        notesText,
        guestName,
        phone,
        finalIsFirstVisit,
      ]
    );

    const appt = insertRes.rows[0];
    const logVisitType = finalIsFirstVisit ? 'Primera visita' : 'Cita de seguimiento';
    logger.info(`[AI_BOOKING] ${logVisitType} #${appt.id} agendada para ${guestName || 'Paciente #' + resolvedPatientId} con ${docInfo.doctorTitle} el ${appointmentDate} a las ${startTime}h.`);

    // Sincronizar evento de cita en CRM (Fase 6)
    try {
      await aiCrmWorkflowService.handleAppointmentEvent({
        clinicId: cid,
        appointmentId: appt.id,
        eventType: 'BOOKED',
        actorType: 'ai',
        details: { isReturningPatient: Boolean(docInfo.isReturningPatient) },
      });
    } catch (crmSyncErr) {
      logger.warn('[AI_BOOKING] Error al sincronizar evento de reserva con CRM:', crmSyncErr.message);
    }

    const patientFriendlyMsg = finalIsFirstVisit
      ? `✅ Su primera consulta de revisión y diagnóstico ha quedado reservada con éxito. Le esperamos el ${appointmentDate} a las ${startTime}h con ${docInfo.doctorTitle} en nuestra clínica.`
      : `✅ Su cita de seguimiento con ${docInfo.doctorTitle} ha quedado reservada con éxito. Le esperamos el ${appointmentDate} a las ${startTime}h en nuestra clínica.`;

    return {
      appointmentId: appt.id,
      patientId: resolvedPatientId,
      doctorId: docInfo.doctor.id,
      doctorName: docInfo.doctorTitle,
      isReturningPatient: Boolean(docInfo.isReturningPatient),
      isFirstVisit: finalIsFirstVisit,
      date: appointmentDate,
      arrivalTime: startTime,
      serviceName: serviceInfo.serviceName,
      messageForPatient: patientFriendlyMsg,
    };
  }

  /**
   * Reagenda una cita existente de un paciente.
   */
  async rescheduleAppointment({
    clinicId = 1,
    appointmentId = null,
    patientId = null,
    phone = null,
    newDate,
    newTime,
    reason = 'Reagendado a petición del paciente por chat'
  }) {
    const cid = parseInt(clinicId, 10) || 1;

    // 1. Identificar la cita activa
    let targetAppt = null;
    if (appointmentId) {
      const aRes = await query(
        `SELECT a.*, COALESCE(u.first_name || ' ' || u.last_name, 'el especialista') as doctor_name
         FROM appointments a
         LEFT JOIN doctors d ON a.doctor_id = d.id
         LEFT JOIN users u ON d.user_id = u.id
         WHERE a.id = $1 AND a.clinic_id = $2 AND a.deleted_at IS NULL`,
        [appointmentId, cid]
      );
      targetAppt = aRes.rows[0] || null;
    } else if (patientId || phone) {
      const resolvedPid = await this.resolveOrCreatePatient({ clinicId: cid, patientId, phone });
      if (resolvedPid) {
        const aRes = await query(
          `SELECT a.*, COALESCE(u.first_name || ' ' || u.last_name, 'el especialista') as doctor_name
           FROM appointments a
           LEFT JOIN doctors d ON a.doctor_id = d.id
           LEFT JOIN users u ON d.user_id = u.id
           WHERE a.patient_id = $1 AND a.clinic_id = $2 AND a.appointment_date >= CURRENT_DATE AND a.deleted_at IS NULL
             AND a.status_id NOT IN (SELECT id FROM appointment_status WHERE name = 'cancelada')
           ORDER BY a.appointment_date ASC, a.start_time ASC LIMIT 1`,
          [resolvedPid, cid]
        );
        targetAppt = aRes.rows[0] || null;
      }
    }

    if (!targetAppt) {
      return {
        success: false,
        reason: 'APPOINTMENT_NOT_FOUND',
        messageForPatient: 'No hemos localizado ninguna cita activa en nuestro sistema para poder cambiar la fecha.',
      };
    }

    // 2. Revalidar disponibilidad para la nueva fecha y hora
    const cleanTime = String(newTime).substring(0, 5);
    const slotsData = await this.getAvailableSlots(cid, newDate);
    const isAvailable = (slotsData.availableSlots || []).some(s => s.time === cleanTime);

    if (!isAvailable) {
      const alts = (slotsData.availableSlots || []).slice(0, 2);
      return {
        success: false,
        reason: 'SLOT_NOT_AVAILABLE',
        alternativeSlots: alts,
        messageForPatient: `Disculpe, a las ${cleanTime}h ya no disponemos de hueco libre para el ${newDate}. ¿Le vendría bien ${alts[0] ? alts[0].formattedArrival : 'otro día'}?`,
      };
    }

    // 3. Calcular nueva hora de fin
    const docInfo = await this.getFirstVisitDoctorForClinic(cid);
    const duration = docInfo.slotDurationMinutes || 15;
    const [h, m] = cleanTime.split(':').map(Number);
    const endMinutes = h * 60 + m + duration;
    const endH = Math.floor(endMinutes / 60).toString().padStart(2, '0');
    const endM = (endMinutes % 60).toString().padStart(2, '0');
    const newEndTime = `${endH}:${endM}:00`;

    const oldDateStr = targetAppt.appointment_date instanceof Date
      ? targetAppt.appointment_date.toISOString().split('T')[0]
      : String(targetAppt.appointment_date).split('T')[0];
    const oldTimeStr = String(targetAppt.start_time).substring(0, 5);

    // Obtener status reprogramada (o programada)
    const stRes = await query(`SELECT id FROM appointment_status WHERE name = 'reprogramada' LIMIT 1`);
    const statusId = stRes.rows[0]?.id || 1;

    // 4. Actualizar cita
    const changeNote = `\n[Reagendada por Sofía el ${new Date().toISOString()}] De ${oldDateStr} ${oldTimeStr}h a ${newDate} ${cleanTime}h. Motivo: ${reason}`;
    await query(
      `UPDATE appointments 
       SET appointment_date = $1,
           start_time = $2,
           end_time = $3,
           status_id = $4,
           notes = COALESCE(notes, '') || $5,
           updated_at = NOW()
       WHERE id = $6 AND clinic_id = $7`,
      [newDate, `${cleanTime}:00`, newEndTime, statusId, changeNote, targetAppt.id, cid]
    );

    // 5. Registrar log de automatización
    await query(
      `INSERT INTO automation_logs (clinic_id, rule_type, patient_id, appointment_id, channel, status, details)
       VALUES ($1, 'RESCHEDULE_AUTONOMOUS', $2, $3, 'WHATSAPP', 'RESCHEDULED', $4)`,
      [
        cid,
        targetAppt.patient_id,
        targetAppt.id,
        JSON.stringify({ old_date: oldDateStr, old_time: oldTimeStr, new_date: newDate, new_time: cleanTime, reason })
      ]
    );

    // 6. Actividad CRM
    try {
      await aiCrmWorkflowService.handleAppointmentEvent({
        clinicId: cid,
        appointmentId: targetAppt.id,
        eventType: 'RESCHEDULED',
        actorType: 'ai',
        details: { oldDate: oldDateStr, oldTime: oldTimeStr, newDate, newTime: cleanTime, reason },
      });
    } catch (crmErr) {
      logger.warn('[AI_BOOKING] Error registrando actividad CRM al reagendar:', crmErr.message);
    }

    // 7. Notificar en tiempo real a recepción
    eventStreamService.broadcastToClinic(cid, 'APPOINTMENT_UPDATED', {
      appointmentId: targetAppt.id,
      patientId: targetAppt.patient_id,
      oldDate: oldDateStr,
      newDate,
      newTime: cleanTime,
      doctorName: targetAppt.doctor_name,
    });

    const dateFormatted = new Date(newDate).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    const messageForPatient = `✅ Su cita ha sido REAGENDADA con éxito. Le esperamos el próximo ${dateFormatted} a las ${cleanTime}h con ${targetAppt.doctor_name} en nuestra clínica. ¡Gracias por avisarnos!`;

    return {
      success: true,
      appointmentId: targetAppt.id,
      oldDate: oldDateStr,
      oldTime: oldTimeStr,
      newDate,
      newTime: cleanTime,
      doctorName: targetAppt.doctor_name,
      messageForPatient,
    };
  }

  /**
   * Cancela una cita de forma determinista y segura.
   */
  async cancelAppointment({
    clinicId = 1,
    appointmentId = null,
    patientId = null,
    phone = null,
    reason = 'Cancelado a petición del paciente por chat'
  }) {
    const cid = parseInt(clinicId, 10) || 1;

    // 1. Identificar la cita activa
    let targetAppt = null;
    if (appointmentId) {
      const aRes = await query(
        `SELECT a.*, COALESCE(u.first_name || ' ' || u.last_name, 'el especialista') as doctor_name
         FROM appointments a
         LEFT JOIN doctors d ON a.doctor_id = d.id
         LEFT JOIN users u ON d.user_id = u.id
         WHERE a.id = $1 AND a.clinic_id = $2 AND a.deleted_at IS NULL`,
        [appointmentId, cid]
      );
      targetAppt = aRes.rows[0] || null;
    } else if (patientId || phone) {
      const resolvedPid = await this.resolveOrCreatePatient({ clinicId: cid, patientId, phone });
      if (resolvedPid) {
        const aRes = await query(
          `SELECT a.*, COALESCE(u.first_name || ' ' || u.last_name, 'el especialista') as doctor_name
           FROM appointments a
           LEFT JOIN doctors d ON a.doctor_id = d.id
           LEFT JOIN users u ON d.user_id = u.id
           WHERE a.patient_id = $1 AND a.clinic_id = $2 AND a.appointment_date >= CURRENT_DATE AND a.deleted_at IS NULL
             AND a.status_id NOT IN (SELECT id FROM appointment_status WHERE name = 'cancelada')
           ORDER BY a.appointment_date ASC, a.start_time ASC LIMIT 1`,
          [resolvedPid, cid]
        );
        targetAppt = aRes.rows[0] || null;
      }
    }

    if (!targetAppt) {
      return {
        success: false,
        reason: 'APPOINTMENT_NOT_FOUND',
        messageForPatient: 'No constan citas pendientes activas en nuestro sistema para poder cancelar.',
      };
    }

    // 2. Obtener status 'cancelada'
    const statusRes = await query(`SELECT id FROM appointment_status WHERE name = 'cancelada' LIMIT 1`);
    const cancelledStatusId = statusRes.rows[0]?.id || 5;

    const dateStr = targetAppt.appointment_date instanceof Date
      ? targetAppt.appointment_date.toISOString().split('T')[0]
      : String(targetAppt.appointment_date).split('T')[0];
    const timeStr = String(targetAppt.start_time).substring(0, 5);

    // 3. Actualizar cita
    await query(
      `UPDATE appointments 
       SET status_id = $1,
           cancellation_reason = $2,
           notes = COALESCE(notes, '') || E'\n[Cancelada por Sofía el ' || NOW()::text || E'] Motivo: ' || $2,
           updated_at = NOW()
       WHERE id = $3 AND clinic_id = $4`,
      [cancelledStatusId, reason, targetAppt.id, cid]
    );

    // 4. Registrar en automation_logs
    await query(
      `INSERT INTO automation_logs (clinic_id, rule_type, patient_id, appointment_id, channel, status, details)
       VALUES ($1, 'CANCELLATION_AUTONOMOUS', $2, $3, 'WHATSAPP', 'CANCELLED', $4)`,
      [
        cid,
        targetAppt.patient_id,
        targetAppt.id,
        JSON.stringify({ date: dateStr, time: timeStr, reason, cancelled_at: new Date().toISOString() })
      ]
    );

    // 5. Actividad CRM
    try {
      await aiCrmWorkflowService.handleAppointmentEvent({
        clinicId: cid,
        appointmentId: targetAppt.id,
        eventType: 'CANCELLED',
        actorType: 'ai',
        details: { date: dateStr, time: timeStr, reason },
      });
    } catch (crmErr) {
      logger.warn('[AI_BOOKING] Error registrando actividad CRM al cancelar:', crmErr.message);
    }

    // 6. Notificar por SSE a recepción
    eventStreamService.broadcastToClinic(cid, 'APPOINTMENT_CANCELLED', {
      appointmentId: targetAppt.id,
      patientId: targetAppt.patient_id,
      date: dateStr,
      time: timeStr,
      doctorName: targetAppt.doctor_name,
    });

    const dateFormatted = new Date(dateStr).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    const messageForPatient = `🗓️ Su cita del ${dateFormatted} a las ${timeStr}h ha quedado CANCELADA en nuestro sistema. Cuando desee retomarla o buscar otra fecha, escríbanos por aquí y con gusto le atenderemos.`;

    return {
      success: true,
      appointmentId: targetAppt.id,
      date: dateStr,
      time: timeStr,
      doctorName: targetAppt.doctor_name,
      messageForPatient,
    };
  }

  /**
   * Intenta emparejar la respuesta del paciente con las franjas horarias ofrecidas.
   */
  matchSlotSelection(incomingText, offeredSlots = []) {
    if (!incomingText || !Array.isArray(offeredSlots) || offeredSlots.length === 0) return null;
    const clean = incomingText.trim().toLowerCase();

    // 1. Coincidencia por ordinal u opción numérica
    if (/^(1|1️⃣|primera|primero|la primera|el primero|opcion 1|opción 1)\b/i.test(clean) || clean === '1') {
      return offeredSlots[0] || null;
    }
    if (/^(2|2️⃣|segunda|segundo|la segunda|el segundo|opcion 2|opción 2)\b/i.test(clean) || clean === '2') {
      return offeredSlots[1] || null;
    }

    // 2. Coincidencia por hora exacta o aproximada
    for (const slot of offeredSlots) {
      const timeNoZero = slot.time.replace(/^0/, ''); // "9:00" si era "09:00"
      const timeExact = slot.time; // "09:00"
      const [h, m] = slot.time.split(':');
      const hourOnly = parseInt(h, 10);

      if (clean.includes(timeExact) || clean.includes(timeNoZero)) {
        return slot;
      }
      if (m === '00' && (clean.includes(`a las ${hourOnly}`) || clean.includes(`las ${hourOnly}`))) {
        return slot;
      }
    }

    return null;
  }

  /**
   * Procesa la selección conversacional de una cita, revalidando disponibilidad
   * y ejecutando la reserva formal mediante el motor autoritativo.
   */
  async handleConversationalBookingSelection({
    clinicId = 1,
    contact,
    incomingText,
    bookingFlowState
  }) {
    if (!bookingFlowState || !bookingFlowState.offered_slots) {
      return { handled: false };
    }

    const selectedSlot = this.matchSlotSelection(incomingText, bookingFlowState.offered_slots);
    if (!selectedSlot) {
      return { handled: false };
    }

    const cid = parseInt(clinicId, 10) || 1;
    const patientName = contact.confirmed_name || contact.name || 'Paciente';
    const firstName = patientName.split(' ')[0];

    // 1. Revalidación determinista de disponibilidad (Prevención de colisiones / race conditions)
    const freshSlotsData = await this.getAvailableSlots(cid, selectedSlot.date, {
      patientId: contact.patient_id || null,
      phone: contact.phone || null,
    });
    const isStillAvailable = (freshSlotsData.availableSlots || []).some(s => s.time === selectedSlot.time);

    if (!isStillAvailable) {
      // El hueco se ocupó justo antes: ofrecer alternativas reales actualizadas
      const altSlots = (freshSlotsData.availableSlots || []).slice(0, 2);
      let altMsg = '';
      if (altSlots.length > 0) {
        altMsg = ` Justo acaban de reservar ese hueco. Disponemos de alternativa el ${altSlots[0].date} ${altSlots[0].formattedArrival}${altSlots[1] ? ' o ' + altSlots[1].formattedArrival : ''}. ¿Le vendría bien?`;
      } else {
        altMsg = ` Justo se ha ocupado ese hueco. Le transferiré con nuestro equipo para buscar otro día adecuado.`;
      }

      return {
        handled: true,
        success: false,
        reason: 'SLOT_NO_LONGER_AVAILABLE',
        replyText: `Disculpe, ${firstName}.${altMsg}`,
        newSlots: altSlots,
      };
    }

    // 2. Reserva autoritativa en appointments
    const bookResult = await this.bookFirstVisit({
      clinicId: cid,
      patientId: contact.patient_id || null,
      guestName: patientName,
      phone: contact.phone,
      appointmentDate: selectedSlot.date,
      startTime: selectedSlot.time,
      serviceRequested: bookingFlowState.service_requested || null,
    });

    // 3. Registrar log de automatización
    await query(
      `INSERT INTO automation_logs (clinic_id, rule_type, patient_id, appointment_id, channel, status, details)
       VALUES ($1, 'BOOKING_AUTONOMOUS', $2, $3, 'WHATSAPP', 'BOOKED', $4)`,
      [
        cid,
        bookResult.patientId || contact.patient_id || null,
        bookResult.appointmentId,
        JSON.stringify({ booked_via: 'CONVERSATIONAL_AI', slot: selectedSlot, booked_at: new Date().toISOString() })
      ]
    );

    // 4. Actualizar estado de Lead en CRM y crear actividad si existe
    try {
      const leadRes = await query(
        `SELECT id FROM crm_leads WHERE contact_id = $1 AND clinic_id = $2 AND status NOT IN ('lost', 'converted') LIMIT 1`,
        [contact.id, cid]
      );
      if (leadRes.rows.length > 0) {
        const leadId = leadRes.rows[0].id;
        await query(
          `UPDATE crm_leads 
           SET status = 'appointment_scheduled',
               updated_at = NOW() 
           WHERE id = $1`,
          [leadId]
        );

        await query(
          `INSERT INTO crm_activities (clinic_id, lead_id, contact_id, activity_type, title, description, actor_type)
           VALUES ($1, $2, $3, 'APPOINTMENT_BOOKED', 'Primera visita agendada automáticamente por Sofía', $4, 'ai')`,
          [
            cid,
            leadId,
            contact.id,
            `Cita agendada para el ${selectedSlot.date} a las ${selectedSlot.time}h con ${bookResult.doctorName}.`
          ]
        );
      }
    } catch (crmErr) {
      logger.warn('Error actualizando lead de CRM tras reserva conversacional:', crmErr.message);
    }

    // 5. Emitir evento SSE en tiempo real a recepción
    eventStreamService.broadcastToClinic(cid, 'APPOINTMENT_CREATED', {
      appointmentId: bookResult.appointmentId,
      patientName,
      date: selectedSlot.date,
      time: selectedSlot.time,
      doctorName: bookResult.doctorName,
      bookedVia: 'SOFIA_CONVERSATIONAL_AI',
    });

    const dateFormatted = new Date(selectedSlot.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    const visitTypeDesc = bookResult.isReturningPatient
      ? `Su cita de seguimiento y revisión con ${bookResult.doctorName}`
      : `Su primera consulta de revisión y diagnóstico con ${bookResult.doctorName}`;
    const replyText = `✅ ¡Perfecto, ${firstName}! ${visitTypeDesc} ha quedado CONFIRMADA para el ${dateFormatted} a las ${selectedSlot.time}h en nuestra clínica.\n\nLe hemos reservado este hueco en nuestra agenda. Si antes de la cita tuviera cualquier duda o necesitara cambiar la hora, solo avísenos por este chat. ¡Le esperamos! 🦷✨`;

    return {
      handled: true,
      success: true,
      appointmentId: bookResult.appointmentId,
      replyText,
      selectedSlot,
      isReturningPatient: Boolean(bookResult.isReturningPatient),
      isFirstVisit: Boolean(bookResult.isFirstVisit),
    };
  }

  /**
   * Manejador unificado de acciones conversacionales de citas (Booking, Reschedule, Cancel).
   */
  async handleConversationalAppointmentAction({
    clinicId = 1,
    contact,
    incomingText,
    bookingFlowState
  }) {
    if (!bookingFlowState) return { handled: false };

    // 1. AWAITING_SLOT_SELECTION (Nueva reserva)
    if (bookingFlowState.step === 'AWAITING_SLOT_SELECTION') {
      return await this.handleConversationalBookingSelection({
        clinicId,
        contact,
        incomingText,
        bookingFlowState,
      });
    }

    // 2. AWAITING_RESCHEDULE_SLOT (Reagendamiento interactivo)
    if (bookingFlowState.step === 'AWAITING_RESCHEDULE_SLOT') {
      const selectedSlot = this.matchSlotSelection(incomingText, bookingFlowState.offered_slots);
      if (!selectedSlot) return { handled: false };

      const reschResult = await this.rescheduleAppointment({
        clinicId,
        appointmentId: bookingFlowState.appointment_id || null,
        phone: contact.phone,
        newDate: selectedSlot.date,
        newTime: selectedSlot.time,
        reason: 'Reagendado por el paciente por chat',
      });

      return {
        handled: true,
        success: reschResult.success,
        replyText: reschResult.messageForPatient,
        appointmentId: reschResult.appointmentId,
        selectedSlot,
      };
    }

    return { handled: false };
  }
}

export default new AIBookingService();
