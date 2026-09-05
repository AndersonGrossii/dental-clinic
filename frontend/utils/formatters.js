// ============================================
// Formateadores y Colores de Estado
// ============================================

/**
 * Retorna la clase CSS correspondiente al estado de una cita.
 */
export function getAppointmentStatusClass(statusName) {
  switch (statusName) {
    case 'programada': return 'badge-info';
    case 'confirmada': return 'badge-success';
    case 'sala': return 'badge-info';
    case 'en_consulta': return 'badge-warning';
    case 'completada': return 'badge-success';
    case 'cancelada': return 'badge-danger';
    case 'no_asistio': return 'badge-neutral';
    default: return 'badge-neutral';
  }
}

/**
 * Traduce y estiliza el estado de una factura.
 */
export function getInvoiceStatusInfo(status) {
  switch (status) {
    case 'pendiente': return { label: 'Pendiente', class: 'badge-warning' };
    case 'parcial': return { label: 'Pago Parcial', class: 'badge-info' };
    case 'pagada': return { label: 'Pagada', class: 'badge-success' };
    case 'vencida': return { label: 'Vencida', class: 'badge-danger' };
    case 'cancelada': return { label: 'Cancelada', class: 'badge-neutral' };
    default: return { label: status, class: 'badge-neutral' };
  }
}

/**
 * Traduce y estiliza el estado de una cotización.
 */
export function getQuotationStatusInfo(status) {
  switch (status) {
    case 'borrador': return { label: 'Borrador', class: 'badge-neutral' };
    case 'enviada': return { label: 'Enviada', class: 'badge-info' };
    case 'aceptada': return { label: 'Aceptada', class: 'badge-success' };
    case 'rechazada': return { label: 'Rechazada', class: 'badge-danger' };
    case 'expirada': return { label: 'Expirada', class: 'badge-neutral' };
    default: return { label: status, class: 'badge-neutral' };
  }
}

/**
 * Formatea los métodos de pago de un recibo o factura.
 * @param {object} doc - Objeto del recibo o factura (puede contener doc.payments o campos individuales)
 * @returns {string} Texto formateado con los métodos de pago usados (ej: "Efectivo", "Tarjeta de Crédito, Financiación")
 */
export function formatPaymentMethods(doc) {
  if (!doc) return 'N/A';
  
  let payments = doc.payments;
  if (payments && Array.isArray(payments) && payments.length > 0) {
    const labels = payments.map(p => {
      if (p.payment_method_label) return p.payment_method_label;
      const name = (p.payment_method_name || p.name || '').toLowerCase();
      switch (name) {
        case 'efectivo': return 'Efectivo';
        case 'tarjeta_credito': return 'Tarjeta de Crédito';
        case 'saldo_credito': return 'Saldo (crédito)';
        case 'transferencia': return 'Transferencia Bancaria';
        case 'financing': return 'Financiación';
        default: return p.payment_method_label || p.payment_method_name || p.name || 'N/A';
      }
    });
    return [...new Set(labels)].join(', ');
  }

  if (doc.payment_method_label) return doc.payment_method_label;
  if (doc.payment_method_name || doc.payment_method) {
    const name = (doc.payment_method_name || doc.payment_method || '').toLowerCase();
    switch (name) {
      case 'efectivo': return 'Efectivo';
      case 'tarjeta_credito': return 'Tarjeta de Crédito';
      case 'saldo_credito': return 'Saldo (crédito)';
      case 'transferencia': return 'Transferencia Bancaria';
      case 'financing': return 'Financiación';
      default: return doc.payment_method_name || doc.payment_method;
    }
  }

  return 'N/A';
}

// Re-exportar formateadores de fecha y hora desde helpers.js para compatibilidad
export { formatDate, formatTime, formatDateTime } from './helpers.js';

