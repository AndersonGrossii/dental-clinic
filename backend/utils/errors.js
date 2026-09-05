// ============================================
// AppError — Clases de error personalizadas
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

export class NotFoundError extends AppError {
  constructor(message = 'Recurso no encontrado') {
    super(message, 404);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Datos de entrada inválidos', errors = []) {
    super(message, 400, errors);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'No autorizado') {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Acceso prohibido') {
    super(message, 403);
  }
}
