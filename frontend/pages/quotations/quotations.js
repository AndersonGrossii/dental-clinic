// ============================================
// Vista de Gestión de Presupuestos (Cotizaciones)
// ============================================
import quotationService from '../../services/quotation.service.js';
import invoiceService from '../../services/invoice.service.js';
import paymentService from '../../services/payment.service.js';
import patientService from '../../services/patient.service.js';
import treatmentService from '../../services/treatment.service.js';
import doctorService from '../../services/doctor.service.js';
import toast from '../../components/toast/toast.js';
import Modal from '../../components/modal/modal.js';
import state from '../../scripts/state.js';
import { formatDate, formatCurrency } from '../../utils/helpers.js';

const STATUS_LABELS = {
  borrador: 'Borrador',
  enviada: 'Enviada',
  parcial: 'Aceptado Parcial',
  aceptada: 'Aceptado Completo',
  rechazada: 'Rechazada',
  expirada: 'Expirada',
};

const STATUS_BADGES = {
  borrador: 'badge-secondary',
  enviada: 'badge-info',
  parcial: 'badge-warning',
  aceptada: 'badge-success',
  rechazada: 'badge-danger',
  expirada: 'badge-warning',
};

const STATUS_OPTIONS = [
  { value: 'borrador', label: 'Borrador' },
  { value: 'enviada', label: 'Enviada' },
  { value: 'parcial', label: 'Aceptado Parcial' },
  { value: 'aceptada', label: 'Aceptado Completo' },
  { value: 'rechazada', label: 'Rechazada' },
  { value: 'expirada', label: 'Expirada' },
];

export class Quotations {
  constructor(container) {
    this.container = container;
    this.quotationsList = [];
    this.searchQuery = '';
    this.statusFilter = '';
    this.currentPage = 1;
    this.itemsPerPage = 15;
    this.abortController = null;
  }

  destroy() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  async render() {
    try {
      const response = await quotationService.getAll({ limit: 500 });
      this.quotationsList = Array.isArray(response) ? response : (response.rows || []);
      this.renderLayout();
      this.renderView();
    } catch (err) {
      toast.error('Error al cargar presupuestos');
    }
  }

  renderLayout() {
    this.container.innerHTML = `
      <div class="page-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-6);">
        <div>
          <h1 class="page-title">Presupuestos</h1>
          <p style="color: var(--text-secondary);">Cotización de tratamientos para pacientes</p>
        </div>
        <button id="add-quote-btn" class="btn btn-primary">+ Nuevo Presupuesto</button>
      </div>

      <div class="card" style="margin-bottom: var(--space-4); padding: var(--space-4);">
        <div style="display: flex; gap: var(--space-3); flex-wrap: wrap;">
          <input type="text" id="quote-search" class="form-input" placeholder="Buscar por Paciente o Doctor..." style="flex: 1; min-width: 200px;" value="${this.searchQuery}" />
          <select id="quote-filter-status" class="form-select" style="width: auto; min-width: 150px;">
            <option value="">Todos los estados</option>
            <option value="borrador" ${this.statusFilter === 'borrador' ? 'selected' : ''}>Borrador</option>
            <option value="enviada" ${this.statusFilter === 'enviada' ? 'selected' : ''}>Enviada</option>
            <option value="parcial" ${this.statusFilter === 'parcial' ? 'selected' : ''}>Aceptado Parcial</option>
            <option value="aceptada" ${this.statusFilter === 'aceptada' ? 'selected' : ''}>Aceptado Completo</option>
            <option value="rechazada" ${this.statusFilter === 'rechazada' ? 'selected' : ''}>Rechazada</option>
            <option value="expirada" ${this.statusFilter === 'expirada' ? 'selected' : ''}>Expirada</option>
          </select>
        </div>
      </div>

      <div class="card">
        <div class="card-body table-container">
          <table>
            <thead>
              <tr>
                <th>No. Presupuesto</th>
                <th>Paciente</th>
                <th>Doctor</th>
                <th>Monto Total</th>
                <th>Estado</th>
                <th>Fecha de Creación</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody id="quotations-table-body">
              <tr>
                <td colspan="7" style="text-align: center; color: var(--text-secondary); padding: var(--space-6);">Cargando presupuestos...</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div id="pagination-controls" style="padding: var(--space-4); display: flex; justify-content: center; align-items: center; gap: var(--space-2); border-top: 1px solid var(--border-color);">
        </div>
      </div>
    `;
  }

  renderView() {
    const tbody = this.container.querySelector('#quotations-table-body');
    if (!tbody) return;

    const query = (this.searchQuery || '').toLowerCase().trim();
    const filtered = this.quotationsList.filter(q => {
      const matchesSearch = !query || 
        (q.patient_name || '').toLowerCase().includes(query) ||
        (q.doctor_name || '').toLowerCase().includes(query) ||
        (q.quote_number || '').toLowerCase().includes(query);
      const matchesStatus = !this.statusFilter || q.status === this.statusFilter;
      return matchesSearch && matchesStatus;
    });

    const totalPages = Math.ceil(filtered.length / this.itemsPerPage) || 1;
    if (this.currentPage > totalPages) {
      this.currentPage = totalPages;
    }

    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const paginatedItems = filtered.slice(startIndex, startIndex + this.itemsPerPage);

    let rows = paginatedItems.map(q => `
      <tr class="clickable-table-row quote-main-row" data-id="${q.id}">
        <td><strong># ${q.quote_number}</strong></td>
        <td>${q.patient_name || '—'}</td>
        <td>${q.doctor_name || 'Sin asignar'}</td>
        <td><strong>${formatCurrency(q.total)}</strong></td>
        <td>
          <span class="badge ${STATUS_BADGES[q.status] || 'badge-secondary'}">${STATUS_LABELS[q.status] || q.status}</span>
          ${q.payment_status === 'pagado'
            ? `<span class="badge" style="background-color: var(--success-100); color: var(--success-800); font-size: 11px; margin-left: 4px; padding: 2px 6px;">🟢 100% Pagado</span>`
            : (q.payment_status === 'parcial'
              ? `<span class="badge" style="background-color: var(--warning-100); color: var(--warning-800); font-size: 11px; margin-left: 4px; padding: 2px 6px;">🟠 Pagado: ${formatCurrency(q.amount_paid)}</span>`
              : '')}
        </td>
        <td>${formatDate(q.created_at)}</td>
        <td style="text-align: right;">
          <button type="button" class="btn btn-sm btn-outline toggle-quote-actions-btn" data-id="${q.id}">
            Acciones ▾
          </button>
        </td>
      </tr>
      <tr class="quote-actions-bar-row" id="quote-actions-${q.id}" style="display: none; background: var(--gray-50);">
        <td colspan="7" style="padding: 12px 16px; border-bottom: 2px solid var(--primary-400);">
          <div style="display: flex; gap: var(--space-3); align-items: center; justify-content: space-between; flex-wrap: wrap;">
            <div style="font-size: 13px; font-weight: 600; color: var(--text-primary);">
              ⚙️ Opciones para Presupuesto #${q.quote_number}:
            </div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <button class="btn btn-sm btn-outline view-quote-btn" data-id="${q.id}" title="Ver / Imprimir Cotización">👁 Ver / Imprimir</button>
              ${(q.is_closed || q.payment_status === 'pagado') ? `
                <span class="badge badge-success" style="font-size: 12px; padding: 6px 12px;">🔒 Presupuesto Bloqueado (Cobrado 100%)</span>
              ` : `
                <button class="btn btn-sm btn-manage-quote manage-items-btn" data-id="${q.id}" title="Gestionar Aceptación e Ítems">⚙️ Gestionar Ítems</button>
                <button class="btn btn-sm btn-warning change-status-btn" data-id="${q.id}" title="Cambiar Estado del Presupuesto">🏷️ Cambiar Estado</button>
                ${(q.status === 'aceptada' || q.status === 'parcial') && (q.remaining_balance === undefined || q.remaining_balance > 0) ? `
                  <button class="btn btn-sm btn-success pay-quote-btn" data-id="${q.id}" title="Registrar Pago de Presupuesto">💳 Registrar Pago</button>
                ` : ''}
                <button class="btn btn-sm btn-primary edit-quote-btn" data-id="${q.id}" title="Editar Presupuesto">✎ Editar</button>
                <button class="btn btn-sm btn-danger delete-quote-btn" data-id="${q.id}" title="Eliminar Presupuesto">✕ Eliminar</button>
              `}
              ${(q.status === 'aceptada' || q.status === 'parcial') ? `<button class="btn btn-sm btn-success convert-appointment-btn" data-id="${q.id}" title="Agendar Cita de Tratamientos">📅 Agendar Cita</button>` : ''}
              ${!q.invoice_id && !q.is_closed && q.payment_status !== 'pagado' ? `<button class="btn btn-sm btn-info convert-invoice-btn" data-id="${q.id}" title="Generar Factura de Ítems Aceptados">📄 Facturar Ítems</button>` : ''}
            </div>
          </div>
        </td>
      </tr>
    `).join('');

    if (filtered.length === 0) {
      rows = `<tr><td colspan="7" style="text-align: center; color: var(--text-secondary); padding: var(--space-6);">No se encontraron presupuestos.</td></tr>`;
    }

    tbody.innerHTML = rows;

    const paginationContainer = this.container.querySelector('#pagination-controls');
    if (paginationContainer) {
      let buttons = '';
      if (totalPages > 1) {
        buttons += `<button class="btn btn-sm btn-outline page-btn" data-page="${this.currentPage - 1}" ${this.currentPage === 1 ? 'disabled' : ''}>Anterior</button>`;
        for (let i = 1; i <= totalPages; i++) {
          if (i === 1 || i === totalPages || (i >= this.currentPage - 1 && i <= this.currentPage + 1)) {
            buttons += `<button class="btn btn-sm ${i === this.currentPage ? 'btn-primary' : 'btn-outline'} page-btn" data-page="${i}">${i}</button>`;
          } else if (i === this.currentPage - 2 || i === this.currentPage + 2) {
            buttons += `<span style="color: var(--text-secondary); padding: 0 var(--space-1);">...</span>`;
          }
        }
        buttons += `<button class="btn btn-sm btn-outline page-btn" data-page="${this.currentPage + 1}" ${this.currentPage === totalPages ? 'disabled' : ''}>Siguiente</button>`;
      }
      paginationContainer.innerHTML = buttons;
    }
  }

  mount() {
    this.destroy();
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    this.container.addEventListener('input', (e) => {
      if (e.target && e.target.id === 'quote-search') {
        this.searchQuery = e.target.value;
        this.currentPage = 1;
        this.renderView();
      }
    }, { signal });

    this.container.addEventListener('change', (e) => {
      if (e.target && e.target.id === 'quote-filter-status') {
        this.statusFilter = e.target.value;
        this.currentPage = 1;
        this.renderView();
      }
    }, { signal });

    this.container.addEventListener('click', async (e) => {
      const pageBtn = e.target.closest('.page-btn');
      if (pageBtn && !pageBtn.disabled) {
        this.currentPage = parseInt(pageBtn.getAttribute('data-page'), 10);
        this.renderView();
        return;
      }

      const addBtn = e.target.closest('#add-quote-btn');
      if (addBtn) {
        this.showQuoteModal();
        return;
      }

      const actionBtn = e.target.closest('.view-quote-btn, .manage-items-btn, .change-status-btn, .pay-quote-btn, .convert-appointment-btn, .convert-invoice-btn, .edit-quote-btn, .delete-quote-btn');
      if (actionBtn) {
        const id = actionBtn.getAttribute('data-id');
        if (actionBtn.classList.contains('view-quote-btn')) {
          this.showViewOptionsModal(id);
        }
        if (actionBtn.classList.contains('manage-items-btn')) {
          this.showManageQuoteModal(id);
        }
        if (actionBtn.classList.contains('change-status-btn')) {
          this.showStatusModal(id);
        }
        if (actionBtn.classList.contains('pay-quote-btn')) {
          this.showQuotationPaymentModal(id);
        }
        if (actionBtn.classList.contains('convert-appointment-btn')) {
          const q = this.quotationsList.find(item => item.id == id);
          if (q) {
            state.set('prefilledAppointment', {
              patientId: q.patient_id,
              patientName: q.patient_name,
              doctorId: q.doctor_id,
              reason: `Tratamientos de Presupuesto #${q.quote_number}`
            });
            window.location.hash = '#/appointments';
          }
        }
        if (actionBtn.classList.contains('edit-quote-btn')) {
          this.showQuoteModal(id);
        }
        if (actionBtn.classList.contains('delete-quote-btn')) {
          this.showDeleteConfirm(id);
        }
        if (actionBtn.classList.contains('convert-invoice-btn')) {
          this.showConvertInvoiceModal(id);
        }
        return;
      }

      // Handle row clicking to reveal/toggle action bar
      const mainRow = e.target.closest('.quote-main-row');
      if (mainRow) {
        const id = mainRow.getAttribute('data-id');
        const targetActionsRow = this.container.querySelector(`#quote-actions-${id}`);
        if (targetActionsRow) {
          const isOpen = targetActionsRow.style.display !== 'none';
          
          // Close all open action rows & remove row active states
          this.container.querySelectorAll('.quote-actions-bar-row').forEach(row => row.style.display = 'none');
          this.container.querySelectorAll('.quote-main-row').forEach(row => row.classList.remove('row-active'));

          if (!isOpen) {
            targetActionsRow.style.display = 'table-row';
            mainRow.classList.add('row-active');
          }
        }
      }
    }, { signal });
  }

  async showManageQuoteModal(quotationId) {
    let qRaw;
    try {
      qRaw = await quotationService.getById(quotationId);
    } catch (err) {
      toast.error('Error al obtener datos del presupuesto');
      return;
    }
    const q = qRaw?.data || qRaw;
    if (!q) {
      toast.error('Presupuesto no encontrado');
      return;
    }

    const renderModalContent = (qData) => {
      const ITEM_STATUS_BADGES = {
        aceptado: 'badge-success',
        rechazado: 'badge-danger',
        pendiente: 'badge-warning',
      };

      const ITEM_STATUS_LABELS = {
        aceptado: '✓ Aceptado',
        rechazado: '✗ Rechazado',
        pendiente: '⏳ Pendiente',
      };

      const items = qData.items || [];
      const acceptedItems = items.filter(i => (i.status || 'pendiente') === 'aceptado');
      const pendingItems = items.filter(i => (i.status || 'pendiente') === 'pendiente');
      const unrealizedAccepted = acceptedItems.filter(i => (i.execution_status || 'pendiente') !== 'realizado');
      const acceptedTotal = acceptedItems.reduce((acc, i) => acc + parseFloat(i.total || 0), 0);
      const totalAmount = parseFloat(qData.total || 0);
      const acceptancePercentage = items.length > 0 ? Math.round((acceptedItems.length / items.length) * 100) : 0;
      const isQuotePaid = qData.payment_status === 'pagado' || (qData.remaining_balance !== undefined && qData.remaining_balance <= 0 && totalAmount > 0);
      const allItemsDecided = items.length > 0 && pendingItems.length === 0;
      const allAcceptedRealized = acceptedItems.length > 0 && unrealizedAccepted.length === 0;
      const isQuoteClosed = qData.is_closed || (allItemsDecided && allAcceptedRealized && isQuotePaid);

      const itemsRowsHtml = items.map((item) => {
        const status = item.status || 'pendiente';
        const execStatus = item.execution_status || 'pendiente';
        const isInvoiced = !!(item.invoice_id || (qData.invoice_id && status === 'aceptado'));
        const paidAmt = parseFloat(item.amount_paid || 0);
        const totalAmt = parseFloat(item.total || 0);
        const remBal = parseFloat(item.remaining_balance !== undefined ? item.remaining_balance : (totalAmt - paidAmt));
        const payStatus = item.payment_status || (paidAmt >= totalAmt - 0.001 && totalAmt > 0 ? 'pagado' : (paidAmt > 0 ? 'parcial' : 'ninguno'));

        let payBadge = '';
        if (payStatus === 'pagado') {
          payBadge = `<span class="badge badge-success" style="background-color: var(--success-100); color: var(--success-800); border: 1px solid var(--success-300); padding: 4px 8px; font-weight: 600;" title="100% Pagado (${formatCurrency(paidAmt)})">🟢 100% Pagado</span>`;
        } else if (payStatus === 'parcial') {
          payBadge = `<span class="badge badge-warning" style="background-color: #ffedd5; color: #c2410c; border: 1px solid #fdba74; padding: 4px 8px; font-weight: 600;" title="Cobrado: ${formatCurrency(paidAmt)} | Pendiente: ${formatCurrency(remBal)}">🟠 Parcial (${formatCurrency(paidAmt)} / ${formatCurrency(totalAmt)})</span>`;
        } else {
          payBadge = `<span class="badge badge-danger" style="background-color: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; padding: 4px 8px; font-weight: 600;" title="Sin abonos registrados (Debe: ${formatCurrency(totalAmt)})">🔴 Sin Pagar (${formatCurrency(totalAmt)})</span>`;
        }

        let execBadge = '';
        if (status === 'aceptado') {
          if (execStatus === 'realizado') {
            execBadge = `<span class="badge badge-success" style="background-color: var(--success-100); color: var(--success-800); border: 1px solid var(--success-300); padding: 4px 10px; font-weight: 600;" title="Completado y registrado en Tratamientos Realizados">🟢 Completado</span>`;
          } else if (execStatus === 'en_proceso') {
            execBadge = `<span class="badge badge-info" style="background-color: var(--primary-100); color: var(--primary-800); border: 1px solid var(--primary-300); padding: 4px 10px; font-weight: 600;" title="En proceso de ejecución">⚙️ En Proceso</span>`;
          } else {
            execBadge = `<span class="badge badge-warning" style="background-color: #ffedd5; color: #c2410c; border: 1px solid #fdba74; padding: 4px 10px; font-weight: 600;" title="Pendiente de ejecución">⏳ Pendiente</span>`;
          }
        } else {
          execBadge = `<span style="color: var(--text-tertiary); font-size: 12px;">—</span>`;
        }

        const isItemFullyConsolidated = isInvoiced || (status === 'aceptado' && payStatus === 'pagado' && execStatus === 'realizado');

        return `
        <tr class="quote-manage-item-row" data-item-id="${item.id}">
          <td>
            <strong>${item.description}</strong>
            ${item.tooth_number ? `<span style="font-size: 11px; color: var(--text-secondary); margin-left: 6px;">(Diente #${item.tooth_number})</span>` : ''}
          </td>
          <td style="text-align: center;">${item.quantity}</td>
          <td style="text-align: right;">${formatCurrency(item.unit_price)}</td>
          <td style="text-align: right;"><strong>${formatCurrency(item.total)}</strong></td>
          <td style="text-align: center;">
            ${isInvoiced 
              ? `<span class="badge badge-info" style="background-color: var(--primary-100); color: var(--primary-800); font-weight: 600;" title="Tratamiento ya facturado">🔒 Facturado</span>` 
              : `<span class="badge ${ITEM_STATUS_BADGES[status]}">${ITEM_STATUS_LABELS[status]}</span>`}
          </td>
          <td style="text-align: center;">
            ${execBadge}
          </td>
          <td style="text-align: center;">
            ${payBadge}
          </td>
          <td style="text-align: center;">
            ${isItemFullyConsolidated ? `
              <div class="status-toggle-segmented" style="opacity: 0.75;" title="Este tratamiento ya está completado y pagado 100%">
                <button type="button" class="status-toggle-btn active" disabled style="cursor: not-allowed; background: var(--success-700); color: #fff;">
                  🔒 ${payStatus === 'pagado' ? 'Pagado & Realizado' : 'Facturado'}
                </button>
              </div>
            ` : `
              <div style="display: flex; flex-direction: column; gap: 4px; align-items: center;">
                <div class="status-toggle-segmented">
                  <button type="button" class="status-toggle-btn ${status === 'aceptado' ? 'active' : ''} set-item-status-btn" data-item-id="${item.id}" data-status="aceptado" title="Aceptar este tratamiento">
                    ✓ Aceptar
                  </button>
                  <button type="button" class="status-toggle-btn ${status === 'pendiente' ? 'active' : ''} set-item-status-btn" data-item-id="${item.id}" data-status="pendiente" title="Marcar como pendiente">
                    ⏳ Pendiente
                  </button>
                  <button type="button" class="status-toggle-btn ${status === 'rechazado' ? 'active' : ''} set-item-status-btn" data-item-id="${item.id}" data-status="rechazado" title="Rechazar este tratamiento">
                    ✗ Rechazar
                  </button>
                </div>
                ${status === 'aceptado' ? `
                  <div class="status-toggle-segmented">
                    <button type="button" class="status-toggle-btn ${execStatus === 'en_proceso' || execStatus === 'pendiente' ? 'active' : ''} set-item-exec-status-btn" data-item-id="${item.id}" data-exec-status="en_proceso" title="Marcar en proceso de ejecución">
                      ⚙️ En Proceso
                    </button>
                    <button type="button" class="status-toggle-btn ${execStatus === 'realizado' ? 'active' : ''} set-item-exec-status-btn" data-item-id="${item.id}" data-exec-status="realizado" style="${execStatus === 'realizado' ? 'background: var(--success-700); color: #fff;' : ''}" title="Marcar como completado (se tornará VERDE y aparecerá en Tratamientos Realizados)">
                      ✅ Completado
                    </button>
                  </div>
                ` : ''}
              </div>
            `}
          </td>
        </tr>
      `}).join('');

      return `
        <div class="quote-manage-hero">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: var(--space-4); margin-bottom: var(--space-3);">
            <div>
              <h3>Presupuesto #${qData.quote_number}</h3>
              <p style="margin: 0; color: var(--text-secondary); font-size: var(--text-sm);">
                👤 Paciente: <strong>${qData.patient_name || 'N/A'}</strong> &nbsp;|&nbsp; 👨‍⚕️ Doctor: <strong>${qData.doctor_name || 'Sin asignar'}</strong>
              </p>
            </div>
            <div style="text-align: right; display: flex; align-items: center; gap: 8px;">
              <span class="badge ${STATUS_BADGES[qData.status] || 'badge-secondary'}" style="font-size: 14px; padding: 6px 14px; border-radius: 9999px;">
                ${STATUS_LABELS[qData.status] || qData.status}
              </span>
              ${isQuoteClosed
                ? `<span class="badge badge-success" style="font-size: 14px; padding: 6px 14px; border-radius: 9999px;">🟢 100% Pagado y Cerrado</span>`
                : (isQuotePaid
                  ? `<span class="badge" style="background-color: var(--success-100); color: var(--success-800); font-size: 14px; padding: 6px 14px; border-radius: 9999px;">🟢 Monto Aceptado Pagado</span>`
                  : (qData.payment_status === 'parcial'
                    ? `<span class="badge" style="background-color: var(--warning-100); color: var(--warning-800); font-size: 14px; padding: 6px 14px; border-radius: 9999px;">🟠 Pagado: ${formatCurrency(qData.amount_paid)}</span>`
                    : ''))}
            </div>
          </div>

          <div style="margin-top: var(--space-3);">
            <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 600; color: var(--text-secondary); margin-bottom: 4px;">
              <span>Progreso de Aceptación</span>
              <span>${acceptedItems.length} de ${items.length} ítems (${acceptancePercentage}%)</span>
            </div>
            <div class="quote-progress-bar-container">
              <div class="quote-progress-bar-fill" style="width: ${acceptancePercentage}%;"></div>
            </div>
          </div>
        </div>

        ${isQuoteClosed ? `
          <div style="background-color: var(--success-50); border: 1px solid var(--success-200); color: var(--success-900); padding: 10px 14px; border-radius: var(--radius-md); font-size: 13px; margin-bottom: var(--space-4); display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 16px;">🟢</span>
            <span>Este presupuesto se encuentra <strong>100% Pagado, Realizado y Cerrado</strong>. Todos los tratamientos han sido resueltos y consolidados.</span>
          </div>
        ` : (pendingItems.length > 0 || unrealizedAccepted.length > 0 ? `
          <div style="background-color: var(--warning-50); border: 1px solid var(--warning-200); color: var(--warning-900); padding: 10px 14px; border-radius: var(--radius-md); font-size: 13px; margin-bottom: var(--space-4); display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 16px;">⏳</span>
            <span>Cotización Abierta en Gestión: ${pendingItems.length > 0 ? `• Quedan <strong>${pendingItems.length} tratamiento(s) pendiente(s)</strong> de aceptar o rechazar. ` : ''}${unrealizedAccepted.length > 0 ? `• Quedan <strong>${unrealizedAccepted.length} tratamiento(s) aceptado(s)</strong> pendiente(s) de marcar como Completado. ` : ''}El presupuesto no podrá cerrarse hasta decidir, cobrar y realizar todos sus tratamientos.</span>
          </div>
        ` : '')}

        ${!isQuoteClosed ? `
        <div style="display: flex; justify-content: flex-end; margin-bottom: var(--space-3);">
          <button id="manage-accept-all-btn" class="btn btn-sm btn-success" style="padding: 6px 14px; font-size: 13px; font-weight: 500;">
            ✅ Aceptar Presupuesto Completo
          </button>
        </div>
        ` : ''}

        <div class="card" style="margin-bottom: var(--space-4); padding: 0; border: 1px solid var(--border-color); overflow: hidden; flex: 1; display: flex; flex-direction: column;">
          <div class="table-container" style="max-height: calc(96vh - 280px); min-height: 420px; overflow-y: auto; flex: 1;">
            <table style="margin: 0; border-radius: 0;">
              <thead>
                <tr>
                  <th>Tratamiento / Descripción</th>
                  <th style="text-align: center;">Cant.</th>
                  <th style="text-align: right;">Precio Unit.</th>
                  <th style="text-align: right;">Total</th>
                  <th style="text-align: center;">Estado Aceptación</th>
                  <th style="text-align: center;">Estado Ejecución</th>
                  <th style="text-align: center;">Estado de Pago</th>
                  <th style="text-align: center;">Acción / Progreso</th>
                </tr>
              </thead>
              <tbody>
                ${itemsRowsHtml || `<tr><td colspan="8" style="text-align: center; padding: var(--space-6); color: var(--text-secondary);">No hay ítems en este presupuesto.</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>

        <div style="background: var(--gray-50); padding: var(--space-4); border-radius: var(--radius-lg); border: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; gap: var(--space-4); flex-wrap: wrap;">
          <div>
            <span style="color: var(--text-secondary); font-size: 13px;">Monto Total Presupuesto:</span>
            <strong style="font-size: 18px; margin-left: 8px; color: var(--text-primary);">${formatCurrency(totalAmount)}</strong>
          </div>
          <div>
            <span style="color: var(--text-secondary); font-size: 13px;">Monto Aceptado Aprobado:</span>
            <strong style="font-size: 20px; color: var(--success-600); margin-left: 8px;">${formatCurrency(acceptedTotal)}</strong>
          </div>
          <div>
            <span style="color: var(--text-secondary); font-size: 13px;">Monto Pagado / Cobrado:</span>
            <strong style="font-size: 20px; color: ${isQuotePaid ? 'var(--success-600)' : 'var(--primary-600)'}; margin-left: 8px;">${formatCurrency(qData.amount_paid || 0)} ${isQuotePaid ? '(100% Pagado)' : ''}</strong>
          </div>
        </div>
      `;
    };

    Modal.show({
      title: `Gestión Integral — Presupuesto #${q.quote_number || quotationId}`,
      content: renderModalContent(q),
      size: 'full',
      showConfirm: false,
      cancelText: 'Cerrar'
    });

    const overlay = document.querySelector('.modal-overlay');
    if (!overlay) return;

    // Use event delegation for dynamic re-rendering of modal buttons and content
    overlay.addEventListener('click', async (e) => {
      const acceptAllBtn = e.target.closest('#manage-accept-all-btn');
      if (acceptAllBtn) {
        try {
          acceptAllBtn.disabled = true;
          const res = await quotationService.acceptAllItems(quotationId);
          const updatedQuote = res?.data || res;
          toast.success('Presupuesto completo aceptado exitosamente');
          const modalBody = overlay.querySelector('.modal-body');
          if (modalBody) modalBody.innerHTML = renderModalContent(updatedQuote);
          if (onSuccess) await onSuccess(); else await this.render();
        } catch (err) {
          toast.error(err.message || 'Error al aceptar el presupuesto');
        } finally {
          if (acceptAllBtn) acceptAllBtn.disabled = false;
        }
        return;
      }

      const payQuoteBtn = e.target.closest('#manage-pay-quote-btn');
      if (payQuoteBtn) {
        Modal.closeAll();
        this.showQuotationPaymentModal(quotationId, onSuccess);
        return;
      }

      const invoiceBtn = e.target.closest('#manage-generate-invoice-btn');
      if (invoiceBtn) {
        Modal.closeAll();
        this.showConvertInvoiceModal(quotationId, onSuccess);
        return;
      }

      const changeStatusBtn = e.target.closest('#manage-change-status-btn, .change-status-modal-btn');
      if (changeStatusBtn) {
        this.showStatusModal(quotationId, onSuccess);
        return;
      }

      const itemBtn = e.target.closest('.set-item-status-btn');
      if (itemBtn) {
        const itemId = itemBtn.getAttribute('data-item-id');
        const status = itemBtn.getAttribute('data-status');
        try {
          const res = await quotationService.updateItemStatus(itemId, status);
          const updatedQuote = await quotationService.getById(quotationId);
          const modalBody = overlay.querySelector('.modal-body');
          if (modalBody) modalBody.innerHTML = renderModalContent(updatedQuote?.data || updatedQuote);
          if (onSuccess) await onSuccess(); else await this.render();
        } catch (err) {
          toast.error(err.message || 'Error al actualizar estado del ítem');
        }
        return;
      }

      const execBtn = e.target.closest('.set-item-exec-status-btn');
      if (execBtn) {
        const itemId = execBtn.getAttribute('data-item-id');
        const execStatus = execBtn.getAttribute('data-exec-status');
        try {
          execBtn.disabled = true;
          await quotationService.updateExecutionStatus(itemId, execStatus);
          toast.success(execStatus === 'realizado' ? '¡Tratamiento marcado como Completado y enviado a Tratamientos Realizados!' : 'Estado de ejecución actualizado');
          const updatedQuote = await quotationService.getById(quotationId);
          const modalBody = overlay.querySelector('.modal-body');
          if (modalBody) modalBody.innerHTML = renderModalContent(updatedQuote?.data || updatedQuote);
          if (onSuccess) await onSuccess(); else await this.render();
        } catch (err) {
          toast.error(err.message || 'Error al actualizar ejecución del tratamiento');
        } finally {
          if (execBtn) execBtn.disabled = false;
        }
        return;
      }
    });
  }

  async showConvertInvoiceModal(quotationId, onSuccess = null) {
    let qRaw;
    try {
      qRaw = await quotationService.getById(quotationId);
    } catch (err) {
      toast.error('Error al obtener información del presupuesto');
      return;
    }
    const q = qRaw?.data || qRaw;

    if (!q.items || q.items.length === 0) {
      toast.error('Este presupuesto no contiene ítems para facturar.');
      return;
    }

    const unbilledItems = (q.items || []).filter(item => !item.invoice_id);
    if (unbilledItems.length === 0) {
      toast.info('Todos los tratamientos de este presupuesto ya han sido facturados.');
      return;
    }

    const itemsRowsHtml = unbilledItems.map((item) => {
      const isAccepted = item.status === 'aceptado';
      return `
      <tr class="quote-convert-item-row" data-id="${item.id}" data-total="${item.total}">
        <td style="text-align: center;">
          <input type="checkbox" class="quote-item-checkbox" value="${item.id}" ${isAccepted ? 'checked' : ''} />
        </td>
        <td>
          <strong>${item.description}</strong>
          ${item.tooth_number ? `<span style="font-size: 11px; color: var(--text-secondary); margin-left: 6px;">(Diente #${item.tooth_number})</span>` : ''}
        </td>
        <td style="text-align: center;">${item.quantity}</td>
        <td style="text-align: right;">${formatCurrency(item.unit_price)}</td>
        <td style="text-align: right;"><strong>${formatCurrency(item.total)}</strong></td>
      </tr>
    `}).join('');

    const taxRate = parseFloat(q.tax_rate || 0);
    const discountPct = parseFloat(q.discount_percentage || 0);

    const content = `
      <div style="margin-bottom: var(--space-4);">
        <p style="margin-bottom: var(--space-2);"><strong>Presupuesto #${q.quote_number}</strong> — Paciente: <strong>${q.patient_name || 'N/A'}</strong></p>
        <p style="color: var(--text-secondary); font-size: var(--text-sm); margin: 0;">Seleccione los ítems que desea aceptar y facturar:</p>
      </div>

      <div class="table-container" style="max-height: 300px; overflow-y: auto; margin-bottom: var(--space-4);">
        <table>
          <thead>
            <tr>
              <th style="width: 40px; text-align: center;">
                <input type="checkbox" id="select-all-quote-items" checked />
              </th>
              <th>Descripción del Tratamiento</th>
              <th style="text-align: center;">Cant.</th>
              <th style="text-align: right;">P. Unitario</th>
              <th style="text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRowsHtml}
          </tbody>
        </table>
      </div>

      <div style="background-color: var(--gray-50); padding: var(--space-4); border-radius: var(--radius-md); border: 1px solid var(--border-color); display: flex; flex-direction: column; gap: var(--space-2);">
        <div style="display: flex; justify-content: space-between;">
          <span>Subtotal ítems seleccionados:</span>
          <strong id="convert-selected-subtotal">${formatCurrency(q.subtotal)}</strong>
        </div>
        ${discountPct > 0 ? `
          <div style="display: flex; justify-content: space-between; color: var(--danger-600);">
            <span>Descuento global (${discountPct}%):</span>
            <strong id="convert-selected-discount">-${formatCurrency(q.discount_amount)}</strong>
          </div>
        ` : ''}
        ${taxRate > 0 ? `
          <div style="display: flex; justify-content: space-between;">
            <span>Impuesto (${taxRate}%):</span>
            <strong id="convert-selected-tax">${formatCurrency(q.tax_amount)}</strong>
          </div>
        ` : ''}
        <div style="display: flex; justify-content: space-between; border-top: 1px solid var(--border-color); padding-top: var(--space-2); margin-top: var(--space-1); font-size: var(--text-base);">
          <strong>Total Factura:</strong>
          <strong id="convert-selected-total" style="color: var(--primary-700); font-size: var(--text-lg);">${formatCurrency(q.total)}</strong>
        </div>
      </div>
    `;

    Modal.show({
      title: `Facturar Presupuesto #${q.quote_number}`,
      content: content,
      confirmText: 'Generar Factura',
      size: 'lg',
      onConfirm: async (modalBody) => {
        const checkboxes = modalBody.querySelectorAll('.quote-item-checkbox:checked');
        const selectedIds = Array.from(checkboxes).map(cb => cb.value);

        if (selectedIds.length === 0) {
          toast.error('Debe seleccionar al menos un ítem para facturar.');
          return false;
        }

        try {
          await invoiceService.createFromQuotation(quotationId, selectedIds);
          toast.success('Factura generada exitosamente con los ítems seleccionados');
          if (onSuccess) {
            await onSuccess();
          } else {
            window.location.hash = '#/invoices';
          }
          return true;
        } catch (err) {
          toast.error(err.message || 'Error al generar la factura');
          return false;
        }
      }
    });

    // Dynamic summary update on checkbox change
    const overlay = document.querySelector('.modal-overlay');
    if (!overlay) return;

    const updateCalculations = () => {
      const rows = overlay.querySelectorAll('.quote-convert-item-row');
      let subtotal = 0;

      rows.forEach(row => {
        const cb = row.querySelector('.quote-item-checkbox');
        if (cb && cb.checked) {
          subtotal += parseFloat(row.dataset.total || 0);
        }
      });

      const discountAmt = subtotal * (discountPct / 100);
      const taxable = subtotal - discountAmt;
      const taxAmt = taxable * (taxRate / 100);
      const total = taxable + taxAmt;

      const subtotalEl = overlay.querySelector('#convert-selected-subtotal');
      const discountEl = overlay.querySelector('#convert-selected-discount');
      const taxEl = overlay.querySelector('#convert-selected-tax');
      const totalEl = overlay.querySelector('#convert-selected-total');

      if (subtotalEl) subtotalEl.textContent = formatCurrency(subtotal);
      if (discountEl) discountEl.textContent = `-${formatCurrency(discountAmt)}`;
      if (taxEl) taxEl.textContent = formatCurrency(taxAmt);
      if (totalEl) totalEl.textContent = formatCurrency(total);
    };

    overlay.querySelectorAll('.quote-item-checkbox').forEach(cb => {
      cb.addEventListener('change', () => {
        const allCbs = overlay.querySelectorAll('.quote-item-checkbox');
        const checkedCbs = overlay.querySelectorAll('.quote-item-checkbox:checked');
        const selectAll = overlay.querySelector('#select-all-quote-items');
        if (selectAll) selectAll.checked = allCbs.length === checkedCbs.length;
        updateCalculations();
      });
    });

    overlay.querySelector('#select-all-quote-items')?.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      overlay.querySelectorAll('.quote-item-checkbox').forEach(cb => {
        cb.checked = isChecked;
      });
      updateCalculations();
    });
  }

  async showQuoteModal(quoteId = null, preselectedPatientId = null, onSuccess = null) {
    const isEdit = !!quoteId;
    let q = { items: [{ description: '', quantity: 1, unit_price: 0, discount: 0 }] };

    if (isEdit) {
      try {
        q = await quotationService.getById(quoteId);
      } catch {
        toast.error('Error al cargar datos del presupuesto');
        return;
      }
    }

    // Fetch patients, doctors and treatments for dropdowns
    let patients = [];
    let doctors = [];
    let treatments = [];
    try {
      [patients, doctors, treatments] = await Promise.all([
        patientService.getAll({ limit: 500 }),
        doctorService.getAll(),
        treatmentService.getAll({ limit: 500, is_active: true }),
      ]);
    } catch {
      // Fallback: show empty selects / lists
    }
    // api.get returns data array directly
    const patientList = Array.isArray(patients) ? patients : (patients?.data || patients?.rows || []);
    const doctorList = Array.isArray(doctors) ? doctors : (doctors?.data || doctors?.rows || []);
    const treatmentList = Array.isArray(treatments) ? treatments : (treatments?.data || treatments?.rows || []);

    const selectedPatientId = q.patient_id || preselectedPatientId;
    let selectedPatient = selectedPatientId ? patientList.find(p => p.id == selectedPatientId) : null;
    if (selectedPatientId && !selectedPatient && (q.patient_first_name || q.patient_name)) {
      selectedPatient = {
        id: selectedPatientId,
        first_name: q.patient_first_name || q.patient_name || '',
        last_name: q.patient_last_name || '',
        custom_id: q.patient_custom_id || ''
      };
    }
    const selectedPatientText = selectedPatient
      ? `[${selectedPatient.custom_id || 'N/A'}] ${selectedPatient.first_name} ${selectedPatient.last_name}`.trim()
      : '';

    const doctorOptions = doctorList.map(d =>
      `<option value="${d.id}" ${d.id == q.doctor_id ? 'selected' : ''}>${d.first_name} ${d.last_name} (${d.specialty || ''})</option>`
    ).join('');

    const itemsHtml = (q.items || [{ description: '', quantity: 1, unit_price: 0, discount: 0 }]).map((item, i) => `
      <div class="quote-item-row" style="margin-top: ${i > 0 ? 'var(--space-2)' : '0'};">
        <div class="treatment-autocomplete-wrapper">
          <input type="text" name="item_desc_${i}" class="form-input quote-item-desc" placeholder="Buscar tratamiento..." value="${item.description || ''}" autocomplete="off" required />
          <ul class="treatment-autocomplete-list"></ul>
        </div>
        <input type="number" name="item_qty_${i}" class="form-input" placeholder="Cant." value="${item.quantity || 1}" min="1" required />
        <input type="number" step="0.01" name="item_price_${i}" class="form-input" placeholder="Precio $" value="${item.unit_price || 0}" min="0" required />
        <input type="number" step="0.01" name="item_discount_${i}" class="form-input" placeholder="Desc. %" value="${item.discount || 0}" min="0" max="100" />
      </div>
    `).join('');

    const content = `
      <form id="quote-form">
        <div class="form-row-responsive">
          <div class="form-group">
            <label class="form-label">Paciente <span style="color: var(--danger-500);">*</span></label>
            <div class="patient-autocomplete-wrapper" style="position: relative;">
              <input type="text" id="quote-patient-search" class="form-input" placeholder="Buscar paciente por nombre, DNI, teléfono o código..." value="${selectedPatientText}" autocomplete="off" required style="padding-right: 32px;" />
              <input type="hidden" name="patient_id" id="quote-patient-id" value="${selectedPatientId || ''}" required />
              <button type="button" id="quote-patient-clear-btn" class="btn-clear-patient" style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; font-size: 16px; cursor: pointer; color: var(--color-text-tertiary); display: ${selectedPatientId ? 'block' : 'none'}; line-height: 1; padding: 4px;" title="Limpiar y buscar otro paciente">&times;</button>
              <ul id="quote-patient-autocomplete-list" class="treatment-autocomplete-list" style="display: none; max-height: 240px; z-index: 1060;"></ul>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Doctor</label>
            <select name="doctor_id" class="form-select">
              <option value="">Seleccione un doctor...</option>
              ${doctorOptions}
            </select>
          </div>
        </div>
        <div class="form-row-responsive" style="margin-top: var(--space-3);">
          <div class="form-group">
            <label class="form-label">Fecha de cotización</label>
            <input type="date" name="quotation_date" class="form-input" value="${q.quotation_date || ''}" />
          </div>
          <div class="form-group">
            <label class="form-label">Válida hasta</label>
            <input type="date" name="valid_until" class="form-input" value="${q.valid_until || ''}" />
          </div>
        </div>
        <div class="form-row-3col" style="margin-top: var(--space-3);">
          <div class="form-group">
            <label class="form-label">Impuesto (%)</label>
            <input type="number" name="tax_rate" class="form-input" value="${q.tax_rate || 21}" min="0" max="100" />
          </div>
          <div class="form-group">
            <label class="form-label">Descuento global (%)</label>
            <input type="number" name="discount_percentage" class="form-input" value="${q.discount_percentage || 0}" min="0" max="100" />
          </div>
          <div class="form-group">
            <label class="form-label">Notas</label>
            <textarea name="notes" class="form-textarea" rows="1">${q.notes || ''}</textarea>
          </div>
        </div>
        <div style="margin-top: var(--space-3);">
          <label class="form-label" style="display: block; margin-bottom: var(--space-1);">Items del presupuesto</label>
          <div id="quote-items-container">
            ${itemsHtml}
          </div>
          <button type="button" id="add-item-btn" class="btn btn-sm btn-outline" style="margin-top: var(--space-2);">+ Agregar item</button>
        </div>
      </form>
    `;

    Modal.show({
      title: isEdit ? 'Editar Presupuesto' : 'Nuevo Presupuesto',
      content: content,
      confirmText: isEdit ? 'Guardar Cambios' : 'Generar Presupuesto',
      size: 'full',
      onConfirm: async (modalBody) => {
        const form = modalBody.querySelector('#quote-form');
        const formData = new FormData(form);
        const raw = Object.fromEntries(formData.entries());

        const patientIdVal = parseInt(raw.patient_id, 10);
        if (!patientIdVal || isNaN(patientIdVal)) {
          toast.error('Por favor busque y seleccione un paciente de la lista.');
          const pInput = modalBody.querySelector('#quote-patient-search');
          if (pInput) pInput.focus();
          return false;
        }

        const items = [];
        let itemIndex = 0;
        while (raw[`item_desc_${itemIndex}`] !== undefined) {
          if (raw[`item_desc_${itemIndex}`].trim()) {
            items.push({
              description: raw[`item_desc_${itemIndex}`].trim(),
              quantity: parseInt(raw[`item_qty_${itemIndex}`], 10) || 1,
              unit_price: parseFloat(raw[`item_price_${itemIndex}`]) || 0,
              discount: parseFloat(raw[`item_discount_${itemIndex}`]) || 0,
            });
          }
          itemIndex++;
        }

        const payload = {
          patient_id: patientIdVal,
          doctor_id: raw.doctor_id ? parseInt(raw.doctor_id, 10) : undefined,
          quotation_date: raw.quotation_date || undefined,
          valid_until: raw.valid_until || undefined,
          tax_rate: parseFloat(raw.tax_rate) || 0,
          discount_percentage: parseFloat(raw.discount_percentage) || 0,
          notes: raw.notes || undefined,
          items,
        };

        if (items.length === 0) {
          toast.error('Debe incluir al menos un item con descripción.');
          return false;
        }

        try {
          if (isEdit) {
            await quotationService.update(quoteId, payload);
            toast.success('Presupuesto actualizado exitosamente');
          } else {
            await quotationService.create(payload);
            toast.success('Presupuesto generado exitosamente');
          }
          if (onSuccess) {
            await onSuccess();
          } else {
            await this.render();
            this.mount();
          }
          return true;
        } catch (err) {
          const fieldErrors = err.details;
          if (fieldErrors) {
            const existing = modalBody.querySelector('.validation-summary');
            if (existing) existing.remove();
            const list = fieldErrors.map(e =>
              `<li style="color: var(--danger-600); font-size: var(--text-sm);">• <strong>${e.field}:</strong> ${e.message}</li>`
            ).join('');
            const summary = document.createElement('div');
            summary.className = 'validation-summary';
            summary.style.cssText = 'background: var(--danger-50); border: 1px solid var(--danger-200); border-radius: var(--radius); padding: var(--space-3); margin-bottom: var(--space-3);';
            summary.innerHTML = `<ul style="margin: 0; padding-left: var(--space-4);">${list}</ul>`;
            modalBody.querySelector('#quote-form').prepend(summary);
          } else {
            toast.error(err.message || 'Error al procesar presupuesto');
          }
          return false;
        }
      },
    });

    // Defer event handlers and autocomplete init until modal is in DOM
    setTimeout(() => {
      // ---- Inject autocomplete CSS (once) ----
      if (!document.getElementById('treatment-autocomplete-styles')) {
        const style = document.createElement('style');
        style.id = 'treatment-autocomplete-styles';
        style.textContent = `
          .treatment-autocomplete-wrapper {
            position: relative;
            flex: 1;
            min-width: 0;
          }
          .treatment-autocomplete-list {
            display: none;
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            z-index: 1050;
            max-height: 220px;
            overflow-y: auto;
            margin: 4px 0 0 0;
            padding: 0;
            list-style: none;
            background: var(--color-surface, #fff);
            border: 1px solid var(--color-border, #ddd);
            border-radius: var(--radius-md, 8px);
            box-shadow: 0 8px 24px rgba(0,0,0,.15);
          }
          [data-theme='dark'] .treatment-autocomplete-list {
            background: var(--gray-900, #0f172a);
            border-color: var(--gray-700, #334155);
          }
          .treatment-autocomplete-list .autocomplete-item {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 10px 14px;
            cursor: pointer;
            font-size: var(--text-sm, 0.875rem);
            border-bottom: 1px solid var(--color-border-light, #eee);
            transition: background .15s;
          }
          .treatment-autocomplete-list .autocomplete-item:last-child { border-bottom: none; }
          .treatment-autocomplete-list .autocomplete-item:hover,
          .treatment-autocomplete-list .autocomplete-item.active {
            background: var(--primary-50, #eef2ff);
          }
          [data-theme='dark'] .treatment-autocomplete-list .autocomplete-item:hover,
          [data-theme='dark'] .treatment-autocomplete-list .autocomplete-item.active {
            background: var(--gray-800, #1e293b);
          }
          .treatment-autocomplete-list .treatment-name {
            flex: 1;
            font-weight: 500;
            color: var(--color-text, #333);
          }
          .treatment-autocomplete-list .treatment-code {
            font-size: 0.75rem;
            color: var(--color-text-secondary, #888);
            background: var(--color-bg-secondary, #f5f5f5);
            padding: 2px 6px;
            border-radius: 4px;
          }
          .treatment-autocomplete-list .treatment-price {
            font-weight: 600;
            color: var(--success-600, #16a34a);
            white-space: nowrap;
          }
          .treatment-autocomplete-list .no-results {
            padding: 12px 14px;
            color: var(--color-text-secondary, #999);
            font-style: italic;
            text-align: center;
          }
          .patient-item-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            width: 100%;
            gap: 10px;
          }
          .patient-item-main {
            display: flex;
            flex-direction: column;
            gap: 2px;
            min-width: 0;
          }
          .patient-item-name {
            font-weight: 600;
            color: var(--color-text);
            font-size: 13px;
          }
          .patient-item-sub {
            font-size: 11px;
            color: var(--color-text-secondary);
          }
          .patient-item-badge {
            font-size: 11px;
            font-weight: 700;
            padding: 2px 6px;
            border-radius: 4px;
            background: linear-gradient(135deg, rgba(15, 134, 236, 0.12), rgba(15, 134, 236, 0.04));
            color: var(--primary-600);
            flex-shrink: 0;
          }
          [data-theme='dark'] .patient-item-badge {
            background: linear-gradient(135deg, rgba(56, 164, 249, 0.16), rgba(56, 164, 249, 0.06));
            color: var(--primary-400);
          }
          .btn-clear-patient:hover {
            color: var(--error-600) !important;
          }
        `;
        document.head.appendChild(style);
      }

      // ---- Patient autocomplete initializer ----
      const patientSearchInput = document.getElementById('quote-patient-search');
      const patientIdInput = document.getElementById('quote-patient-id');
      const patientClearBtn = document.getElementById('quote-patient-clear-btn');
      const patientDropdown = document.getElementById('quote-patient-autocomplete-list');

      if (patientSearchInput && patientDropdown) {
        let activePatientIdx = -1;

        const renderPatientMatches = (matches) => {
          if (!matches || matches.length === 0) {
            patientDropdown.innerHTML = '<li class="no-results">No se encontraron pacientes</li>';
            patientDropdown.style.display = 'block';
            activePatientIdx = -1;
            return;
          }

          patientDropdown.innerHTML = matches.map((p, idx) => {
            const customId = p.custom_id || `PAC-${String(p.id).padStart(5, '0')}`;
            const subInfo = [
              p.identification_number ? `DNI/Doc: ${p.identification_number}` : '',
              p.phone ? `Tel: ${p.phone}` : '',
              p.email || ''
            ].filter(Boolean).join(' · ');

            return `
              <li class="autocomplete-item" data-idx="${idx}">
                <div class="patient-item-row">
                  <div class="patient-item-main">
                    <span class="patient-item-name">${p.first_name} ${p.last_name}</span>
                    ${subInfo ? `<span class="patient-item-sub">${subInfo}</span>` : ''}
                  </div>
                  <span class="patient-item-badge">[${customId}]</span>
                </div>
              </li>
            `;
          }).join('');
          patientDropdown.style.display = 'block';
          activePatientIdx = -1;

          patientDropdown.querySelectorAll('.autocomplete-item').forEach((li, idx) => {
            li.addEventListener('mousedown', (e) => {
              e.preventDefault();
              const p = matches[idx];
              if (p) {
                patientIdInput.value = p.id;
                patientSearchInput.value = `[${p.custom_id || 'PAC-' + p.id}] ${p.first_name} ${p.last_name}`;
                if (patientClearBtn) patientClearBtn.style.display = 'block';
                patientDropdown.style.display = 'none';
              }
            });
          });
        };

        const showPatientResults = async () => {
          const term = (patientSearchInput.value || '').toLowerCase().trim();
          if (!term) {
            // Show recent/top 15 patients
            renderPatientMatches(patientList.slice(0, 15));
            return;
          }

          let matches = patientList.filter(p => {
            const fullName = `${p.first_name || ''} ${p.last_name || ''}`.toLowerCase();
            const customId = (p.custom_id || '').toLowerCase();
            const dni = (p.identification_number || '').toLowerCase();
            const phone = (p.phone || '').toLowerCase();
            const email = (p.email || '').toLowerCase();
            return fullName.includes(term) || customId.includes(term) || dni.includes(term) || phone.includes(term) || email.includes(term);
          }).slice(0, 15);

          renderPatientMatches(matches);
        };

        patientSearchInput.addEventListener('input', () => {
          patientIdInput.value = '';
          if (patientClearBtn) {
            patientClearBtn.style.display = patientSearchInput.value.trim() ? 'block' : 'none';
          }
          showPatientResults();
        });

        patientSearchInput.addEventListener('focus', showPatientResults);
        patientSearchInput.addEventListener('blur', () => {
          setTimeout(() => {
            patientDropdown.style.display = 'none';
            // If user typed custom text without selecting, clear or validate
            if (!patientIdInput.value && patientSearchInput.value.trim() && selectedPatientText) {
              if (patientSearchInput.value.trim() === selectedPatientText) {
                patientIdInput.value = selectedPatientId;
              }
            }
          }, 200);
        });

        if (patientClearBtn) {
          patientClearBtn.addEventListener('click', () => {
            patientSearchInput.value = '';
            patientIdInput.value = '';
            patientClearBtn.style.display = 'none';
            patientSearchInput.focus();
            showPatientResults();
          });
        }

        patientSearchInput.addEventListener('keydown', (e) => {
          const items = patientDropdown.querySelectorAll('.autocomplete-item');
          if (!items.length || patientDropdown.style.display === 'none') return;

          if (e.key === 'ArrowDown') {
            e.preventDefault();
            activePatientIdx = Math.min(activePatientIdx + 1, items.length - 1);
            items.forEach((li, i) => li.classList.toggle('active', i === activePatientIdx));
            items[activePatientIdx]?.scrollIntoView({ block: 'nearest' });
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            activePatientIdx = Math.max(activePatientIdx - 1, 0);
            items.forEach((li, i) => li.classList.toggle('active', i === activePatientIdx));
            items[activePatientIdx]?.scrollIntoView({ block: 'nearest' });
          } else if (e.key === 'Enter' && activePatientIdx >= 0) {
            e.preventDefault();
            items[activePatientIdx]?.dispatchEvent(new Event('mousedown'));
          } else if (e.key === 'Escape') {
            patientDropdown.style.display = 'none';
          }
        });
      }

      // ---- Treatment autocomplete initializer ----
      const initAutocomplete = (input) => {
        const wrapper = input.closest('.treatment-autocomplete-wrapper');
        if (!wrapper || input._acInitialized) return;
        input._acInitialized = true;
        const dropdown = wrapper.querySelector('.treatment-autocomplete-list');
        const row = input.closest('.quote-item-row');
        let activeIdx = -1;

        const showResults = () => {
          const term = input.value.toLowerCase().trim();
          if (!term) { dropdown.style.display = 'none'; return; }

          const matches = treatmentList.filter(t =>
            t.name.toLowerCase().includes(term) ||
            (t.code && t.code.toLowerCase().includes(term))
          ).slice(0, 10);

          if (matches.length === 0) {
            dropdown.innerHTML = '<li class="no-results">Sin resultados</li>';
            dropdown.style.display = 'block';
            activeIdx = -1;
            return;
          }

          dropdown.innerHTML = matches.map((t, idx) => `
            <li class="autocomplete-item" data-idx="${idx}">
              <span class="treatment-name">${t.name}</span>
              ${t.code ? `<span class="treatment-code">${t.code}</span>` : ''}
              <span class="treatment-price">${formatCurrency(t.default_price || 0)}</span>
            </li>
          `).join('');
          dropdown.style.display = 'block';
          activeIdx = -1;

          dropdown.querySelectorAll('.autocomplete-item').forEach((li, idx) => {
            li.addEventListener('mousedown', (e) => {
              e.preventDefault();
              const selected = matches[idx];
              input.value = selected.name;
              const priceInput = row.querySelector('input[name^="item_price_"]');
              if (priceInput) priceInput.value = parseFloat(selected.default_price || 0).toFixed(2);
              dropdown.style.display = 'none';
            });
          });
        };

        input.addEventListener('input', showResults);
        input.addEventListener('focus', () => { if (input.value.trim()) showResults(); });
        input.addEventListener('blur', () => { setTimeout(() => { dropdown.style.display = 'none'; }, 150); });

        input.addEventListener('keydown', (e) => {
          const items = dropdown.querySelectorAll('.autocomplete-item');
          if (!items.length || dropdown.style.display === 'none') return;

          if (e.key === 'ArrowDown') {
            e.preventDefault();
            activeIdx = Math.min(activeIdx + 1, items.length - 1);
            items.forEach((li, i) => li.classList.toggle('active', i === activeIdx));
            items[activeIdx]?.scrollIntoView({ block: 'nearest' });
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            activeIdx = Math.max(activeIdx - 1, 0);
            items.forEach((li, i) => li.classList.toggle('active', i === activeIdx));
            items[activeIdx]?.scrollIntoView({ block: 'nearest' });
          } else if (e.key === 'Enter' && activeIdx >= 0) {
            e.preventDefault();
            items[activeIdx]?.dispatchEvent(new Event('mousedown'));
          } else if (e.key === 'Escape') {
            dropdown.style.display = 'none';
          }
        });
      };

      // Init autocomplete on existing item rows
      document.querySelectorAll('#quote-items-container .quote-item-desc').forEach(initAutocomplete);

      // Add-item button handler
      const addBtn = document.getElementById('add-item-btn');
      if (addBtn) {
        addBtn.addEventListener('click', () => {
          const container = document.getElementById('quote-items-container');
          const idx = container.children.length;
          const div = document.createElement('div');
          div.className = 'quote-item-row';
          div.style.marginTop = 'var(--space-2)';
          div.innerHTML = `
            <div class="treatment-autocomplete-wrapper">
              <input type="text" name="item_desc_${idx}" class="form-input quote-item-desc" placeholder="Buscar tratamiento..." autocomplete="off" required />
              <ul class="treatment-autocomplete-list"></ul>
            </div>
            <input type="number" name="item_qty_${idx}" class="form-input" placeholder="Cant." value="1" min="1" required />
            <input type="number" step="0.01" name="item_price_${idx}" class="form-input" placeholder="Precio $" min="0" required />
            <input type="number" step="0.01" name="item_discount_${idx}" class="form-input" placeholder="Desc. %" value="0" min="0" max="100" />
          `;
          container.appendChild(div);
          // Init autocomplete on the new input and focus it
          const newInput = div.querySelector('.quote-item-desc');
          initAutocomplete(newInput);
          newInput.focus();
        });
      }
    }, 50);
  }

  showDeleteConfirm(quoteId, onSuccess = null) {
    const q = (this.quotationsList || []).find(q => q.id == quoteId);
    const label = q ? `# ${q.quote_number}` : 'este presupuesto';

    Modal.confirm(
      'Eliminar Presupuesto',
      `¿Está seguro de eliminar ${label}? Esta acción es reversible (desactivación lógica).`,
      async () => {
        try {
          await quotationService.remove(quoteId);
          toast.success('Presupuesto eliminado exitosamente');
          if (onSuccess) {
            await onSuccess();
          } else {
            await this.render();
            this.mount();
          }
          return true;
        } catch (err) {
          toast.error(err.message || 'Error al eliminar presupuesto');
          return false;
        }
      }
    );
  }

  async showStatusModal(quoteId, onSuccess = null) {
    let q = (this.quotationsList || []).find(item => item.id == quoteId);
    if (!q) {
      try {
        const res = await quotationService.getById(quoteId);
        q = res?.data || res;
      } catch (err) {
        toast.error('Error al obtener presupuesto');
        return;
      }
    }
    const currentStatus = q ? q.status : 'borrador';
    const quoteNum = q ? q.quote_number : quoteId;
    const opts = STATUS_OPTIONS.filter(o => o.value !== currentStatus);

    Modal.show({
      title: `Cambiar Estado — Presupuesto #${quoteNum}`,
      content: `
        <p style="margin-bottom: var(--space-3);">Estado actual: <strong class="badge ${STATUS_BADGES[currentStatus] || 'badge-secondary'}">${STATUS_LABELS[currentStatus] || currentStatus}</strong></p>
        <div class="form-group">
          <label class="form-label">Seleccionar Nuevo Estado</label>
          <select id="new-status-select" class="form-select">
            ${opts.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
          </select>
        </div>
      `,
      confirmText: 'Cambiar Estado',
      onConfirm: async (modalBody) => {
        const status = modalBody.querySelector('#new-status-select').value;
        try {
          await quotationService.changeStatus(quoteId, status);
          toast.success(`Estado cambiado a "${STATUS_LABELS[status]}"`);
          if (onSuccess) {
            await onSuccess();
          } else {
            await this.render();
            this.mount();
          }

          // If detail modal overlay is open, refresh it live
          const overlay = document.querySelector('.modal-overlay:has(.quote-manage-hero)');
          if (overlay) {
            Modal.closeAll();
            this.showManageQuoteModal(quoteId, onSuccess);
          }
          return true;
        } catch (err) {
          toast.error(err.message || 'Error al cambiar estado');
          return false;
        }
      }
    });
  }

  async showViewOptionsModal(quotationId, onSuccess = null) {
    let q = null;
    let linkedDocs = [];
    try {
      q = await quotationService.getById(quotationId);
      const res = await invoiceService.getAll({ quotation_id: quotationId, limit: 100 });
      linkedDocs = Array.isArray(res) ? res : (res?.invoices || res?.data || []);
    } catch (err) {
      console.error('Error fetching quotation linked docs:', err);
    }

    if (!q) {
      toast.error('Presupuesto no encontrado');
      return;
    }

    // Si no hay comprobantes vinculados (recibos/facturas), abrir directamente el presupuesto
    if (linkedDocs.length === 0) {
      this.printQuote(quotationId);
      return;
    }

    Modal.show({
      title: `📄 Opciones de Visualización — Presupuesto #${q.quote_number}`,
      content: `
        <div style="display: flex; flex-direction: column; gap: 14px; padding: 6px 0;">
          <button id="view-opt-quote-btn" class="btn btn-outline btn-md" style="display: flex; align-items: center; justify-content: space-between; text-align: left; padding: 14px 16px; border: 1px solid var(--primary-300); background: var(--primary-50, #f0f9ff); border-radius: var(--radius-md); cursor: pointer;">
            <div>
              <div style="font-weight: 700; font-size: 15px; color: var(--primary-900);">📄 Imprimir Presupuesto #${q.quote_number}</div>
              <div style="font-size: 12px; color: var(--primary-700); margin-top: 2px;">Ver documento original de la cotización con desglose de tratamientos</div>
            </div>
            <span style="font-size: 14px; font-weight: 600; color: var(--primary-700);">🖨️ Ver Presupuesto</span>
          </button>

          <div>
            <h4 style="font-size: 14px; margin: 10px 0 8px 0; color: var(--text-primary); font-weight: 600;">
              🧾 Comprobantes de Pago Vinculados (${linkedDocs.length}):
            </h4>
            <div style="display: flex; flex-direction: column; gap: 8px; max-height: 280px; overflow-y: auto;">
              ${linkedDocs.map(doc => `
                <button class="btn btn-outline view-opt-doc-btn" data-id="${doc.id}" data-type="${doc.document_type || 'recibo'}" style="display: flex; align-items: center; justify-content: space-between; text-align: left; padding: 12px 14px; border: 1px solid var(--border-color); border-radius: var(--radius-md); background: #fff; cursor: pointer;">
                  <div>
                    <div style="font-weight: 600; font-size: 14px; color: var(--text-primary);">
                      ${doc.document_type === 'factura' ? '📄 Factura' : '🧾 Recibo de Pago'} #${doc.invoice_number}
                    </div>
                    <div style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">
                      Abono/Cobro: <strong style="color: var(--success-700);">${formatCurrency(doc.amount_paid || doc.total)}</strong> | Fecha: ${formatDate(doc.created_at)}
                    </div>
                  </div>
                  <span class="badge badge-success" style="font-size: 11px; padding: 4px 8px;">🖨️ Imprimir ${doc.document_type === 'factura' ? 'Factura' : 'Recibo'}</span>
                </button>
              `).join('')}
            </div>
          </div>
        </div>
      `,
      showConfirm: false,
      cancelText: 'Cerrar',
    });

    const overlay = document.querySelector('.modal-overlay');
    if (!overlay) return;

    overlay.addEventListener('click', async (e) => {
      const quoteBtn = e.target.closest('#view-opt-quote-btn');
      if (quoteBtn) {
        Modal.close();
        this.printQuote(quotationId);
        return;
      }

      const docBtn = e.target.closest('.view-opt-doc-btn');
      if (docBtn) {
        const docId = docBtn.getAttribute('data-id');
        const docType = docBtn.getAttribute('data-type');
        Modal.close();
        if (docType === 'recibo') {
          const { Receipts } = await import('../receipts/receipts.js');
          const receiptsPage = new Receipts(this.container);
          await receiptsPage.printReceipt(docId);
        } else {
          const { Invoices } = await import('../invoices/invoices.js');
          const invoicesPage = new Invoices(this.container);
          await invoicesPage.printInvoice(docId);
        }
      }
    });
  }

  async printQuote(id) {
    try {
      const quote = await quotationService.getById(id);
      const clinic = state.get('clinicInfo') || {};
      const logoUrl = '/assets/videsDentalLogo.jpg';

      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
        <html>
        <head>
          <title>Presupuesto # ${quote.quote_number}</title>
          <style>
            @page { margin: 20mm 15mm; }
            body { font-family: 'Segoe UI', Arial, sans-serif; padding: 0; margin: 0; color: #333; font-size: 13px; }
            .header { display: flex; align-items: center; gap: 20px; border-bottom: 2px solid #0f86ec; padding-bottom: 16px; margin-bottom: 20px; }
            .header-info { flex: 1; }
            .header-info h2 { margin: 0 0 4px 0; font-size: 18px; color: #0f86ec; }
            .header-info p { margin: 2px 0; color: #555; font-size: 12px; }
            .title-section { text-align: right; margin-bottom: 16px; }
            .title-section h1 { font-size: 22px; color: #111; margin: 0; letter-spacing: 2px; text-transform: uppercase; }
            .title-section p { color: #0f86ec; font-size: 14px; margin: 4px 0 0 0; font-weight: 600; }
            .details { display: flex; justify-content: space-between; margin: 16px 0; padding: 12px 14px; background: #f8f9fa; border-radius: 6px; }
            .details div { font-size: 13px; }
            .details strong { color: #111; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th { background-color: #0f86ec; color: white; padding: 10px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
            td { padding: 10px; border: 1px solid #ddd; font-size: 13px; }
            .totals { text-align: right; margin-top: 24px; padding: 16px; background: #f8f9fa; border-radius: 6px; }
            .totals p { margin: 4px 0; font-size: 14px; }
            .totals h2 { margin: 8px 0 0 0; font-size: 18px; }
            .totals hr { border: none; border-top: 1px solid #ddd; margin: 8px 0; }
            .footer { margin-top: 30px; display: flex; justify-content: space-between; align-items: end; }
            .footer-info { font-size: 11px; color: #999; text-align: right; }
            .print-btn { display: block; margin: 20px auto; padding: 10px 30px; background: #0f86ec; color: white; border: none; border-radius: 6px; font-size: 14px; cursor: pointer; }
            .print-btn:hover { background: #0b6cc4; }
            @media print { .print-btn { display: none !important; } body { padding: 0; } }
          </style>
        </head>
        <body>
          <button class="print-btn" id="print-btn">🖨️ Imprimir / Guardar PDF</button>

          <div class="header">
            <img src="${logoUrl}" alt="Logo" style="height: 60px; width: auto; object-fit: contain;" id="print-logo" />
            <div class="header-info">
              <h2>${clinic.name || 'Clínica Dental'}</h2>
              <p>${clinic.address || ''}${clinic.city ? ', ' + clinic.city : ''}</p>
              <p>${clinic.phone ? 'Tel: ' + clinic.phone : ''}${clinic.email ? ' | ' + clinic.email : ''}${clinic.tax_id ? ' | NIF: ' + clinic.tax_id : ''}</p>
            </div>
          </div>

          <div class="title-section">
            <h1>Presupuesto</h1>
            <p>${quote.quote_number}</p>
          </div>

          <div class="details">
            <div>
              <strong>Paciente:</strong> ${quote.patient_name}<br>
              <strong>Teléfono:</strong> ${quote.patient_phone || 'N/A'}
            </div>
            <div style="text-align: right;">
              <strong>Fecha de Emisión:</strong> ${formatDate(quote.quotation_date || quote.created_at)}<br>
              <strong>Especialista:</strong> Dr/a. ${quote.doctor_name || 'N/A'}
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Tratamiento</th>
                <th>Precio Unitario</th>
                <th>Cant.</th>
                <th>Desc.</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${(quote.items || []).map(item => `
                <tr>
                  <td>${item.description}</td>
                  <td>${formatCurrency(item.unit_price)}</td>
                  <td>${item.quantity}</td>
                  <td>${item.discount || 0}%</td>
                  <td><strong>${formatCurrency(item.total)}</strong></td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="totals">
            <p>Subtotal: ${formatCurrency(quote.subtotal)}</p>
            ${parseFloat(quote.discount_amount || 0) > 0 ? `<p>Descuento: -${formatCurrency(quote.discount_amount)}</p>` : ''}
            ${parseFloat(quote.tax_amount || 0) > 0 ? `<p>IVA (${quote.tax_rate}%): ${formatCurrency(quote.tax_amount)}</p>` : ''}
            <hr/>
            <h2 style="color: #0f86ec;">TOTAL: ${formatCurrency(quote.total)}</h2>
          </div>

          <div class="footer">
            <div></div>
            <div class="footer-info">
              Documento generado por Sistema de Gestión Clínica<br>
              ${new Date().toLocaleDateString()}
            </div>
          </div>
        </body>
        </html>
      `);
      printWindow.document.close();
      const printBtn = printWindow.document.querySelector('.print-btn');
      if (printBtn) printBtn.addEventListener('click', () => printWindow.print());
      const logo = printWindow.document.querySelector('#print-logo');
      if (logo) logo.addEventListener('error', () => { logo.style.display = 'none'; });
    } catch {
      toast.error('Error al generar vista de impresión');
    }
  }

  async showQuotationPaymentModal(quotationId, onSuccess = null) {
    let qRaw;
    try {
      qRaw = await quotationService.getById(quotationId);
    } catch (err) {
      toast.error('Error al obtener datos del presupuesto');
      return;
    }
    const q = qRaw?.data || qRaw;
    if (!q) {
      toast.error('Presupuesto no encontrado');
      return;
    }

    if (q.payment_status === 'pagado' || (q.remaining_balance !== undefined && q.remaining_balance <= 0)) {
      toast.info('Este presupuesto ya se encuentra 100% pagado. No hay saldo pendiente por cobrar.');
      return;
    }

    const items = q.items || [];
    let acceptedItems = items.filter(i => (i.status || 'pendiente') === 'aceptado' && (i.payment_status !== 'pagado') && (i.remaining_balance === undefined || i.remaining_balance > 0.001));
    if (acceptedItems.length === 0 && (q.status === 'aceptada' || q.status === 'parcial')) {
      acceptedItems = items.filter(i => (i.payment_status !== 'pagado') && (i.remaining_balance === undefined || i.remaining_balance > 0.001));
    }
    if (acceptedItems.length === 0) {
      toast.info('Este presupuesto ya se encuentra 100% pagado.');
      return;
    }

    let methods = [];
    try {
      methods = await paymentService.getMethods();
    } catch {
      toast.error('Error al cargar métodos de pago');
    }
    const methodOpts = methods.map(m => `<option value="${m.id}">${m.label || m.name}</option>`).join('');

    const { patientCredit, patientCreditBalance } = await (async () => {
      try {
        const res = await patientService.getCredit(q.patient_id);
        const data = Array.isArray(res) ? res[0] : res;
        const bal = parseFloat(data?.balance || 0);
        return { patientCredit: bal > 0, patientCreditBalance: bal };
      } catch {
        return { patientCredit: false, patientCreditBalance: 0 };
      }
    })();

    const storedTaxRate = parseFloat(q.tax_rate || 0);

    const itemAllocationsCardsHtml = acceptedItems.map(i => {
      const totalPrice = parseFloat(i.total || 0);
      const paidAmount = parseFloat(i.amount_paid || 0);
      const owedAmount = parseFloat(i.remaining_balance !== undefined ? i.remaining_balance : (totalPrice - paidAmount));

      return `
        <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 10px 14px; margin-bottom: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.03);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
            <div>
              <strong style="font-size: 13px; color: var(--text-primary);">${i.description}</strong>
              ${i.tooth_number ? `<span style="font-size: 11px; color: var(--text-secondary); margin-left: 4px;">(Pieza #${i.tooth_number})</span>` : ''}
            </div>
            <div style="text-align: right; font-size: 12px;">
              Total: <strong>${formatCurrency(totalPrice)}</strong> &nbsp;|&nbsp;
              Pagado: <span style="color: var(--success-700); font-weight: 600;">${formatCurrency(paidAmount)}</span> &nbsp;|&nbsp;
              Debe: <strong style="color: ${owedAmount > 0 ? 'var(--warning-700)' : 'var(--success-700)'};">${formatCurrency(owedAmount)}</strong>
            </div>
          </div>
          <div style="display: flex; align-items: center; justify-content: flex-end; gap: 8px;">
            <label style="font-size: 12px; font-weight: 600; color: var(--text-secondary); margin: 0;">Monto a Abonar a este tratamiento ($):</label>
            <input type="number" step="0.01" min="0" max="${owedAmount}" class="form-input quote-item-alloc-input" data-item-id="${i.id}" data-max="${owedAmount}" value="${owedAmount}" style="width: 140px; padding: 4px 8px; font-size: 13px; font-weight: 600; text-align: right;" ${owedAmount <= 0 ? 'disabled readOnly' : ''} />
          </div>
        </div>
      `;
    }).join('');

    const initialTotal = acceptedItems.reduce((acc, i) => {
      const paidAmount = parseFloat(i.amount_paid || 0);
      const owedAmount = parseFloat(i.remaining_balance !== undefined ? i.remaining_balance : (parseFloat(i.total || 0) - paidAmount));
      return acc + Math.max(0, owedAmount);
    }, 0);

    const taxFieldHtml = storedTaxRate > 0 ? `
      <div style="margin-bottom: var(--space-3); background: var(--primary-50); padding: 10px 14px; border-radius: var(--radius-md); border: 1px solid var(--primary-200); font-size: 13px; color: var(--primary-900);">
        ℹ️ Este comprobante aplicará un IVA del <strong>${storedTaxRate}%</strong> sobre este pago.
      </div>
      <input type="hidden" id="quote-pay-tax-rate" name="tax_rate" value="${storedTaxRate}" />
    ` : `
      <div style="margin-bottom: var(--space-3); background: var(--gray-50); padding: 10px 14px; border-radius: var(--radius-md); border: 1px solid var(--border-color); font-size: 13px; color: var(--text-secondary);">
        ℹ️ Este comprobante no lleva IVA (<strong>0%</strong>). El monto íntegro se registrará como neto.
      </div>
      <input type="hidden" id="quote-pay-tax-rate" name="tax_rate" value="0" />
    `;

    const content = `
      <form id="quote-payment-modal-form">
        <div style="margin-bottom: var(--space-4); background: var(--gray-50); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
          <div style="font-weight: 600; font-size: 13px; margin-bottom: 8px; color: var(--text-primary); border-bottom: 1px solid var(--border-color); padding-bottom: 6px;">
            Presupuesto #${q.quote_number} &nbsp;|&nbsp; Paciente: <strong>${q.patient_name || 'N/A'}</strong> — Desglose de Abonos por Tratamiento:
          </div>
          ${itemAllocationsCardsHtml}
        </div>

        <div class="form-group" style="margin-bottom: var(--space-4);">
          <label class="form-label" style="font-weight: 600;">Tipo de Comprobante a Generar para este Pago</label>
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

        <div class="form-group" style="margin-bottom: var(--space-3);">
          <label class="form-label" style="font-weight: 600;">Monto Total a Abonar en este Pago ($)</label>
          <input type="number" step="0.01" id="quote-pay-amount" name="amount" class="form-input" value="${initialTotal}" min="0.01" required />
          <div id="quote-partial-pay-notice" style="display: none; font-size: 12px; color: var(--warning-700); margin-top: 4px; font-weight: 500;">
            ⚡ Se registrará un pago parcial de este presupuesto. Quedará un saldo pendiente que podrá abonarse posteriormente.
          </div>
        </div>

        <div style="background: var(--primary-50); border: 1px solid var(--primary-200); padding: 14px 18px; border-radius: var(--radius-md); margin-bottom: var(--space-4);">
          <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: bold; color: var(--primary-900);">
            <span>TOTAL A PAGAR DE ESTE COMPROBANTE:</span> <span id="quote-summary-total">${formatCurrency(initialTotal)}</span>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Método de Pago</label>
          <select name="payment_method_id" class="form-select" required>
            ${methodOpts}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">No. Referencia / Operación (opcional)</label>
          <input type="text" name="reference_number" class="form-input" placeholder="Ej: TRANS-98765" />
        </div>

        ${patientCredit ? `
        <div style="background: var(--success-50); border: 1px solid var(--success-300); border-radius: var(--radius-md); padding: var(--space-3); margin-bottom: var(--space-3);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <strong style="color: var(--success-800);">🏦 Saldo a Favor Disponible</strong>
            <span style="font-size: 13px; font-weight: 600; color: var(--success-700);">${formatCurrency(patientCreditBalance)}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <label class="form-label" style="margin: 0; white-space: nowrap; font-size: 13px;">Usar saldo:</label>
            <input type="number" id="quote-credit-used-input" name="credit_used" class="form-input" step="0.01" min="0" max="${patientCreditBalance}" value="0" style="width: 150px;" />
            <span style="font-size: 11px; color: var(--text-secondary);">Reduce el efectivo a recibir.</span>
          </div>
        </div>
        ` : ''}

        <div class="form-group">
          <label class="form-label">Notas (opcional)</label>
          <textarea name="notes" class="form-input" rows="2"></textarea>
        </div>
      </form>
    `;

    Modal.show({
      title: 'Registrar Pago y Generar Comprobante',
      content,
      size: 'lg',
      footer: `
        <button class="btn btn-outline" onclick="Modal.close()">Cancelar</button>
        <button class="btn btn-success" id="confirm-quote-payment-btn">💳 Confirmar Pago</button>
      `,
    });

    const amountInput = document.getElementById('quote-pay-amount');
    const noticeDiv = document.getElementById('quote-partial-pay-notice');

    const recalc = () => {
      const P = parseFloat(amountInput?.value || 0);
      if (document.getElementById('quote-summary-total')) document.getElementById('quote-summary-total').textContent = formatCurrency(P);

      if (noticeDiv) {
        noticeDiv.style.display = P < initialTotal ? 'block' : 'none';
      }
    };

    const syncAllocations = () => {
      let sum = 0;
      document.querySelectorAll('.quote-item-alloc-input').forEach(input => {
        sum += parseFloat(input.value || 0);
      });
      if (amountInput) {
        amountInput.value = sum.toFixed(2);
      }
      recalc();
    };

    document.querySelectorAll('.quote-item-alloc-input').forEach(input => {
      input.addEventListener('input', syncAllocations);
    });

    recalc();

    amountInput?.addEventListener('input', recalc);

    document.getElementById('confirm-quote-payment-btn')?.addEventListener('click', async () => {
      const form = document.getElementById('quote-payment-modal-form');
      if (!form) return;
      const formData = new FormData(form);

      const documentType = formData.get('document_type') || 'recibo';
      const amountVal = parseFloat(formData.get('amount') || 0);
      const paymentMethodId = parseInt(formData.get('payment_method_id'), 10);
      const creditUsed = parseFloat(formData.get('credit_used') || 0);
      const referenceNumber = formData.get('reference_number') || null;
      const notes = formData.get('notes') || null;

      const itemAllocations = [];
      document.querySelectorAll('.quote-item-alloc-input').forEach(input => {
        const itemId = parseInt(input.getAttribute('data-item-id'), 10);
        const amount = parseFloat(input.value || 0);
        if (amount > 0) {
          itemAllocations.push({ id: itemId, amount });
        }
      });

      if (itemAllocations.length === 0) {
        toast.error('Debe ingresar un monto de abono mayor a 0 para al menos un tratamiento.');
        return;
      }

      try {
        const acceptedItemIds = acceptedItems.map(i => i.id);
        const invoiceRes = await invoiceService.createFromQuotation(quotationId, acceptedItemIds, documentType, itemAllocations);
        const invObj = invoiceRes?.data || invoiceRes;
        const targetInvoiceId = invObj?.id;
        const docNum = invObj?.invoice_number || '';

        if (!targetInvoiceId) {
          throw new Error('No se pudo generar o asociar el comprobante al presupuesto.');
        }

        const payPayload = {
          invoice_id: targetInvoiceId,
          payment_method_id: paymentMethodId,
          amount: amountVal,
          credit_used: creditUsed,
          reference_number: referenceNumber,
          notes,
          payment_date: new Date().toISOString().split('T')[0],
        };

        const payRes = await paymentService.create(payPayload);
        const invNum = docNum || payRes?.invoice_number || '';
        toast.success(`¡Pago registrado exitosamente! Comprobante #${invNum} generado.`);
        Modal.close();

        // Automatically open the printed receipt or invoice for the payment just made
        try {
          if (documentType === 'recibo') {
            const { Receipts } = await import('../receipts/receipts.js');
            const receiptsPage = new Receipts(this.container);
            await receiptsPage.printReceipt(targetInvoiceId);
          } else {
            const { Invoices } = await import('../invoices/invoices.js');
            const invoicesPage = new Invoices(this.container);
            await invoicesPage.printInvoice(targetInvoiceId);
          }
        } catch (printErr) {
          console.error('Error launching document print view:', printErr);
        }

        if (onSuccess) {
          await onSuccess();
        } else {
          await this.render();
          this.mount();
        }
      } catch (err) {
        toast.error(err.message || 'Error al procesar el pago');
      }
    });
  }
}
