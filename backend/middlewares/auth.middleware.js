// ============================================
// Middleware de Autenticación JWT
// ============================================
import jwt from 'jsonwebtoken';
import config from '../config/app.js';
import { ApiResponse } from '../utils/response.js';
import { query, als } from '../database/pool.js';

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

    // Obtener usuario con rol y clinic_id
    const userRes = await query(`
      SELECT u.id, u.email, u.role_id, r.name AS role_name, u.clinic_id, u.current_session_id
      FROM users u
      INNER JOIN roles r ON u.role_id = r.id
      WHERE u.id = $1 AND u.deleted_at IS NULL
    `, [decoded.id]);
    
    const user = userRes.rows[0];
    if (!user) {
      return ApiResponse.error(res, 'Usuario no encontrado.', 401);
    }
    
    // Verificar sesión (excepto para higienistas)
    if (user.role_name.toLowerCase() !== 'higienista') {
      if (user.current_session_id && decoded.sessionId !== user.current_session_id) {
        return ApiResponse.error(res, 'Sesión cerrada. Este usuario ha iniciado sesión en otro dispositivo.', 401);
      }
    }
    
    // Definir clinicId según el rol
    const isOwner = user.role_name === 'propietario';
    let clinicId = user.clinic_id;
    
    if (isOwner) {
      const headerClinicId = req.headers['x-clinic-id'];
      if (headerClinicId) {
        clinicId = parseInt(headerClinicId, 10);
      }
    }
    
    // Adjuntar datos del usuario al request
    req.user = {
      id: user.id,
      email: user.email,
      roleId: user.role_id,
      roleName: user.role_name,
      clinicId: clinicId,
      doctorId: decoded.doctorId || null,
      sessionId: decoded.sessionId || null,
    };
    
    const store = {
      userId: user.id,
      clinicId: clinicId,
      isOwner: isOwner,
      roleName: user.role_name,
    };
    
    als.run(store, () => {
      next();
    });
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
