// ============================================
// Vista de Gestión de Presupuestos (Cotizaciones)
// ============================================
import quotationService from '../../services/quotation.service.js';
import invoiceService from '../../services/invoice.service.js';
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
      const response = await quotationService.getAll();
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

    let rows = filtered.map(q => `
      <tr class="clickable-table-row quote-main-row" data-id="${q.id}">
        <td><strong># ${q.quote_number}</strong></td>
        <td>${q.patient_name || '—'}</td>
        <td>${q.doctor_name || 'Sin asignar'}</td>
        <td><strong>${formatCurrency(q.total)}</strong></td>
        <td>
          <span class="badge ${STATUS_BADGES[q.status] || 'badge-secondary'}">${STATUS_LABELS[q.status] || q.status}</span>
          ${q.invoice_id ? `<span class="badge" style="background-color: var(--primary-100); color: var(--primary-800); font-size: 10px; margin-left: 4px; padding: 2px 4px;">Facturado</span>` : ''}
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
              <button class="btn btn-sm btn-manage-quote manage-items-btn" data-id="${q.id}" title="Gestionar Aceptación e Ítems">⚙️ Gestionar Ítems</button>
              ${(q.status === 'aceptada' || q.status === 'parcial') ? `<button class="btn btn-sm btn-success convert-appointment-btn" data-id="${q.id}" title="Agendar Cita de Tratamientos">📅 Agendar Cita</button>` : ''}
              ${!q.invoice_id ? `<button class="btn btn-sm btn-info convert-invoice-btn" data-id="${q.id}" title="Generar Factura de Ítems Aceptados">📄 Facturar Ítems</button>` : ''}
              <button class="btn btn-sm btn-primary edit-quote-btn" data-id="${q.id}" title="Editar Presupuesto">✎ Editar</button>
              <button class="btn btn-sm btn-danger delete-quote-btn" data-id="${q.id}" title="Eliminar Presupuesto">✕ Eliminar</button>
            </div>
          </div>
        </td>
      </tr>
    `).join('');

    if (filtered.length === 0) {
      rows = `<tr><td colspan="7" style="text-align: center; color: var(--text-secondary); padding: var(--space-6);">No se encontraron presupuestos.</td></tr>`;
    }

    tbody.innerHTML = rows;
  }

  mount() {
    this.destroy();
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    this.container.addEventListener('input', (e) => {
      if (e.target && e.target.id === 'quote-search') {
        this.searchQuery = e.target.value;
        this.renderView();
      }
    }, { signal });

    this.container.addEventListener('change', (e) => {
      if (e.target && e.target.id === 'quote-filter-status') {
        this.statusFilter = e.target.value;
        this.renderView();
      }
    }, { signal });

    this.container.addEventListener('click', async (e) => {
      const addBtn = e.target.closest('#add-quote-btn');
      if (addBtn) {
        this.showQuoteModal();
        return;
      }

      const actionBtn = e.target.closest('.view-quote-btn, .manage-items-btn, .convert-appointment-btn, .convert-invoice-btn, .edit-quote-btn, .delete-quote-btn');
      if (actionBtn) {
        const id = actionBtn.getAttribute('data-id');
        if (actionBtn.classList.contains('view-quote-btn')) {
          this.printQuote(id);
        }
        if (actionBtn.classList.contains('manage-items-btn')) {
          this.showManageQuoteModal(id);
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
      const acceptedTotal = acceptedItems.reduce((acc, i) => acc + parseFloat(i.total || 0), 0);
      const totalAmount = parseFloat(qData.total || 0);
      const acceptancePercentage = items.length > 0 ? Math.round((acceptedItems.length / items.length) * 100) : 0;

      const itemsRowsHtml = items.map((item) => {
        const status = item.status || 'pendiente';
        const isInvoiced = !!(item.invoice_id || (qData.invoice_id && status === 'aceptado'));

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
            ${isInvoiced ? `
              <div class="status-toggle-segmented" style="opacity: 0.75;" title="Este tratamiento ya fue facturado y está protegido">
                <button type="button" class="status-toggle-btn active" disabled style="cursor: not-allowed; background: var(--primary-600); color: #fff;">
                  🔒 Facturado
                </button>
              </div>
            ` : `
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
            `}
          </td>
        </tr>
      `}).join('');

      const hasInvoicedItems = items.some(i => i.invoice_id || (qData.invoice_id && i.status === 'aceptado'));

      return `
        <div class="quote-manage-hero">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: var(--space-4); margin-bottom: var(--space-3);">
            <div>
              <h3>Presupuesto #${qData.quote_number}</h3>
              <p style="margin: 0; color: var(--text-secondary); font-size: var(--text-sm);">
                👤 Paciente: <strong>${qData.patient_name || 'N/A'}</strong> &nbsp;|&nbsp; 👨‍⚕️ Doctor: <strong>${qData.doctor_name || 'Sin asignar'}</strong>
              </p>
            </div>
            <div style="text-align: right;">
              <span class="badge ${STATUS_BADGES[qData.status] || 'badge-secondary'}" style="font-size: 14px; padding: 6px 14px; border-radius: 9999px;">
                ${STATUS_LABELS[qData.status] || qData.status}
              </span>
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

        ${hasInvoicedItems ? `
          <div style="background-color: var(--primary-50); border: 1px solid var(--primary-200); color: var(--primary-900); padding: 10px 14px; border-radius: var(--radius-md); font-size: 13px; margin-bottom: var(--space-4); display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 16px;">ℹ️</span>
            <span>Los tratamientos marcados con <strong>🔒 Facturado</strong> ya fueron emitidos en una factura oficial y su estado no puede ser alterado.</span>
          </div>
        ` : ''}

        <div style="display: flex; gap: var(--space-3); margin-bottom: var(--space-4); flex-wrap: wrap; align-items: center;">
          <button id="manage-accept-all-btn" class="btn btn-success btn-md" style="flex: 1; min-width: 220px;">
            ✅ Aceptar Presupuesto Completo
          </button>
          <button id="manage-generate-invoice-btn" class="btn btn-primary btn-md" style="flex: 1; min-width: 240px;" ${acceptedItems.length === 0 ? 'disabled' : ''}>
            📄 Facturar Ítems Aceptados (${acceptedItems.length})
          </button>
        </div>

        <div class="card" style="margin-bottom: var(--space-4); padding: 0; border: 1px solid var(--border-color); overflow: hidden;">
          <div class="table-container" style="max-height: 360px; overflow-y: auto;">
            <table style="margin: 0; border-radius: 0;">
              <thead>
                <tr>
                  <th>Tratamiento / Descripción</th>
                  <th style="text-align: center;">Cant.</th>
                  <th style="text-align: right;">Precio Unit.</th>
                  <th style="text-align: right;">Total</th>
                  <th style="text-align: center;">Estado</th>
                  <th style="text-align: center;">Acción Independiente</th>
                </tr>
              </thead>
              <tbody>
                ${itemsRowsHtml || `<tr><td colspan="6" style="text-align: center; padding: var(--space-6); color: var(--text-secondary);">No hay ítems en este presupuesto.</td></tr>`}
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
        </div>
      `;
    };

    Modal.show({
      title: `Gestionar y Aceptar Presupuesto #${q.quote_number}`,
      content: renderModalContent(q),
      confirmText: 'Cerrar',
      size: 'xl',
      onConfirm: async () => {
        await this.render();
        return true;
      }
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
          await this.render();
        } catch (err) {
          toast.error(err.message || 'Error al aceptar el presupuesto');
        } finally {
          if (acceptAllBtn) acceptAllBtn.disabled = false;
        }
        return;
      }

      const invoiceBtn = e.target.closest('#manage-generate-invoice-btn');
      if (invoiceBtn) {
        Modal.closeAll();
        this.showConvertInvoiceModal(quotationId);
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
          await this.render();
        } catch (err) {
          toast.error(err.message || 'Error al actualizar estado del ítem');
        }
        return;
      }
    });
  }

  async showConvertInvoiceModal(quotationId) {
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
          window.location.hash = '#/invoices';
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

  async showQuoteModal(quoteId = null) {
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
        patientService.getAll({ limit: 200 }),
        doctorService.getAll(),
        treatmentService.getAll({ limit: 500, is_active: true }),
      ]);
    } catch {
      // Fallback: show empty selects / lists
    }
    // api.get returns data array directly
    const patientList = Array.isArray(patients) ? patients : [];
    const doctorList = Array.isArray(doctors) ? doctors : [];
    const treatmentList = Array.isArray(treatments) ? treatments : [];

    const patientOptions = patientList.map(p =>
      `<option value="${p.id}" ${p.id == q.patient_id ? 'selected' : ''}>[${p.custom_id || 'N/A'}] ${p.first_name} ${p.last_name}</option>`
    ).join('');
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
            <label class="form-label">Paciente</label>
            <select name="patient_id" class="form-select" required>
              <option value="">Seleccione un paciente...</option>
              ${patientOptions}
            </select>
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
      size: 'lg',
      onConfirm: async (modalBody) => {
        const form = modalBody.querySelector('#quote-form');
        const formData = new FormData(form);
        const raw = Object.fromEntries(formData.entries());

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
          patient_id: parseInt(raw.patient_id, 10),
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
          await this.render();
          this.mount();
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
            background: var(--bg-primary, #fff);
            border: 1px solid var(--border-color, #ddd);
            border-radius: var(--radius, 8px);
            box-shadow: 0 8px 24px rgba(0,0,0,.15);
          }
          .treatment-autocomplete-list .autocomplete-item {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 10px 14px;
            cursor: pointer;
            font-size: var(--text-sm, 0.875rem);
            border-bottom: 1px solid var(--border-color, #eee);
            transition: background .15s;
          }
          .treatment-autocomplete-list .autocomplete-item:last-child { border-bottom: none; }
          .treatment-autocomplete-list .autocomplete-item:hover,
          .treatment-autocomplete-list .autocomplete-item.active {
            background: var(--primary-50, #eef2ff);
          }
          .treatment-autocomplete-list .treatment-name {
            flex: 1;
            font-weight: 500;
            color: var(--text-primary, #333);
          }
          .treatment-autocomplete-list .treatment-code {
            font-size: 0.75rem;
            color: var(--text-secondary, #888);
            background: var(--bg-secondary, #f5f5f5);
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
            color: var(--text-secondary, #999);
            font-style: italic;
            text-align: center;
          }
        `;
        document.head.appendChild(style);
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

  showDeleteConfirm(quoteId) {
    const q = this.quotationsList.find(q => q.id == quoteId);
    const label = q ? `# ${q.quote_number}` : 'este presupuesto';

    Modal.confirm(
      'Eliminar Presupuesto',
      `¿Está seguro de eliminar ${label}? Esta acción es reversible (desactivación lógica).`,
      async () => {
        try {
          await quotationService.remove(quoteId);
          toast.success('Presupuesto eliminado exitosamente');
          await this.render();
          this.mount();
          return true;
        } catch (err) {
          toast.error(err.message || 'Error al eliminar presupuesto');
          return false;
        }
      }
    );
  }

  showStatusModal(quoteId) {
    const q = this.quotationsList.find(q => q.id == quoteId);
    const opts = STATUS_OPTIONS.filter(o => o.value !== q.status);

    Modal.show({
      title: `Cambiar Estado — # ${q.quote_number}`,
      content: `
        <p style="margin-bottom: var(--space-3);">Estado actual: <strong>${STATUS_LABELS[q.status]}</strong></p>
        <div class="form-group">
          <label class="form-label">Nuevo estado</label>
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
          await this.render();
          this.mount();
          return true;
        } catch (err) {
          toast.error(err.message || 'Error al cambiar estado');
          return false;
        }
      },
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
            <p>Descuento: -${formatCurrency(quote.discount_amount)}</p>
            <p>IVA (${quote.tax_rate}%): ${formatCurrency(quote.tax_amount)}</p>
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
}
