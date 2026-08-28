// ============================================
// Vista de Gestión de Facturas
// ============================================
import invoiceService from '../../services/invoice.service.js';
import paymentService from '../../services/payment.service.js';
import patientService from '../../services/patient.service.js';
import doctorService from '../../services/doctor.service.js';
import treatmentService from '../../services/treatment.service.js';
import quotationService from '../../services/quotation.service.js';
import toast from '../../components/toast/toast.js';
import Modal from '../../components/modal/modal.js';
import state from '../../scripts/state.js';
import { formatDate, formatCurrency } from '../../utils/helpers.js';
import { getInvoiceStatusInfo, formatPaymentMethods } from '../../utils/formatters.js';

export class Invoices {
  constructor(container) {
    this.container = container;
    this.invoicesList = [];
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
      const response = await invoiceService.getAll({ document_type: 'factura' });
      const rawList = Array.isArray(response) ? response : (response?.invoices || response?.data || []);
      this.invoicesList = rawList.filter(i => i.document_type === 'factura' || (!i.document_type && i.invoice_number?.startsWith('FAC')));
      this.renderView();
    } catch (err) {
      toast.error('Error al cargar facturas');
    }
  }

  renderView() {
    let rows = this.invoicesList.map(inv => {
      const receiptTag = inv.receipt_number || inv.receipt_id
        ? `<span class="badge badge-success" style="font-family: monospace; font-size: 12px; padding: 4px 8px; background-color: var(--success-100); color: var(--success-800); border: 1px solid var(--success-300);">🧾 #${inv.receipt_number || inv.receipt_id}</span>`
        : `<span style="color: var(--text-tertiary); font-size: 12px; font-style: italic;">Sin recibo</span>`;

      return `
        <tr class="clickable-table-row invoice-main-row" data-id="${inv.id}">
          <td><strong class="badge badge-info" style="font-family: monospace; font-size: 13px;"># ${inv.invoice_number}</strong></td>
          <td><strong>${inv.patient_name || 'N/A'}</strong></td>
          <td>${receiptTag}</td>
          <td><strong style="color: var(--primary-700);">${formatCurrency(inv.total)}</strong></td>
          <td>${formatDate(inv.created_at)}</td>
          <td style="text-align: right;">
            <button type="button" class="btn btn-sm btn-outline toggle-invoice-actions-btn" data-id="${inv.id}">
              Acciones ▾
            </button>
          </td>
        </tr>
        <tr class="invoice-actions-bar-row" id="invoice-actions-${inv.id}" style="display: none; background: var(--gray-50);">
          <td colspan="6" style="padding: 12px 16px; border-bottom: 2px solid var(--primary-400);">
            <div style="display: flex; gap: var(--space-3); align-items: center; justify-content: space-between; flex-wrap: wrap;">
              <div style="font-size: 13px; font-weight: 600; color: var(--text-primary);">
                🧾 Opciones para Factura #${inv.invoice_number}:
              </div>
              <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                <button class="btn btn-sm btn-outline print-invoice-btn" data-id="${inv.id}">🖨️ Ver / Imprimir Factura</button>
                <button class="btn btn-sm btn-primary edit-invoice-btn" data-id="${inv.id}">✏️ Editar Factura</button>
                <button class="btn btn-sm btn-danger delete-invoice-btn" data-id="${inv.id}">✕ Eliminar Factura</button>
              </div>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    if (this.invoicesList.length === 0) {
      rows = `<tr><td colspan="6" style="text-align: center; color: var(--text-secondary); padding: var(--space-6);">No hay facturas registradas.</td></tr>`;
    }

    this.container.innerHTML = `
      <div class="page-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-6);">
        <div>
          <h1 class="page-title">Facturación</h1>
          <p style="color: var(--text-secondary);">Facturas oficiales emitidas y vinculadas a recibos</p>
        </div>
        <div style="display: flex; gap: var(--space-2);">
          <button id="add-invoice-btn" class="btn btn-primary">+ Nueva Factura</button>
        </div>
      </div>

      <div class="card">
        <div class="card-body table-container">
          <table>
            <thead>
              <tr>
                <th>No. Factura</th>
                <th>Paciente</th>
                <th>Recibo Vinculado (#REC)</th>
                <th>Monto Total</th>
                <th>Fecha Emisión</th>
                <th style="text-align: right;">Acciones</th>
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
    this.destroy();
    this.abortController = new AbortController();

    this.container.addEventListener('click', (e) => {
      const addInvoiceBtn = e.target.closest('#add-invoice-btn');
      if (addInvoiceBtn) {
        this.showAddInvoiceModal();
        return;
      }

      const actionBtn = e.target.closest('.print-invoice-btn, .edit-invoice-btn, .delete-invoice-btn');
      if (actionBtn) {
        const id = actionBtn.getAttribute('data-id');
        if (actionBtn.classList.contains('print-invoice-btn')) {
          this.printInvoice(id);
        }
        if (actionBtn.classList.contains('edit-invoice-btn')) {
          this.showEditInvoiceModal(id);
        }
        if (actionBtn.classList.contains('delete-invoice-btn')) {
          this.confirmDeleteInvoice(id);
        }
        return;
      }

      const mainRow = e.target.closest('.invoice-main-row');
      if (mainRow) {
        const id = mainRow.getAttribute('data-id');
        const targetActionsRow = this.container.querySelector(`#invoice-actions-${id}`);
        if (targetActionsRow) {
          const isOpen = targetActionsRow.style.display !== 'none';
          this.container.querySelectorAll('.invoice-actions-bar-row').forEach(row => row.style.display = 'none');
          this.container.querySelectorAll('.invoice-main-row').forEach(row => row.classList.remove('row-active'));
          if (!isOpen) {
            targetActionsRow.style.display = 'table-row';
            mainRow.classList.add('row-active');
          }
        }
      }
    }, { signal: this.abortController.signal });
  }

  /**
   * Modal para crear una factura manual directamente.
   */
  async showAddInvoiceModal(preSelectedPatientId = null, onSuccess = null) {
    let patients = [];
    let doctors = [];
    let treatments = [];
    let unlinkedReceipts = [];
    try {
      const [resPts, resDocs, resTreats, resReceipts] = await Promise.all([
        patientService.getAll({ limit: 200 }).catch(() => []),
        doctorService.getAll().catch(() => []),
        treatmentService.getAll({ limit: 500, is_active: true }).catch(() => []),
        invoiceService.getAll({ document_type: 'recibo', unlinked_receipts: 'true', limit: 200 }).catch(() => [])
      ]);
      patients = resPts;
      doctors = resDocs;
      treatments = resTreats;
      unlinkedReceipts = Array.isArray(resReceipts) ? resReceipts : (resReceipts?.rows || resReceipts?.data || []);
      if (preSelectedPatientId) {
        unlinkedReceipts = unlinkedReceipts.filter(r => Number(r.patient_id) === Number(preSelectedPatientId));
      }
    } catch {
      // Fallback
    }

    const patientList = Array.isArray(patients) ? patients : (patients.data || []);
    const doctorList = Array.isArray(doctors) ? doctors : [];
    const treatmentList = Array.isArray(treatments) ? treatments : [];

    const patientOptions = patientList.map(p =>
      `<option value="${p.id}" ${preSelectedPatientId && Number(preSelectedPatientId) === Number(p.id) ? 'selected' : ''}>[${p.custom_id || 'N/A'}] ${p.first_name} ${p.last_name}</option>`
    ).join('');

    const doctorOptions = doctorList.map(d =>
      `<option value="${d.id}">${d.first_name} ${d.last_name} (${d.specialty || ''})</option>`
    ).join('');

    const receiptOptions = unlinkedReceipts.map(r =>
      `<option value="${r.id}" data-patient-id="${r.patient_id}" data-doctor-id="${r.doctor_id || ''}" data-number="${r.invoice_number}" data-amount="${r.total}"># ${r.invoice_number} — Paciente: ${r.patient_name || 'N/A'} — Monto: ${formatCurrency(r.total)} (${r.created_at ? formatDate(r.created_at) : ''})</option>`
    ).join('');

    const receiptSectionHtml = unlinkedReceipts.length > 0 ? `
      <div style="margin-bottom: var(--space-4); background: linear-gradient(135deg, var(--primary-50), var(--primary-100)); border: 1px solid var(--primary-300); padding: var(--space-4); border-radius: var(--radius-md);">
        <label class="form-label" style="font-weight: 700; color: var(--primary-900); font-size: 14px; margin-bottom: var(--space-2);">
          🧾 Facturar desde Recibo de Pago Pendiente (Recomendado)
        </label>
        <select name="receipt_id" id="modal-invoice-receipt-select" class="form-select" style="font-size: 14px; font-weight: 600; background-color: #fff;">
          <option value="">-- Seleccionar Recibo para Convertir a Factura Oficial (#FACT) --</option>
          ${receiptOptions}
        </select>
        <p style="font-size: 12px; color: var(--primary-700); margin: 6px 0 0 0;">
          Al seleccionar un recibo, la factura oficial (#FACT) heredará automáticamente los conceptos, el paciente y el monto pagado del recibo.
        </p>
      </div>
      <div style="text-align: center; margin: var(--space-3) 0; color: var(--text-tertiary); font-size: 12px; font-weight: 600;">
        — O bien, cree una factura manual a continuación —
      </div>
    ` : `
      <div style="margin-bottom: var(--space-3); padding: var(--space-3); background-color: var(--gray-50); border: 1px dashed var(--border-color); border-radius: var(--radius-md); font-size: 13px; color: var(--text-secondary);">
        ℹ️ No hay recibos de pago pendientes sin facturar. Complete los siguientes campos para generar una factura manual.
      </div>
    `;

    const content = `
      <form id="add-invoice-form">
        ${receiptSectionHtml}

        <div class="form-row-responsive">
          <div class="form-group">
            <label class="form-label">Paciente <span style="color: var(--danger-500);">*</span></label>
            <select name="patient_id" id="modal-invoice-patient-select" class="form-select" required>
              <option value="">Seleccione un paciente...</option>
              ${patientOptions}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Doctor (Opcional)</label>
            <select name="doctor_id" id="modal-invoice-doctor-select" class="form-select">
              <option value="">Seleccione un doctor...</option>
              ${doctorOptions}
            </select>
          </div>
        </div>

        <div class="form-row-responsive" style="margin-top: var(--space-3);">
          <div class="form-group">
            <label class="form-label">Fecha de Emisión <span style="color: var(--danger-500);">*</span></label>
            <input type="date" name="invoice_date" class="form-input" value="${new Date().toISOString().split('T')[0]}" required />
          </div>
          <div class="form-group">
            <label class="form-label">Fecha de Vencimiento (Opcional)</label>
            <input type="date" name="due_date" class="form-input" />
          </div>
        </div>

        <div class="form-row-3col" style="margin-top: var(--space-3);">
          <div class="form-group">
            <label class="form-label">Descuento Global ($)</label>
            <input type="number" step="0.01" name="discount" class="form-input" value="0.00" min="0" required />
          </div>
          <div class="form-group">
            <label class="form-label">Notas</label>
            <textarea name="notes" class="form-textarea" rows="1" placeholder="Observaciones de la factura..."></textarea>
          </div>
        </div>

        <div id="manual-items-section" style="margin-top: var(--space-4);">
          <label class="form-label" style="display: block; margin-bottom: var(--space-1);">Detalle de Conceptos / Tratamientos <span style="color: var(--danger-500);">*</span></label>
          <div id="invoice-items-container">
            <div class="quote-item-row">
              <div class="treatment-autocomplete-wrapper">
                <input type="text" name="item_desc_0" class="form-input quote-item-desc" placeholder="Buscar tratamiento..." autocomplete="off" required />
                <input type="hidden" name="item_treatment_id_0" class="item-treatment-id" value="" />
                <ul class="treatment-autocomplete-list"></ul>
              </div>
              <input type="number" name="item_qty_0" class="form-input" placeholder="Cant." value="1" min="1" required />
              <input type="number" step="0.01" name="item_price_0" class="form-input" placeholder="Precio $" value="0.00" min="0" required />
              <button type="button" class="btn btn-sm btn-outline btn-danger remove-item-btn" style="padding: 0 8px; font-weight: bold; border-color: transparent;">✕</button>
            </div>
          </div>
          <button type="button" id="add-item-btn" class="btn btn-sm btn-outline" style="margin-top: var(--space-2);">+ Agregar Concepto</button>
        </div>

        <!-- Live Totals Review Box -->
        <div style="margin-top: var(--space-4); background-color: var(--gray-50); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: var(--space-4);">
          <div style="display: flex; flex-direction: column; gap: var(--space-2); max-width: 300px; margin-left: auto;">
            <div style="display: flex; justify-content: space-between; font-size: var(--text-sm);">
              <span style="color: var(--text-secondary);">Subtotal:</span>
              <strong id="calc-subtotal">€0,00</strong>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: var(--text-sm); color: var(--danger-600);">
              <span>Descuento:</span>
              <strong id="calc-discount">-€0,00</strong>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: var(--text-lg); font-weight: 700; border-top: 1px solid var(--border-color); padding-top: var(--space-2); margin-top: var(--space-1);">
              <span>Total Factura:</span>
              <strong id="calc-total" style="color: var(--primary-700);">€0,00</strong>
            </div>
          </div>
        </div>
      </form>
    `;

    Modal.show({
      title: 'Crear Nueva Factura Oficial (#FACT)',
      content: content,
      confirmText: 'Generar Factura',
      size: 'lg',
      onConfirm: async (modalBody) => {
        const form = modalBody.querySelector('#add-invoice-form');
        const formData = new FormData(form);
        const raw = Object.fromEntries(formData.entries());

        const items = [];
        let itemIndex = 0;
        // Collect dynamic item rows
        while (raw[`item_desc_${itemIndex}`] !== undefined) {
          if (raw[`item_desc_${itemIndex}`].trim()) {
            const item = {
              description: raw[`item_desc_${itemIndex}`].trim(),
              quantity: parseInt(raw[`item_qty_${itemIndex}`], 10) || 1,
              unit_price: parseFloat(raw[`item_price_${itemIndex}`]) || 0,
            };
            const tid = raw[`item_treatment_id_${itemIndex}`];
            if (tid) item.treatment_id = parseInt(tid, 10);
            items.push(item);
          }
          itemIndex++;
        }

        if (raw.receipt_id) {
          if (items.length === 0) {
            toast.error('Debe incluir al menos un concepto en la factura');
            return false;
          }
          try {
            await invoiceService.createFromReceipt(raw.receipt_id, {
              patient_id: raw.patient_id ? parseInt(raw.patient_id, 10) : undefined,
              doctor_id: raw.doctor_id ? parseInt(raw.doctor_id, 10) : undefined,
              notes: raw.notes || undefined,
              discount: parseFloat(raw.discount) || 0,
              items: items,
            });
            toast.success('¡Factura oficial (#FACT) creada exitosamente a partir del recibo!');
            if (onSuccess) {
              await onSuccess();
            } else {
              await this.render();
              this.mount();
            }
            return true;
          } catch (err) {
            toast.error(err.message || 'Error al generar factura oficial desde el recibo');
            return false;
          }
        }

        if (items.length === 0) {
          toast.error('Debe incluir al menos un concepto o seleccionar un recibo de pago');
          return false;
        }

        const payload = {
          patient_id: parseInt(raw.patient_id, 10),
          doctor_id: raw.doctor_id ? parseInt(raw.doctor_id, 10) : undefined,
          invoice_date: raw.invoice_date || undefined,
          due_date: raw.due_date || undefined,
          tax_rate: 0,
          discount: parseFloat(raw.discount) || 0,
          notes: raw.notes || undefined,
          items,
        };

        try {
          await invoiceService.create(payload);
          toast.success('Factura manual creada exitosamente');
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
            modalBody.querySelector('#add-invoice-form').prepend(summary);
          } else {
            toast.error(err.message || 'Error al guardar la factura');
          }
          return false;
        }
      }
    });

    // Autocomplete list style injections & helper logic
    setTimeout(() => {
      // Inject treatment autocomplete styles if not present
      if (!document.getElementById('treatment-autocomplete-styles')) {
        const style = document.createElement('style');
        style.id = 'treatment-autocomplete-styles';
        style.textContent = `
          .quote-item-row {
            display: grid;
            grid-template-columns: 2fr 1fr 1.5fr auto;
            gap: var(--space-2);
            align-items: center;
            margin-bottom: var(--space-2);
          }
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

      const modalBody = document.querySelector('.modal-body');
      if (!modalBody) return;

      // Live totals calculation logic
      const recalculate = () => {
        let subtotal = 0;
        const rows = modalBody.querySelectorAll('.quote-item-row');
        rows.forEach((row) => {
          const qtyInput = row.querySelector('input[name^="item_qty_"]');
          const priceInput = row.querySelector('input[name^="item_price_"]');
          const qty = parseInt(qtyInput?.value || 0, 10);
          const price = parseFloat(priceInput?.value || 0);
          subtotal += qty * price;
        });

        const discount = parseFloat(modalBody.querySelector('input[name="discount"]')?.value || 0);
        const total = Math.max(0, subtotal - discount);

        modalBody.querySelector('#calc-subtotal').textContent = formatCurrency(subtotal);
        modalBody.querySelector('#calc-discount').textContent = `-${formatCurrency(discount)}`;
        modalBody.querySelector('#calc-total').textContent = formatCurrency(total);
      };

      // Add event listeners for recalculations
      modalBody.addEventListener('input', (e) => {
        if (e.target.name === 'discount' || e.target.name.startsWith('item_qty_') || e.target.name.startsWith('item_price_')) {
          recalculate();
        }
      });

      // Autocomplete setup
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
              const treatmentIdInput = row.querySelector('.item-treatment-id');
              if (treatmentIdInput) treatmentIdInput.value = selected.id;
              dropdown.style.display = 'none';
              recalculate();
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

      // Initial row autocomplete
      document.querySelectorAll('#invoice-items-container .quote-item-desc').forEach(initAutocomplete);

      // Handle item removal
      modalBody.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-item-btn')) {
          const rowsContainer = modalBody.querySelector('#invoice-items-container');
          if (rowsContainer.children.length > 1) {
            e.target.closest('.quote-item-row').remove();
            // Re-index all item fields
            rowsContainer.querySelectorAll('.quote-item-row').forEach((row, i) => {
              row.querySelector('.quote-item-desc').name = `item_desc_${i}`;
              row.querySelector('.item-treatment-id').name = `item_treatment_id_${i}`;
              row.querySelector('input[placeholder="Cant."]').name = `item_qty_${i}`;
              row.querySelector('input[placeholder="Precio $"]').name = `item_price_${i}`;
            });
            recalculate();
          } else {
            toast.error('Debe haber al menos un concepto en la factura');
          }
        }
      });

      // Add-item button handler
      const addItemBtn = modalBody.querySelector('#add-item-btn');
      if (addItemBtn) {
        addItemBtn.addEventListener('click', () => {
          const container = modalBody.querySelector('#invoice-items-container');
          const idx = container.children.length;
          const div = document.createElement('div');
          div.className = 'quote-item-row';
          div.innerHTML = `
            <div class="treatment-autocomplete-wrapper">
              <input type="text" name="item_desc_${idx}" class="form-input quote-item-desc" placeholder="Buscar tratamiento..." autocomplete="off" required />
              <input type="hidden" name="item_treatment_id_${idx}" class="item-treatment-id" value="" />
              <ul class="treatment-autocomplete-list"></ul>
            </div>
            <input type="number" name="item_qty_${idx}" class="form-input" placeholder="Cant." value="1" min="1" required />
            <input type="number" step="0.01" name="item_price_${idx}" class="form-input" placeholder="Precio $" value="0.00" min="0" required />
            <button type="button" class="btn btn-sm btn-outline btn-danger remove-item-btn" style="padding: 0 8px; font-weight: bold; border-color: transparent;">✕</button>
          `;
          container.appendChild(div);
          initAutocomplete(div.querySelector('.quote-item-desc'));
          div.querySelector('.quote-item-desc').focus();
          recalculate();
        });
      }

      // Receipt select change handler to auto-populate patient, doctor and editable line items
      const receiptSelect = modalBody.querySelector('#modal-invoice-receipt-select');
      const patientSelect = modalBody.querySelector('#modal-invoice-patient-select');
      const doctorSelect = modalBody.querySelector('#modal-invoice-doctor-select');
      const notesTextarea = modalBody.querySelector('textarea[name="notes"]');
      const container = modalBody.querySelector('#invoice-items-container');

      if (receiptSelect) {
        receiptSelect.addEventListener('change', async () => {
          const selectedReceiptId = receiptSelect.value;
          if (!selectedReceiptId) return;

          try {
            const receipt = await invoiceService.getById(selectedReceiptId);
            if (receipt) {
              if (patientSelect && receipt.patient_id) {
                patientSelect.value = String(receipt.patient_id);
              }
              if (doctorSelect && receipt.doctor_id) {
                doctorSelect.value = String(receipt.doctor_id);
              }
              if (notesTextarea) {
                notesTextarea.value = receipt.notes || `Factura oficial vinculada al Recibo #${receipt.invoice_number}`;
              }

              if (container && Array.isArray(receipt.items) && receipt.items.length > 0) {
                container.innerHTML = '';
                receipt.items.forEach((item, idx) => {
                  const desc = item.clean_description || item.description || 'Tratamiento Odontológico';
                  const qty = parseInt(item.quantity || 1, 10);
                  const price = parseFloat(item.unit_price || item.total || 0);
                  const tid = item.treatment_id || '';

                  const div = document.createElement('div');
                  div.className = 'quote-item-row';
                  div.innerHTML = `
                    <div class="treatment-autocomplete-wrapper">
                      <input type="text" name="item_desc_${idx}" class="form-input quote-item-desc" placeholder="Buscar o escribir tratamiento..." value="${desc}" autocomplete="off" required />
                      <input type="hidden" name="item_treatment_id_${idx}" class="item-treatment-id" value="${tid}" />
                      <ul class="treatment-autocomplete-list"></ul>
                    </div>
                    <input type="number" name="item_qty_${idx}" class="form-input" placeholder="Cant." value="${qty}" min="1" required />
                    <input type="number" step="0.01" name="item_price_${idx}" class="form-input" placeholder="Precio $" value="${price.toFixed(2)}" min="0" required />
                    <button type="button" class="btn btn-sm btn-outline btn-danger remove-item-btn" style="padding: 0 8px; font-weight: bold; border-color: transparent;">✕</button>
                  `;
                  container.appendChild(div);
                  initAutocomplete(div.querySelector('.quote-item-desc'));
                });
                recalculate();
              }
            }
          } catch (err) {
            console.warn('Error cargando datos del recibo:', err);
          }
        });
      }
    }, 50);
  }



  async showRegisterPaymentModal(invoiceId, onSuccess = null) {
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
          <label class="form-label">Fecha del Pago</label>
          <input type="date" name="payment_date" class="form-input" value="${new Date().toISOString().split('T')[0]}" required />
        </div>
        <div class="form-group" style="margin-top: var(--space-3);">
          <label class="form-label">Montante del Pago ($)</label>
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
        data.invoice_id = parseInt(invoiceId, 10);
        data.amount = parseFloat(data.amount || 0);
        data.payment_method_id = parseInt(data.payment_method_id, 10);

        try {
          await paymentService.create(data);
          toast.success('Pago registrado exitosamente');
          if (onSuccess) {
            await onSuccess();
          } else {
            await this.render();
            this.mount();
          }
          return true;
        } catch (err) {
          toast.error(err.message || 'Error al guardar el pago');
          return false;
        }
      }
    });
  }

  async confirmDeleteInvoice(id, onSuccess = null) {
    Modal.show({
      title: 'Eliminar Factura',
      content: `
        <div style="text-align: center; padding: var(--space-2);">
          <div style="font-size: 48px; margin-bottom: var(--space-2); color: var(--danger-500);">&#9888;</div>
          <h3>Eliminar Factura</h3>
          <p style="color: var(--text-secondary);">Esta acci&oacute;n eliminar&aacute; la factura permanentemente. ¿Est&aacute; seguro?</p>
        </div>
      `,
      confirmText: 'Eliminar',
      confirmClass: 'btn-danger',
      onConfirm: async () => {
        try {
          await invoiceService.remove(id);
          toast.success('Factura eliminada exitosamente');
          if (onSuccess) {
            await onSuccess();
          } else {
            await this.render();
            this.mount();
          }
          return true;
        } catch (err) {
          toast.error(err.message || 'Error al eliminar la factura');
          return false;
        }
      }
    });
  }

  async printInvoice(id) {
    try {
      const invoice = await invoiceService.getById(id);
      const clinic = state.get('clinicInfo') || {};
      const logoUrl = '/assets/videsDentalLogo.jpg';

      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
        <html>
        <head>
          <title>Factura # ${invoice.invoice_number}</title>
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
            <h1>Factura</h1>
            <p>${invoice.invoice_number}</p>
          </div>

          <div class="details">
            <div>
              <strong>Paciente:</strong> ${invoice.patient_name || 'N/A'}<br>
              <strong>DNI:</strong> ${invoice.patient_dni || 'N/A'}
            </div>
            <div style="text-align: right;">
              <strong>Fecha de Emisión:</strong> ${formatDate(invoice.created_at)}<br>
              <strong>Especialista:</strong> Dr/a. ${invoice.doctor_name || 'N/A'}
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Descripción del Servicio</th>
                <th style="text-align: right;">Precio Unitario</th>
                <th style="text-align: center;">Cant.</th>
                <th style="text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${(invoice.items || []).map(item => {
                let displayDesc = item.clean_description || item.description;

                return `
                  <tr>
                    <td>
                      <div><strong>${displayDesc}</strong></div>
                    </td>
                    <td style="text-align: right;">${formatCurrency(item.unit_price)}</td>
                    <td style="text-align: center;">${item.quantity}</td>
                    <td style="text-align: right;"><strong>${formatCurrency(item.total)}</strong></td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <div class="totals">
            <p>Subtotal: ${formatCurrency(invoice.subtotal)}</p>
            <p>Descuento: -${formatCurrency(invoice.discount_amount)}</p>
            <p>Montante Pagado: ${formatCurrency(invoice.amount_paid)}</p>
            <p>Método de Pago: ${formatPaymentMethods(invoice)}</p>
            <hr/>
            <h2>Saldo Restante: ${formatCurrency(invoice.balance)}</h2>
            <h2 style="color: #0f86ec;">TOTAL FACTURA: ${formatCurrency(invoice.total)}</h2>
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
      toast.error('Error al generar vista de impresión de factura');
    }
  }

  async showChangeInvoiceStatusModal(invoiceId, onSuccess = null) {
    let invoice;
    try {
      invoice = await invoiceService.getById(invoiceId);
    } catch {
      toast.error('Error al obtener datos de la factura');
      return;
    }

    const currentStatus = invoice.status || 'pendiente';
    const statusOptions = [
      { value: 'pendiente', label: 'Pendiente / Abierta' },
      { value: 'parcial', label: 'Parcialmente Pagada' },
      { value: 'pagada', label: 'Pagada / Cerrada' },
      { value: 'cancelada', label: 'Cancelada / Anulada' },
    ];

    const optionsHtml = statusOptions.map(opt => 
      `<option value="${opt.value}" ${opt.value === currentStatus ? 'selected' : ''}>${opt.label}</option>`
    ).join('');

    const content = `
      <form id="change-status-form">
        <div style="background-color: var(--gray-50); padding: var(--space-3); border-radius: var(--radius-md); margin-bottom: var(--space-3); border: 1px solid var(--border-color);">
          <p style="margin: 0 0 4px 0;">Factura: <strong># ${invoice.invoice_number}</strong> | Paciente: <strong>${invoice.patient_name || 'N/A'}</strong></p>
          <p style="margin: 0;">Estado actual: <strong class="badge ${getInvoiceStatusInfo(currentStatus).class}">${getInvoiceStatusInfo(currentStatus).label}</strong></p>
        </div>
        <div class="form-group">
          <label class="form-label">Seleccionar Nuevo Estado <span style="color: var(--danger-500);">*</span></label>
          <select name="status" class="form-select" required>
            ${optionsHtml}
          </select>
        </div>
        <div class="alert alert-info" style="margin-top: var(--space-3); font-size: 13px;">
          💡 Al cambiar el estado de la factura, los saldos del paciente, tratamientos vinculados y presupuestos se actualizarán automáticamente.
        </div>
      </form>
    `;

    Modal.show({
      title: `Cambiar Estado — Factura #${invoice.invoice_number}`,
      content,
      confirmText: 'Guardar Estado',
      onConfirm: async (modalBody) => {
        const form = modalBody.querySelector('#change-status-form');
        const formData = new FormData(form);
        const newStatus = formData.get('status');

        try {
          await invoiceService.update(invoiceId, { status: newStatus });
          toast.success(`Estado de factura cambiado a "${getInvoiceStatusInfo(newStatus).label}"`);
          if (onSuccess) {
            await onSuccess();
          } else {
            await this.render();
            this.mount();
          }
          return true;
        } catch (err) {
          toast.error(err.message || 'Error al cambiar estado de la factura');
          return false;
        }
      }
    });
  }

  async showEditInvoiceModal(invoiceId, onSuccess = null) {
    let invoice, doctors = [], treatments = [];
    try {
      [invoice, doctors, treatments] = await Promise.all([
        invoiceService.getById(invoiceId),
        doctorService.getAll(),
        treatmentService.getAll({ limit: 500, is_active: true }),
      ]);
    } catch {
      toast.error('Error al obtener datos para edición de factura');
      return;
    }

    const doctorList = Array.isArray(doctors) ? doctors : [];
    const treatmentList = Array.isArray(treatments) ? treatments : [];

    const doctorOptions = doctorList.map(d =>
      `<option value="${d.id}" ${d.id === invoice.doctor_id ? 'selected' : ''}>${d.first_name} ${d.last_name} (${d.specialty || ''})</option>`
    ).join('');

    const invoiceDateVal = invoice.created_at ? invoice.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10);
    const dueDateVal = invoice.due_date ? invoice.due_date.slice(0, 10) : '';

    let itemsRows = (invoice.items || []).map((item, idx) => `
      <div class="quote-item-row" data-index="${idx}" style="display: flex; gap: var(--space-2); align-items: flex-start; margin-bottom: var(--space-2);">
        <div class="treatment-autocomplete-wrapper" style="flex: 2; position: relative;">
          <input type="text" name="item_desc_${idx}" class="form-input quote-item-desc" placeholder="Buscar o escribir tratamiento..." value="${item.description || ''}" autocomplete="off" required />
          <input type="hidden" name="item_treatment_id_${idx}" class="item-treatment-id" value="${item.treatment_id || ''}" />
          <ul class="treatment-autocomplete-list" style="display: none; position: absolute; background: white; border: 1px solid var(--border-color); border-radius: var(--radius-md); box-shadow: var(--shadow-md); max-height: 200px; overflow-y: auto; z-index: 100; width: 100%;"></ul>
        </div>
        <div style="width: 80px;">
          <input type="number" name="item_tooth_${idx}" class="form-input" placeholder="Diente" value="${item.tooth_number || ''}" min="1" max="32" />
        </div>
        <div style="width: 70px;">
          <input type="number" name="item_qty_${idx}" class="form-input item-qty" value="${item.quantity || 1}" min="1" placeholder="Cant." required />
        </div>
        <div style="width: 110px;">
          <input type="number" name="item_price_${idx}" class="form-input item-price" value="${item.unit_price || 0}" step="0.01" min="0" placeholder="Precio $" required />
        </div>
        <div style="width: 30px; padding-top: 4px;">
          <button type="button" class="btn btn-sm btn-outline remove-item-btn" style="color: var(--danger-600); border-color: var(--danger-200); padding: 4px 8px;" title="Eliminar ítem">✕</button>
        </div>
      </div>
    `).join('');

    if (!itemsRows) {
      itemsRows = `
        <div class="quote-item-row" data-index="0" style="display: flex; gap: var(--space-2); align-items: flex-start; margin-bottom: var(--space-2);">
          <div class="treatment-autocomplete-wrapper" style="flex: 2; position: relative;">
            <input type="text" name="item_desc_0" class="form-input quote-item-desc" placeholder="Buscar tratamiento..." autocomplete="off" required />
            <input type="hidden" name="item_treatment_id_0" class="item-treatment-id" value="" />
            <ul class="treatment-autocomplete-list" style="display: none; position: absolute; background: white; border: 1px solid var(--border-color); border-radius: var(--radius-md); box-shadow: var(--shadow-md); max-height: 200px; overflow-y: auto; z-index: 100; width: 100%;"></ul>
          </div>
          <div style="width: 80px;">
            <input type="number" name="item_tooth_0" class="form-input" placeholder="Diente" min="1" max="32" />
          </div>
          <div style="width: 70px;">
            <input type="number" name="item_qty_0" class="form-input item-qty" value="1" min="1" placeholder="Cant." required />
          </div>
          <div style="width: 110px;">
            <input type="number" name="item_price_0" class="form-input item-price" value="0.00" step="0.01" min="0" placeholder="Precio $" required />
          </div>
          <div style="width: 30px; padding-top: 4px;">
            <button type="button" class="btn btn-sm btn-outline remove-item-btn" style="color: var(--danger-600); border-color: var(--danger-200); padding: 4px 8px;" title="Eliminar ítem">✕</button>
          </div>
        </div>
      `;
    }

    const content = `
      <form id="edit-invoice-form">
        <div style="background-color: var(--gray-50); padding: var(--space-3); border-radius: var(--radius-md); margin-bottom: var(--space-3); border: 1px solid var(--border-color);">
          <strong>Factura #${invoice.invoice_number}</strong> — Paciente: <strong>${invoice.patient_name || 'N/A'}</strong>
        </div>
        <div class="form-row-responsive">
          <div class="form-group">
            <label class="form-label">Doctor Responsable</label>
            <select name="doctor_id" class="form-select">
              <option value="">Seleccione un doctor...</option>
              ${doctorOptions}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Estado de Factura</label>
            <select name="status" class="form-select">
              <option value="pendiente" ${invoice.status === 'pendiente' ? 'selected' : ''}>Pendiente / Abierta</option>
              <option value="parcial" ${invoice.status === 'parcial' ? 'selected' : ''}>Parcialmente Pagada</option>
              <option value="pagada" ${invoice.status === 'pagada' ? 'selected' : ''}>Pagada / Cerrada</option>
              <option value="cancelada" ${invoice.status === 'cancelada' ? 'selected' : ''}>Cancelada / Anulada</option>
            </select>
          </div>
        </div>

        <div class="form-row-responsive" style="margin-top: var(--space-3);">
          <div class="form-group">
            <label class="form-label">Fecha de Emisión</label>
            <input type="date" name="invoice_date" class="form-input" value="${invoiceDateVal}" />
          </div>
          <div class="form-group">
            <label class="form-label">Fecha de Vencimiento</label>
            <input type="date" name="due_date" class="form-input" value="${dueDateVal}" />
          </div>
        </div>

        <div style="margin-top: var(--space-4);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-2);">
            <label class="form-label" style="margin: 0; font-weight: 600;">Conceptos / Tratamientos <span style="color: var(--danger-500);">*</span></label>
            <button type="button" id="add-item-btn" class="btn btn-sm btn-outline">+ Agregar Ítem</button>
          </div>
          <div id="invoice-items-container">
            ${itemsRows}
          </div>
        </div>

        <div class="form-row-responsive" style="margin-top: var(--space-4);">
          <div class="form-group" style="flex: 2;">
            <label class="form-label">Notas / Observaciones</label>
            <textarea name="notes" class="form-textarea" rows="3">${invoice.notes || ''}</textarea>
          </div>
          <div class="form-group" style="flex: 1; background: var(--gray-50); padding: var(--space-3); border-radius: var(--radius-md); border: 1px solid var(--border-color);">
            <div class="form-group" style="margin-bottom: var(--space-2);">
              <label class="form-label" style="font-size: var(--text-xs);">Descuento ($)</label>
              <input type="number" name="discount" class="form-input" value="${invoice.discount_amount || 0}" step="0.01" min="0" />
            </div>
            <div style="border-top: 1px solid var(--border-color); padding-top: var(--space-2); margin-top: var(--space-2); display: flex; flex-direction: column; gap: 4px;">
              <div style="display: flex; justify-content: space-between; font-size: 13px;">
                <span>Subtotal:</span>
                <strong id="calc-subtotal">${formatCurrency(invoice.subtotal || 0)}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 13px; color: var(--danger-600);">
                <span>Descuento:</span>
                <strong id="calc-discount">-${formatCurrency(invoice.discount_amount || 0)}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 15px; font-weight: 700; border-top: 1px solid var(--border-color); padding-top: 4px;">
                <span>Total Factura:</span>
                <strong id="calc-total" style="color: var(--primary-700);">${formatCurrency(invoice.total || 0)}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 12px; color: var(--success-600); margin-top: 2px;">
                <span>Pagado:</span>
                <strong>${formatCurrency(invoice.amount_paid || 0)}</strong>
              </div>
            </div>
          </div>
        </div>
      </form>
    `;

    Modal.show({
      title: `Editar Factura #${invoice.invoice_number}`,
      content,
      confirmText: 'Guardar Cambios',
      size: 'lg',
      onConfirm: async (modalBody) => {
        const form = modalBody.querySelector('#edit-invoice-form');
        const formData = new FormData(form);
        const raw = Object.fromEntries(formData.entries());

        const items = [];
        let itemIndex = 0;
        while (raw[`item_desc_${itemIndex}`] !== undefined) {
          if (raw[`item_desc_${itemIndex}`].trim()) {
            const item = {
              description: raw[`item_desc_${itemIndex}`].trim(),
              quantity: parseInt(raw[`item_qty_${itemIndex}`], 10) || 1,
              unit_price: parseFloat(raw[`item_price_${itemIndex}`]) || 0,
            };
            const tid = raw[`item_treatment_id_${itemIndex}`];
            if (tid) item.treatment_id = parseInt(tid, 10);
            const tooth = raw[`item_tooth_${itemIndex}`];
            if (tooth) item.tooth_number = parseInt(tooth, 10);
            items.push(item);
          }
          itemIndex++;
        }

        if (items.length === 0) {
          toast.error('Debe incluir al menos un concepto en la factura');
          return false;
        }

        const payload = {
          doctor_id: raw.doctor_id ? parseInt(raw.doctor_id, 10) : undefined,
          status: raw.status,
          invoice_date: raw.invoice_date || undefined,
          due_date: raw.due_date || undefined,
          tax_rate: 0,
          discount: parseFloat(raw.discount) || 0,
          notes: raw.notes || undefined,
          items,
        };

        try {
          await invoiceService.update(invoiceId, payload);
          toast.success('Factura actualizada y cambios sincronizados en todo el sistema');
          if (onSuccess) {
            await onSuccess();
          } else {
            await this.render();
            this.mount();
          }
          return true;
        } catch (err) {
          toast.error(err.message || 'Error al actualizar la factura');
          return false;
        }
      }
    });

    // Wire up autocomplete and dynamic calculation events inside modalBody
    setTimeout(() => {
      this.attachInvoiceModalEvents(treatmentList, parseFloat(invoice.amount_paid || 0));
    }, 50);
  }

  attachInvoiceModalEvents(treatmentList, amountPaid = 0) {
    const modalBody = document.querySelector('.modal-body');
    if (!modalBody) return;

    const recalculate = () => {
      let subtotal = 0;
      const rows = modalBody.querySelectorAll('.quote-item-row');
      rows.forEach((row) => {
        const qtyInput = row.querySelector('input[name^="item_qty_"]');
        const priceInput = row.querySelector('input[name^="item_price_"]');
        const qty = parseInt(qtyInput?.value || 0, 10);
        const price = parseFloat(priceInput?.value || 0);
        subtotal += qty * price;
      });

      const discount = parseFloat(modalBody.querySelector('input[name="discount"]')?.value || 0);
      const total = Math.max(0, parseFloat((subtotal - discount).toFixed(2)));
      const balance = Math.max(0, parseFloat((total - amountPaid).toFixed(2)));

      if (modalBody.querySelector('#calc-subtotal')) modalBody.querySelector('#calc-subtotal').textContent = formatCurrency(subtotal);
      if (modalBody.querySelector('#calc-discount')) modalBody.querySelector('#calc-discount').textContent = `-${formatCurrency(discount)}`;
      if (modalBody.querySelector('#calc-total')) modalBody.querySelector('#calc-total').textContent = formatCurrency(total);
      if (modalBody.querySelector('#calc-balance')) modalBody.querySelector('#calc-balance').textContent = formatCurrency(balance);
    };

    modalBody.addEventListener('input', (e) => {
      if (e.target.name === 'discount' || e.target.name.startsWith('item_qty_') || e.target.name.startsWith('item_price_')) {
        recalculate();
      }
    });

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
          dropdown.innerHTML = '<li class="no-results" style="padding: 8px 12px; color: var(--text-secondary);">Sin resultados</li>';
          dropdown.style.display = 'block';
          activeIdx = -1;
          return;
        }

        dropdown.innerHTML = matches.map((t, idx) => `
          <li class="autocomplete-item" data-idx="${idx}" style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid var(--border-color-light); display: flex; justify-content: space-between;">
            <span class="treatment-name"><strong>${t.name}</strong></span>
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
            const treatmentIdInput = row.querySelector('.item-treatment-id');
            if (treatmentIdInput) treatmentIdInput.value = selected.id;
            dropdown.style.display = 'none';
            recalculate();
          });
        });
      };

      input.addEventListener('input', showResults);
      input.addEventListener('focus', () => { if (input.value.trim()) showResults(); });
      input.addEventListener('blur', () => { setTimeout(() => { dropdown.style.display = 'none'; }, 150); });
    };

    modalBody.querySelectorAll('.quote-item-desc').forEach(initAutocomplete);

    modalBody.addEventListener('click', (e) => {
      if (e.target.classList.contains('remove-item-btn')) {
        const rowsContainer = modalBody.querySelector('#invoice-items-container');
        if (rowsContainer.children.length > 1) {
          e.target.closest('.quote-item-row').remove();
          rowsContainer.querySelectorAll('.quote-item-row').forEach((row, i) => {
            if (row.querySelector('.quote-item-desc')) row.querySelector('.quote-item-desc').name = `item_desc_${i}`;
            if (row.querySelector('.item-treatment-id')) row.querySelector('.item-treatment-id').name = `item_treatment_id_${i}`;
            if (row.querySelector('input[name^="item_tooth_"]')) row.querySelector('input[name^="item_tooth_"]').name = `item_tooth_${i}`;
            if (row.querySelector('.item-qty')) row.querySelector('.item-qty').name = `item_qty_${i}`;
            if (row.querySelector('.item-price')) row.querySelector('.item-price').name = `item_price_${i}`;
          });
          recalculate();
        } else {
          toast.error('Debe haber al menos un concepto en la factura');
        }
      }
    });

    const addItemBtn = modalBody.querySelector('#add-item-btn');
    if (addItemBtn) {
      addItemBtn.addEventListener('click', () => {
        const container = modalBody.querySelector('#invoice-items-container');
        const idx = container.children.length;
        const div = document.createElement('div');
        div.className = 'quote-item-row';
        div.style.cssText = 'display: flex; gap: var(--space-2); align-items: flex-start; margin-bottom: var(--space-2);';
        div.setAttribute('data-index', idx);
        div.innerHTML = `
          <div class="treatment-autocomplete-wrapper" style="flex: 2; position: relative;">
            <input type="text" name="item_desc_${idx}" class="form-input quote-item-desc" placeholder="Buscar tratamiento..." autocomplete="off" required />
            <input type="hidden" name="item_treatment_id_${idx}" class="item-treatment-id" value="" />
            <ul class="treatment-autocomplete-list" style="display: none; position: absolute; background: white; border: 1px solid var(--border-color); border-radius: var(--radius-md); box-shadow: var(--shadow-md); max-height: 200px; overflow-y: auto; z-index: 100; width: 100%;"></ul>
          </div>
          <div style="width: 80px;">
            <input type="number" name="item_tooth_${idx}" class="form-input" placeholder="Diente" min="1" max="32" />
          </div>
          <div style="width: 70px;">
            <input type="number" name="item_qty_${idx}" class="form-input item-qty" placeholder="Cant." value="1" min="1" required />
          </div>
          <div style="width: 110px;">
            <input type="number" step="0.01" name="item_price_${idx}" class="form-input item-price" placeholder="Precio $" value="0.00" min="0" required />
          </div>
          <div style="width: 30px; padding-top: 4px;">
            <button type="button" class="btn btn-sm btn-outline remove-item-btn" style="color: var(--danger-600); border-color: var(--danger-200); padding: 4px 8px;" title="Eliminar ítem">✕</button>
          </div>
        `;
        container.appendChild(div);
        initAutocomplete(div.querySelector('.quote-item-desc'));
        recalculate();
      });
    }
  }
}
