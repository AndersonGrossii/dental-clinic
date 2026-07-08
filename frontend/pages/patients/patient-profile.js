// ============================================
// Vista de Perfil y Expediente de Paciente
// ============================================
import patientService from '../../services/patient.service.js';
import treatmentService from '../../services/treatment.service.js';
import appointmentService from '../../services/appointment.service.js';
import quotationService from '../../services/quotation.service.js';
import toast from '../../components/toast/toast.js';
import Modal from '../../components/modal/modal.js';
import state from '../../scripts/state.js';
import { formatDate, formatCurrency } from '../../utils/helpers.js';

export class PatientProfile {
  constructor(container, params) {
    this.container = container;
    this.patientId = params.id;
    this.patient = null;
    this.clinicalTreatments = [];
    this.appointments = [];
    this.quotations = [];
    this.clinicalNotes = [];
    this.activeTab = 'info';
  }

  async render() {
    try {
      this.patient = await patientService.getById(this.patientId);
      this.clinicalTreatments = await treatmentService.getPatientTreatments(this.patientId);
      this.appointments = await appointmentService.getAll({ patient_id: this.patientId, limit: 999 });
      const quotesRes = await quotationService.getAll({ patient_id: this.patientId, limit: 999 });
      this.quotations = Array.isArray(quotesRes) ? quotesRes : (quotesRes.rows || []);
      this.clinicalNotes = await patientService.getNotes(this.patientId) || [];
      
      this.renderProfile();
    } catch (err) {
      toast.error('Error al cargar expediente del paciente');
      this.container.innerHTML = `<div class="empty-state"><h3>Error al cargar el expediente</h3><p>${err.message}</p></div>`;
    }
  }

  renderProfile() {
    const pat = this.patient;
    const isDoctor = state.get('user')?.role_name === 'doctor';

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
          <div style="grid-column: span 2; margin-top: var(--space-4); display: grid; grid-template-columns: ${isDoctor ? '1fr' : '1fr 1fr'}; gap: var(--space-6);">
            <div style="${isDoctor ? 'grid-column: span 2;' : ''}">
              <h3 style="margin-bottom: var(--space-4); border-bottom: 2px solid var(--gray-100); padding-bottom: 4px;">Historial Médico & Alergias</h3>
              <div style="background-color: var(--danger-50); border-left: 4px solid var(--danger-500); padding: var(--space-3); border-radius: var(--radius-sm); margin-bottom: var(--space-3);">
                <p style="color: var(--danger-900); font-weight: 600; margin-bottom: 2px;">⚠️ Alergias Registradas</p>
                <p style="color: var(--danger-800); margin: 0;">${pat.allergies || 'Ninguna alergia conocida registrada.'}</p>
              </div>
              <p><strong>Condiciones Médicas:</strong> ${pat.medical_conditions || 'Ninguna condición registrada.'}</p>
              <p><strong>Medicamentos Actuales:</strong> ${pat.current_medications || 'Ninguno.'}</p>
              <p><strong>Aseguradora:</strong> ${pat.insurance_provider || 'Ninguna'} (No. Póliza: ${pat.insurance_number || 'N/A'})</p>
            </div>
            ${isDoctor ? '' : `
              <div>
                <h3 style="margin-bottom: var(--space-4); border-bottom: 2px solid var(--gray-100); padding-bottom: 4px;">Resumen Financiero</h3>
                <div style="display: flex; flex-direction: column; gap: var(--space-3); background-color: var(--gray-50); padding: var(--space-4); border-radius: var(--radius-md); border: 1px solid var(--border-color);">
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: var(--text-secondary); font-weight: 500;">Total Facturado (Débito):</span>
                    <span style="font-weight: 600; color: var(--text-primary);">${formatCurrency(pat.total_debit || pat.financial?.totalDebit || 0)}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: var(--text-secondary); font-weight: 500;">Total Pagado (Crédito):</span>
                    <span style="font-weight: 600; color: var(--success-600);">${formatCurrency(pat.total_credit || pat.financial?.totalCredit || 0)}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-color); padding-top: var(--space-2); margin-top: var(--space-1);">
                    <span style="font-weight: 700; color: var(--text-primary);">Saldo Pendiente:</span>
                    <span style="font-weight: 700; color: ${parseFloat(pat.balance || 0) > 0 ? 'var(--danger-600)' : 'var(--success-600)'};">
                      ${formatCurrency(pat.balance || pat.financial?.balance || 0)}
                    </span>
                  </div>
                </div>
              </div>
            `}
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
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4);">
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
    } else if (this.activeTab === 'appointments') {
      let appointmentRows = (this.appointments || []).map(a => `
        <tr>
          <td>${a.appointment_date ? formatDate(a.appointment_date) : 'N/A'}</td>
          <td>${a.start_time ? a.start_time.substring(0, 5) : ''} - ${a.end_time ? a.end_time.substring(0, 5) : ''}</td>
          <td>Dr/a. ${a.doctor_name || ''}</td>
          <td>${a.reason || ''}</td>
          <td><span class="badge" style="background-color: ${a.status_color || '#cbd5e1'}; color: white;">${a.status_label || ''}</span></td>
        </tr>
      `).join('');

      if (!this.appointments || this.appointments.length === 0) {
        appointmentRows = `
          <tr>
            <td colspan="5" style="text-align: center; color: var(--text-secondary); padding: var(--space-6);">
              No se han registrado citas para este paciente.
            </td>
          </tr>
        `;
      }

      tabContent = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4);">
          <h3>Historial de Citas</h3>
          <button id="profile-add-appointment-btn" class="btn btn-sm btn-primary">+ Agendar Cita</button>
        </div>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Horario</th>
                <th>Doctor</th>
                <th>Motivo</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              ${appointmentRows}
            </tbody>
          </table>
        </div>
      `;
    } else if (this.activeTab === 'quotations') {
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

      let quotationRows = (this.quotations || []).map(q => `
        <tr>
          <td><strong># ${q.quote_number}</strong></td>
          <td>Dr/a. ${q.doctor_name || 'Sin asignar'}</td>
          <td><strong>${formatCurrency(q.total)}</strong></td>
          <td><span class="badge ${STATUS_BADGES[q.status] || 'badge-secondary'}">${STATUS_LABELS[q.status] || q.status}</span></td>
          <td>${q.created_at ? formatDate(q.created_at) : 'N/A'}</td>
          <td>
            <a href="#/quotations" class="btn btn-sm btn-outline">Ver Detalle</a>
          </td>
        </tr>
      `).join('');

      if (!this.quotations || this.quotations.length === 0) {
        quotationRows = `
          <tr>
            <td colspan="6" style="text-align: center; color: var(--text-secondary); padding: var(--space-6);">
              No se han registrado presupuestos para este paciente.
            </td>
          </tr>
        `;
      }

      tabContent = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4);">
          <h3>Presupuestos / Cotizaciones</h3>
          <a href="#/quotations" class="btn btn-sm btn-primary">+ Nuevo Presupuesto</a>
        </div>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>No. Presupuesto</th>
                <th>Doctor</th>
                <th>Monto Total</th>
                <th>Estado</th>
                <th>Fecha de Creación</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${quotationRows}
            </tbody>
          </table>
        </div>
      `;
    } else if (this.activeTab === 'notes') {
      const userRole = state.get('user')?.role_name;
      const canWriteNotes = ['propietario', 'direccion', 'doctor'].includes(userRole);

      let noteRows = (this.clinicalNotes || []).map(n => `
        <div style="border-bottom: 1px solid var(--border-color); padding: var(--space-4) 0; margin-bottom: var(--space-2);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-1); gap: var(--space-2);">
            <strong style="font-size: var(--text-sm); color: var(--primary-700);">${n.title || 'Nota Clínica'}</strong>
            <span style="font-size: var(--text-xs); color: var(--text-tertiary); white-space: nowrap;">${formatDate(n.created_at)}</span>
          </div>
          <div style="font-size: var(--text-xs); color: var(--text-secondary); margin-bottom: var(--space-2);">
            Escrito por: <strong>${n.author_name} ${n.author_lastname}</strong> (${n.author_role.charAt(0).toUpperCase() + n.author_role.slice(1)})
          </div>
          <p style="font-size: var(--text-sm); margin: 0; color: var(--color-text); white-space: pre-wrap;">${n.content}</p>
        </div>
      `).join('');

      if (!this.clinicalNotes || this.clinicalNotes.length === 0) {
        noteRows = `
          <div style="text-align: center; color: var(--text-secondary); padding: var(--space-6);">
            No hay notas de evolución clínica registradas para este paciente.
          </div>
        `;
      }

      tabContent = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4);">
          <h3>Notas de Evolución Clínica</h3>
          ${canWriteNotes ? `<button id="profile-add-note-btn" class="btn btn-sm btn-primary">+ Nueva Nota</button>` : ''}
        </div>
        <div style="max-height: 500px; overflow-y: auto; padding-right: 8px;">
          ${noteRows}
        </div>
      `;
    }

    this.container.innerHTML = `
      <div class="page-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-6);">
        <div style="display: flex; align-items: center; gap: var(--space-4);">
          <span style="font-size: 64px; background-color: var(--primary-100); border-radius: 50%; width: 80px; height: 80px; display: flex; align-items: center; justify-content: center; color: var(--primary-800);">
            ${pat.first_name[0].toUpperCase()}${pat.last_name[0].toUpperCase()}
          </span>
          <div>
            <h1 class="page-title">${pat.first_name} ${pat.last_name}</h1>
            <div style="display: flex; gap: var(--space-2); align-items: center; margin-top: 4px;">
              <span class="badge badge-info" style="font-size: var(--text-sm); font-weight: 600; padding: 2px 8px;">ID: ${pat.custom_id || 'N/A'}</span>
              ${isDoctor ? '' : `
                <span class="badge ${parseFloat(pat.balance || 0) > 0 ? 'badge-danger' : 'badge-success'}" style="font-size: var(--text-sm); font-weight: 600; padding: 2px 8px;">
                  ${parseFloat(pat.balance || 0) > 0 ? `Pendiente: ${formatCurrency(pat.balance)}` : 'Al corriente'}
                </span>
              `}
              <p style="color: var(--text-secondary); margin: 0; font-size: var(--text-sm);">Expediente Clínico #EXP-${pat.id.toString().padStart(5, '0')}</p>
            </div>
          </div>
        </div>
        <div style="display: flex; gap: var(--space-2);">
          <button id="schedule-appointment-btn" class="btn btn-primary">📅 Agendar Cita</button>
          <button id="edit-patient-profile-btn" class="btn btn-secondary">Editar Datos</button>
          <a href="#/patients" class="btn btn-outline">⬅ Volver al Directorio</a>
        </div>
      </div>

      <div class="tabs" style="display: flex; gap: var(--space-2); margin-bottom: var(--space-4); border-bottom: 1px solid var(--border-color); padding-bottom: var(--space-2);">
        ${tabLink('info', 'Ficha Técnica')}
        ${tabLink('treatments', 'Historial Odontológico')}
        ${tabLink('appointments', 'Historial de Citas')}
        ${tabLink('quotations', 'Presupuestos')}
        ${tabLink('notes', 'Notas de Evolución')}
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

    // Agregar nota clínica
    const addNoteBtn = this.container.querySelector('#profile-add-note-btn');
    if (addNoteBtn) {
      addNoteBtn.addEventListener('click', () => this.showAddNoteModal());
    }

    // Editar datos del paciente
    const editBtn = this.container.querySelector('#edit-patient-profile-btn');
    if (editBtn) {
      editBtn.addEventListener('click', () => this.showPatientModal());
    }

    // Agendar cita
    const prefillAndGo = () => {
      state.set('prefilledAppointment', {
        patientId: this.patient.id,
        patientName: `${this.patient.first_name} ${this.patient.last_name}`,
        patientCustomId: this.patient.custom_id || null
      });
      window.location.hash = '#/appointments';
    };

    const scheduleBtn = this.container.querySelector('#schedule-appointment-btn');
    if (scheduleBtn) {
      scheduleBtn.addEventListener('click', prefillAndGo);
    }

    const tabScheduleBtn = this.container.querySelector('#profile-add-appointment-btn');
    if (tabScheduleBtn) {
      tabScheduleBtn.addEventListener('click', prefillAndGo);
    }
  }

  async showPatientModal() {
    let patientData = {};
    try {
      patientData = await patientService.getById(this.patientId);
    } catch {
      toast.error('Error al cargar los datos del paciente');
      return;
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
      title: 'Editar Expediente de Paciente',
      content: content,
      confirmText: 'Guardar Cambios',
      size: 'lg',
      onConfirm: async (modalBody) => {
        const formElement = modalBody.querySelector('#patient-modal-form');
        const formData = new FormData(formElement);
        const data = Object.fromEntries(formData.entries());

        if (data.is_active === 'true') data.is_active = true;
        if (data.is_active === 'false') data.is_active = false;

        try {
          await patientService.update(this.patientId, data);
          toast.success('Expediente del paciente actualizado con éxito');
          await this.render();
          this.mount();
          return true;
        } catch (err) {
          toast.error(err.message || 'Error al actualizar el expediente del paciente');
          return false;
        }
      }
    });
  }

  async showAddTreatmentModal() {
    let treatments = [];
    try {
      treatments = await treatmentService.getAll();
    } catch (err) {
      toast.error('Error al cargar catálogo de tratamientos');
      return;
    }

    const options = treatments
      .filter(t => t.is_active)
      .map(t => `<option value="${t.id}" data-price="${t.default_price}">${t.name} (${t.code}) - ${formatCurrency(t.default_price)}</option>`)
      .join('');

    const content = `
      <form id="add-treatment-history-form">
        <div class="form-group">
          <label class="form-label">Tratamiento</label>
          <select name="treatment_id" id="treatment-select" class="form-select" required>
            <option value="">Seleccione un tratamiento...</option>
            ${options}
          </select>
        </div>
        <div class="form-group" style="margin-top: var(--space-3);">
          <label class="form-label">Diente / Pieza (Opcional)</label>
          <input type="number" name="tooth_number" class="form-input" placeholder="Ej: 18" />
        </div>
        <div class="form-group" style="margin-top: var(--space-3);">
          <label class="form-label">Precio Cobrado</label>
          <input type="number" name="price" id="treatment-price" class="form-input" placeholder="Ej: 1200" required />
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
        data.treatment_id = Number(data.treatment_id);
        data.price = Number(data.price);
        if (data.tooth_number) data.tooth_number = Number(data.tooth_number);

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

    // Auto-fill price when treatment select changes
    const select = document.getElementById('treatment-select');
    const priceInput = document.getElementById('treatment-price');
    if (select && priceInput) {
      select.addEventListener('change', () => {
        const selectedOption = select.options[select.selectedIndex];
        const price = selectedOption.dataset.price || '';
        priceInput.value = price;
      });
    }
  }

  async showAddNoteModal() {
    const content = `
      <form id="add-note-form">
        <div class="form-group">
          <label class="form-label">Título de la Nota</label>
          <input type="text" name="title" class="form-input" placeholder="Ej: Revisión general, Evolución Ortodoncia..." required />
        </div>
        <div class="form-group" style="margin-top: var(--space-3);">
          <label class="form-label">Contenido Clínico</label>
          <textarea name="content" class="form-textarea" rows="5" placeholder="Escriba los detalles de la consulta..." required></textarea>
        </div>
        <div class="form-group" style="margin-top: var(--space-3);">
          <label class="form-label">Tipo de Nota</label>
          <select name="type" class="form-select">
            <option value="clinica">Clínica</option>
            <option value="seguimiento">Seguimiento</option>
            <option value="observacion">Observación</option>
            <option value="general">General</option>
          </select>
        </div>
      </form>
    `;

    Modal.show({
      title: 'Registrar Nota de Evolución Clínica',
      content: content,
      confirmText: 'Registrar',
      onConfirm: async (modalBody) => {
        const form = modalBody.querySelector('#add-note-form');
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        if (!data.content || data.content.trim() === '') {
          toast.error('El contenido de la nota es requerido.');
          return false;
        }

        try {
          await patientService.createNote(this.patientId, data);
          toast.success('Nota clínica registrada con éxito');
          await this.render();
          this.mount();
          return true;
        } catch (err) {
          toast.error(err.message || 'Error al guardar nota clínica');
          return false;
        }
      }
    });
  }
}
