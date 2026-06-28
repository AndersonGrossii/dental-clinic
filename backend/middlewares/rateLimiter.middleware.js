// ============================================
// Middleware de Rate Limiting
// ============================================
import rateLimit from 'express-rate-limit';
import config from '../config/app.js';

/**
 * Rate limiter general para todas las rutas.
 */
export const generalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: {
    success: false,
    message: 'Demasiadas solicitudes. Por favor, intente de nuevo más tarde.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter estricto para rutas de autenticación (login, forgot-password).
 */
export const loginLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.loginMax,
  message: {
    success: false,
    message: 'Demasiados intentos de inicio de sesión. Intente de nuevo en 15 minutos.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
