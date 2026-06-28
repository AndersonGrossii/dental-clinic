// ============================================
// Validador de Doctores — Reglas de validación
// ============================================

const STRONG_PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&.#_\-])[A-Za-z\d@$!%*?&.#_\-]{8,}$/;

/**
 * Reglas de validación para crear un doctor.
 * @type {Array<object>}
 */
export const createDoctorRules = [
  {
    field: 'firstName',
    label: 'Nombre',
    required: true,
    type: 'string',
    minLength: 2,
    maxLength: 100,
  },
  {
    field: 'lastName',
    label: 'Apellido',
    required: true,
    type: 'string',
    minLength: 2,
    maxLength: 100,
  },
  {
    field: 'email',
    label: 'Correo electrónico',
    required: true,
    type: 'email',
  },
  {
    field: 'password',
    label: 'Contraseña',
    required: true,
    type: 'string',
    minLength: 8,
    pattern: STRONG_PASSWORD_PATTERN,
    patternMsg: 'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula, un número y un carácter especial.',
  },
  {
    field: 'phone',
    label: 'Teléfono',
    required: false,
    type: 'string',
    maxLength: 20,
  },
  {
    field: 'specialty',
    label: 'Especialidad',
    required: true,
    type: 'string',
    minLength: 2,
    maxLength: 100,
  },
  {
    field: 'licenseNumber',
    label: 'Cédula profesional',
    required: false,
    type: 'string',
    maxLength: 50,
  },
  {
    field: 'bio',
    label: 'Biografía',
    required: false,
    type: 'string',
    maxLength: 2000,
  },
  {
    field: 'consultationDuration',
    label: 'Duración de consulta (minutos)',
    required: false,
    type: 'number',
    min: 5,
    max: 480,
  },
  {
    field: 'color',
    label: 'Color',
    required: false,
    type: 'string',
    pattern: /^#[0-9a-fA-F]{6}$/,
    patternMsg: 'El color debe tener formato hexadecimal (#RRGGBB).',
  },
];

/**
 * Reglas de validación para actualizar un doctor.
 * @type {Array<object>}
 */
export const updateDoctorRules = [
  {
    field: 'firstName',
    label: 'Nombre',
    required: false,
    type: 'string',
    minLength: 2,
    maxLength: 100,
  },
  {
    field: 'lastName',
    label: 'Apellido',
    required: false,
    type: 'string',
    minLength: 2,
    maxLength: 100,
  },
  {
    field: 'email',
    label: 'Correo electrónico',
    required: false,
    type: 'email',
  },
  {
    field: 'phone',
    label: 'Teléfono',
    required: false,
    type: 'string',
    maxLength: 20,
  },
  {
    field: 'specialty',
    label: 'Especialidad',
    required: false,
    type: 'string',
    minLength: 2,
    maxLength: 100,
  },
  {
    field: 'licenseNumber',
    label: 'Cédula profesional',
    required: false,
    type: 'string',
    maxLength: 50,
  },
  {
    field: 'bio',
    label: 'Biografía',
    required: false,
    type: 'string',
    maxLength: 2000,
  },
  {
    field: 'consultationDuration',
    label: 'Duración de consulta (minutos)',
    required: false,
    type: 'number',
    min: 5,
    max: 480,
  },
  {
    field: 'color',
    label: 'Color',
    required: false,
    type: 'string',
    pattern: /^#[0-9a-fA-F]{6}$/,
    patternMsg: 'El color debe tener formato hexadecimal (#RRGGBB).',
  },
];
