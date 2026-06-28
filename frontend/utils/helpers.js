// ============================================
// Utilidades Auxiliares (Helpers)
// ============================================

/**
 * Retrasa la ejecución de una función hasta que transcurra un tiempo sin llamadas.
 */
export function debounce(fn, delay) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Formatea un número como moneda local (MXN / USD).
 */
export function formatCurrency(amount) {
  const num = parseFloat(amount || 0);
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(num);
}

/**
 * Formatea una fecha (YYYY-MM-DD) a formato legible (DD/MM/YYYY).
 */
export function formatDate(dateString) {
  if (!dateString) return '';
  const [year, month, day] = dateString.split('T')[0].split('-');
  return `${day}/${month}/${year}`;
}

/**
 * Formatea una hora en formato legible (14:30).
 */
export function formatTime(timeString) {
  if (!timeString) return '';
  return timeString.substring(0, 5);
}

/**
 * Formatea un timestamp completo a fecha y hora.
 */
export function formatDateTime(dateTimeString) {
  if (!dateTimeString) return '';
  const date = new Date(dateTimeString);
  return date.toLocaleString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Obtiene las iniciales de un nombre completo.
 */
export function getInitials(name) {
  if (!name) return 'U';
  return name
    .split(' ')
    .filter(n => n.length > 0)
    .slice(0, 2)
    .map(n => n[0].toUpperCase())
    .join('');
}

/**
 * Escapa HTML especial para prevenir XSS en inyección dinámica.
 */
export function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}
