// ============================================
// Validaciones de Usuarios
// ============================================

/**
 * Patrón para contraseña segura.
 */
const STRONG_PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&.#_\-])[A-Za-z\d@$!%*?&.#_\-]{8,}$/;

/**
 * Reglas de validación para creación de usuario.
 * @type {Array<object>}
 */
export const createUserRules = [
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
    field: 'roleId',
    label: 'Rol',
    required: true,
    type: 'number',
  },
  {
    field: 'phone',
    label: 'Teléfono',
    required: false,
    type: 'string',
    maxLength: 20,
  },
];

/**
 * Reglas de validación para actualización de usuario.
 * @type {Array<object>}
 */
export const updateUserRules = [
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
    field: 'roleId',
    label: 'Rol',
    required: false,
    type: 'number',
  },
  {
    field: 'phone',
    label: 'Teléfono',
    required: false,
    type: 'string',
    maxLength: 20,
  },
];

/**
 * Reglas de validación para reseteo de contraseña por administrador.
 * @type {Array<object>}
 */
export const adminResetPasswordRules = [
  {
    field: 'newPassword',
    label: 'Nueva contraseña',
    required: true,
    type: 'string',
    minLength: 8,
    pattern: STRONG_PASSWORD_PATTERN,
    patternMsg: 'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula, un número y un carácter especial.',
  },
];
