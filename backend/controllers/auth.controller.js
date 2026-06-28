// ============================================
// Controlador de Autenticación
// ============================================
import authService from '../services/auth.service.js';
import { ApiResponse } from '../utils/response.js';

/**
 * Inicia sesión del usuario.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password);

    return ApiResponse.success(res, result, 'Inicio de sesión exitoso.');
  } catch (error) {
    next(error);
  }
};

/**
 * Cierra la sesión del usuario.
 * En una implementación con blacklist de tokens, aquí se invalidaría el token.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export const logout = async (req, res, next) => {
  try {
    // En una implementación completa, se agregaría el token a una lista negra (Redis)
    return ApiResponse.success(res, null, 'Sesión cerrada exitosamente.');
  } catch (error) {
    next(error);
  }
};

/**
 * Genera un nuevo access token usando el refresh token.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken: token } = req.body;
    const result = await authService.refreshToken(token);

    return ApiResponse.success(res, result, 'Token actualizado exitosamente.');
  } catch (error) {
    next(error);
  }
};

/**
 * Cambia la contraseña del usuario autenticado.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    await authService.changePassword(req.user.id, currentPassword, newPassword);

    return ApiResponse.success(res, null, 'Contraseña cambiada exitosamente.');
  } catch (error) {
    next(error);
  }
};

/**
 * Solicita un token de recuperación de contraseña.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    await authService.forgotPassword(email);

    // Siempre responder éxito por seguridad (no revelar si el email existe)
    return ApiResponse.success(
      res,
      null,
      'Si el correo electrónico está registrado, recibirá instrucciones para restablecer su contraseña.'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Restablece la contraseña usando un token de recuperación.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export const resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;
    await authService.resetPassword(token, newPassword);

    return ApiResponse.success(res, null, 'Contraseña restablecida exitosamente. Ya puede iniciar sesión.');
  } catch (error) {
    next(error);
  }
};
