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
    logger.warn(`Violación de restricción única [23505]: ${err.detail || err.message} (Constraint: ${err.constraint || 'n/a'})`);
    let userMsg = 'El registro ya existe. Verifique los datos e intente de nuevo.';
    if (err.constraint === 'patients_custom_id_key' || err.detail?.includes('custom_id')) {
      userMsg = 'El código de paciente (ID) ya existe. Deje el campo en blanco para que el sistema lo genere automáticamente o use otro código.';
    } else if (err.constraint?.includes('dni') || err.detail?.includes('dni')) {
      userMsg = 'Ya existe un paciente registrado con ese DNI / Pasaporte.';
    } else if (err.constraint?.includes('email') || err.detail?.includes('email')) {
      userMsg = 'Ya existe un registro con ese correo electrónico.';
    } else if (err.detail) {
      userMsg = `El registro ya existe: ${err.detail}`;
    }
    return res.status(409).json({
      success: false,
      message: userMsg,
      detail: err.detail || null,
      constraint: err.constraint || null,
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
