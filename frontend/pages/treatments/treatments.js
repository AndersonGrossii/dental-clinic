// ============================================
// Vista del Catálogo de Tratamientos
// ============================================
import treatmentService from '../../services/treatment.service.js';
import toast from '../../components/toast/toast.js';
import Modal from '../../components/modal/modal.js';
import { formatCurrency } from '../../utils/helpers.js';

export class Treatments {
  constructor(container) {
    this.container = container;
    this.treatmentsList = [];
    this.categoriesList = [];
    this.searchQuery = '';
  }

  async render() {
    await this.loadData();
    this.renderLayout();
    this.renderView();
  }

  async loadData() {
    try {
      const response = await treatmentService.getAll();
      this.treatmentsList = response || [];
      this.categoriesList = await treatmentService.getCategories();
    } catch (err) {
      toast.error('Error al cargar catálogo de tratamientos');
    }
  }

  getCategoryName(id) {
    const cat = this.categoriesList.find(c => c.id === id);
    return cat ? cat.name : 'General';
  }

  renderLayout() {
    this.container.innerHTML = `
      <div class="page-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-6);">
        <div>
          <h1 class="page-title">Catálogo de Tratamientos</h1>
          <p style="color: var(--text-secondary);">Catálogo de servicios odontológicos ofrecidos</p>
        </div>
        <button id="add-treatment-btn" class="btn btn-primary">+ Nuevo Tratamiento</button>
      </div>

      <div class="card" style="margin-bottom: var(--space-4); padding: var(--space-4);">
        <div style="display: flex; gap: var(--space-2);">
          <input type="text" id="treatment-search" class="form-input" placeholder="Buscar por Nombre o Código..." style="flex: 1;" value="${this.searchQuery}" />
        </div>
      </div>

      <div class="card">
        <div class="card-body table-container">
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
        </div>
      </div>
    `;
  }

  renderView() {
    const tbody = this.container.querySelector('#treatments-table-body');
    if (!tbody) return;

    const query = (this.searchQuery || '').toLowerCase().trim();
    const filtered = this.treatmentsList.filter(t => 
      t.name.toLowerCase().includes(query) || 
      (t.code || '').toLowerCase().includes(query)
    );

    let rows = filtered.map(t => `
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
          </div>
        </td>
      </tr>
    `).join('');

    if (filtered.length === 0) {
      rows = `<tr><td colspan="7" style="text-align: center; color: var(--text-secondary); padding: var(--space-6);">No se encontraron tratamientos.</td></tr>`;
    }

    tbody.innerHTML = rows;
  }

  mount() {
    const searchInput = this.container.querySelector('#treatment-search');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        this.searchQuery = searchInput.value;
        this.renderView();
      });
    }

    const addBtn = this.container.querySelector('#add-treatment-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => this.showTreatmentModal());
    }

    this.containerClickListener = async (e) => {
      if (e.target.classList.contains('edit-treatment-btn')) {
        const id = e.target.getAttribute('data-id');
        this.showTreatmentModal(id);
      }
      if (e.target.classList.contains('toggle-active-btn')) {
        const id = e.target.getAttribute('data-id');
        const isActive = e.target.getAttribute('data-active') === 'true';
        try {
          await treatmentService.update(id, { is_active: !isActive });
          toast.success(`Tratamiento ${!isActive ? 'activado' : 'desactivado'} con éxito`);
          await this.loadData();
          this.renderView();
        } catch (err) {
          toast.error(err.message || 'Error al cambiar estado del tratamiento');
        }
      }
    };

    this.container.addEventListener('click', this.containerClickListener);
  }

  destroy() {
    this.container.removeEventListener('click', this.containerClickListener);
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
            <input type="number" name="default_price" class="form-input" value="${treat.default_price || ''}" required />
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
}
