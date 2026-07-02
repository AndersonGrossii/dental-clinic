// ============================================
// DTOs de Citas — Transformación de datos
// ============================================

/**
 * Transforma un registro de cita de la base de datos al formato de respuesta API.
 * @param {object} row - Registro crudo de la base de datos
 * @returns {object} DTO de cita formateado
 */
export const toAppointmentDTO = (row) => {
  if (!row) return null;

  return {
    id: row.id,
    patientId: row.patient_id,
    doctorId: row.doctor_id,
    statusId: row.status_id,
    treatmentId: row.treatment_id,
    appointmentDate: row.appointment_date,
    startTime: row.start_time,
    endTime: row.end_time,
    reason: row.reason,
    notes: row.notes,
    cancellationReason: row.cancellation_reason,
    isFirstVisit: row.is_first_visit,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    patient: {
      id: row.patient_id,
      firstName: row.patient_first_name,
      lastName: row.patient_last_name,
      fullName: row.patient_name,
      phone: row.patient_phone,
      email: row.patient_email || null,
      dni: row.patient_dni || null,
    },
    doctor: {
      id: row.doctor_id,
      firstName: row.doctor_first_name,
      lastName: row.doctor_last_name,
      fullName: row.doctor_name,
      specialty: row.doctor_specialty,
      color: row.doctor_color,
    },
    status: {
      id: row.status_id,
      name: row.status_name,
      label: row.status_label,
      color: row.status_color,
    },
    treatment: row.treatment_name
      ? {
          id: row.treatment_id,
          name: row.treatment_name,
          price: row.treatment_price || null,
          duration: row.treatment_duration || null,
        }
      : null,

    // flat snake_case aliases for frontend
    patient_id: row.patient_id,
    doctor_id: row.doctor_id,
    status_id: row.status_id,
    treatment_id: row.treatment_id,
    appointment_date: row.appointment_date,
    start_time: row.start_time,
    end_time: row.end_time,
    patient_name: row.patient_name,
    doctor_name: row.doctor_name,
    treatment_name: row.treatment_name,
    status_name: row.status_name,
    status_color: row.status_color,
    status_label: row.status_label,
    cancellation_reason: row.cancellation_reason,
    is_first_visit: row.is_first_visit,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
};

/**
 * Transforma un registro de cita al formato de evento de calendario.
 * @param {object} row - Registro crudo de la base de datos
 * @returns {object} DTO de evento de calendario
 */
export const toCalendarEventDTO = (row) => {
  if (!row) return null;

  return {
    id: row.id,
    title: `${row.patient_name} — ${row.treatment_name || row.reason || 'Consulta'}`,
    start: `${row.appointment_date}T${row.start_time}`,
    end: `${row.appointment_date}T${row.end_time}`,
    date: row.appointment_date,
    startTime: row.start_time,
    endTime: row.end_time,
    patientId: row.patient_id,
    patientName: row.patient_name,
    doctorId: row.doctor_id,
    doctorName: row.doctor_name,
    doctorColor: row.doctor_color,
    statusName: row.status_name,
    statusLabel: row.status_label,
    statusColor: row.status_color,
    treatmentName: row.treatment_name || null,
    isFirstVisit: row.is_first_visit,
    backgroundColor: row.doctor_color || '#0891b2',
    borderColor: row.status_color || '#6b7280',
  };
};
