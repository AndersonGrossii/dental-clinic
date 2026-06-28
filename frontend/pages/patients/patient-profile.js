// ============================================
// Vista de Perfil y Expediente de Paciente
// ============================================
import patientService from '../../services/patient.service.js';
import treatmentService from '../../services/treatment.service.js';
import toast from '../../components/toast/toast.js';
import Modal from '../../components/modal/modal.js';
import { formatDate, formatCurrency } from '../../utils/helpers.js';

export class PatientProfile {
  constructor(container, params) {
    this.container = container;
    this.patientId = params.id;
    this.patient = null;
    this.clinicalTreatments = [];
    this.activeTab = 'info';
  }

  async render() {
    try {
      this.patient = await patientService.getById(this.patientId);
      this.clinicalTreatments = await treatmentService.getPatientTreatments(this.patientId);
      this.renderProfile();
    } catch (err) {
      toast.error('Error al cargar expediente del paciente');
      this.container.innerHTML = `<p>Error: ${err.message}</p>`;
    }
  }

  renderProfile() {
    const pat = this.patient;

    // Tabs links
    const tabLink = (id, label) => `
      <button class="tab-item ${this.activeTab === id ? 'active' : ''}" data-tab="${id}">
        ${label}
      </button>
    `;

    // Dynamic Tab Content
    let tabContent = '';
    if (this.activeTab === 'info') {
      tabContent = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-6);">
          <div>
            <h3 style="margin-bottom: var(--space-4); border-bottom: 2px solid var(--gray-100); padding-bottom: 4px;">Información Personal</h3>
            <p><strong>Identificación (DNI/ID):</strong> ${pat.dni || 'N/A'}</p>
            <p><strong>Pasaporte:</strong> ${pat.passport || 'N/A'}</p>
            <p><strong>Fecha de Nacimiento:</strong> ${pat.birth_date ? formatDate(pat.birth_date) : 'N/A'}</p>
            <p><strong>Género:</strong> ${pat.gender || 'N/A'}</p>
            <p><strong>Ocupación:</strong> ${pat.occupation || 'N/A'}</p>
          </div>
          <div>
            <h3 style="margin-bottom: var(--space-4); border-bottom: 2px solid var(--gray-100); padding-bottom: 4px;">Información de Contacto</h3>
            <p><strong>Teléfono:</strong> ${pat.phone || 'N/A'}</p>
            <p><strong>Móvil:</strong> ${pat.mobile || 'N/A'}</p>
            <p><strong>Correo Electrónico:</strong> ${pat.email || 'N/A'}</p>
            <p><strong>Dirección:</strong> ${pat.address || 'N/A'}</p>
            <p><strong>Contacto de Emergencia:</strong> ${pat.emergency_contact_name || 'N/A'} (${pat.emergency_contact_phone || 'N/A'})</p>
          </div>
          <div style="grid-column: span 2; margin-top: var(--space-4);">
            <h3 style="margin-bottom: var(--space-4); border-bottom: 2px solid var(--gray-100); padding-bottom: 4px;">Historial Médico & Alergias</h3>
            <div style="background-color: var(--danger-50); border-left: 4px solid var(--danger-500); padding: var(--space-3); border-radius: var(--radius-sm); margin-bottom: var(--space-3);">
              <p style="color: var(--danger-900); font-weight: 600; margin-bottom: 2px;">⚠️ Alergias Registradas</p>
              <p style="color: var(--danger-800); margin: 0;">${pat.allergies || 'Ninguna alergia conocida registrada.'}</p>
            </div>
            <p><strong>Condiciones Médicas:</strong> ${pat.medical_conditions || 'Ninguna condición registrada.'}</p>
            <p><strong>Medicamentos Actuales:</strong> ${pat.current_medications || 'Ninguno.'}</p>
            <p><strong>Aseguradora:</strong> ${pat.insurance_provider || 'Ninguna'} (No. Póliza: ${pat.insurance_number || 'N/A'})</p>
          </div>
        </div>
      `;
    } else if (this.activeTab === 'treatments') {
      let treatmentRows = this.clinicalTreatments.map(t => `
        <tr>
          <td>${t.created_at ? formatDate(t.created_at) : 'N/A'}</td>
          <td>${t.treatment_name}</td>
          <td>${t.tooth_number ? `Pieza ${t.tooth_number}` : 'General'}</td>
          <td><strong>${formatCurrency(t.price)}</strong></td>
          <td><span class="badge ${t.status === 'completado' ? 'badge-success' : 'badge-warning'}">${t.status.toUpperCase()}</span></td>
          <td>${t.notes || ''}</td>
        </tr>
      `).join('');

      if (this.clinicalTreatments.length === 0) {
        treatmentRows = `
          <tr>
            <td colspan="6" style="text-align: center; color: var(--text-secondary); padding: var(--space-6);">
              No se han registrado tratamientos en el expediente de este paciente.
            </td>
          </tr>
        `;
      }

      tabContent = `
        <div style="display: flex; justify-content: between; align-items: center; margin-bottom: var(--space-4);">
          <h3>Historial Dental de Tratamientos</h3>
          <button id="add-treatment-history-btn" class="btn btn-sm btn-primary">+ Agregar Tratamiento</button>
        </div>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tratamiento</th>
                <th>Pieza</th>
                <th>Costo</th>
                <th>Estado</th>
                <th>Notas</th>
              </tr>
            </thead>
            <tbody>
              ${treatmentRows}
            </tbody>
          </table>
        </div>
      `;
    }

    this.container.innerHTML = `
      <div class="page-header" style="display: flex; justify-content: between; align-items: center; margin-bottom: var(--space-6);">
        <div style="display: flex; align-items: center; gap: var(--space-4);">
          <span style="font-size: 64px; background-color: var(--primary-100); border-radius: 50%; width: 80px; height: 80px; display: flex; align-items: center; justify-content: center; color: var(--primary-800);">
            ${pat.first_name[0].toUpperCase()}${pat.last_name[0].toUpperCase()}
          </span>
          <div>
            <h1 class="page-title">${pat.first_name} ${pat.last_name}</h1>
            <p style="color: var(--text-secondary); margin: 0;">Expediente Clínico #EXP-${pat.id.toString().padStart(5, '0')}</p>
          </div>
        </div>
        <a href="#/patients" class="btn btn-outline">⬅ Volver al Directorio</a>
      </div>

      <div class="tabs" style="display: flex; gap: var(--space-2); margin-bottom: var(--space-4); border-bottom: 1px solid var(--border-color); padding-bottom: var(--space-2);">
        ${tabLink('info', 'Ficha Técnica')}
        ${tabLink('treatments', 'Historial Odontológico')}
      </div>

      <div class="card" style="padding: var(--space-6);">
        ${tabContent}
      </div>
    `;
  }

  mount() {
    // Escuchar cambio de pestañas
    const tabs = this.container.querySelectorAll('.tab-item');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        this.activeTab = tab.getAttribute('data-tab');
        this.renderProfile();
        this.mount();
      });
    });

    // Agregar tratamiento al historial
    const addHistoryBtn = this.container.querySelector('#add-treatment-history-btn');
    if (addHistoryBtn) {
      addHistoryBtn.addEventListener('click', () => this.showAddTreatmentModal());
    }
  }

  showAddTreatmentModal() {
    // Aquí cargaríamos un dropdown de tratamientos activos.
    // Para simplificar, permitimos ingresar un formulario de registro.
    const content = `
      <form id="add-treatment-history-form">
        <div class="form-group">
          <label class="form-label">ID de Tratamiento (Catálogo)</label>
          <input type="number" name="treatment_id" class="form-input" placeholder="Ej: 1" required />
        </div>
        <div class="form-group" style="margin-top: var(--space-3);">
          <label class="form-label">Diente / Pieza (Opcional)</label>
          <input type="number" name="tooth_number" class="form-input" placeholder="Ej: 18" />
        </div>
        <div class="form-group" style="margin-top: var(--space-3);">
          <label class="form-label">Precio Cobrado</label>
          <input type="number" name="price" class="form-input" placeholder="Ej: 1200" required />
        </div>
        <div class="form-group" style="margin-top: var(--space-3);">
          <label class="form-label">Notas Clínicas</label>
          <textarea name="notes" class="form-textarea" rows="3"></textarea>
        </div>
      </form>
    `;

    Modal.show({
      title: 'Registrar Tratamiento Clínico',
      content: content,
      confirmText: 'Registrar',
      onConfirm: async (modalBody) => {
        const form = modalBody.querySelector('#add-treatment-history-form');
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        data.patient_id = this.patientId;
        data.status = 'completado'; // completado por defecto al registrar manualmente

        try {
          await treatmentService.addPatientTreatment(data);
          toast.success('Tratamiento registrado con éxito');
          await this.render();
          this.mount();
          return true;
        } catch (err) {
          toast.error(err.message || 'Error al guardar tratamiento');
          return false;
        }
      }
    });
  }
}
