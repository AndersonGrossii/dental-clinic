// ============================================
// Validador de Citas — Reglas de validación
// ============================================

/**
 * Reglas de validación para crear una cita.
 * @type {Array<object>}
 */
export const createAppointmentRules = [
  {
    field: 'patient_id',
    label: 'Paciente',
    required: true,
    type: 'number',
  },
  {
    field: 'doctor_id',
    label: 'Doctor',
    required: true,
    type: 'number',
  },
  {
    field: 'appointment_date',
    label: 'Fecha de la cita',
    required: true,
    type: 'string',
    pattern: /^\d{4}-\d{2}-\d{2}$/,
    patternMsg: 'La fecha debe tener formato YYYY-MM-DD.',
  },
  {
    field: 'start_time',
    label: 'Hora de inicio',
    required: true,
    type: 'string',
    pattern: /^\d{2}:\d{2}(:\d{2})?$/,
    patternMsg: 'La hora de inicio debe tener formato HH:mm o HH:mm:ss.',
  },
  {
    field: 'end_time',
    label: 'Hora de fin',
    required: true,
    type: 'string',
    pattern: /^\d{2}:\d{2}(:\d{2})?$/,
    patternMsg: 'La hora de fin debe tener formato HH:mm o HH:mm:ss.',
    custom: (value, data) => {
      if (data.start_time && value && value <= data.start_time) {
        return 'La hora de fin debe ser posterior a la hora de inicio.';
      }
      return null;
    },
  },
  {
    field: 'treatment_id',
    label: 'Tratamiento',
    required: false,
    type: 'number',
  },
  {
    field: 'reason',
    label: 'Motivo',
    required: false,
    type: 'string',
    maxLength: 500,
  },
  {
    field: 'notes',
    label: 'Notas',
    required: false,
    type: 'string',
    maxLength: 1000,
  },
  {
    field: 'gabinete',
    label: 'Gabinete',
    required: false,
    type: 'string',
    enum: ['Gabinete 1', 'Gabinete 2'],
  },
];

/**
 * Reglas de validación para actualizar una cita.
 * Todos los campos son opcionales.
 * @type {Array<object>}
 */
export const updateAppointmentRules = [
  {
    field: 'patient_id',
    label: 'Paciente',
    required: false,
    type: 'number',
  },
  {
    field: 'doctor_id',
    label: 'Doctor',
    required: false,
    type: 'number',
  },
  {
    field: 'appointment_date',
    label: 'Fecha de la cita',
    required: false,
    type: 'string',
    pattern: /^\d{4}-\d{2}-\d{2}$/,
    patternMsg: 'La fecha debe tener formato YYYY-MM-DD.',
  },
  {
    field: 'start_time',
    label: 'Hora de inicio',
    required: false,
    type: 'string',
    pattern: /^\d{2}:\d{2}(:\d{2})?$/,
    patternMsg: 'La hora de inicio debe tener formato HH:mm o HH:mm:ss.',
  },
  {
    field: 'end_time',
    label: 'Hora de fin',
    required: false,
    type: 'string',
    pattern: /^\d{2}:\d{2}(:\d{2})?$/,
    patternMsg: 'La hora de fin debe tener formato HH:mm o HH:mm:ss.',
  },
  {
    field: 'treatment_id',
    label: 'Tratamiento',
    required: false,
    type: 'number',
  },
  {
    field: 'reason',
    label: 'Motivo',
    required: false,
    type: 'string',
    maxLength: 500,
  },
  {
    field: 'notes',
    label: 'Notas',
    required: false,
    type: 'string',
    maxLength: 1000,
  },
  {
    field: 'gabinete',
    label: 'Gabinete',
    required: false,
    type: 'string',
    enum: ['Gabinete 1', 'Gabinete 2'],
  },
];

/**
 * Reglas de validación para cambiar el estado de una cita.
 * @type {Array<object>}
 */
export const updateStatusRules = [
  {
    field: 'status_name',
    label: 'Estado',
    required: true,
    type: 'string',
    enum: ['programada', 'confirmada', 'en_consulta', 'completada', 'cancelada', 'no_asistio'],
  },
  {
    field: 'cancellation_reason',
    label: 'Motivo de cancelación',
    required: false,
    type: 'string',
    maxLength: 500,
    custom: (value, data) => {
      if (data.status_name === 'cancelada' && (!value || value.trim() === '')) {
        return 'El motivo de cancelación es obligatorio al cancelar una cita.';
      }
      return null;
    },
  },
];
