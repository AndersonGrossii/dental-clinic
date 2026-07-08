// ============================================
// Vista del Dashboard de Pagos
// ============================================
import paymentService from '../../services/payment.service.js';
import invoiceService from '../../services/invoice.service.js';
import toast from '../../components/toast/toast.js';
import Modal from '../../components/modal/modal.js';
import { formatDate, formatDateTime, formatCurrency } from '../../utils/helpers.js';

export class Payments {
  constructor(container) {
    this.container = container;
    this.paymentsList = [];
    this.paymentMethods = [];
    this.currentPage = 1;
    this.totalPages = 1;
    this.limit = 15;
    this.searchQuery = '';
    this.filterMethod = '';
    this.filterDateFrom = '';
    this.filterDateTo = '';
    this.searchTimeout = null;
    this.stats = { totalCollected: 0, totalTransactions: 0 };
  }

  async render() {
    try {
      // Cargar métodos de pago y datos en paralelo
      const [methodsRes] = await Promise.all([
        paymentService.getMethods(),
      ]);
      this.paymentMethods = methodsRes || [];
      this.renderLayout();
      await this.loadPayments();
    } catch (err) {
      toast.error('Error al cargar el dashboard de pagos');
    }
  }

  async loadPayments() {
    try {
      const params = {
        page: this.currentPage,
        limit: this.limit,
      };
      if (this.searchQuery) params.search = this.searchQuery;
      if (this.filterMethod) params.payment_method_id = this.filterMethod;
      if (this.filterDateFrom) params.date_from = this.filterDateFrom;
      if (this.filterDateTo) params.date_to = this.filterDateTo;

      const response = await paymentService.getAll(params, { returnFullResponse: true });
      this.paymentsList = response.data || [];
      this.totalPages = response.pagination?.totalPages || 1;
      this.currentPage = response.pagination?.page || 1;

      // Calcular estadísticas rápidas desde la lista visible
      this.computeStats();
      this.renderStatsCards();
      this.renderTable();
    } catch (err) {
      toast.error('Error al cargar los pagos');
    }
  }

  computeStats() {
    const total = this.paymentsList.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
    this.stats.totalCollected = total;
    this.stats.totalTransactions = this.paymentsList.length;
  }

  renderLayout() {
    const methodOptions = this.paymentMethods
      .map(m => `<option value="${m.id}" ${this.filterMethod == m.id ? 'selected' : ''}>${m.name}</option>`)
      .join('');

    this.container.innerHTML = `
      <div class="page-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4);">
        <div>
          <h1 class="page-title">Gestión de Pagos</h1>
          <p style="color: var(--text-secondary);">Registro consolidado de transacciones y cobros</p>
        </div>
        <button id="register-payment-btn" class="btn btn-primary">+ Registrar Pago</button>
      </div>

      <!-- Metric Cards -->
      <div id="stats-cards-container" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: var(--space-4); margin-bottom: var(--space-4);">
        <!-- Stats will be rendered here -->
      </div>

      <!-- Filtros -->
      <div class="card" style="margin-bottom: var(--space-4); padding: var(--space-4);">
        <div style="display: flex; gap: var(--space-2); align-items: center; flex-wrap: wrap;">
          <input type="text" id="payment-search" class="form-input" placeholder="Buscar por paciente o factura..." style="flex: 1; min-width: 200px;" value="${this.searchQuery}" />
          <select id="payment-method-filter" class="form-select" style="width: 180px;">
            <option value="">Todos los Métodos</option>
            ${methodOptions}
          </select>
          <input type="date" id="payment-date-from" class="form-input" style="width: 155px;" value="${this.filterDateFrom}" title="Desde" />
          <input type="date" id="payment-date-to" class="form-input" style="width: 155px;" value="${this.filterDateTo}" title="Hasta" />
          <button id="clear-filters-btn" class="btn btn-outline" style="white-space: nowrap;">Limpiar</button>
        </div>
      </div>

      <!-- Tabla de Pagos -->
      <div class="card">
        <div class="card-body table-container">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>No. Factura</th>
                <th>Paciente</th>
                <th>Montante Recibido</th>
                <th>Método de Pago</th>
                <th>Referencia</th>
                <th>Fecha y Hora</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody id="payments-table-body">
              <tr>
                <td colspan="8" style="text-align: center; color: var(--text-secondary); padding: var(--space-6);">
                  Cargando pagos...
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="card-footer" style="display: flex; justify-content: space-between; align-items: center; padding: var(--space-4); border-top: 1px solid var(--color-border-light);">
          <div style="color: var(--text-secondary); font-size: var(--text-sm);">
            Página <span id="current-page-text">1</span> de <span id="total-pages-text">1</span>
          </div>
          <div style="display: flex; gap: var(--space-2);">
            <button id="prev-page-btn" class="btn btn-sm btn-outline" disabled>Anterior</button>
            <button id="next-page-btn" class="btn btn-sm btn-outline" disabled>Siguiente</button>
          </div>
        </div>
      </div>
    `;
  }

  renderStatsCards() {
    const container = this.container.querySelector('#stats-cards-container');
    if (!container) return;

    container.innerHTML = `
      <div class="card" style="padding: var(--space-4); background: linear-gradient(135deg, var(--success-50), var(--success-100)); border-left: 4px solid var(--success-500);">
        <p style="color: var(--success-700); font-size: var(--text-sm); font-weight: 600; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px;">Cobrado en Página</p>
        <p style="font-size: var(--text-2xl); font-weight: 700; color: var(--success-800); margin: 0;">${formatCurrency(this.stats.totalCollected)}</p>
      </div>
      <div class="card" style="padding: var(--space-4); background: linear-gradient(135deg, var(--primary-50), var(--primary-100)); border-left: 4px solid var(--primary-500);">
        <p style="color: var(--primary-700); font-size: var(--text-sm); font-weight: 600; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px;">Transacciones</p>
        <p style="font-size: var(--text-2xl); font-weight: 700; color: var(--primary-800); margin: 0;">${this.stats.totalTransactions}</p>
      </div>
      <div class="card" style="padding: var(--space-4); background: linear-gradient(135deg, var(--warning-50), var(--warning-100)); border-left: 4px solid var(--warning-500);">
        <p style="color: var(--warning-700); font-size: var(--text-sm); font-weight: 600; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px;">Métodos Activos</p>
        <p style="font-size: var(--text-2xl); font-weight: 700; color: var(--warning-800); margin: 0;">${this.paymentMethods.length}</p>
      </div>
    `;
  }

  renderTable() {
    const tbody = this.container.querySelector('#payments-table-body');
    const currentPageText = this.container.querySelector('#current-page-text');
    const totalPagesText = this.container.querySelector('#total-pages-text');
    const prevBtn = this.container.querySelector('#prev-page-btn');
    const nextBtn = this.container.querySelector('#next-page-btn');

    if (!tbody) return;

    let rows = this.paymentsList.map(pay => `
      <tr>
        <td><code style="font-weight: 600;">#${pay.id}</code></td>
        <td><strong>${pay.invoice_number || 'N/A'}</strong></td>
        <td>${pay.patient_first_name || ''} ${pay.patient_last_name || ''}</td>
        <td style="color: var(--success-600); font-weight: 700;">${formatCurrency(pay.amount)}</td>
        <td><span class="badge badge-info">${pay.payment_method_name || 'N/A'}</span></td>
        <td>${pay.reference_number || '—'}</td>
        <td>${formatDateTime(pay.payment_date)}</td>
        <td>
          <button class="btn btn-sm btn-danger void-payment-btn" data-id="${pay.id}" data-amount="${pay.amount}" data-invoice="${pay.invoice_number || ''}">Anular</button>
        </td>
      </tr>
    `).join('');

    if (this.paymentsList.length === 0) {
      rows = `
        <tr>
          <td colspan="8" style="text-align: center; color: var(--text-secondary); padding: var(--space-6);">
            No se encontraron registros de pagos.
          </td>
        </tr>
      `;
    }

    tbody.innerHTML = rows;
    if (currentPageText) currentPageText.textContent = this.currentPage;
    if (totalPagesText) totalPagesText.textContent = this.totalPages;
    if (prevBtn) prevBtn.disabled = this.currentPage <= 1;
    if (nextBtn) nextBtn.disabled = this.currentPage >= this.totalPages;
  }

  mount() {
    // Búsqueda con debounce
    const searchInput = this.container.querySelector('#payment-search');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(async () => {
          this.searchQuery = searchInput.value.trim();
          this.currentPage = 1;
          await this.loadPayments();
        }, 350);
      });
    }

    // Filtro por método de pago
    const methodFilter = this.container.querySelector('#payment-method-filter');
    if (methodFilter) {
      methodFilter.addEventListener('change', async () => {
        this.filterMethod = methodFilter.value;
        this.currentPage = 1;
        await this.loadPayments();
      });
    }

    // Filtros de fecha
    const dateFrom = this.container.querySelector('#payment-date-from');
    const dateTo = this.container.querySelector('#payment-date-to');
    if (dateFrom) {
      dateFrom.addEventListener('change', async () => {
        this.filterDateFrom = dateFrom.value;
        this.currentPage = 1;
        await this.loadPayments();
      });
    }
    if (dateTo) {
      dateTo.addEventListener('change', async () => {
        this.filterDateTo = dateTo.value;
        this.currentPage = 1;
        await this.loadPayments();
      });
    }

    // Limpiar filtros
    const clearBtn = this.container.querySelector('#clear-filters-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', async () => {
        this.searchQuery = '';
        this.filterMethod = '';
        this.filterDateFrom = '';
        this.filterDateTo = '';
        this.currentPage = 1;
        if (searchInput) searchInput.value = '';
        if (methodFilter) methodFilter.value = '';
        if (dateFrom) dateFrom.value = '';
        if (dateTo) dateTo.value = '';
        await this.loadPayments();
      });
    }

    // Paginación
    const prevBtn = this.container.querySelector('#prev-page-btn');
    const nextBtn = this.container.querySelector('#next-page-btn');
    if (prevBtn) {
      prevBtn.addEventListener('click', async () => {
        if (this.currentPage > 1) { this.currentPage--; await this.loadPayments(); }
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', async () => {
        if (this.currentPage < this.totalPages) { this.currentPage++; await this.loadPayments(); }
      });
    }

    // Registrar pago
    const registerBtn = this.container.querySelector('#register-payment-btn');
    if (registerBtn) {
      registerBtn.addEventListener('click', () => this.showRegisterPaymentModal());
    }

    // Anular pago (event delegation)
    this.handleVoidClick = (e) => {
      if (e.target.classList.contains('void-payment-btn')) {
        const id = e.target.getAttribute('data-id');
        const amount = e.target.getAttribute('data-amount');
        const invoice = e.target.getAttribute('data-invoice');
        this.showVoidPaymentModal(id, amount, invoice);
      }
    };
    this.container.addEventListener('click', this.handleVoidClick);
  }

  destroy() {
    if (this.handleVoidClick) {
      this.container.removeEventListener('click', this.handleVoidClick);
    }
    clearTimeout(this.searchTimeout);
  }

  /**
   * Modal para registrar un nuevo pago contra una factura pendiente.
   */
  async showRegisterPaymentModal() {
    let invoices = [];
    try {
      // Obtener facturas pendientes o parciales
      const res = await invoiceService.getAll({ limit: 200, status: 'pendiente' });
      const resParcial = await invoiceService.getAll({ limit: 200, status: 'parcial' });
      const pendientes = Array.isArray(res) ? res : (res.data || res.rows || []);
      const parciales = Array.isArray(resParcial) ? resParcial : (resParcial.data || resParcial.rows || []);
      invoices = [...pendientes, ...parciales];
    } catch {
      toast.error('Error al cargar facturas pendientes');
      return;
    }

    const methodOptions = this.paymentMethods
      .map(m => `<option value="${m.id}">${m.name}</option>`)
      .join('');

    const invoiceOptions = invoices.map(inv => {
      const balance = parseFloat(inv.balance || (parseFloat(inv.total) - parseFloat(inv.amount_paid)));
      const patientName = `${inv.patient_first_name || ''} ${inv.patient_last_name || ''}`.trim();
      return `<option value="${inv.id}" data-balance="${balance}" data-total="${inv.total}" data-paid="${inv.amount_paid}">${inv.invoice_number} — ${patientName} — Saldo: ${formatCurrency(balance)}</option>`;
    }).join('');

    const content = `
      <form id="register-payment-form">
        <div class="form-group">
          <label class="form-label">Factura <span style="color: var(--danger-500);">*</span></label>
          <select name="invoice_id" id="payment-invoice-select" class="form-select" required>
            <option value="">Seleccione una factura pendiente...</option>
            ${invoiceOptions}
          </select>
        </div>

        <div id="invoice-detail-box" style="display: none; background: var(--gray-50); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: var(--space-3); margin: var(--space-3) 0;">
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: var(--space-2); text-align: center;">
            <div>
              <p style="font-size: var(--text-xs); color: var(--text-secondary); margin: 0;">Total Factura</p>
              <p id="inv-total" style="font-weight: 700; margin: 2px 0 0 0;">—</p>
            </div>
            <div>
              <p style="font-size: var(--text-xs); color: var(--text-secondary); margin: 0;">Ya Pagado</p>
              <p id="inv-paid" style="font-weight: 700; color: var(--success-600); margin: 2px 0 0 0;">—</p>
            </div>
            <div>
              <p style="font-size: var(--text-xs); color: var(--text-secondary); margin: 0;">Saldo Pendiente</p>
              <p id="inv-balance" style="font-weight: 700; color: var(--danger-600); margin: 2px 0 0 0;">—</p>
            </div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); margin-top: var(--space-3);">
          <div class="form-group">
            <label class="form-label">Montante a Pagar <span style="color: var(--danger-500);">*</span></label>
            <input type="number" name="amount" id="payment-amount-input" class="form-input" step="0.01" min="0.01" placeholder="0.00" required />
          </div>
          <div class="form-group">
            <label class="form-label">Método de Pago <span style="color: var(--danger-500);">*</span></label>
            <select name="payment_method_id" class="form-select" required>
              <option value="">Seleccione...</option>
              ${methodOptions}
            </select>
          </div>
        </div>

        <div class="form-group" style="margin-top: var(--space-3);">
          <label class="form-label">No. Referencia / Comprobante</label>
          <input type="text" name="reference_number" class="form-input" placeholder="Ej: TRX-123456" />
        </div>

        <div class="form-group" style="margin-top: var(--space-3);">
          <label class="form-label">Notas</label>
          <textarea name="notes" class="form-textarea" rows="2" placeholder="Observaciones del pago..."></textarea>
        </div>
      </form>
    `;

    Modal.show({
      title: 'Registrar Nuevo Pago',
      content,
      confirmText: 'Registrar Pago',
      size: 'lg',
      onConfirm: async (modalBody) => {
        const form = modalBody.querySelector('#register-payment-form');
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        // Validaciones
        if (!data.invoice_id) {
          toast.error('Debe seleccionar una factura');
          return false;
        }
        if (!data.payment_method_id) {
          toast.error('Debe seleccionar un método de pago');
          return false;
        }
        const amount = parseFloat(data.amount);
        if (!amount || amount <= 0) {
          toast.error('Ingrese un montante válido mayor a 0');
          return false;
        }

        data.invoice_id = parseInt(data.invoice_id);
        data.payment_method_id = parseInt(data.payment_method_id);
        data.amount = amount;

        try {
          await paymentService.create(data);
          toast.success('Pago registrado exitosamente');
          await this.loadPayments();
          return true;
        } catch (err) {
          toast.error(err.message || 'Error al registrar el pago');
          return false;
        }
      },
    });

    // Mostrar detalle de factura al seleccionar
    const invoiceSelect = document.getElementById('payment-invoice-select');
    const detailBox = document.getElementById('invoice-detail-box');
    const amountInput = document.getElementById('payment-amount-input');

    if (invoiceSelect) {
      invoiceSelect.addEventListener('change', () => {
        const opt = invoiceSelect.options[invoiceSelect.selectedIndex];
        if (opt && opt.value) {
          const total = parseFloat(opt.dataset.total || 0);
          const paid = parseFloat(opt.dataset.paid || 0);
          const balance = parseFloat(opt.dataset.balance || 0);

          document.getElementById('inv-total').textContent = formatCurrency(total);
          document.getElementById('inv-paid').textContent = formatCurrency(paid);
          document.getElementById('inv-balance').textContent = formatCurrency(balance);
          if (detailBox) detailBox.style.display = 'block';
          if (amountInput) {
            amountInput.max = balance;
            amountInput.value = balance.toFixed(2);
          }
        } else {
          if (detailBox) detailBox.style.display = 'none';
          if (amountInput) amountInput.value = '';
        }
      });
    }
  }

  /**
   * Modal de confirmación para anular un pago.
   */
  showVoidPaymentModal(paymentId, amount, invoiceNumber) {
    const content = `
      <div style="text-align: center; padding: var(--space-4);">
        <div style="font-size: 48px; margin-bottom: var(--space-3);">⚠️</div>
        <h3 style="margin-bottom: var(--space-2);">¿Anular este pago?</h3>
        <p style="color: var(--text-secondary); margin-bottom: var(--space-3);">
          Está a punto de anular el pago <strong>#${paymentId}</strong> por <strong style="color: var(--danger-600);">${formatCurrency(amount)}</strong>
          ${invoiceNumber ? ` de la factura <strong>${invoiceNumber}</strong>` : ''}.
        </p>
        <div style="background: var(--danger-50); border: 1px solid var(--danger-200); border-radius: var(--radius-md); padding: var(--space-3); text-align: left;">
          <p style="color: var(--danger-800); font-weight: 600; margin: 0 0 4px 0;">⚠ Esta acción:</p>
          <ul style="color: var(--danger-700); margin: 0; padding-left: var(--space-4); font-size: var(--text-sm);">
            <li>Eliminará el registro de pago</li>
            <li>Restaurará el saldo pendiente en la factura asociada</li>
            <li>Actualizará el balance del paciente</li>
          </ul>
        </div>
      </div>
    `;

    Modal.show({
      title: 'Confirmar Anulación de Pago',
      content,
      confirmText: 'Sí, Anular Pago',
      cancelText: 'Cancelar',
      onConfirm: async () => {
        try {
          await paymentService.remove(paymentId);
          toast.success('Pago anulado exitosamente. Saldo de factura restaurado.');
          await this.loadPayments();
          return true;
        } catch (err) {
          toast.error(err.message || 'Error al anular el pago');
          return false;
        }
      },
    });
  }
}
