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
import { getInvoiceStatusInfo } from '../../utils/formatters.js';

export class Invoices {
  constructor(container) {
    this.container = container;
    this.invoicesList = [];
  }

  async render() {
    try {
      const response = await invoiceService.getAll();
      this.invoicesList = Array.isArray(response) ? response : (response?.invoices || response?.data || []);
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
          <td>${inv.patient_name || 'N/A'}</td>
          <td><strong>${formatCurrency(inv.total)}</strong></td>
          <td style="color: var(--success-600);">${formatCurrency(inv.amount_paid)}</td>
          <td style="color: var(--danger-600);"><strong>${formatCurrency(inv.balance)}</strong></td>
          <td><span class="badge ${statusInfo.class}">${statusInfo.label}</span></td>
          <td>${formatDate(inv.created_at)}</td>
          <td>
            <div style="display: flex; gap: var(--space-1);">
              <button class="btn btn-sm btn-outline print-invoice-btn" data-id="${inv.id}">Imprimir</button>
              ${parseFloat(inv.balance || 0) > 0 ? `<button class="btn btn-sm btn-primary pay-invoice-btn" data-id="${inv.id}">Pagar</button>` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    if (this.invoicesList.length === 0) {
      rows = `<tr><td colspan="8" style="text-align: center; color: var(--text-secondary); padding: var(--space-6);">No hay facturas registradas.</td></tr>`;
    }

    this.container.innerHTML = `
      <div class="page-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-6);">
        <div>
          <h1 class="page-title">Facturación</h1>
          <p style="color: var(--text-secondary);">Facturas de servicios y saldos pendientes</p>
        </div>
        <div style="display: flex; gap: var(--space-2);">
          <button id="add-invoice-btn" class="btn btn-primary">+ Nueva Factura</button>
          <button id="add-invoice-from-quote-btn" class="btn btn-secondary">Facturar desde Presupuesto</button>
        </div>
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
    // Facturar manual
    const addInvoiceBtn = this.container.querySelector('#add-invoice-btn');
    if (addInvoiceBtn) {
      addInvoiceBtn.addEventListener('click', () => this.showAddInvoiceModal());
    }

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

  /**
   * Modal para crear una factura manual directamente.
   */
  async showAddInvoiceModal() {
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
      // Fallback
    }

    const patientList = Array.isArray(patients) ? patients : (patients.data || []);
    const doctorList = Array.isArray(doctors) ? doctors : [];
    const treatmentList = Array.isArray(treatments) ? treatments : [];

    const patientOptions = patientList.map(p =>
      `<option value="${p.id}">[${p.custom_id || 'N/A'}] ${p.first_name} ${p.last_name}</option>`
    ).join('');

    const doctorOptions = doctorList.map(d =>
      `<option value="${d.id}">${d.first_name} ${d.last_name} (${d.specialty || ''})</option>`
    ).join('');

    const content = `
      <form id="add-invoice-form">
        <div class="form-row-responsive">
          <div class="form-group">
            <label class="form-label">Paciente <span style="color: var(--danger-500);">*</span></label>
            <select name="patient_id" class="form-select" required>
              <option value="">Seleccione un paciente...</option>
              ${patientOptions}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Doctor (Opcional)</label>
            <select name="doctor_id" class="form-select">
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
            <label class="form-label">Impuesto (%)</label>
            <input type="number" name="tax_rate" class="form-input" value="16" min="0" max="100" required />
          </div>
          <div class="form-group">
            <label class="form-label">Descuento Global ($)</label>
            <input type="number" step="0.01" name="discount" class="form-input" value="0.00" min="0" required />
          </div>
          <div class="form-group">
            <label class="form-label">Notas</label>
            <textarea name="notes" class="form-textarea" rows="1" placeholder="Observaciones de la factura..."></textarea>
          </div>
        </div>

        <div style="margin-top: var(--space-4);">
          <label class="form-label" style="display: block; margin-bottom: var(--space-1);">Detalle de Conceptos / Tratamientos <span style="color: var(--danger-500);">*</span></label>
          <div id="invoice-items-container">
            <div class="quote-item-row">
              <div class="treatment-autocomplete-wrapper">
                <input type="text" name="item_desc_0" class="form-input quote-item-desc" placeholder="Buscar tratamiento..." autocomplete="off" required />
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
            <div style="display: flex; justify-content: space-between; font-size: var(--text-sm);">
              <span style="color: var(--text-secondary);">Impuestos:</span>
              <strong id="calc-tax">€0,00</strong>
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
      title: 'Crear Nueva Factura',
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
            items.push({
              description: raw[`item_desc_${itemIndex}`].trim(),
              quantity: parseInt(raw[`item_qty_${itemIndex}`], 10) || 1,
              unit_price: parseFloat(raw[`item_price_${itemIndex}`]) || 0,
            });
          }
          itemIndex++;
        }

        if (items.length === 0) {
          toast.error('Debe incluir al menos un concepto en la factura');
          return false;
        }

        const payload = {
          patient_id: parseInt(raw.patient_id, 10),
          doctor_id: raw.doctor_id ? parseInt(raw.doctor_id, 10) : undefined,
          invoice_date: raw.invoice_date || undefined,
          due_date: raw.due_date || undefined,
          tax_rate: parseFloat(raw.tax_rate) || 0,
          discount: parseFloat(raw.discount) || 0,
          notes: raw.notes || undefined,
          items,
        };

        try {
          await invoiceService.create(payload);
          toast.success('Factura manual creada exitosamente');
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

        const taxRate = parseFloat(modalBody.querySelector('input[name="tax_rate"]')?.value || 0);
        const taxAmount = (subtotal * taxRate) / 100;
        const discount = parseFloat(modalBody.querySelector('input[name="discount"]')?.value || 0);
        const total = Math.max(0, subtotal + taxAmount - discount);

        modalBody.querySelector('#calc-subtotal').textContent = formatCurrency(subtotal);
        modalBody.querySelector('#calc-tax').textContent = formatCurrency(taxAmount);
        modalBody.querySelector('#calc-discount').textContent = `-${formatCurrency(discount)}`;
        modalBody.querySelector('#calc-total').textContent = formatCurrency(total);
      };

      // Add event listeners for recalculations
      modalBody.addEventListener('input', (e) => {
        if (e.target.name === 'tax_rate' || e.target.name === 'discount' || e.target.name.startsWith('item_qty_') || e.target.name.startsWith('item_price_')) {
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
    }, 50);
  }

  async showInvoiceFromQuoteModal() {
    let quotations = [];
    try {
      const quotesRes = await quotationService.getAll({ status: 'aceptada', limit: 200 });
      quotations = Array.isArray(quotesRes) ? quotesRes : (quotesRes.rows || []);
      // Filter out already invoiced ones
      quotations = quotations.filter(q => !q.invoice_id);
    } catch {
      toast.error('Error al cargar presupuestos aceptados');
      return;
    }

    if (quotations.length === 0) {
      Modal.show({
        title: 'Facturar Presupuesto',
        content: `
          <div style="text-align: center; padding: var(--space-4);">
            <div style="font-size: 48px; margin-bottom: var(--space-2);">📄</div>
            <h3>Sin presupuestos pendientes</h3>
            <p style="color: var(--text-secondary); margin-top: var(--space-2);">No hay presupuestos con estado "Aceptada" que no hayan sido facturados aún.</p>
          </div>
        `,
        confirmText: 'Aceptar',
        cancelText: null
      });
      return;
    }

    const options = quotations.map(q => {
      return `<option value="${q.id}"># ${q.quote_number} — Paciente: ${q.patient_name || 'N/A'} — Total: ${formatCurrency(q.total)}</option>`;
    }).join('');

    const content = `
      <form id="invoice-quote-form">
        <div class="form-group">
          <label class="form-label">Seleccione el Presupuesto Aceptado <span style="color: var(--danger-500);">*</span></label>
          <select name="quotation_id" class="form-select" required>
            <option value="">Seleccione un presupuesto...</option>
            ${options}
          </select>
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

        if (!quoteId) {
          toast.error('Debe seleccionar un presupuesto');
          return false;
        }

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
      <option value="${m.id}">${m.label || m.name}</option>
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
        data.invoice_id = parseInt(invoiceId, 10);
        data.amount = parseFloat(data.amount || 0);
        data.payment_method_id = parseInt(data.payment_method_id, 10);

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
              <p><strong>Nombre:</strong> ${invoice.patient_name || 'N/A'}</p>
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
