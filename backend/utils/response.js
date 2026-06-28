// ============================================
// Respuestas estandarizadas de la API
// ============================================

/**
 * Clase de utilidad para generar respuestas HTTP consistentes.
 */
export class ApiResponse {
  /**
   * Respuesta exitosa.
   * @param {import('express').Response} res
   * @param {any} data - Datos a enviar
   * @param {string} [message='Operación exitosa'] - Mensaje
   * @param {number} [statusCode=200] - Código HTTP
   */
  static success(res, data = null, message = 'Operación exitosa', statusCode = 200) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
    });
  }

  /**
   * Respuesta de error.
   * @param {import('express').Response} res
   * @param {string} [message='Error interno del servidor'] - Mensaje
   * @param {number} [statusCode=500] - Código HTTP
   * @param {Array} [errors=[]] - Lista de errores de validación
   */
  static error(res, message = 'Error interno del servidor', statusCode = 500, errors = []) {
    return res.status(statusCode).json({
      success: false,
      message,
      errors,
    });
  }

  /**
   * Respuesta paginada.
   * @param {import('express').Response} res
   * @param {Array} data - Datos
   * @param {object} pagination - Información de paginación
   * @param {string} [message='Operación exitosa']
   */
  static paginated(res, data, pagination, message = 'Operación exitosa') {
    return res.status(200).json({
      success: true,
      message,
      data,
      pagination,
    });
  }

  /**
   * Respuesta de creación exitosa (201).
   * @param {import('express').Response} res
   * @param {any} data
   * @param {string} [message='Recurso creado exitosamente']
   */
  static created(res, data, message = 'Recurso creado exitosamente') {
    return res.status(201).json({
      success: true,
      message,
      data,
    });
  }

  /**
   * Respuesta sin contenido (204).
   * @param {import('express').Response} res
   */
  static noContent(res) {
    return res.status(204).send();
  }
}
