// ============================================
// Vista del Catálogo de Tratamientos y Packs Promocionales
// ============================================
import treatmentService from '../../services/treatment.service.js';
import promotionalPackService from '../../services/promotional-pack.service.js';
import toast from '../../components/toast/toast.js';
import Modal from '../../components/modal/modal.js';
import { formatCurrency, formatDate } from '../../utils/helpers.js';

export class Treatments {
  constructor(container) {
    this.container = container;
    this.activeTab = 'treatments'; // 'treatments' | 'packs'
    this.treatmentsList = [];
    this.categoriesList = [];
    this.packsList = [];
    this.searchQuery = '';
    this.currentPage = 1;
    this.pageSize = 15;
  }

  async render() {
    await this.loadData();
    this.renderLayout();
    this.renderView();
  }

  async loadData() {
    try {
      const [treatmentsRes, categoriesRes, packsRes] = await Promise.all([
        treatmentService.getAll(),
        treatmentService.getCategories(),
        promotionalPackService.getAll({ include_inactive: true }).catch(() => []),
      ]);
      this.treatmentsList = treatmentsRes || [];
      this.categoriesList = categoriesRes || [];
      this.packsList = packsRes || [];
    } catch (err) {
      toast.error('Error al cargar catálogo de tratamientos y packs');
    }
  }

  getCategoryName(id) {
    const cat = this.categoriesList.find(c => c.id === id);
    return cat ? cat.name : 'General';
  }

  renderLayout() {
    const isTreatments = this.activeTab === 'treatments';

    this.container.innerHTML = `
      <div class="page-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4); flex-wrap: wrap; gap: 12px;">
        <div>
          <h1 class="page-title">${isTreatments ? 'Catálogo de Tratamientos' : 'Packs Promocionales de Tratamientos'}</h1>
          <p style="color: var(--text-secondary);">
            ${isTreatments ? 'Gestión de servicios odontológicos individuales' : 'Paquetes comerciales con precio fijo cerrado para presupuestos'}
          </p>
        </div>
        <div style="display: flex; gap: 10px; align-items: center;">
          ${isTreatments 
            ? '<button id="add-treatment-btn" class="btn btn-primary">+ Nuevo Tratamiento</button>'
            : '<button id="add-pack-btn" class="btn btn-primary" style="background: #0284c7; border-color: #0284c7;">+ Nuevo Pack Promocional</button>'
          }
        </div>
      </div>

      <!-- Subnavigation Tabs -->
      <div style="display: flex; gap: 8px; margin-bottom: var(--space-4); border-bottom: 2px solid var(--border-color); padding-bottom: 8px;">
        <button class="btn btn-sm tab-switch-btn ${isTreatments ? 'btn-primary' : 'btn-outline'}" data-tab="treatments" style="display: flex; align-items: center; gap: 6px;">
          🦷 Catálogo de Tratamientos (${this.treatmentsList.length})
        </button>
        <button class="btn btn-sm tab-switch-btn ${!isTreatments ? 'btn-primary' : 'btn-outline'}" data-tab="packs" style="display: flex; align-items: center; gap: 6px; ${!isTreatments ? 'background: #0284c7; border-color: #0284c7;' : ''}">
          🎁 Packs Promocionales (${this.packsList.length})
        </button>
      </div>

      <div class="card" style="margin-bottom: var(--space-4); padding: var(--space-4);">
        <div style="display: flex; gap: var(--space-2);">
          <input type="text" id="treatment-search" class="form-input" placeholder="${isTreatments ? 'Buscar por Nombre o Código...' : 'Buscar Pack por Nombre o Descripción...'}" style="flex: 1;" value="${this.searchQuery}" />
        </div>
      </div>

      <div class="card">
        <div class="card-body table-container">
          ${isTreatments ? this.getTreatmentsTableHtml() : this.getPacksTableHtml()}
        </div>
        <div id="pagination-controls" style="display: flex; justify-content: space-between; align-items: center; padding: var(--space-4); border-top: 1px solid var(--border-color);"></div>
      </div>
    `;
  }

  getTreatmentsTableHtml() {
    return `
      <table>
        <thead>
          <tr>
            <th>Código</th>
            <th>Nombre del Tratamiento</th>
            <th>Categoría</th>
            <th>Duración Estimada</th>
            <th>Precio Base</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody id="treatments-table-body">
          <tr>
            <td colspan="7" style="text-align: center; color: var(--text-secondary); padding: var(--space-6);">
              Cargando tratamientos...
            </td>
          </tr>
        </tbody>
      </table>
    `;
  }

  getPacksTableHtml() {
    return `
      <table>
        <thead>
          <tr>
            <th>Nombre del Pack</th>
            <th>Tratamientos Incluidos</th>
            <th>Vigencia</th>
            <th>Precio Catálogo</th>
            <th>Precio Fijo Pack</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody id="packs-table-body">
          <tr>
            <td colspan="7" style="text-align: center; color: var(--text-secondary); padding: var(--space-6);">
              Cargando packs promocionales...
            </td>
          </tr>
        </tbody>
      </table>
    `;
  }

  renderView() {
    if (this.activeTab === 'treatments') {
      this.renderTreatmentsView();
    } else {
      this.renderPacksView();
    }
  }

  renderTreatmentsView() {
    const tbody = this.container.querySelector('#treatments-table-body');
    if (!tbody) return;

    const query = (this.searchQuery || '').toLowerCase().trim();
    const filtered = this.treatmentsList.filter(t => 
      t.name.toLowerCase().includes(query) || 
      (t.code || '').toLowerCase().includes(query)
    );

    const totalPages = Math.max(1, Math.ceil(filtered.length / this.pageSize));
    if (this.currentPage > totalPages) this.currentPage = totalPages;

    const startIndex = (this.currentPage - 1) * this.pageSize;
    const paged = filtered.slice(startIndex, startIndex + this.pageSize);

    let rows = paged.map(t => `
      <tr>
        <td><strong>${t.code || 'N/A'}</strong></td>
        <td>${t.name}</td>
        <td>${this.getCategoryName(t.category_id)}</td>
        <td>${t.duration_minutes} min</td>
        <td><strong>${formatCurrency(t.default_price)}</strong></td>
        <td><span class="badge ${t.is_active ? 'badge-success' : 'badge-danger'}">${t.is_active ? 'Activo' : 'Inactivo'}</span></td>
        <td>
          <div style="display: flex; gap: var(--space-2);">
            <button class="btn btn-sm btn-secondary edit-treatment-btn" data-id="${t.id}">Editar</button>
            <button class="btn btn-sm ${t.is_active ? 'btn-outline' : 'btn-primary'} toggle-active-btn" data-id="${t.id}" data-active="${t.is_active}">
              ${t.is_active ? 'Desactivar' : 'Activar'}
            </button>
            <button class="btn btn-sm btn-danger delete-treatment-btn" data-id="${t.id}" data-name="${t.name}">Eliminar</button>
          </div>
        </td>
      </tr>
    `).join('');

    if (filtered.length === 0) {
      rows = `<tr><td colspan="7" style="text-align: center; color: var(--text-secondary); padding: var(--space-6);">No se encontraron tratamientos.</td></tr>`;
    }

    tbody.innerHTML = rows;
    this.renderPagination(filtered.length, startIndex, totalPages, 'tratamientos');
  }

  renderPacksView() {
    const tbody = this.container.querySelector('#packs-table-body');
    if (!tbody) return;

    const query = (this.searchQuery || '').toLowerCase().trim();
    const filtered = this.packsList.filter(p => 
      p.name.toLowerCase().includes(query) || 
      (p.description || '').toLowerCase().includes(query)
    );

    const totalPages = Math.max(1, Math.ceil(filtered.length / this.pageSize));
    if (this.currentPage > totalPages) this.currentPage = totalPages;

    const startIndex = (this.currentPage - 1) * this.pageSize;
    const paged = filtered.slice(startIndex, startIndex + this.pageSize);

    const todayStr = new Date().toISOString().split('T')[0];

    let rows = paged.map(p => {
      const items = Array.isArray(p.items) ? p.items : [];
      const itemsListHtml = items.map(it => `
        <span class="badge" style="background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; margin: 2px; font-size: 11px;">
          ${it.quantity > 1 ? `<strong>${it.quantity}x</strong> ` : ''}${it.treatment_name || 'Tratamiento'}
        </span>
      `).join('');

      let validityBadge = '<span class="badge" style="background: #e0f2fe; color: #0369a1;">Permanente</span>';
      if (p.start_date || p.end_date) {
        const isExpired = p.end_date && p.end_date < todayStr;
        const isPending = p.start_date && p.start_date > todayStr;
        if (isExpired) {
          validityBadge = `<span class="badge badge-danger" title="Vigencia finalizada el ${formatDate(p.end_date)}">Expirado (${formatDate(p.end_date)})</span>`;
        } else if (isPending) {
          validityBadge = `<span class="badge badge-warning" title="Inicia el ${formatDate(p.start_date)}">Inicia ${formatDate(p.start_date)}</span>`;
        } else {
          validityBadge = `<span class="badge badge-success" title="Hasta ${p.end_date ? formatDate(p.end_date) : 'indefinido'}">Vigente (${p.end_date ? formatDate(p.end_date) : 'Activo'})</span>`;
        }
      }

      const originalTotal = parseFloat(p.original_total_price || 0);
      const fixedPrice = parseFloat(p.fixed_price || 0);
      const savings = originalTotal > fixedPrice ? originalTotal - fixedPrice : 0;

      return `
        <tr>
          <td>
            <strong>🎁 ${p.name}</strong>
            ${p.description ? `<div style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">${p.description}</div>` : ''}
          </td>
          <td style="max-width: 280px;">
            <div style="display: flex; flex-wrap: wrap; gap: 2px;">
              ${itemsListHtml || '<span style="color: var(--text-secondary); font-size: 11px;">Sin tratamientos</span>'}
            </div>
          </td>
          <td>${validityBadge}</td>
          <td>
            <span style="color: var(--text-secondary); text-decoration: ${savings > 0 ? 'line-through' : 'none'};">
              ${formatCurrency(originalTotal)}
            </span>
            ${savings > 0 ? `<div style="font-size: 11px; color: #16a34a; font-weight: 600;">Ahorro: ${formatCurrency(savings)}</div>` : ''}
          </td>
          <td>
            <strong style="color: #0284c7; font-size: 14px;">${formatCurrency(fixedPrice)}</strong>
          </td>
          <td>
            <span class="badge ${p.is_active ? 'badge-success' : 'badge-danger'}">
              ${p.is_active ? 'Activo' : 'Inactivo'}
            </span>
          </td>
          <td>
            <div style="display: flex; gap: var(--space-2);">
              <button class="btn btn-sm btn-secondary edit-pack-btn" data-id="${p.id}">Editar</button>
              <button class="btn btn-sm ${p.is_active ? 'btn-outline' : 'btn-primary'} toggle-active-pack-btn" data-id="${p.id}" data-active="${p.is_active}">
                ${p.is_active ? 'Desactivar' : 'Activar'}
              </button>
              <button class="btn btn-sm btn-danger delete-pack-btn" data-id="${p.id}" data-name="${p.name}">Eliminar</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    if (filtered.length === 0) {
      rows = `<tr><td colspan="7" style="text-align: center; color: var(--text-secondary); padding: var(--space-6);">No se encontraron packs promocionales.</td></tr>`;
    }

    tbody.innerHTML = rows;
    this.renderPagination(filtered.length, startIndex, totalPages, 'packs promocionales');
  }

  renderPagination(totalCount, startIndex, totalPages, label) {
    const paginationContainer = this.container.querySelector('#pagination-controls');
    if (!paginationContainer) return;

    const startItem = totalCount === 0 ? 0 : startIndex + 1;
    const endItem = Math.min(startIndex + this.pageSize, totalCount);

    paginationContainer.innerHTML = `
      <span style="color: var(--text-secondary); font-size: 0.875rem;">
        Mostrando ${startItem}–${endItem} de ${totalCount} ${label}
      </span>
      <div style="display: flex; gap: var(--space-2); align-items: center;">
        <button id="prev-page-btn" class="btn btn-sm btn-secondary" ${this.currentPage <= 1 ? 'disabled' : ''}>← Anterior</button>
        <span style="font-size: 0.875rem; min-width: 80px; text-align: center;">Página ${this.currentPage} de ${totalPages}</span>
        <button id="next-page-btn" class="btn btn-sm btn-secondary" ${this.currentPage >= totalPages ? 'disabled' : ''}>Siguiente →</button>
      </div>
    `;
  }

  mount() {
    const searchInput = this.container.querySelector('#treatment-search');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        this.searchQuery = searchInput.value;
        this.currentPage = 1;
        this.renderView();
      });
    }

    this.containerClickListener = async (e) => {
      // Tab switcher
      const tabBtn = e.target.closest('.tab-switch-btn');
      if (tabBtn) {
        const targetTab = tabBtn.getAttribute('data-tab');
        if (targetTab && targetTab !== this.activeTab) {
          this.activeTab = targetTab;
          this.currentPage = 1;
          this.searchQuery = '';
          this.renderLayout();
          this.renderView();
        }
        return;
      }

      // Pagination
      if (e.target.id === 'prev-page-btn' && this.currentPage > 1) {
        this.currentPage--;
        this.renderView();
        return;
      }
      if (e.target.id === 'next-page-btn') {
        this.currentPage++;
        this.renderView();
        return;
      }

      // Add treatment
      if (e.target.closest('#add-treatment-btn')) {
        this.showTreatmentModal();
        return;
      }

      // Add promotional pack
      if (e.target.closest('#add-pack-btn')) {
        this.showPackModal();
        return;
      }

      // Edit treatment
      const editTreatBtn = e.target.closest('.edit-treatment-btn');
      if (editTreatBtn) {
        const id = editTreatBtn.getAttribute('data-id');
        this.showTreatmentModal(id);
        return;
      }

      // Toggle treatment active
      const toggleTreatBtn = e.target.closest('.toggle-active-btn');
      if (toggleTreatBtn) {
        const id = toggleTreatBtn.getAttribute('data-id');
        const isActive = toggleTreatBtn.getAttribute('data-active') === 'true';
        try {
          await treatmentService.update(id, { is_active: !isActive });
          toast.success(`Tratamiento ${!isActive ? 'activado' : 'desactivado'} con éxito`);
          await this.loadData();
          this.renderView();
        } catch (err) {
          toast.error(err.message || 'Error al cambiar estado del tratamiento');
        }
        return;
      }

      // Delete treatment
      const deleteTreatBtn = e.target.closest('.delete-treatment-btn');
      if (deleteTreatBtn) {
        const id = deleteTreatBtn.getAttribute('data-id');
        const name = deleteTreatBtn.getAttribute('data-name') || 'este tratamiento';
        Modal.confirm(
          'Eliminar Tratamiento',
          `¿Está seguro de que desea eliminar el tratamiento "${name}"?`,
          async () => {
            try {
              await treatmentService.remove(id);
              toast.success('Tratamiento eliminado exitosamente');
              await this.loadData();
              this.renderView();
              return true;
            } catch (err) {
              toast.error(err.message || 'Error al eliminar el tratamiento');
              return false;
            }
          }
        );
        return;
      }

      // Edit pack
      const editPackBtn = e.target.closest('.edit-pack-btn');
      if (editPackBtn) {
        const id = editPackBtn.getAttribute('data-id');
        this.showPackModal(id);
        return;
      }

      // Toggle pack active
      const togglePackBtn = e.target.closest('.toggle-active-pack-btn');
      if (togglePackBtn) {
        const id = togglePackBtn.getAttribute('data-id');
        const isActive = togglePackBtn.getAttribute('data-active') === 'true';
        try {
          await promotionalPackService.toggleStatus(id, !isActive);
          toast.success(`Pack promocional ${!isActive ? 'activado' : 'desactivado'} con éxito`);
          await this.loadData();
          this.renderView();
        } catch (err) {
          toast.error(err.message || 'Error al cambiar estado del pack');
        }
        return;
      }

      // Delete pack
      const deletePackBtn = e.target.closest('.delete-pack-btn');
      if (deletePackBtn) {
        const id = deletePackBtn.getAttribute('data-id');
        const name = deletePackBtn.getAttribute('data-name') || 'este pack promocional';
        Modal.confirm(
          'Eliminar Pack Promocional',
          `¿Está seguro de que desea eliminar el pack "${name}"? Los presupuestos históricos no se verán afectados.`,
          async () => {
            try {
              await promotionalPackService.remove(id);
              toast.success('Pack promocional eliminado exitosamente');
              await this.loadData();
              this.renderView();
              return true;
            } catch (err) {
              toast.error(err.message || 'Error al eliminar el pack promocional');
              return false;
            }
          }
        );
        return;
      }
    };

    this.container.addEventListener('click', this.containerClickListener);
  }

  destroy() {
    if (this.containerClickListener) {
      this.container.removeEventListener('click', this.containerClickListener);
    }
  }

  showTreatmentModal(treatmentId = null) {
    const isEdit = !!treatmentId;
    const treat = isEdit ? this.treatmentsList.find(t => t.id == treatmentId) : {};

    const catOptions = this.categoriesList.map(c => `
      <option value="${c.id}" ${treat.category_id === c.id ? 'selected' : ''}>${c.name}</option>
    `).join('');

    const content = `
      <form id="treatment-form">
        <div class="form-group">
          <label class="form-label">Nombre del Tratamiento</label>
          <input type="text" name="name" class="form-input" value="${treat.name || ''}" required />
        </div>
        <div class="form-group" style="margin-top: var(--space-3);">
          <label class="form-label">Código</label>
          <input type="text" name="code" class="form-input" value="${treat.code || ''}" placeholder="Ej: LIM-001" required />
        </div>
        <div class="form-group" style="margin-top: var(--space-3);">
          <label class="form-label">Categoría</label>
          <select name="category_id" class="form-select" required>
            <option value="">Seleccione categoría</option>
            ${catOptions}
          </select>
        </div>
        <div class="form-group" style="margin-top: var(--space-3); display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3);">
          <div>
            <label class="form-label">Precio Base ($)</label>
            <input type="number" step="0.01" name="default_price" class="form-input" value="${treat.default_price || ''}" required />
          </div>
          <div>
            <label class="form-label">Duración (Minutos)</label>
            <input type="number" name="duration_minutes" class="form-input" value="${treat.duration_minutes || ''}" required />
          </div>
        </div>
        <div class="form-group" style="margin-top: var(--space-3);">
          <label class="form-label">Descripción</label>
          <textarea name="description" class="form-textarea" rows="3">${treat.description || ''}</textarea>
        </div>
      </form>
    `;

    Modal.show({
      title: isEdit ? 'Editar Tratamiento' : 'Agregar Nuevo Tratamiento',
      content: content,
      confirmText: isEdit ? 'Guardar Cambios' : 'Crear',
      onConfirm: async (modalBody) => {
        const form = modalBody.querySelector('#treatment-form');
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        data.category_id = data.category_id ? Number(data.category_id) : undefined;
        data.default_price = Number(data.default_price);
        data.duration_minutes = data.duration_minutes ? Number(data.duration_minutes) : undefined;

        if (!data.category_id) delete data.category_id;
        if (!data.duration_minutes) delete data.duration_minutes;

        try {
          if (isEdit) {
            await treatmentService.update(treatmentId, data);
            toast.success('Tratamiento actualizado exitosamente');
          } else {
            await treatmentService.create(data);
            toast.success('Tratamiento creado exitosamente');
          }
          await this.loadData();
          this.renderView();
          return true;
        } catch (err) {
          toast.error(err.message || 'Error al procesar tratamiento');
          return false;
        }
      }
    });
  }

  showPackModal(packId = null) {
    const isEdit = !!packId;
    const pack = isEdit ? this.packsList.find(p => p.id == packId) : {};
    let selectedItems = isEdit && Array.isArray(pack.items)
      ? pack.items.map(it => ({
          treatment_id: it.treatment_id,
          treatment_name: it.treatment_name || 'Tratamiento',
          default_price: parseFloat(it.default_price || 0),
          quantity: parseInt(it.quantity || 1, 10),
        }))
      : [];

    const activeTreatments = (this.treatmentsList || []).filter(t => t.is_active !== false);

    const renderItemsTable = (container) => {
      if (!container) return;
      if (selectedItems.length === 0) {
        container.innerHTML = `
          <tr>
            <td colspan="4" style="text-align: center; color: var(--text-secondary); padding: 16px;">
              Aún no ha agregado tratamientos a este pack. Busque un tratamiento arriba y presione "Agregar al Pack".
            </td>
          </tr>
        `;
        return;
      }

      container.innerHTML = selectedItems.map((it, idx) => `
        <tr data-idx="${idx}">
          <td>
            <strong>${it.treatment_name}</strong>
            <div style="font-size: 11px; color: var(--text-secondary);">${formatCurrency(it.default_price)} unitario</div>
          </td>
          <td style="text-align: center;">
            <input type="number" class="form-input pack-item-qty" data-idx="${idx}" value="${it.quantity}" min="1" style="width: 60px; padding: 4px 6px; text-align: center; font-size: 12px; margin: 0 auto;" />
          </td>
          <td style="text-align: right; font-weight: 600;" class="pack-item-row-total">${formatCurrency(it.default_price * it.quantity)}</td>
          <td style="text-align: center;">
            <button type="button" class="btn btn-sm btn-ghost remove-pack-item-btn" data-idx="${idx}" title="Eliminar del pack" style="color: var(--danger-500); padding: 2px 6px; font-size: 14px;">✕</button>
          </td>
        </tr>
      `).join('');
    };

    const updateSavingsDisplay = (modalBody) => {
      const origTotal = selectedItems.reduce((acc, it) => acc + (it.default_price * it.quantity), 0);
      const fixedPriceInput = modalBody.querySelector('#pack-fixed-price');
      const fixedPrice = parseFloat(fixedPriceInput?.value || 0);
      const savingsElem = modalBody.querySelector('#pack-savings-indicator');
      if (savingsElem) {
        if (origTotal > 0) {
          const savings = origTotal - fixedPrice;
          const pct = fixedPrice > 0 && origTotal > 0 && savings > 0 
            ? Math.round((savings / origTotal) * 100) 
            : 0;
          savingsElem.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
              <div>
                Valor individual en catálogo: <strong>${formatCurrency(origTotal)}</strong> | 
                Precio pack: <strong style="color: #0284c7;">${formatCurrency(fixedPrice)}</strong>
              </div>
              ${savings > 0 ? `
                <div style="color: #16a34a; font-weight: 700; background: #dcfce7; padding: 2px 8px; border-radius: 4px; border: 1px solid #bbf7d0;">
                  🎉 Ahorro paciente: ${formatCurrency(savings)} (${pct}%)
                </div>
              ` : ''}
            </div>
          `;
        } else {
          savingsElem.innerHTML = '<span style="color: var(--text-secondary);">Agregue tratamientos para calcular el valor de catálogo y ahorro del pack.</span>';
        }
      }
    };

    const content = `
      <form id="pack-form">
        <div class="form-group">
          <label class="form-label">Nombre del Pack Promocional <span style="color: var(--danger-500);">*</span></label>
          <input type="text" name="name" id="pack-name" class="form-input" value="${pack.name || ''}" placeholder="Ej: PROMOCIÓN SEPTIEMBRE" required />
        </div>

        <div class="form-group" style="margin-top: var(--space-3);">
          <label class="form-label">Descripción del Pack</label>
          <textarea name="description" id="pack-description" class="form-textarea" rows="2" placeholder="Detalle comercial del paquete, condiciones o beneficios...">${pack.description || ''}</textarea>
        </div>

        <div class="form-group" style="margin-top: var(--space-3); display: grid; grid-template-columns: 1fr 1fr 1fr; gap: var(--space-3);">
          <div>
            <label class="form-label">Precio Fijo del Pack ($) <span style="color: var(--danger-500);">*</span></label>
            <input type="number" step="0.01" name="fixed_price" id="pack-fixed-price" class="form-input" value="${pack.fixed_price !== undefined ? pack.fixed_price : ''}" placeholder="0.00" min="0" required style="font-weight: 700; color: #0284c7;" />
          </div>
          <div>
            <label class="form-label">Fecha Inicio Vigencia</label>
            <input type="date" name="start_date" id="pack-start-date" class="form-input" value="${pack.start_date ? pack.start_date.split('T')[0] : ''}" />
          </div>
          <div>
            <label class="form-label">Fecha Fin Vigencia</label>
            <input type="date" name="end_date" id="pack-end-date" class="form-input" value="${pack.end_date ? pack.end_date.split('T')[0] : ''}" />
          </div>
        </div>

        <div class="form-group" style="margin-top: var(--space-3);">
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
            <input type="checkbox" name="is_active" id="pack-is-active" ${pack.is_active !== false ? 'checked' : ''} style="transform: scale(1.1);" />
            <span style="font-weight: 600;">Pack Activo para Presupuestos</span>
          </label>
        </div>

        <!-- SECCIÓN DE TRATAMIENTOS INCLUIDOS CON AUTOCOMPLETE -->
        <div style="margin-top: var(--space-4); border-top: 1px solid var(--border-color); padding-top: var(--space-4);">
          <label class="form-label" style="font-weight: 700; font-size: 13px; color: var(--text-primary); margin-bottom: 8px;">
            🦷 Tratamientos Incluidos en el Pack <span style="color: var(--danger-500);">*</span>
          </label>
          <div style="display: flex; gap: var(--space-2); margin-bottom: var(--space-2); align-items: flex-start; flex-wrap: wrap;">
            <div class="treatment-autocomplete-wrapper" style="flex: 2; min-width: 280px; position: relative;">
              <input 
                type="text" 
                id="pack-treatment-search" 
                class="form-input" 
                placeholder="🔍 Buscar tratamiento por nombre o código..." 
                autocomplete="off" 
              />
              <ul class="treatment-autocomplete-list" id="pack-treatment-autocomplete-list" style="display: none; position: absolute; top: calc(100% + 4px); left: 0; width: 100%; min-width: 320px; max-height: 260px; overflow-y: auto; z-index: 10050; background: var(--color-surface, #ffffff); border: 1px solid var(--color-border, #cbd5e1); border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.15); list-style: none; margin: 0; padding: 4px 0;"></ul>
            </div>
            <div style="display: flex; gap: 8px; align-items: center;">
              <input type="number" id="pack-treatment-qty" class="form-input" value="1" min="1" style="width: 70px; text-align: center;" title="Cantidad de veces" />
              <button type="button" id="add-item-to-pack-btn" class="btn btn-primary" style="background: #0284c7; border-color: #0284c7; white-space: nowrap; font-weight: 600;">
                + Agregar al Pack
              </button>
            </div>
          </div>
          <div id="pack-selected-treatment-badge" style="display: none; margin-bottom: 10px; font-size: 12px; padding: 6px 12px; background: #e0f2fe; color: #0369a1; border-radius: 6px; border: 1px solid #bae6fd; align-items: center; justify-content: space-between;">
            <span id="pack-selected-treatment-text"></span>
            <button type="button" id="clear-selected-treatment-btn" style="background: none; border: none; color: #0284c7; font-weight: 700; cursor: pointer; padding: 0 4px; font-size: 14px;" title="Quitar selección">✕</button>
          </div>

          <div class="table-container" style="max-height: 180px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 6px;">
            <table class="table" style="margin: 0;">
              <thead>
                <tr style="background: var(--gray-50); font-size: 11px;">
                  <th>Tratamiento</th>
                  <th style="width: 80px; text-align: center;">Cantidad</th>
                  <th style="width: 120px; text-align: right;">Precio Catálogo</th>
                  <th style="width: 45px; text-align: center;"></th>
                </tr>
              </thead>
              <tbody id="pack-items-tbody"></tbody>
            </table>
          </div>

          <div id="pack-savings-indicator" style="margin-top: 8px; font-size: 12px; color: var(--text-secondary); background: #f8fafc; padding: 8px 12px; border-radius: 4px; border: 1px solid #e2e8f0;">
          </div>
        </div>
      </form>
    `;

    const setupModalLogic = (modalBody) => {
      if (!modalBody || modalBody._packInitialized) return;
      modalBody._packInitialized = true;

      const tbody = modalBody.querySelector('#pack-items-tbody');
      const searchInput = modalBody.querySelector('#pack-treatment-search');
      const dropdown = modalBody.querySelector('#pack-treatment-autocomplete-list');
      const qtyInput = modalBody.querySelector('#pack-treatment-qty');
      const addBtn = modalBody.querySelector('#add-item-to-pack-btn');
      const fixedPriceInput = modalBody.querySelector('#pack-fixed-price');
      const badge = modalBody.querySelector('#pack-selected-treatment-badge');
      const badgeText = modalBody.querySelector('#pack-selected-treatment-text');
      const clearBtn = modalBody.querySelector('#clear-selected-treatment-btn');

      let selectedTreatmentForAdd = null;
      let activeDropdownIndex = -1;

      renderItemsTable(tbody);
      updateSavingsDisplay(modalBody);

      fixedPriceInput?.addEventListener('input', () => updateSavingsDisplay(modalBody));

      // --- AUTOCOMPLETE LOGIC ---
      const renderDropdown = () => {
        if (!searchInput || !dropdown) return;
        const term = searchInput.value.trim().toLowerCase();
        if (!term) {
          dropdown.style.display = 'none';
          activeDropdownIndex = -1;
          return;
        }

        const matches = activeTreatments.filter(t =>
          t.name.toLowerCase().includes(term) ||
          (t.code && t.code.toLowerCase().includes(term)) ||
          (t.category_name && t.category_name.toLowerCase().includes(term))
        ).slice(0, 15);

        if (matches.length === 0) {
          dropdown.innerHTML = '<li style="padding: 10px 14px; text-align: center; color: var(--text-secondary); font-size: 12px;">Sin tratamientos encontrados</li>';
          dropdown.style.display = 'block';
          activeDropdownIndex = -1;
          return;
        }

        dropdown.innerHTML = matches.map((t, idx) => `
          <li class="autocomplete-item" data-idx="${idx}" style="padding: 8px 14px; cursor: pointer; border-bottom: 1px solid var(--border-color, #f1f5f9); display: flex; justify-content: space-between; align-items: center; transition: background 0.15s;">
            <div>
              <div style="font-weight: 600; color: var(--text-primary); font-size: 13px;">${t.name}</div>
              <div style="font-size: 11px; color: var(--text-secondary); display: flex; gap: 6px; align-items: center; margin-top: 2px;">
                ${t.code ? `<span style="background: #f1f5f9; padding: 1px 5px; border-radius: 3px; font-weight: 600;">${t.code}</span>` : ''}
                ${t.category_name ? `<span>📂 ${t.category_name}</span>` : ''}
              </div>
            </div>
            <div style="font-weight: 700; color: #0284c7; font-size: 13px; margin-left: 12px; white-space: nowrap;">
              ${formatCurrency(t.default_price || 0)}
            </div>
          </li>
        `).join('');
        dropdown.style.display = 'block';
        activeDropdownIndex = -1;

        dropdown.querySelectorAll('.autocomplete-item').forEach((li, idx) => {
          li.addEventListener('mouseenter', () => {
            activeDropdownIndex = idx;
            highlightActive();
          });
          li.addEventListener('mousedown', (e) => {
            e.preventDefault();
            selectTreatment(matches[idx]);
          });
        });
      };

      const highlightActive = () => {
        if (!dropdown) return;
        const items = dropdown.querySelectorAll('.autocomplete-item');
        items.forEach((li, i) => {
          if (i === activeDropdownIndex) {
            li.style.background = '#e0f2fe';
            li.scrollIntoView({ block: 'nearest' });
          } else {
            li.style.background = '';
          }
        });
      };

      const selectTreatment = (treatment) => {
        if (!treatment) return;
        selectedTreatmentForAdd = treatment;
        if (searchInput) searchInput.value = treatment.name;
        if (dropdown) dropdown.style.display = 'none';
        if (badge && badgeText) {
          badgeText.innerHTML = `Seleccionado: <strong>${treatment.name}</strong> — <span style="color: #0284c7; font-weight: 700;">${formatCurrency(treatment.default_price || 0)}</span>`;
          badge.style.display = 'flex';
        }
        qtyInput?.focus();
      };

      const clearSelection = () => {
        selectedTreatmentForAdd = null;
        if (searchInput) searchInput.value = '';
        if (badge) badge.style.display = 'none';
        if (dropdown) dropdown.style.display = 'none';
        searchInput?.focus();
      };

      clearBtn?.addEventListener('click', clearSelection);

      searchInput?.addEventListener('input', renderDropdown);
      searchInput?.addEventListener('focus', () => {
        if (searchInput.value.trim()) renderDropdown();
      });
      searchInput?.addEventListener('blur', () => {
        setTimeout(() => {
          if (dropdown) dropdown.style.display = 'none';
        }, 200);
      });

      searchInput?.addEventListener('keydown', (e) => {
        const items = dropdown?.querySelectorAll('.autocomplete-item') || [];
        if (dropdown && dropdown.style.display !== 'none' && items.length > 0) {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            activeDropdownIndex = Math.min(activeDropdownIndex + 1, items.length - 1);
            highlightActive();
            return;
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            activeDropdownIndex = Math.max(activeDropdownIndex - 1, 0);
            highlightActive();
            return;
          }
          if (e.key === 'Enter') {
            e.preventDefault();
            if (activeDropdownIndex >= 0 && items[activeDropdownIndex]) {
              items[activeDropdownIndex].dispatchEvent(new Event('mousedown'));
              return;
            }
          }
          if (e.key === 'Escape') {
            dropdown.style.display = 'none';
            return;
          }
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          addBtn?.click();
        }
      });

      qtyInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          addBtn?.click();
        }
      });

      // --- AGREGAR TRATAMIENTO AL PACK ---
      addBtn?.addEventListener('click', () => {
        if (!selectedTreatmentForAdd) {
          const term = searchInput?.value.trim().toLowerCase();
          if (term) {
            const found = activeTreatments.find(t => t.name.toLowerCase() === term || (t.code && t.code.toLowerCase() === term))
                       || activeTreatments.find(t => t.name.toLowerCase().includes(term));
            if (found) {
              selectedTreatmentForAdd = found;
            }
          }
        }

        if (!selectedTreatmentForAdd) {
          toast.warning('Por favor busque y seleccione un tratamiento para agregar al pack.');
          searchInput?.focus();
          return;
        }

        const treatId = parseInt(selectedTreatmentForAdd.id, 10);
        const existing = selectedItems.find(it => it.treatment_id === treatId);
        if (existing) {
          toast.warning(`El tratamiento "${selectedTreatmentForAdd.name}" ya está incluido en el pack. Modifique la cantidad en la tabla.`);
          return;
        }

        const qty = parseInt(qtyInput?.value || 1, 10) || 1;
        selectedItems.push({
          treatment_id: treatId,
          treatment_name: selectedTreatmentForAdd.name,
          default_price: parseFloat(selectedTreatmentForAdd.default_price || 0),
          quantity: qty,
        });

        toast.success(`Tratamiento "${selectedTreatmentForAdd.name}" agregado al pack.`);

        clearSelection();
        if (qtyInput) qtyInput.value = '1';
        renderItemsTable(tbody);
        updateSavingsDisplay(modalBody);
      });

      // --- CAMBIO DE CANTIDAD EN TABLA ---
      tbody?.addEventListener('input', (e) => {
        if (e.target.classList.contains('pack-item-qty')) {
          const idx = parseInt(e.target.getAttribute('data-idx'), 10);
          const val = parseInt(e.target.value || 1, 10) || 1;
          if (selectedItems[idx]) {
            selectedItems[idx].quantity = val;
            const row = e.target.closest('tr');
            const totalCell = row?.querySelector('.pack-item-row-total');
            if (totalCell) {
              totalCell.textContent = formatCurrency(selectedItems[idx].default_price * val);
            }
            updateSavingsDisplay(modalBody);
          }
        }
      });

      // --- ELIMINAR TRATAMIENTO DEL PACK ---
      tbody?.addEventListener('click', (e) => {
        const btn = e.target.closest('.remove-pack-item-btn');
        if (btn) {
          const idx = parseInt(btn.getAttribute('data-idx'), 10);
          if (!isNaN(idx) && selectedItems[idx]) {
            selectedItems.splice(idx, 1);
            renderItemsTable(tbody);
            updateSavingsDisplay(modalBody);
          }
        }
      });
    };

    Modal.show({
      title: isEdit ? 'Editar Pack Promocional' : 'Crear Nuevo Pack Promocional',
      content: content,
      confirmText: isEdit ? 'Guardar Cambios' : 'Crear Pack',
      onOpen: (modalBody) => {
        setupModalLogic(modalBody);
      },
      onConfirm: async (modalBody) => {
        const name = modalBody.querySelector('#pack-name')?.value.trim();
        const description = modalBody.querySelector('#pack-description')?.value.trim();
        const fixedPriceVal = modalBody.querySelector('#pack-fixed-price')?.value;
        const startDate = modalBody.querySelector('#pack-start-date')?.value;
        const endDate = modalBody.querySelector('#pack-end-date')?.value;
        const isActive = modalBody.querySelector('#pack-is-active')?.checked;

        if (!name) {
          toast.error('El nombre del pack promocional es obligatorio.');
          return false;
        }

        const priceNum = parseFloat(fixedPriceVal);
        if (isNaN(priceNum) || priceNum < 0) {
          toast.error('El precio fijo del pack debe ser un número mayor o igual a 0.');
          return false;
        }

        if (selectedItems.length === 0) {
          toast.error('Debe incluir al menos un tratamiento en el pack.');
          return false;
        }

        if (startDate && endDate && startDate > endDate) {
          toast.error('La fecha de inicio no puede ser posterior a la fecha de fin de vigencia.');
          return false;
        }

        const payload = {
          name,
          description: description || null,
          fixed_price: priceNum,
          start_date: startDate || null,
          end_date: endDate || null,
          is_active: isActive !== false,
          items: selectedItems.map((it, i) => ({
            treatment_id: it.treatment_id,
            quantity: it.quantity,
            sort_order: i,
          })),
        };

        try {
          if (isEdit) {
            await promotionalPackService.update(packId, payload);
            toast.success('Pack promocional actualizado exitosamente');
          } else {
            await promotionalPackService.create(payload);
            toast.success('Pack promocional creado exitosamente');
          }
          await this.loadData();
          this.renderView();
          return true;
        } catch (err) {
          toast.error(err.message || 'Error al guardar pack promocional');
          return false;
        }
      }
    });

    // Immediate fallback initialization check
    const overlay = document.querySelector('.modal-overlay');
    if (overlay) {
      const modalBody = overlay.querySelector('.modal-body');
      if (modalBody && !modalBody._packInitialized) {
        setupModalLogic(modalBody);
      }
    }
  }
}
