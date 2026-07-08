// ============================================
// Middleware de Autenticación JWT
// ============================================
import jwt from 'jsonwebtoken';
import config from '../config/app.js';
import { ApiResponse } from '../utils/response.js';
import { query } from '../database/pool.js';

/**
 * Middleware que verifica el token JWT en el header Authorization.
 * Extrae la información del usuario y la adjunta a req.user.
 */
export const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return ApiResponse.error(res, 'Acceso no autorizado. Token no proporcionado.', 401);
    }

    const token = authHeader.split(' ')[1];

    const decoded = jwt.verify(token, config.jwt.secret);

    // Si el rol no es higienista, verificar la sesión concurrente
    if (decoded.roleName?.toLowerCase() !== 'higienista') {
      const userRes = await query('SELECT current_session_id FROM users WHERE id = $1 AND deleted_at IS NULL', [decoded.id]);
      const dbSessionId = userRes.rows[0]?.current_session_id;
      if (dbSessionId && decoded.sessionId !== dbSessionId) {
        return ApiResponse.error(res, 'Sesión cerrada. Este usuario ha iniciado sesión en otro dispositivo.', 401);
      }
    }

    // Adjuntar datos del usuario al request
    req.user = {
      id: decoded.id,
      email: decoded.email,
      roleId: decoded.roleId,
      roleName: decoded.roleName,
      doctorId: decoded.doctorId || null,
      sessionId: decoded.sessionId || null,
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return ApiResponse.error(res, 'Sesión expirada. Por favor, inicie sesión nuevamente.', 401);
    }
    if (error.name === 'JsonWebTokenError') {
      return ApiResponse.error(res, 'Token inválido.', 401);
    }
    return ApiResponse.error(res, 'Error de autenticación.', 401);
  }
};
