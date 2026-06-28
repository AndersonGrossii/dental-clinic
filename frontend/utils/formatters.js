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
