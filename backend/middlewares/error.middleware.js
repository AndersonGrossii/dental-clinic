// ============================================
// Middleware de Manejo de Errores
// ============================================
import { logger } from '../utils/logger.js';
import { AppError } from '../utils/errors.js';

/**
 * Middleware central de manejo de errores.
 * Captura todos los errores y devuelve una respuesta estandarizada.
 */
export const errorMiddleware = (err, req, res, _next) => {
  // Si es un error operacional (AppError), usamos su status
  if (err instanceof AppError) {
    logger.warn(`Error operacional: ${err.message} [${err.statusCode}]`);
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: err.errors,
    });
  }

  // Error de validación de JSON
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      message: 'El cuerpo de la solicitud es demasiado grande',
    });
  }

  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      message: 'JSON inválido en el cuerpo de la solicitud',
    });
  }

  // Error de PostgreSQL — violación de constraint único
  if (err.code === '23505') {
    return res.status(409).json({
      success: false,
      message: 'El registro ya existe. Verifique los datos e intente de nuevo.',
    });
  }

  // Error de PostgreSQL — violación de foreign key
  if (err.code === '23503') {
    return res.status(409).json({
      success: false,
      message: 'No se puede completar la operación: existe una referencia a otro registro.',
    });
  }

  // Error inesperado
  logger.error('Error inesperado:', err.message, err.stack);

  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'Error interno del servidor'
    : err.message || 'Error interno del servidor';

  return res.status(statusCode).json({
    success: false,
    message,
  });
};

/**
 * Middleware para rutas no encontradas (404).
 */
export const notFoundMiddleware = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
  });
};
