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
  aceptada: 'Aceptada',
  rechazada: 'Rechazada',
  expirada: 'Expirada',
};

const STATUS_BADGES = {
  borrador: 'badge-secondary',
  enviada: 'badge-info',
  aceptada: 'badge-success',
  rechazada: 'badge-danger',
  expirada: 'badge-warning',
};

const STATUS_OPTIONS = [
  { value: 'borrador', label: 'Borrador' },
  { value: 'enviada', label: 'Enviada' },
  { value: 'aceptada', label: 'Aceptada' },
  { value: 'rechazada', label: 'Rechazada' },
  { value: 'expirada', label: 'Expirada' },
];

export class Quotations {
  constructor(container) {
    this.container = container;
    this.quotationsList = [];
    this.searchQuery = '';
    this.statusFilter = '';
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
            <option value="aceptada" ${this.statusFilter === 'aceptada' ? 'selected' : ''}>Aceptada</option>
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
      <tr>
        <td><strong># ${q.quote_number}</strong></td>
        <td>${q.patient_name || '—'}</td>
        <td>${q.doctor_name || 'Sin asignar'}</td>
        <td><strong>${formatCurrency(q.total)}</strong></td>
        <td>
          <span class="badge ${STATUS_BADGES[q.status] || 'badge-secondary'}">${STATUS_LABELS[q.status] || q.status}</span>
          ${q.invoice_id ? `<span class="badge" style="background-color: var(--primary-100); color: var(--primary-800); font-size: 10px; margin-left: 4px; padding: 2px 4px;">Facturado</span>` : ''}
        </td>
        <td>${formatDate(q.created_at)}</td>
        <td>
          <div style="display: flex; gap: var(--space-1); flex-wrap: nowrap;">
            <button class="btn btn-sm btn-outline view-quote-btn" data-id="${q.id}" title="Ver / Imprimir">👁</button>
            ${q.status === 'aceptada' ? `<button class="btn btn-sm btn-success convert-appointment-btn" data-id="${q.id}" title="Agendar Cita">📅</button>` : ''}
            ${q.status === 'aceptada' && !q.invoice_id ? `<button class="btn btn-sm btn-info convert-invoice-btn" data-id="${q.id}" title="Generar Factura">📄</button>` : ''}
            <button class="btn btn-sm btn-primary edit-quote-btn" data-id="${q.id}" title="Editar">✎</button>
            <button class="btn btn-sm btn-secondary status-quote-btn" data-id="${q.id}" title="Cambiar estado">⇄</button>
            <button class="btn btn-sm btn-danger delete-quote-btn" data-id="${q.id}" title="Eliminar">✕</button>
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
    const addBtn = this.container.querySelector('#add-quote-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => this.showQuoteModal());
    }

    const searchInput = this.container.querySelector('#quote-search');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        this.searchQuery = searchInput.value;
        this.renderView();
      });
    }

    const statusFilter = this.container.querySelector('#quote-filter-status');
    if (statusFilter) {
      statusFilter.addEventListener('change', () => {
        this.statusFilter = statusFilter.value;
        this.renderView();
      });
    }

    this.container.addEventListener('click', async (e) => {
      const targetBtn = e.target.closest('button');
      if (!targetBtn) return;
      const id = targetBtn.getAttribute('data-id');

      if (targetBtn.classList.contains('view-quote-btn')) {
        this.printQuote(id);
      }
      if (targetBtn.classList.contains('convert-appointment-btn')) {
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
      if (targetBtn.classList.contains('edit-quote-btn')) {
        this.showQuoteModal(id);
      }
      if (targetBtn.classList.contains('status-quote-btn')) {
        this.showStatusModal(id);
      }
      if (targetBtn.classList.contains('delete-quote-btn')) {
        this.showDeleteConfirm(id);
      }
      if (targetBtn.classList.contains('convert-invoice-btn')) {
        this.showConvertInvoiceConfirm(id);
      }
    });
  }

  showConvertInvoiceConfirm(quotationId) {
    const q = this.quotationsList.find(q => q.id == quotationId);
    const label = q ? `# ${q.quote_number}` : 'este presupuesto';

    Modal.confirm(
      'Generar Factura',
      `¿Está seguro de generar la factura para el presupuesto ${label}?`,
      async () => {
        try {
          await invoiceService.createFromQuotation(quotationId);
          toast.success('Factura generada exitosamente');
          window.location.hash = '#/invoices';
          return true;
        } catch (err) {
          toast.error(err.message || 'Error al generar la factura');
          return false;
        }
      }
    );
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

      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
        <html>
        <head>
          <title>Presupuesto # ${quote.quote_number}</title>
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
              <p>${clinic.email || 'contacto@dentalsonrisa.com'}</p>
            </div>
            <div>
              <h1>PRESUPUESTO</h1>
              <p><strong>No:</strong> ${quote.quote_number}</p>
              <p><strong>Fecha:</strong> ${formatDate(quote.quotation_date || quote.created_at)}</p>
            </div>
          </div>

          <div class="details">
            <div>
              <h3>Paciente:</h3>
              <p><strong>Nombre:</strong> ${quote.patient_name}</p>
              <p><strong>Teléfono:</strong> ${quote.patient_phone || 'N/A'}</p>
            </div>
            <div>
              <h3>Especialista:</h3>
              <p>Dr/a. ${quote.doctor_name || 'N/A'}</p>
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
            <h2>TOTAL: ${formatCurrency(quote.total)}</h2>
          </div>
        </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    } catch {
      toast.error('Error al generar vista de impresión');
    }
  }
}
