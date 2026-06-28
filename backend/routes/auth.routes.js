// ============================================
// Rutas de Autenticación — /api/v1/auth
// ============================================
import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { loginLimiter } from '../middlewares/rateLimiter.middleware.js';
import { validate } from '../middlewares/validation.middleware.js';
import { loginRules, changePasswordRules, forgotPasswordRules, resetPasswordRules } from '../validators/auth.validator.js';
import * as authController from '../controllers/auth.controller.js';

const router = Router();

/**
 * @route   POST /api/v1/auth/login
 * @desc    Iniciar sesión
 * @access  Público
 */
router.post('/login', loginLimiter, validate(loginRules), authController.login);

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Cerrar sesión
 * @access  Privado (autenticado)
 */
router.post('/logout', authMiddleware, authController.logout);

/**
 * @route   POST /api/v1/auth/refresh
 * @desc    Renovar access token con refresh token
 * @access  Público
 */
router.post('/refresh', authController.refreshToken);

/**
 * @route   PUT /api/v1/auth/change-password
 * @desc    Cambiar contraseña del usuario autenticado
 * @access  Privado (autenticado)
 */
router.put('/change-password', authMiddleware, validate(changePasswordRules), authController.changePassword);

/**
 * @route   POST /api/v1/auth/forgot-password
 * @desc    Solicitar token de recuperación de contraseña
 * @access  Público
 */
router.post('/forgot-password', loginLimiter, validate(forgotPasswordRules), authController.forgotPassword);

/**
 * @route   POST /api/v1/auth/reset-password
 * @desc    Restablecer contraseña con token
 * @access  Público
 */
router.post('/reset-password', validate(resetPasswordRules), authController.resetPassword);

export default router;
