// ============================================
// Vista de Gestión de Pacientes
// ============================================
import patientService from '../../services/patient.service.js';
import toast from '../../components/toast/toast.js';
import Modal from '../../components/modal/modal.js';
import { formatDate } from '../../utils/helpers.js';

export class Patients {
  constructor(container) {
    this.container = container;
    this.patientsList = [];
  }

  async render() {
    await this.loadPatients();
  }

  async loadPatients(searchQuery = '') {
    try {
      let data;
      if (searchQuery) {
        data = await patientService.search(searchQuery);
      } else {
        const response = await patientService.getAll();
        data = response || [];
      }
      this.patientsList = data;
      this.renderTable();
    } catch (err) {
      toast.error('Error al cargar la lista de pacientes');
    }
  }

  renderTable() {
    let rows = this.patientsList.map(pat => `
      <tr>
        <td><strong>${pat.first_name} ${pat.last_name}</strong></td>
        <td>${pat.dni || pat.passport || 'No registrado'}</td>
        <td>${pat.phone || pat.mobile || 'No registrado'}</td>
        <td>${pat.email || 'No registrado'}</td>
        <td>${pat.birth_date ? formatDate(pat.birth_date) : 'N/A'}</td>
        <td><span class="badge ${pat.is_active ? 'badge-success' : 'badge-danger'}">${pat.is_active ? 'Activo' : 'Inactivo'}</span></td>
        <td>
          <a href="#/patients/${pat.id}" class="btn btn-sm btn-outline">Perfil</a>
          <button class="btn btn-sm btn-secondary edit-patient-btn" data-id="${pat.id}">Editar</button>
        </td>
      </tr>
    `).join('');

    if (this.patientsList.length === 0) {
      rows = `
        <tr>
          <td colspan="7" style="text-align: center; color: var(--text-secondary); padding: var(--space-6);">
            No se encontraron pacientes registrados.
          </td>
        </tr>
      `;
    }

    this.container.innerHTML = `
      <div class="page-header" style="display: flex; justify-content: between; align-items: center; margin-bottom: var(--space-4);">
        <div>
          <h1 class="page-title">Gestión de Pacientes</h1>
          <p style="color: var(--text-secondary);">Directorio de expedientes clínicos</p>
        </div>
        <button id="add-patient-btn" class="btn btn-primary">+ Nuevo Paciente</button>
      </div>

      <div class="card" style="margin-bottom: var(--space-4); padding: var(--space-4);">
        <div style="display: flex; gap: var(--space-2);">
          <input type="text" id="patient-search" class="form-input" placeholder="Buscar por Nombre, DNI, Teléfono o Correo..." style="flex: 1;" />
          <button id="search-btn" class="btn btn-secondary">Buscar</button>
        </div>
      </div>

      <div class="card">
        <div class="card-body table-container">
          <table>
            <thead>
              <tr>
                <th>Nombre Completo</th>
                <th>DNI / Pasaporte</th>
                <th>Teléfono</th>
                <th>Correo Electrónico</th>
                <th>Fecha Nacimiento</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody id="patients-table-body">
              ${rows}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  mount() {
    // Escuchar búsqueda
    const searchInput = this.container.querySelector('#patient-search');
    const searchBtn = this.container.querySelector('#search-btn');
    
    if (searchBtn && searchInput) {
      searchBtn.addEventListener('click', async () => {
        searchBtn.disabled = true;
        await this.loadPatients(searchInput.value.trim());
        searchBtn.disabled = false;
      });
      searchInput.addEventListener('keypress', async (e) => {
        if (e.key === 'Enter') {
          searchBtn.disabled = true;
          await this.loadPatients(searchInput.value.trim());
          searchBtn.disabled = false;
        }
      });
    }

    // Modal para Agregar Paciente
    const addBtn = this.container.querySelector('#add-patient-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => this.showPatientModal());
    }

    // Botones de editar
    this.container.addEventListener('click', (e) => {
      if (e.target.classList.contains('edit-patient-btn')) {
        const id = e.target.getAttribute('data-id');
        this.showPatientModal(id);
      }
    });
  }

  async showPatientModal(patientId = null) {
    const isEdit = !!patientId;
    let patientData = {};
    if (isEdit) {
      try {
        patientData = await patientService.getById(patientId);
      } catch {
        toast.error('Error al cargar los datos del paciente');
        return;
      }
    }

    const sectionTitle = (label) => `
      <div style="grid-column: span 2; border-bottom: 1px solid var(--border-color); margin: var(--space-2) 0 var(--space-1) 0; padding-bottom: var(--space-1);">
        <h4 style="margin: 0; color: var(--primary-700); font-size: var(--text-sm); text-transform: uppercase; letter-spacing: 0.5px;">${label}</h4>
      </div>`;

    const content = `
      <form id="patient-modal-form" class="patient-form-grid">
        ${sectionTitle('Información Personal')}
        <div class="form-group">
          <label class="form-label">Nombres</label>
          <input type="text" name="first_name" class="form-input" value="${patientData.first_name || ''}" required />
        </div>
        <div class="form-group">
          <label class="form-label">Apellidos</label>
          <input type="text" name="last_name" class="form-input" value="${patientData.last_name || ''}" required />
        </div>
        <div class="form-group">
          <label class="form-label">DNI / ID</label>
          <input type="text" name="dni" class="form-input" value="${patientData.dni || ''}" />
        </div>
        <div class="form-group">
          <label class="form-label">Pasaporte</label>
          <input type="text" name="passport" class="form-input" value="${patientData.passport || ''}" />
        </div>
        <div class="form-group">
          <label class="form-label">Fecha de Nacimiento</label>
          <input type="date" name="birth_date" class="form-input" value="${patientData.birth_date ? patientData.birth_date.split('T')[0] : ''}" />
        </div>
        <div class="form-group">
          <label class="form-label">Género</label>
          <select name="gender" class="form-select">
            <option value="">Seleccione</option>
            <option value="masculino" ${patientData.gender === 'masculino' ? 'selected' : ''}>Masculino</option>
            <option value="femenino" ${patientData.gender === 'femenino' ? 'selected' : ''}>Femenino</option>
            <option value="otro" ${patientData.gender === 'otro' ? 'selected' : ''}>Otro</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Ocupación</label>
          <input type="text" name="occupation" class="form-input" value="${patientData.occupation || ''}" />
        </div>
        <div class="form-group">
          <label class="form-label">Estado</label>
          <select name="is_active" class="form-select">
            <option value="true" ${patientData.is_active !== false ? 'selected' : ''}>Activo</option>
            <option value="false" ${patientData.is_active === false ? 'selected' : ''}>Inactivo</option>
          </select>
        </div>

        ${sectionTitle('Contacto')}
        <div class="form-group">
          <label class="form-label">Teléfono</label>
          <input type="text" name="phone" class="form-input" value="${patientData.phone || ''}" />
        </div>
        <div class="form-group">
          <label class="form-label">Celular</label>
          <input type="text" name="mobile" class="form-input" value="${patientData.mobile || ''}" />
        </div>
        <div class="form-group" style="grid-column: span 2;">
          <label class="form-label">Email</label>
          <input type="email" name="email" class="form-input" value="${patientData.email || ''}" />
        </div>

        ${sectionTitle('Dirección')}
        <div class="form-group" style="grid-column: span 2;">
          <label class="form-label">Dirección</label>
          <input type="text" name="address" class="form-input" value="${patientData.address || ''}" />
        </div>
        <div class="form-group">
          <label class="form-label">Ciudad</label>
          <input type="text" name="city" class="form-input" value="${patientData.city || ''}" />
        </div>
        <div class="form-group">
          <label class="form-label">Estado / Provincia</label>
          <input type="text" name="state" class="form-input" value="${patientData.state || ''}" />
        </div>
        <div class="form-group">
          <label class="form-label">Código Postal</label>
          <input type="text" name="postal_code" class="form-input" value="${patientData.postal_code || ''}" />
        </div>

        ${sectionTitle('Seguro Médico')}
        <div class="form-group">
          <label class="form-label">Aseguradora</label>
          <input type="text" name="insurance_provider" class="form-input" value="${patientData.insurance_provider || ''}" />
        </div>
        <div class="form-group">
          <label class="form-label">No. Póliza</label>
          <input type="text" name="insurance_number" class="form-input" value="${patientData.insurance_number || ''}" />
        </div>

        ${sectionTitle('Contacto de Emergencia')}
        <div class="form-group" style="grid-column: span 2;">
          <label class="form-label">Nombre Completo</label>
          <input type="text" name="emergency_contact_name" class="form-input" value="${patientData.emergency_contact_name || ''}" />
        </div>
        <div class="form-group">
          <label class="form-label">Teléfono</label>
          <input type="text" name="emergency_contact_phone" class="form-input" value="${patientData.emergency_contact_phone || ''}" />
        </div>
        <div class="form-group">
          <label class="form-label">Parentesco / Relación</label>
          <input type="text" name="emergency_contact_relationship" class="form-input" value="${patientData.emergency_contact_relationship || ''}" />
        </div>

        ${sectionTitle('Información Médica')}
        <div class="form-group" style="grid-column: span 2;">
          <label class="form-label">Alergias Conocidas</label>
          <textarea name="allergies" class="form-textarea" rows="2">${patientData.allergies || ''}</textarea>
        </div>
        <div class="form-group" style="grid-column: span 2;">
          <label class="form-label">Condiciones Médicas</label>
          <textarea name="medical_conditions" class="form-textarea" rows="2">${patientData.medical_conditions || ''}</textarea>
        </div>
        <div class="form-group" style="grid-column: span 2;">
          <label class="form-label">Medicamentos Actuales</label>
          <textarea name="current_medications" class="form-textarea" rows="2">${patientData.current_medications || ''}</textarea>
        </div>

        ${sectionTitle('Notas')}
        <div class="form-group" style="grid-column: span 2;">
          <textarea name="notes" class="form-textarea" rows="3">${patientData.notes || ''}</textarea>
        </div>
      </form>
    `;

    Modal.show({
      title: isEdit ? 'Editar Expediente de Paciente' : 'Registrar Nuevo Paciente',
      content: content,
      confirmText: isEdit ? 'Guardar Cambios' : 'Registrar',
      size: 'lg',
      onConfirm: async (modalBody) => {
        const formElement = modalBody.querySelector('#patient-modal-form');
        const formData = new FormData(formElement);
        const data = Object.fromEntries(formData.entries());

        if (data.is_active === 'true') data.is_active = true;
        if (data.is_active === 'false') data.is_active = false;

        try {
          if (isEdit) {
            await patientService.update(patientId, data);
            toast.success('Expediente del paciente actualizado con éxito');
          } else {
            await patientService.create(data);
            toast.success('Paciente registrado con éxito');
          }
          await this.loadPatients();
          return true;
        } catch (err) {
          toast.error(err.message || 'Error al procesar el expediente del paciente');
          return false;
        }
      }
    });
  }
}
