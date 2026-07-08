// ============================================
// Middleware de Roles y Permisos
// ============================================
import { ApiResponse } from '../utils/response.js';

/**
 * Middleware que verifica que el usuario tenga uno de los roles permitidos.
 * @param  {...string} allowedRoles - Nombres de roles permitidos ('propietario', 'recepcionista', 'doctor')
 * @returns {Function} Middleware de Express
 */
export const roleMiddleware = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return ApiResponse.error(res, 'Acceso no autorizado.', 401);
    }

    const userRole = req.user.roleName?.toLowerCase();

    if (!allowedRoles.includes(userRole)) {
      return ApiResponse.error(
        res,
        'No tiene permisos suficientes para realizar esta acción.',
        403
      );
    }

    next();
  };
};

/**
 * Solo propietarios (eliminación de cuentas de propietario).
 */
export const ownerOnly = roleMiddleware('propietario');

/**
 * Dirección y propietarios (gestión completa excepto borrar propietario).
 */
export const managementOnly = roleMiddleware('propietario', 'direccion');

/**
 * Dirección, propietarios y recepcionistas.
 */
export const staffOnly = roleMiddleware('propietario', 'direccion', 'recepcionista');

/**
 * Todos los roles autenticados.
 */
export const allRoles = roleMiddleware('propietario', 'direccion', 'recepcionista', 'doctor', 'higienista');
