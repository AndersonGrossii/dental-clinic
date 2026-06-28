// ============================================
// Vista de Gestión de Facturas
// ============================================
import invoiceService from '../../services/invoice.service.js';
import paymentService from '../../services/payment.service.js';
import toast from '../../components/toast/toast.js';
import Modal from '../../components/modal/modal.js';
import state from '../../scripts/state.js';
import { formatDate, formatCurrency } from '../../utils/helpers.js';
import { getInvoiceStatusInfo } from '../../utils/formatters.js';

export class Invoices {
  constructor(container) {
    this.container = container;
    this.invoicesList = [];
  }

  async render() {
    try {
      const response = await invoiceService.getAll();
      this.invoicesList = response.invoices || [];
      this.renderView();
    } catch (err) {
      toast.error('Error al cargar facturas');
    }
  }

  renderView() {
    let rows = this.invoicesList.map(inv => {
      const statusInfo = getInvoiceStatusInfo(inv.status);
      return `
        <tr>
          <td><strong># ${inv.invoice_number}</strong></td>
          <td>${inv.patient_name}</td>
          <td><strong>${formatCurrency(inv.total)}</strong></td>
          <td style="color: var(--success-600);">${formatCurrency(inv.amount_paid)}</td>
          <td style="color: var(--danger-600);"><strong>${formatCurrency(inv.balance)}</strong></td>
          <td><span class="badge ${statusInfo.class}">${statusInfo.label}</span></td>
          <td>${formatDate(inv.created_at)}</td>
          <td>
            <button class="btn btn-sm btn-outline print-invoice-btn" data-id="${inv.id}">Imprimir</button>
            ${inv.balance > 0 ? `<button class="btn btn-sm btn-primary pay-invoice-btn" data-id="${inv.id}">Pagar</button>` : ''}
          </td>
        </tr>
      `;
    }).join('');

    if (this.invoicesList.length === 0) {
      rows = `<tr><td colspan="8" style="text-align: center; color: var(--text-secondary);">No hay facturas registradas.</td></tr>`;
    }

    this.container.innerHTML = `
      <div class="page-header" style="display: flex; justify-content: between; align-items: center; margin-bottom: var(--space-6);">
        <div>
          <h1 class="page-title">Facturación</h1>
          <p style="color: var(--text-secondary);">Facturas de servicios y saldos pendientes</p>
        </div>
        <button id="add-invoice-from-quote-btn" class="btn btn-primary">Facturar desde Presupuesto</button>
      </div>

      <div class="card">
        <div class="card-body table-container">
          <table>
            <thead>
              <tr>
                <th>No. Factura</th>
                <th>Paciente</th>
                <th>Monto Total</th>
                <th>Monto Pagado</th>
                <th>Saldo Restante</th>
                <th>Estado</th>
                <th>Fecha Emisión</th>
                <th>Acciones</th>
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
    // Facturar desde presupuesto
    const quoteBtn = this.container.querySelector('#add-invoice-from-quote-btn');
    if (quoteBtn) {
      quoteBtn.addEventListener('click', () => this.showInvoiceFromQuoteModal());
    }

    // Eventos de fila
    this.container.addEventListener('click', (e) => {
      if (e.target.classList.contains('print-invoice-btn')) {
        const id = e.target.getAttribute('data-id');
        this.printInvoice(id);
      }
      if (e.target.classList.contains('pay-invoice-btn')) {
        const id = e.target.getAttribute('data-id');
        this.showRegisterPaymentModal(id);
      }
    });
  }

  showInvoiceFromQuoteModal() {
    const content = `
      <form id="invoice-quote-form">
        <div class="form-group">
          <label class="form-label">ID de Presupuesto (Cotización)</label>
          <input type="number" name="quotation_id" class="form-input" placeholder="Ej: 1" required />
        </div>
      </form>
    `;

    Modal.show({
      title: 'Facturar Presupuesto',
      content: content,
      confirmText: 'Generar Factura',
      onConfirm: async (modalBody) => {
        const form = modalBody.querySelector('#invoice-quote-form');
        const quoteId = form.querySelector('[name="quotation_id"]').value;

        try {
          await invoiceService.createFromQuotation(quoteId);
          toast.success('Factura creada exitosamente a partir de la cotización');
          await this.render();
          this.mount();
          return true;
        } catch (err) {
          toast.error(err.message || 'Error al generar la factura');
          return false;
        }
      }
    });
  }

  async showRegisterPaymentModal(invoiceId) {
    // Cargar métodos de pago
    let methods = [];
    try {
      methods = await paymentService.getMethods();
    } catch {
      toast.error('Error al cargar métodos de pago');
    }

    const methodOptions = methods.map(m => `
      <option value="${m.id}">${m.label}</option>
    `).join('');

    const invoice = this.invoicesList.find(i => i.id == invoiceId);

    const content = `
      <form id="register-payment-form">
        <div style="margin-bottom: var(--space-4); background-color: var(--gray-50); padding: var(--space-3); border-radius: var(--radius-sm);">
          <p style="margin: 2px 0;"><strong>Factura:</strong> # ${invoice.invoice_number}</p>
          <p style="margin: 2px 0;"><strong>Saldo Pendiente:</strong> ${formatCurrency(invoice.balance)}</p>
        </div>
        <div class="form-group">
          <label class="form-label">Monto del Pago ($)</label>
          <input type="number" name="amount" class="form-input" max="${invoice.balance}" min="1" value="${invoice.balance}" required />
        </div>
        <div class="form-group" style="margin-top: var(--space-3);">
          <label class="form-label">Método de Pago</label>
          <select name="payment_method_id" class="form-select" required>
            ${methodOptions}
          </select>
        </div>
        <div class="form-group" style="margin-top: var(--space-3);">
          <label class="form-label">Referencia / Transacción (Opcional)</label>
          <input type="text" name="reference_number" class="form-input" placeholder="Ej: Transferencia No. 12345" />
        </div>
        <div class="form-group" style="margin-top: var(--space-3);">
          <label class="form-label">Notas</label>
          <textarea name="notes" class="form-textarea" rows="2"></textarea>
        </div>
      </form>
    `;

    Modal.show({
      title: 'Registrar Pago de Factura',
      content: content,
      confirmText: 'Registrar Pago',
      size: 'sm',
      onConfirm: async (modalBody) => {
        const form = modalBody.querySelector('#register-payment-form');
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        data.invoice_id = invoiceId;

        try {
          await paymentService.create(data);
          toast.success('Pago registrado exitosamente');
          await this.render();
          this.mount();
          return true;
        } catch (err) {
          toast.error(err.message || 'Error al guardar el pago');
          return false;
        }
      }
    });
  }

  async printInvoice(id) {
    try {
      const invoice = await invoiceService.getById(id);
      const clinic = state.get('clinicInfo') || {};

      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
        <html>
        <head>
          <title>Factura # ${invoice.invoice_number}</title>
          <style>
            body { font-family: sans-serif; padding: 40px; color: #333; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #ccc; padding-bottom: 20px; }
            .details { margin: 30px 0; display: flex; justify-content: space-between; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
            th { background-color: #f5f5f5; }
            .totals { text-align: right; margin-top: 30px; font-size: 1.1em; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h2>${clinic.name || 'Clinica Vides Dental'}</h2>
              <p>${clinic.address || 'Av. Reforma 1234, Centro'}</p>
              <p>${clinic.tax_id ? 'RFC: ' + clinic.tax_id : 'RFC: CDS850101ABC'}</p>
            </div>
            <div>
              <h1>FACTURA</h1>
              <p><strong>No:</strong> ${invoice.invoice_number}</p>
              <p><strong>Fecha:</strong> ${formatDate(invoice.created_at)}</p>
            </div>
          </div>
          
          <div class="details">
            <div>
              <h3>Receptor:</h3>
              <p><strong>Nombre:</strong> ${invoice.patient_name}</p>
              <p><strong>RFC / ID:</strong> ${invoice.patient_dni || 'N/A'}</p>
            </div>
            <div>
              <h3>Especialista:</h3>
              <p>Dr/a. ${invoice.doctor_name || 'N/A'}</p>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Descripción del Servicio</th>
                <th>Precio Unitario</th>
                <th>Cant.</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${invoice.items.map(item => `
                <tr>
                  <td>${item.description}</td>
                  <td>${formatCurrency(item.unit_price)}</td>
                  <td>${item.quantity}</td>
                  <td><strong>${formatCurrency(item.total)}</strong></td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="totals">
            <p>Subtotal: ${formatCurrency(invoice.subtotal)}</p>
            <p>IVA (${invoice.tax_rate}%): ${formatCurrency(invoice.tax_amount)}</p>
            <p>Descuento: -${formatCurrency(invoice.discount_amount)}</p>
            <p>Monto Pagado: ${formatCurrency(invoice.amount_paid)}</p>
            <hr/>
            <h2>Saldo Restante: ${formatCurrency(invoice.balance)}</h2>
            <h2>TOTAL FACTURA: ${formatCurrency(invoice.total)}</h2>
          </div>
        </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    } catch {
      toast.error('Error al generar vista de impresión de factura');
    }
  }
}
