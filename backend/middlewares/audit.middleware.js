// ============================================
// Middleware de Auditoría
// ============================================
import { query } from '../database/pool.js';
import { logger } from '../utils/logger.js';

/**
 * Middleware que registra acciones del usuario en la tabla audit_logs.
 * Se ejecuta después de que la respuesta ha sido enviada.
 *
 * @param {string} action - Acción realizada (ej: 'CREAR_PACIENTE', 'EDITAR_CITA')
 * @param {string} tableName - Tabla afectada
 * @returns {Function} Middleware de Express
 */
export const auditMiddleware = (action, tableName) => {
  return (req, res, next) => {
    // Guardar la función original de json
    const originalJson = res.json.bind(res);

    res.json = function (body) {
      // Registrar auditoría solo si la respuesta fue exitosa
      if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
        const recordId = req.params?.id || body?.data?.id || null;

        query(
          `INSERT INTO audit_logs (user_id, action, table_name, record_id, old_values, new_values, ip_address, user_agent)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            req.user.id,
            action,
            tableName,
            recordId,
            JSON.stringify(req._oldValues || null),
            JSON.stringify(req.body || null),
            req.ip || req.connection?.remoteAddress,
            req.headers['user-agent'] || 'desconocido',
          ]
        ).catch((err) => {
          logger.error('Error al registrar auditoría:', err.message);
        });
      }

      return originalJson(body);
    };

    next();
  };
};
