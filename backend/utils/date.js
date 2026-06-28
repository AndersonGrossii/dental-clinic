// ============================================
// Utilidades de Fecha
// ============================================

/**
 * Formatea una fecha para PostgreSQL (YYYY-MM-DD).
 * @param {Date|string} date
 * @returns {string}
 */
export const formatDateSQL = (date) => {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
};

/**
 * Formatea una fecha y hora para display.
 * @param {Date|string} date
 * @returns {string}
 */
export const formatDateTime = (date) => {
  const d = new Date(date);
  return d.toLocaleString('es-ES', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Obtiene el inicio y fin del día actual.
 * @returns {{ start: string, end: string }}
 */
export const getTodayRange = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  return { start: start.toISOString(), end: end.toISOString() };
};

/**
 * Obtiene el rango de la semana actual (lunes a domingo).
 * @returns {{ start: string, end: string }}
 */
export const getWeekRange = () => {
  const now = new Date();
  const dayOfWeek = now.getDay() || 7;
  const start = new Date(now);
  start.setDate(now.getDate() - dayOfWeek + 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
};

/**
 * Obtiene el rango del mes actual.
 * @returns {{ start: string, end: string }}
 */
export const getMonthRange = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  return { start: start.toISOString(), end: end.toISOString() };
};
