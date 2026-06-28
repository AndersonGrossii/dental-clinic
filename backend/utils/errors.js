// ============================================
// AppError — Clase de error personalizada
// ============================================

/**
 * Error personalizado de la aplicación con código de estado HTTP.
 * Usado en la capa de servicio para lanzar errores controlados.
 */
export class AppError extends Error {
  /**
   * @param {string} message - Mensaje de error
   * @param {number} statusCode - Código HTTP (400, 401, 403, 404, 409, 500)
   * @param {Array} [errors=[]] - Errores de validación adicionales
   */
  constructor(message, statusCode = 500, errors = []) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}
