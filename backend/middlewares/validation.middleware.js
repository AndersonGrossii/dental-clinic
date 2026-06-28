// ============================================
// Middleware de Validación
// ============================================
import { ApiResponse } from '../utils/response.js';

/**
 * Crea un middleware de validación basado en un esquema de reglas.
 * Cada regla es un objeto con: { field, label, required, type, minLength, maxLength, pattern, patternMsg, custom }
 *
 * @param {Array<object>} rules - Reglas de validación
 * @param {'body'|'query'|'params'} source - Fuente de datos (por defecto 'body')
 * @returns {Function} Middleware de Express
 */
export const validate = (rules, source = 'body') => {
  return (req, res, next) => {
    const data = req[source];
    const errors = [];

    for (const rule of rules) {
      const value = data?.[rule.field];
      const label = rule.label || rule.field;

      // Campo requerido
      if (rule.required && (value === undefined || value === null || value === '')) {
        errors.push({ field: rule.field, message: `${label} es obligatorio.` });
        continue;
      }

      // Si no tiene valor y no es requerido, saltar validaciones
      if (value === undefined || value === null || value === '') continue;

      // Tipo string
      if (rule.type === 'string' && typeof value !== 'string') {
        errors.push({ field: rule.field, message: `${label} debe ser texto.` });
        continue;
      }

      // Tipo number
      if (rule.type === 'number' && (typeof value !== 'number' || isNaN(value))) {
        errors.push({ field: rule.field, message: `${label} debe ser un número.` });
        continue;
      }

      // Tipo email
      if (rule.type === 'email') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          errors.push({ field: rule.field, message: `${label} no es un email válido.` });
          continue;
        }
      }

      // Longitud mínima
      if (rule.minLength && typeof value === 'string' && value.length < rule.minLength) {
        errors.push({ field: rule.field, message: `${label} debe tener al menos ${rule.minLength} caracteres.` });
      }

      // Longitud máxima
      if (rule.maxLength && typeof value === 'string' && value.length > rule.maxLength) {
        errors.push({ field: rule.field, message: `${label} no puede tener más de ${rule.maxLength} caracteres.` });
      }

      // Patrón regex
      if (rule.pattern && !rule.pattern.test(value)) {
        errors.push({ field: rule.field, message: rule.patternMsg || `${label} tiene un formato inválido.` });
      }

      // Validación personalizada
      if (rule.custom && typeof rule.custom === 'function') {
        const customError = rule.custom(value, data);
        if (customError) {
          errors.push({ field: rule.field, message: customError });
        }
      }

      // Valores permitidos (enum)
      if (rule.enum && !rule.enum.includes(value)) {
        errors.push({ field: rule.field, message: `${label} debe ser uno de: ${rule.enum.join(', ')}.` });
      }

      // Rango numérico
      if (rule.min !== undefined && typeof value === 'number' && value < rule.min) {
        errors.push({ field: rule.field, message: `${label} debe ser al menos ${rule.min}.` });
      }
      if (rule.max !== undefined && typeof value === 'number' && value > rule.max) {
        errors.push({ field: rule.field, message: `${label} no puede ser mayor que ${rule.max}.` });
      }
    }

    if (errors.length > 0) {
      return ApiResponse.error(res, 'Errores de validación', 422, errors);
    }

    next();
  };
};

/**
 * Middleware que sanitiza strings en el body para prevenir XSS básico.
 */
const SANITIZE_SKIP = new Set(['password', 'password_hash']);

export const sanitizeBody = (req, _res, next) => {
  if (req.body && typeof req.body === 'object') {
    for (const [key, value] of Object.entries(req.body)) {
      if (SANITIZE_SKIP.has(key)) continue;
      if (typeof value === 'string') {
        req.body[key] = value
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#x27;')
          .trim();
      }
    }
  }
  next();
};
