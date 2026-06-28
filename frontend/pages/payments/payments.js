// ============================================
// Vista del Historial de Pagos
// ============================================
import paymentService from '../../services/payment.service.js';
import toast from '../../components/toast/toast.js';
import { formatDate, formatDateTime, formatCurrency } from '../../utils/helpers.js';

export class Payments {
  constructor(container) {
    this.container = container;
    this.paymentsList = [];
  }

  async render() {
    try {
      const response = await paymentService.getAll();
      this.paymentsList = response.payments || [];
      this.renderView();
    } catch (err) {
      toast.error('Error al cargar historial de pagos');
    }
  }

  renderView() {
    let rows = this.paymentsList.map(pay => `
      <tr>
        <td><strong># ${pay.id}</strong></td>
        <td>${pay.invoice_number}</td>
        <td>${pay.patient_name}</td>
        <td style="color: var(--success-600); font-weight: 600;">${formatCurrency(pay.amount)}</td>
        <td>${pay.payment_method_label}</td>
        <td>${pay.reference_number || 'N/A'}</td>
        <td>${formatDateTime(pay.payment_date)}</td>
      </tr>
    `).join('');

    if (this.paymentsList.length === 0) {
      rows = `<tr><td colspan="7" style="text-align: center; color: var(--text-secondary);">No hay registros de pagos.</td></tr>`;
    }

    this.container.innerHTML = `
      <div class="page-header" style="margin-bottom: var(--space-6);">
        <h1 class="page-title">Historial de Pagos</h1>
        <p style="color: var(--text-secondary);">Registro consolidado de transacciones y cobros</p>
      </div>

      <div class="card">
        <div class="card-body table-container">
          <table>
            <thead>
              <tr>
                <th>ID Transacción</th>
                <th>No. Factura</th>
                <th>Paciente</th>
                <th>Monto Recibido</th>
                <th>Método de Pago</th>
                <th>Referencia</th>
                <th>Fecha y Hora</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  mount() {
    // No interaction needed for simple list log
  }
}
