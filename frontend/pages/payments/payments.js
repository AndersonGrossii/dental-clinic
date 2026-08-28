// ============================================
// Vista del Dashboard de Pagos
// ============================================
import paymentService from '../../services/payment.service.js';
import invoiceService from '../../services/invoice.service.js';
import patientService from '../../services/patient.service.js';
import treatmentService from '../../services/treatment.service.js';
import quotationService from '../../services/quotation.service.js';
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
      this.currentPage = response.pagination?.currentPage || 1;

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
      .map(m => `<option value="${m.id}" ${this.filterMethod == m.id ? 'selected' : ''}>${m.label}</option>`)
      .join('');

    this.container.innerHTML = `
      <div class="page-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4);">
        <div>
          <h1 class="page-title">Gestión de Pagos</h1>
          <p style="color: var(--text-secondary);">Historial y registro de transacciones. Los cobros se realizan directamente desde presupuestos/facturas.</p>
        </div>
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
        <td style="color: var(--success-600); font-weight: 700;">${formatCurrency(pay.amount)}${parseFloat(pay.credit_used || 0) > 0 ? `<br><span class="badge badge-success" style="font-size: 10px;">Saldo a favor: ${formatCurrency(pay.credit_used)}</span>` : ''}</td>
        <td><span class="badge badge-info">${pay.payment_method_name || 'N/A'}</span></td>
        <td>${pay.reference_number || '—'}</td>
        <td>${formatDateTime(pay.payment_date)}</td>
        <td>
          <button class="btn btn-sm btn-danger void-payment-btn" data-id="${pay.id}" data-amount="${pay.amount}" data-invoice="${pay.invoice_number || ''}" title="Cancelar este pago y restaurar el saldo">🚫 Cancelar Pago</button>
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

    // Anular/Cancelar pago (event delegation)
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
  /**
   * Modal para registrar un pago (cargando factura existente o creando factura de cero).
   */
  async showRegisterPaymentModal() {
    let invoices = [];
    let patients = [];
    let treatments = [];

    try {
      const [resPend, resParc, resPats, resTreats] = await Promise.all([
        invoiceService.getAll({ limit: 200, status: 'pendiente' }),
        invoiceService.getAll({ limit: 200, status: 'parcial' }),
        patientService.getAll({ limit: 300 }),
        treatmentService.getAll({ limit: 200 }).catch(() => [])
      ]);

      const pendientes = Array.isArray(resPend) ? resPend : (resPend.data || resPend.rows || []);
      const parciales = Array.isArray(resParc) ? resParc : (resParc.data || resParc.rows || []);
      invoices = [...pendientes, ...parciales];
      patients = Array.isArray(resPats) ? resPats : (resPats.data || resPats.rows || []);
      treatments = Array.isArray(resTreats) ? resTreats : (resTreats.data || resTreats.rows || []);
    } catch {
      toast.error('Error al cargar datos requeridos para registrar el pago');
      return;
    }

    const methodOptions = this.paymentMethods
      .map(m => `<option value="${m.id}">${m.label}</option>`)
      .join('');

    const invoiceOptions = invoices.map(inv => {
      const balance = parseFloat(inv.balance || (parseFloat(inv.total) - parseFloat(inv.amount_paid)));
      const patientName = `${inv.patient_first_name || ''} ${inv.patient_last_name || ''}`.trim();
      const docTypeLabel = inv.document_type === 'recibo' ? '🧾 Recibo' : '📄 Factura';
      return `<option value="${inv.id}" data-balance="${balance}" data-total="${inv.total}" data-paid="${inv.amount_paid}" data-patient="${inv.patient_id || ''}">${docTypeLabel} ${inv.invoice_number} — ${patientName} — Saldo: ${formatCurrency(balance)}</option>`;
    }).join('');

    const patientOptions = patients.map(p => {
      const customId = p.custom_id ? `[${p.custom_id}] ` : '';
      return `<option value="${p.id}">${customId}${p.first_name} ${p.last_name}</option>`;
    }).join('');

    const treatmentOptions = treatments.map(t => {
      const priceVal = parseFloat(t.default_price ?? t.price ?? 0);
      return `<option value="${t.id}" data-price="${priceVal}" data-name="${t.name}">${t.name} (${formatCurrency(priceVal)})</option>`;
    }).join('');

    const todayStr = new Date().toISOString().split('T')[0];

    const content = `
      <div style="margin-bottom: var(--space-4);">
        <div style="display: flex; gap: 8px; background: var(--gray-100); padding: 4px; border-radius: var(--radius-md);">
          <button type="button" id="tab-mode-existing" class="btn btn-sm btn-primary" style="flex: 1; border-radius: var(--radius-sm);">📄 Comprobante Existente</button>
          <button type="button" id="tab-mode-new" class="btn btn-sm btn-ghost" style="flex: 1; border-radius: var(--radius-sm);">✨ Generar Comprobante y Cobrar</button>
        </div>
      </div>

      <form id="register-payment-form">
        <input type="hidden" id="payment-mode-input" name="payment_mode" value="existing" />

        <!-- MODO A: COMPROBANTE EXISTENTE -->
        <div id="mode-existing-section" style="background: #fff; padding: var(--space-3); border: 1px solid var(--border-color); border-radius: var(--radius-md); margin-bottom: var(--space-4);">
          <div class="form-group">
            <label class="form-label">Seleccionar Factura / Recibo Pendiente <span style="color: var(--danger-500);">*</span></label>
            <select name="invoice_id" id="payment-invoice-select" class="form-select">
              <option value="">-- Buscar por No. de Comprobante o Paciente --</option>
              ${invoiceOptions}
            </select>
          </div>

          <div id="invoice-detail-box" style="display: none; background: var(--primary-50, #f0fdf4); border: 1px solid var(--primary-200, #bbf7d0); border-radius: var(--radius-md); padding: var(--space-3); margin-top: var(--space-3);">
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: var(--space-2); text-align: center;">
              <div>
                <p style="font-size: var(--text-xs); color: var(--text-secondary); margin: 0;">Total Comprobante</p>
                <p id="inv-total" style="font-weight: 700; margin: 2px 0 0 0; font-size: var(--text-sm);">—</p>
              </div>
              <div>
                <p style="font-size: var(--text-xs); color: var(--text-secondary); margin: 0;">Ya Pagado</p>
                <p id="inv-paid" style="font-weight: 700; color: var(--success-600); margin: 2px 0 0 0; font-size: var(--text-sm);">—</p>
              </div>
              <div>
                <p style="font-size: var(--text-xs); color: var(--text-secondary); margin: 0;">Saldo Pendiente</p>
                <p id="inv-balance" style="font-weight: 700; color: var(--danger-600); margin: 2px 0 0 0; font-size: var(--text-md);">—</p>
              </div>
            </div>
          </div>
        </div>

        <!-- MODO B: GENERAR COMPROBANTE DE CERO -->
        <div id="mode-new-section" style="display: none; background: #fff; padding: var(--space-3); border: 1px solid var(--border-color); border-radius: var(--radius-md); margin-bottom: var(--space-4);">
          <div class="form-group" style="margin-bottom: var(--space-3);">
            <label class="form-label" style="font-weight: 600;">Tipo de Comprobante a Generar</label>
            <div style="display: flex; gap: 16px; margin-top: 6px;">
              <label style="cursor: pointer; display: flex; align-items: center; gap: 6px; font-weight: 500;">
                <input type="radio" name="document_type" value="recibo" checked style="transform: scale(1.2);" />
                🧾 Recibo de Pago (REC)
              </label>
              <label style="cursor: pointer; display: flex; align-items: center; gap: 6px; font-weight: 500;">
                <input type="radio" name="document_type" value="factura" style="transform: scale(1.2);" />
                📄 Factura Oficial (FAC)
              </label>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Paciente <span style="color: var(--danger-500);">*</span></label>
            <select name="new_patient_id" id="new-invoice-patient-select" class="form-select" disabled>
              <option value="">-- Seleccionar Paciente --</option>
              ${patientOptions}
            </select>
          </div>

          <!-- Contenedor para Tratamientos Pendientes del Historial del Paciente -->
          <div id="patient-pending-treatments-box" style="display: none; margin-top: var(--space-3); background: var(--gray-50); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
            <div style="font-weight: 600; font-size: 13px; margin-bottom: 6px; color: var(--primary-800);">
              🦷 Tratamientos Pendientes en Historial Odontológico:
            </div>
            <div id="pending-treatments-list" style="display: flex; flex-direction: column; gap: 6px;">
              <span style="font-size: 12px; color: var(--text-secondary);">Seleccione un paciente para ver sus tratamientos pendientes...</span>
            </div>
          </div>

          <div style="margin-top: var(--space-3);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-2);">
              <label class="form-label" style="margin: 0; font-weight: 600; color: var(--primary-800);">Agregar Nuevos Tratamientos / Conceptos</label>
              <button type="button" id="add-concept-row-btn" class="btn btn-sm btn-primary" style="display: inline-flex; align-items: center; gap: 6px; font-weight: 600; padding: 6px 14px; border-radius: var(--radius-md); font-size: 13px; box-shadow: var(--shadow-sm);">
                <span style="font-size: 14px;">➕</span> Agregar Concepto
              </button>
            </div>

            <div id="new-invoice-items-container" style="display: flex; flex-direction: column; gap: 8px;">
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr; gap: 12px; margin-top: var(--space-3);">
            <div class="form-group">
              <label class="form-label">Descuento ($)</label>
              <input type="number" id="payment-modal-disc-amt" name="discount_amount" class="form-input" value="0" min="0" step="0.5" />
            </div>
          </div>

          <div style="display: flex; justify-content: flex-end; margin-top: var(--space-3); padding-top: 8px; border-top: 1px dashed var(--border-color);">
            <div style="text-align: right;">
              <span style="font-size: var(--text-xs); color: var(--text-secondary);">Total a Generar: </span>
              <strong id="new-invoice-total-display" style="font-size: var(--text-lg); color: var(--primary-700);">$0.00</strong>
            </div>
          </div>
        </div>

        <!-- SECCIÓN COMÚN: DETALLES DEL PAGO -->
        <div style="background: var(--gray-50); padding: var(--space-3); border: 1px solid var(--border-color); border-radius: var(--radius-md);">
          <h4 style="margin: 0 0 var(--space-3) 0; font-size: var(--text-sm); color: var(--text-primary); border-bottom: 1px solid var(--border-color); padding-bottom: 6px;">
            💳 Detalles del Pago a Registrar
          </h4>

          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: var(--space-3);">
            <div class="form-group">
              <label class="form-label">Fecha del Pago <span style="color: var(--danger-500);">*</span></label>
              <input type="date" name="payment_date" class="form-input" value="${todayStr}" required />
            </div>
            <div class="form-group">
              <label class="form-label">Monto a Pagar ($) <span style="color: var(--danger-500);">*</span></label>
              <input type="number" name="amount" id="payment-amount-input" class="form-input" step="0.01" min="0" placeholder="0.00" />
            </div>
            <div class="form-group">
              <label class="form-label">Método de Pago <span style="color: var(--danger-500);">*</span></label>
              <select name="payment_method_id" class="form-select" required>
                <option value="">Seleccione...</option>
                ${methodOptions}
              </select>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); margin-top: var(--space-3);">
            <div class="form-group">
              <label class="form-label">No. Referencia / Comprobante</label>
              <input type="text" name="reference_number" class="form-input" placeholder="Ej: TRX-123456" />
            </div>
            <div class="form-group">
              <label class="form-label">Notas / Observaciones</label>
              <input type="text" name="notes" class="form-input" placeholder="Observaciones del pago..." />
            </div>
          </div>

          <div id="patient-credit-row" style="margin-top: var(--space-3); background: var(--success-50, #f0fdf4); border: 1px solid var(--success-300, #86efac); border-radius: var(--radius-md); padding: var(--space-3); display: none;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-2);">
              <strong style="color: var(--success-800);">🏦 Saldo a Favor del Paciente</strong>
              <span id="credit-available-label" style="font-size: var(--text-sm); color: var(--success-700); font-weight: 600;">Disponible: $0.00</span>
            </div>
            <div style="display: flex; align-items: center; gap: var(--space-2);">
              <label class="form-label" style="margin: 0; white-space: nowrap; font-size: var(--text-sm);">Aplicar saldo al pago:</label>
              <input type="number" id="credit-used-input" name="credit_used" class="form-input" step="0.01" min="0" value="0" style="width: 160px;" />
              <span style="font-size: var(--text-xs); color: var(--text-secondary);">Reduce el efectivo a recibir.</span>
            </div>
          </div>
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
        const mode = modalBody.querySelector('#payment-mode-input').value;
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        if (!data.payment_method_id) {
          toast.error('Debe seleccionar un método de pago');
          return false;
        }
        const amount = parseFloat(data.amount);
        const creditUsed = parseFloat(data.credit_used || 0);
        if ((!amount || amount < 0) && (!creditUsed || creditUsed <= 0)) {
          toast.error('Ingrese un monto y/o saldo a favor válido');
          return false;
        }
        data.payment_method_id = parseInt(data.payment_method_id);
        data.amount = amount;
        data.credit_used = creditUsed || 0;

        if (mode === 'existing') {
          if (!data.invoice_id) {
            toast.error('Debe seleccionar un comprobante pendiente');
            return false;
          }
          data.invoice_id = parseInt(data.invoice_id);

          try {
            await paymentService.create(data);
            toast.success('Pago registrado exitosamente');
            await this.loadPayments();
            return true;
          } catch (err) {
            toast.error(err.message || 'Error al registrar el pago');
            return false;
          }
        } else {
          // MODO GENERAR COMPROBANTE Y VINCULAR TRATAMIENTO
          const patientSelect = modalBody.querySelector('#new-invoice-patient-select');
          const patientId = parseInt(patientSelect?.value || 0);
          if (!patientId) {
            toast.error('Debe seleccionar un paciente');
            return false;
          }

          // Gather checked pending treatments from history
          const checkedTreatChks = modalBody.querySelectorAll('.pay-treat-chk:checked');
          const treatmentIds = Array.from(checkedTreatChks).map(chk => parseInt(chk.value, 10));

          // Gather checked accepted quotation items
          const checkedAcceptedChks = modalBody.querySelectorAll('.pay-accepted-quote-chk:checked');
          for (const chk of checkedAcceptedChks) {
            const itemId = parseInt(chk.value, 10);
            try {
              const execRes = await quotationService.updateExecutionStatus(itemId, 'realizado');
              if (execRes?.patient_treatment_id) {
                treatmentIds.push(execRes.patient_treatment_id);
              }
            } catch (err) {
              console.error('Error updating quote item execution status:', err);
            }
          }

          // Also check newly added concept cards
          const itemCards = modalBody.querySelectorAll('#new-invoice-items-container .concept-item-card');
          for (const card of itemCards) {
            const treatSelect = card.querySelector('.item-treatment-select');
            const treatId = parseInt(treatSelect?.value || 0);
            const price = parseFloat(card.querySelector('.item-price-input')?.value || 0);

            if (treatId && price > 0) {
              // Create treatment debit for patient
              const newPt = await treatmentService.addPatientTreatment({
                patient_id: patientId,
                treatment_id: treatId,
                price,
                status: 'pendiente',
                notes: card.querySelector('.item-desc-input')?.value?.trim() || null,
              });
              if (newPt?.id) {
                treatmentIds.push(newPt.id);
              }
            }
          }

          if (treatmentIds.length === 0) {
            toast.error('Debe seleccionar o agregar al menos un tratamiento para cobro');
            return false;
          }

          try {
            const documentType = formData.get('document_type') || 'recibo';
            const discountAmount = parseFloat(formData.get('discount_amount') || 0);

            const res = await paymentService.processTreatmentPayment({
              patient_id: patientId,
              treatment_ids: treatmentIds,
              document_type: documentType,
              payment_method_id: data.payment_method_id,
              amount: data.amount,
              credit_used: data.credit_used,
              tax_rate: 0,
              discount_amount: discountAmount,
              reference_number: data.reference_number || null,
              notes: data.notes || null,
            });

            const docNum = res?.document?.invoice_number || '';
            const docTypeName = documentType === 'recibo' ? 'Recibo' : 'Factura';
            toast.success(`¡${docTypeName} #${docNum} generado y pago vinculado en el Historial Odontológico del paciente!`);
            await this.loadPayments();
            return true;
          } catch (err) {
            toast.error(err.message || 'Error al generar comprobante y registrar el pago');
            return false;
          }
        }
      },
    });

    // LÓGICA DE INTERACCIÓN EN EL MODAL
    const tabExisting = document.getElementById('tab-mode-existing');
    const tabNew = document.getElementById('tab-mode-new');
    const modeInput = document.getElementById('payment-mode-input');
    const sectionExisting = document.getElementById('mode-existing-section');
    const sectionNew = document.getElementById('mode-new-section');

    const invoiceSelect = document.getElementById('payment-invoice-select');
    const patientSelect = document.getElementById('new-invoice-patient-select');
    const detailBox = document.getElementById('invoice-detail-box');
    const amountInput = document.getElementById('payment-amount-input');
    const itemsContainer = document.getElementById('new-invoice-items-container');
    const totalDisplay = document.getElementById('new-invoice-total-display');

    const creditRow = document.getElementById('patient-credit-row');
    const creditAvailableLabel = document.getElementById('credit-available-label');
    const creditUsedInput = document.getElementById('credit-used-input');

    // Carga el saldo a favor del paciente y muestra la fila para aplicarlo
    const loadPatientCredit = async (patientId) => {
      if (!creditRow || !creditAvailableLabel || !creditUsedInput) return;
      if (!patientId) {
        creditRow.style.display = 'none';
        return;
      }
      try {
        const res = await patientService.getCredit(patientId);
        const data = Array.isArray(res) ? res[0] : res;
        const balance = parseFloat(data?.balance || 0);
        creditAvailableLabel.textContent = `Disponible: ${formatCurrency(balance)}`;
        creditUsedInput.max = balance > 0 ? balance : 0;
        creditUsedInput.value = 0;
        creditRow.style.display = balance > 0 ? 'block' : 'none';
      } catch {
        creditRow.style.display = 'none';
      }
    };

    // Cambio de Pestañas con Aislamiento Estricto
    if (tabExisting && tabNew) {
      tabExisting.addEventListener('click', () => {
        tabExisting.className = 'btn btn-sm btn-primary';
        tabNew.className = 'btn btn-sm btn-ghost';
        modeInput.value = 'existing';
        sectionExisting.style.display = 'block';
        sectionNew.style.display = 'none';

        if (invoiceSelect) invoiceSelect.disabled = false;
        if (patientSelect) patientSelect.disabled = true;
      });

      tabNew.addEventListener('click', () => {
        tabNew.className = 'btn btn-sm btn-primary';
        tabExisting.className = 'btn btn-sm btn-ghost';
        modeInput.value = 'new';
        sectionExisting.style.display = 'none';
        sectionNew.style.display = 'block';

        if (invoiceSelect) invoiceSelect.disabled = true;
        if (patientSelect) patientSelect.disabled = false;

        recalcNewInvoiceTotal();
      });
    }

    // Modo A: Detalle de factura seleccionada
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
          if (amountInput && modeInput.value === 'existing') {
            amountInput.value = balance.toFixed(2);
          }
          loadPatientCredit(opt.dataset.patient || '');
        } else {
          if (detailBox) detailBox.style.display = 'none';
          if (amountInput && modeInput.value === 'existing') amountInput.value = '';
          loadPatientCredit('');
        }
      });
    }

    const pendingTreatmentsBox = document.getElementById('patient-pending-treatments-box');
    const pendingTreatmentsList = document.getElementById('pending-treatments-list');
    const taxRateInput = document.getElementById('payment-modal-tax-rate');
    const discAmtInput = document.getElementById('payment-modal-disc-amt');

    // Modo B: Cálculo de Totales y Manejo de Tarjetas de Concepto
    const recalcNewInvoiceTotal = () => {
      let sum = 0;

      // Sum checked pending treatments (from history & accepted quotes)
      if (pendingTreatmentsList) {
        pendingTreatmentsList.querySelectorAll('.pay-treat-chk:checked, .pay-accepted-quote-chk:checked').forEach(chk => {
          sum += parseFloat(chk.getAttribute('data-price') || 0);
        });
      }

      // Sum concept cards
      if (itemsContainer) {
        itemsContainer.querySelectorAll('.concept-item-card').forEach(card => {
          const qty = parseFloat(card.querySelector('.item-qty-input')?.value || 0);
          const price = parseFloat(card.querySelector('.item-price-input')?.value || 0);
          const subtotal = qty * price;
          const subtotalSpan = card.querySelector('.item-subtotal-span');
          if (subtotalSpan) subtotalSpan.textContent = formatCurrency(subtotal);
          sum += subtotal;
        });
      }

      const da = parseFloat(discAmtInput?.value || 0);
      const totalAfterDiscount = Math.max(0, parseFloat((sum - da).toFixed(2)));

      if (totalDisplay) totalDisplay.textContent = formatCurrency(totalAfterDiscount);
      if (modeInput.value === 'new' && amountInput) {
        amountInput.value = totalAfterDiscount.toFixed(2);
      }
    };
    if (discAmtInput) discAmtInput.addEventListener('input', recalcNewInvoiceTotal);

    if (patientSelect) {
      patientSelect.addEventListener('change', async () => {
        const patientId = patientSelect.value;
        if (!patientId) {
          if (pendingTreatmentsBox) pendingTreatmentsBox.style.display = 'none';
          loadPatientCredit('');
          return;
        }

        try {
          const [ptList, acceptedRes] = await Promise.all([
            treatmentService.getPatientTreatments(patientId).catch(() => []),
            quotationService.getAcceptedItemsByPatient(patientId).catch(() => []),
          ]);

          const unpaidHistory = (ptList || []).filter(t => !t.invoice_id || t.invoice_status !== 'pagada');
          const acceptedQuotes = (Array.isArray(acceptedRes) ? acceptedRes : (acceptedRes?.data || [])).filter(q => q.execution_status !== 'realizado');

          let itemsHtml = '';

          if (unpaidHistory.length > 0) {
            itemsHtml += unpaidHistory.map(t => {
              const pendingPrice = (t.invoice_id && t.invoice_balance !== undefined && t.invoice_balance !== null)
                ? parseFloat(t.invoice_balance)
                : parseFloat(t.price || 0);
              return `
                <label style="display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; background: #fff; border-radius: var(--radius-sm); border: 1px solid var(--border-color); cursor: pointer; font-size: 13px;">
                  <span style="display: flex; align-items: center; gap: 8px;">
                    <input type="checkbox" class="pay-treat-chk" value="${t.id}" data-price="${pendingPrice}" style="transform: scale(1.1); cursor: pointer;" />
                    <strong>${t.treatment_name}</strong> ${t.tooth_number ? `(Pieza #${t.tooth_number})` : ''} ${t.invoice_id ? `<span class="badge badge-warning" style="font-size: 10px;">Saldo Restante: ${formatCurrency(pendingPrice)}</span>` : ''}
                  </span>
                  <span style="color: var(--primary-700); font-weight: 600;">${formatCurrency(pendingPrice)}</span>
                </label>
              `;
            }).join('');
          }

          if (acceptedQuotes.length > 0) {
            itemsHtml += acceptedQuotes.map(q => `
              <label style="display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; background: var(--success-50, #f0fdf4); border-radius: var(--radius-sm); border: 1px solid var(--success-300, #86efac); cursor: pointer; font-size: 13px;">
                <span style="display: flex; align-items: center; gap: 8px;">
                  <input type="checkbox" class="pay-accepted-quote-chk" value="${q.id}" data-price="${q.total}" style="transform: scale(1.1); cursor: pointer;" />
                  <span><span class="badge badge-success" style="font-size: 10px; margin-right: 4px;">Presupuesto #${q.quote_number}</span> <strong>${q.treatment_name || q.catalog_treatment_name || 'Tratamiento'}</strong> ${q.tooth_number ? `(Pieza #${q.tooth_number})` : ''}</span>
                </span>
                <span style="color: var(--success-700); font-weight: 600;">${formatCurrency(q.total)}</span>
              </label>
            `).join('');
          }

          if (!itemsHtml) {
            itemsHtml = `<span style="font-size: 12px; color: var(--text-secondary);">El paciente no tiene tratamientos pendientes. Puede agregar un nuevo concepto abajo.</span>`;
          }

          pendingTreatmentsList.innerHTML = itemsHtml;
          pendingTreatmentsBox.style.display = 'block';

          pendingTreatmentsList.querySelectorAll('.pay-treat-chk, .pay-accepted-quote-chk').forEach(chk => {
            chk.addEventListener('change', recalcNewInvoiceTotal);
          });

          recalcNewInvoiceTotal();
          loadPatientCredit(patientId);
        } catch {
          if (pendingTreatmentsBox) pendingTreatmentsBox.style.display = 'none';
          loadPatientCredit('');
        }
      });
    }

    const createConceptCard = (initialDesc = '', initialPrice = 0) => {
      const card = document.createElement('div');
      card.className = 'concept-item-card';
      card.style.background = '#fff';
      card.style.border = '1px solid var(--border-color)';
      card.style.borderRadius = 'var(--radius-sm)';
      card.style.padding = 'var(--space-2)';
      card.style.display = 'flex';
      card.style.flexDirection = 'column';
      card.style.gap = '6px';

      card.innerHTML = `
        <div style="display: flex; gap: 6px; align-items: center;">
          <select class="form-select item-treatment-select" style="font-size: 12px; padding: 4px; flex: 1;">
            <option value="">-- Tratamiento del catálogo (opcional) --</option>
            ${treatmentOptions}
          </select>
          <button type="button" class="btn btn-xs btn-outline remove-row-btn" style="color: var(--danger-600); border-color: var(--danger-300); padding: 2px 6px;">✕</button>
        </div>
        <div>
          <input type="text" class="form-input item-desc-input" placeholder="Descripción del concepto o servicio..." value="${initialDesc}" style="font-size: 12px; padding: 4px;" required />
        </div>
        <div style="display: flex; gap: 8px; align-items: center;">
          <div style="flex: 1;">
            <label style="font-size: 10px; color: var(--text-secondary); display: block;">Cant.</label>
            <input type="number" class="form-input item-qty-input" value="1" min="1" style="font-size: 12px; padding: 4px;" required />
          </div>
          <div style="flex: 1.5;">
            <label style="font-size: 10px; color: var(--text-secondary); display: block;">Precio (€)</label>
            <input type="number" step="0.01" class="form-input item-price-input" value="${initialPrice}" min="0" style="font-size: 12px; padding: 4px;" required />
          </div>
          <div style="flex: 1.5; text-align: right;">
            <label style="font-size: 10px; color: var(--text-secondary); display: block;">Subtotal</label>
            <strong class="item-subtotal-span" style="font-size: 12px; color: var(--primary-700);">€0.00</strong>
          </div>
        </div>
      `;

      const treatSelect = card.querySelector('.item-treatment-select');
      const descInput = card.querySelector('.item-desc-input');
      const priceInput = card.querySelector('.item-price-input');
      const qtyInput = card.querySelector('.item-qty-input');
      const removeBtn = card.querySelector('.remove-row-btn');

      if (treatSelect) {
        treatSelect.addEventListener('change', () => {
          const opt = treatSelect.options[treatSelect.selectedIndex];
          if (opt && opt.value) {
            if (descInput) descInput.value = opt.dataset.name || '';
            if (priceInput) priceInput.value = parseFloat(opt.dataset.price || 0).toFixed(2);
            recalcNewInvoiceTotal();
          }
        });
      }

      if (qtyInput) qtyInput.addEventListener('input', recalcNewInvoiceTotal);
      if (priceInput) priceInput.addEventListener('input', recalcNewInvoiceTotal);
      if (removeBtn) {
        removeBtn.addEventListener('click', () => {
          card.remove();
          recalcNewInvoiceTotal();
        });
      }

      return card;
    };

    const addRowBtn = document.getElementById('add-concept-row-btn');
    if (addRowBtn && itemsContainer) {
      addRowBtn.addEventListener('click', () => {
        itemsContainer.appendChild(createConceptCard('', 0));
        recalcNewInvoiceTotal();
      });
      // Card inicial por defecto
      itemsContainer.appendChild(createConceptCard('', 0));
      recalcNewInvoiceTotal();
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
