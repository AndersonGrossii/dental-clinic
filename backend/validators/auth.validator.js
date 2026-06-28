// ============================================
// Validaciones de Autenticación
// ============================================

/**
 * Patrón para contraseña segura.
 * Mínimo 8 caracteres, al menos una mayúscula, una minúscula, un número y un carácter especial.
 */
const STRONG_PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&.#_\-])[A-Za-z\d@$!%*?&.#_\-]{8,}$/;

/**
 * Reglas de validación para inicio de sesión.
 * @type {Array<object>}
 */
export const loginRules = [
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
    minLength: 6,
  },
];

/**
 * Reglas de validación para cambio de contraseña.
 * @type {Array<object>}
 */
export const changePasswordRules = [
  {
    field: 'currentPassword',
    label: 'Contraseña actual',
    required: true,
    type: 'string',
  },
  {
    field: 'newPassword',
    label: 'Nueva contraseña',
    required: true,
    type: 'string',
    minLength: 8,
    pattern: STRONG_PASSWORD_PATTERN,
    patternMsg: 'La nueva contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula, un número y un carácter especial.',
  },
];

/**
 * Reglas de validación para solicitud de recuperación de contraseña.
 * @type {Array<object>}
 */
export const forgotPasswordRules = [
  {
    field: 'email',
    label: 'Correo electrónico',
    required: true,
    type: 'email',
  },
];

/**
 * Reglas de validación para restablecer contraseña con token.
 * @type {Array<object>}
 */
export const resetPasswordRules = [
  {
    field: 'token',
    label: 'Token de recuperación',
    required: true,
    type: 'string',
  },
  {
    field: 'newPassword',
    label: 'Nueva contraseña',
    required: true,
    type: 'string',
    minLength: 8,
    pattern: STRONG_PASSWORD_PATTERN,
    patternMsg: 'La nueva contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula, un número y un carácter especial.',
  },
];
