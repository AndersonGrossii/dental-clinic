// ============================================
// AI Tools Hub — Herramientas Dinámicas de Aplicación (Fase 4)
// Estandariza la consulta de datos en tiempo real para el Copilot y Sofía:
// - check_availability (Franjas libres de agenda)
// - check_clinic_status (Horario y festivos de la sede)
// - lookup_patient (Identidad de paciente)
// - get_patient_appointments (Citas activas e historial)
// - lookup_doctors (Cuadro médico de la sede)
// - lookup_lead (Estado comercial del lead en CRM)
// ============================================
import { query } from '../database/pool.js';
import aiBookingService from './ai-booking.service.js';
import holidayService from './holiday.service.js';
import { logger } from '../utils/logger.js';

class AIToolsService {
  /**
   * Consulta franjas horarias reales disponibles para citas.
   * Regla de confidencialidad: comunica solo hora de llegada, nunca duración interna.
   */
  async checkAvailability({ clinicId = 1, targetDate = null, doctorId = null }) {
    const cid = parseInt(clinicId, 10) || 1;
    const slotsData = await aiBookingService.getAvailableSlots(cid, targetDate);
    const slots = (slotsData.availableSlots || []).slice(0, 4);

    return {
      success: true,
      clinicId: cid,
      targetDate: slotsData.targetDate || targetDate,
      doctorId: doctorId || null,
      isHolidayOrWeekend: Boolean(slotsData.isHolidayOrWeekend),
      reason: slotsData.reason || null,
      availableSlots: slots.map(s => ({
        date: s.date,
        time: s.time,
        formattedArrival: s.formattedArrival || `Llegada: ${s.time}h`,
      })),
      totalAvailable: slots.length,
    };
  }

  /**
   * Consulta estado operativo de la clínica en tiempo real (abierta/cerrada, festivo, horario).
   */
  async checkClinicStatus({ clinicId = 1, date = null }) {
    const cid = parseInt(clinicId, 10) || 1;
    const now = new Date();
    const madridTimeStr = now.toLocaleTimeString('es-ES', { timeZone: 'Europe/Madrid', hour12: false });
    const targetDate = date || now.toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).split('/').reverse().join('-');

    const [h, m] = madridTimeStr.split(':').map(Number);
    const currentMin = h * 60 + m;

    const dateObj = new Date(targetDate + 'T12:00:00');
    const dow = dateObj.getDay();

    if (dow === 0 || dow === 6) {
      return {
        success: true,
        clinicId: cid,
        isOpen: false,
        reason: 'Fin de semana',
        openingHoursText: cid === 1 ? 'lunes a viernes de 09:00 a 20:00' : 'lunes a viernes de 10:00 a 19:00',
        currentTime: madridTimeStr.substring(0, 5),
      };
    }

    const holiday = await holidayService.isHoliday(cid, targetDate);
    if (holiday) {
      return {
        success: true,
        clinicId: cid,
        isOpen: false,
        reason: `Festivo (${holiday.name})`,
        holiday,
        openingHoursText: cid === 1 ? 'lunes a viernes de 09:00 a 20:00' : 'lunes a viernes de 10:00 a 19:00',
        currentTime: madridTimeStr.substring(0, 5),
      };
    }

    const isOpen = currentMin >= 540 && currentMin < 1200;
    return {
      success: true,
      clinicId: cid,
      isOpen,
      openingHoursText: cid === 1 ? 'lunes a viernes de 09:00 a 20:00' : 'lunes a viernes de 10:00 a 19:00',
      currentTime: madridTimeStr.substring(0, 5),
    };
  }

  /**
   * Identifica un paciente por teléfono o DNI garantizando aislamiento multi-clínica.
   */
  async lookupPatient({ clinicId = 1, phone = null, dni = null }) {
    const cid = parseInt(clinicId, 10) || 1;
    if (!phone && !dni) {
      return { success: true, found: false, patient: null };
    }

    const cleanPhone = phone ? phone.replace(/\D/g, '').slice(-9) : null;
    const cleanDni = dni ? dni.trim().toUpperCase() : null;

    let sql = `SELECT id, clinic_id, first_name, last_name, phone, dni, email, created_at
               FROM patients
               WHERE clinic_id = $1 AND deleted_at IS NULL AND (`;
    const params = [cid];

    const conditions = [];
    if (cleanPhone) {
      params.push(`%${cleanPhone}`);
      conditions.push(`REGEXP_REPLACE(phone, '[^0-9]', '', 'g') LIKE $${params.length}`);
    }
    if (cleanDni) {
      params.push(cleanDni);
      conditions.push(`UPPER(dni) = $${params.length}`);
    }
    sql += conditions.join(' OR ') + `) LIMIT 1`;

    const res = await query(sql, params);
    if (res.rows.length === 0) {
      return { success: true, found: false, patient: null };
    }

    const p = res.rows[0];
    const fullName = `${p.first_name} ${p.last_name}`.trim();
    return {
      success: true,
      found: true,
      patient: {
        id: p.id,
        clinicId: p.clinic_id,
        name: fullName,
        fullName,
        firstName: p.first_name,
        lastName: p.last_name,
        phone: p.phone,
        dni: p.dni,
        email: p.email,
        isRegistered: true,
      },
    };
  }

  /**
   * Consulta citas activas programadas de un paciente.
   */
  async getPatientAppointments({ clinicId = 1, patientId = null, phone = null }) {
    const cid = parseInt(clinicId, 10) || 1;

    let targetPatientId = patientId;
    let patientRecord = null;
    if (!targetPatientId && phone) {
      const pLookup = await this.lookupPatient({ clinicId: cid, phone });
      if (pLookup.found) {
        targetPatientId = pLookup.patient.id;
        patientRecord = pLookup.patient;
      }
    }

    if (!targetPatientId) {
      return {
        success: true,
        found: false,
        patientId: null,
        patient: null,
        count: 0,
        appointments: [],
        upcoming: [],
        nextAppointment: null,
        summaryText: 'No constan citas pendientes programadas para este paciente en el sistema.',
      };
    }

    const res = await query(
      `SELECT a.id, a.appointment_date, a.start_time, a.end_time, s.name as status_name,
              a.reason as treatment,
              COALESCE(u.first_name || ' ' || u.last_name, 'el especialista') as doctor_name
       FROM appointments a
       JOIN appointment_status s ON a.status_id = s.id
       LEFT JOIN doctors d ON a.doctor_id = d.id
       LEFT JOIN users u ON d.user_id = u.id
       WHERE a.clinic_id = $1 
         AND a.patient_id = $2
         AND a.appointment_date >= CURRENT_DATE
         AND a.deleted_at IS NULL
         AND s.name NOT IN ('cancelada', 'no_asistio')
       ORDER BY a.appointment_date ASC, a.start_time ASC
       LIMIT 5`,
      [cid, targetPatientId]
    );

    const upcoming = res.rows.map(a => {
      const dateStr = a.appointment_date instanceof Date ? a.appointment_date.toISOString().split('T')[0] : String(a.appointment_date).split('T')[0];
      const timeStr = String(a.start_time).substring(0, 5);
      return {
        id: a.id,
        date: dateStr,
        time: timeStr,
        formattedArrival: `Llegada: ${timeStr}h`,
        doctorName: a.doctor_name,
        treatment: a.treatment || 'Consulta general',
        status: a.status_name,
      };
    });

    const nextAppt = upcoming[0] || null;
    const summaryText = upcoming.length > 0
      ? `Tiene ${upcoming.length} cita(s) programada(s). La próxima es el ${nextAppt.date} a las ${nextAppt.formattedArrival} con ${nextAppt.doctorName} (${nextAppt.treatment}).`
      : 'No constan citas pendientes programadas para este paciente en el sistema.';

    return {
      success: true,
      found: upcoming.length > 0,
      patientId: targetPatientId,
      patient: patientRecord,
      count: upcoming.length,
      appointments: upcoming,
      upcoming,
      nextAppointment: nextAppt,
      summaryText,
    };
  }

  /**
   * Consulta el cuadro médico y especialistas disponibles para la sede.
   */
  async getClinicDoctors({ clinicId = 1 }) {
    const cid = parseInt(clinicId, 10) || 1;
    const res = await query(
      `SELECT d.id, d.specialty, d.consultation_duration,
              u.first_name, u.last_name
       FROM doctors d
       JOIN users u ON d.user_id = u.id
       WHERE u.clinic_id = $1 AND d.deleted_at IS NULL
       ORDER BY d.id ASC`,
      [cid]
    );

    const doctors = res.rows.map(d => ({
      id: d.id,
      name: `Dr/a. ${d.first_name} ${d.last_name}`,
      specialty: d.specialty || (cid === 1 ? 'Odontología' : 'Medicina Estética'),
    }));

    const firstVisitDoc = cid === 1
      ? doctors.find(d => /sonia/i.test(d.name)) || doctors[0] || null
      : doctors[0] || null;

    const doctorListText = doctors.length > 0
      ? doctors.map(d => `${d.name} (${d.specialty})`).join(', ')
      : 'Especialistas colegiados';

    const summaryText = `El equipo médico de la clínica está compuesto por: ${doctorListText}. Para primeras visitas diagnósticas le atenderá ${firstVisitDoc ? firstVisitDoc.name : 'nuestro especialista'}.`;

    return {
      success: true,
      clinicId: cid,
      doctors,
      count: doctors.length,
      firstVisitDoctor: firstVisitDoc,
      summaryText,
    };
  }

  /**
   * Consulta el estado del lead comercial en el CRM para la conversación omnicanal.
   */
  async getCRMLeadState({ clinicId = 1, contactId = null, phone = null }) {
    const cid = parseInt(clinicId, 10) || 1;

    let targetContactId = contactId;
    if (!targetContactId && phone) {
      const cRes = await query(
        `SELECT id FROM messaging_contacts WHERE clinic_id = $1 AND phone = $2 LIMIT 1`,
        [cid, phone]
      );
      targetContactId = cRes.rows[0]?.id || null;
    }

    if (!targetContactId) {
      return { success: true, found: false, lead: null };
    }

    const res = await query(
      `SELECT id, clinic_id, contact_id, status, service_interest, estimated_value, notes, created_at, updated_at
       FROM crm_leads
       WHERE clinic_id = $1 AND contact_id = $2
       LIMIT 1`,
      [cid, targetContactId]
    );

    return {
      success: true,
      found: res.rows.length > 0,
      lead: res.rows[0] || null,
    };
  }

  /**
   * Despachador universal de herramientas (Tool Dispatcher).
   * Ejecuta la herramienta de forma segura resolviendo alias y garantizando aislamiento.
   */
  async executeTool(toolName, params = {}) {
    const name = (toolName || '').toLowerCase().trim();
    const clinicId = params.clinicId || 1;

    try {
      logger.info(`[AI_TOOL] Ejecutando herramienta "${name}" para clínica #${clinicId}`);

      let data = null;
      switch (name) {
        case 'check_availability':
        case 'availability_tool':
          data = await this.checkAvailability(params);
          break;

        case 'check_clinic_status':
        case 'clinic_status_tool':
          data = await this.checkClinicStatus(params);
          break;

        case 'lookup_patient':
        case 'patient_identity_tool':
          data = await this.lookupPatient(params);
          break;

        case 'get_patient_appointments':
        case 'patient_appointments_tool':
          data = await this.getPatientAppointments(params);
          break;

        case 'lookup_doctors':
        case 'doctor_catalog_tool':
          data = await this.getClinicDoctors(params);
          break;

        case 'lookup_lead':
        case 'crm_lead_tool':
          data = await this.getCRMLeadState(params);
          break;

        default:
          logger.warn(`[AI_TOOL] Herramienta desconocida "${name}"`);
          return {
            success: false,
            error: `Herramienta "${name}" no soportada o no reconocida`,
          };
      }

      return {
        success: true,
        tool: name,
        data,
      };
    } catch (err) {
      logger.error(`[AI_TOOL] Error al ejecutar "${name}":`, err.message);
      return {
        success: false,
        tool: name,
        error: err.message,
      };
    }
  }
}

export default new AIToolsService();
