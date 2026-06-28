// ============================================
// Vista de Gestión de Citas y Calendario
// ============================================
import appointmentService from '../../services/appointment.service.js';
import doctorService from '../../services/doctor.service.js';
import patientService from '../../services/patient.service.js';
import toast from '../../components/toast/toast.js';
import Modal from '../../components/modal/modal.js';
import state from '../../scripts/state.js';
import { formatDate, formatTime } from '../../utils/helpers.js';

export class Appointments {
  constructor(container) {
    this.container = container;
    this.appointmentsList = [];
    this.doctorsList = [];
    this.filters = {};
  }

  async render(filters = {}) {
    await this.loadData(filters);
    this.renderView();
  }

  async loadData(filters = {}) {
    try {
      const user = state.get('user');
      this.isDoctor = user?.role_name === 'doctor';

      this.filters = { ...this.filters, ...filters };
      if (this.isDoctor) {
        this.filters.doctor_id = user.doctor_id;
      }
      const params = { ...this.filters };
      Object.keys(params).forEach(k => { if (!params[k] && params[k] !== 0) delete params[k]; });
      const apptsResponse = await appointmentService.getAll(params);
      this.appointmentsList = apptsResponse || [];
      if (!this.isDoctor && !filters.doctor_id) {
        const docsResponse = await doctorService.getAll();
        this.doctorsList = docsResponse || [];
      }
    } catch (err) {
      toast.error('Error al cargar la agenda de citas');
    }
  }

  renderView() {
    const docOptions = this.doctorsList.map(d =>
      `<option value="${d.id}" ${this.filters.doctor_id == d.id ? 'selected' : ''}>${d.first_name} ${d.last_name}</option>`
    ).join('');

    const doctorFilterHtml = this.isDoctor
      ? ''
      : `<div class="form-group" style="margin: 0; min-width: 160px;">
           <label class="form-label" style="font-size: var(--text-xs);">Doctor</label>
           <select id="filter-doctor" class="form-select">
             <option value="">Todos</option>
             ${docOptions}
           </select>
         </div>`;

    const rows = this.appointmentsList.length
      ? this.appointmentsList.map(app => `
          <tr>
            <td><strong>${formatDate(app.appointment_date)}</strong></td>
            <td>${formatTime(app.start_time)} - ${formatTime(app.end_time)}</td>
            <td>${app.patient_name}</td>
            <td>${app.doctor_name}</td>
            <td>${app.treatment_name || 'Consulta general'}</td>
            <td><span class="badge" style="background-color: ${app.status_color}; color: white;">${app.status_label}</span></td>
            <td>
              <button class="btn btn-sm btn-secondary change-status-btn" data-id="${app.id}">Cambiar Estado</button>
            </td>
          </tr>
        `).join('')
      : `<tr><td colspan="7" style="text-align: center; color: var(--text-secondary); padding: var(--space-6);">No hay citas programadas en la agenda.</td></tr>`;

    this.container.innerHTML = `
      <div class="page-header" style="display: flex; justify-content: between; align-items: center; margin-bottom: var(--space-6);">
        <div>
          <h1 class="page-title">Agenda y Citas</h1>
          <p style="color: var(--text-secondary);">Programación diaria y semanal de consultas</p>
        </div>
        <button id="add-appointment-btn" class="btn btn-primary">+ Nueva Cita</button>
      </div>

      <div class="card" style="margin-bottom: var(--space-4);">
        <div class="card-body">
          <div class="appointment-filters" style="display: flex; flex-wrap: wrap; gap: var(--space-3); align-items: flex-end;">
            <div class="form-group" style="margin: 0; min-width: 180px; flex: 1;">
              <label class="form-label" style="font-size: var(--text-xs);">Buscar paciente</label>
              <input type="text" id="filter-search" class="form-input" placeholder="Nombre o teléfono..." value="${this.filters.search || ''}" />
            </div>
            ${doctorFilterHtml}
            <div class="form-group" style="margin: 0; min-width: 140px;">
              <label class="form-label" style="font-size: var(--text-xs);">Fecha desde</label>
              <input type="date" id="filter-date-from" class="form-input" value="${this.filters.date_from || ''}" />
            </div>
            <div class="form-group" style="margin: 0; min-width: 140px;">
              <label class="form-label" style="font-size: var(--text-xs);">Fecha hasta</label>
              <input type="date" id="filter-date-to" class="form-input" value="${this.filters.date_to || ''}" />
            </div>
            <div class="form-group" style="margin: 0; min-width: 120px;">
              <label class="form-label" style="font-size: var(--text-xs);">Hora desde</label>
              <input type="time" id="filter-time-from" class="form-input" value="${this.filters.time_from || ''}" />
            </div>
            <div class="form-group" style="margin: 0; min-width: 120px;">
              <label class="form-label" style="font-size: var(--text-xs);">Hora hasta</label>
              <input type="time" id="filter-time-to" class="form-input" value="${this.filters.time_to || ''}" />
            </div>
            <div style="display: flex; gap: var(--space-2); padding-bottom: 1px;">
              <button id="apply-filters-btn" class="btn btn-primary btn-sm">Filtrar</button>
              <button id="clear-filters-btn" class="btn btn-outline btn-sm">Limpiar</button>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3>Listado General de Citas</h3>
        </div>
        <div class="card-body table-container">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Horario</th>
                <th>Paciente</th>
                <th>Doctor</th>
                <th>Tratamiento</th>
                <th>Estado</th>
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
    const addBtn = this.container.querySelector('#add-appointment-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => this.showAddAppointmentModal());
    }

    this.container.querySelector('#apply-filters-btn')?.addEventListener('click', () => this.applyFilters());
    this.container.querySelector('#clear-filters-btn')?.addEventListener('click', () => this.clearFilters());
    if (this.isDoctor && !this.container.querySelector('#filter-doctor')) {
      // no-op — doctor filter not rendered
    }

    this.container.addEventListener('click', (e) => {
      if (e.target.classList.contains('change-status-btn')) {
        const id = e.target.getAttribute('data-id');
        this.showChangeStatusModal(id);
      }
    });
  }

  applyFilters() {
    const filters = {
      search: this.container.querySelector('#filter-search')?.value?.trim() || undefined,
      doctor_id: this.isDoctor ? state.get('user')?.doctor_id : (this.container.querySelector('#filter-doctor')?.value || undefined),
      date_from: this.container.querySelector('#filter-date-from')?.value || undefined,
      date_to: this.container.querySelector('#filter-date-to')?.value || undefined,
      time_from: this.container.querySelector('#filter-time-from')?.value || undefined,
      time_to: this.container.querySelector('#filter-time-to')?.value || undefined,
    };
    Object.keys(filters).forEach(k => { if (!filters[k]) delete filters[k]; });
    this.render(filters);
  }

  clearFilters() {
    this.filters = {};
    this.render({});
  }

  async showAddAppointmentModal() {
    // Dropdown de doctores
    const docOptions = this.doctorsList.map(d => `
      <option value="${d.id}">Dr/a. ${d.first_name} ${d.last_name} (${d.specialty})</option>
    `).join('');

    const content = `
      <form id="add-appointment-form">
        <div class="form-group">
          <label class="form-label">Buscar Paciente</label>
          <div style="display: flex; gap: var(--space-2);">
            <input type="text" id="appointment-patient-search" class="form-input" placeholder="Nombre, DNI, teléfono o correo" />
            <button type="button" id="appointment-patient-search-btn" class="btn btn-secondary">Buscar</button>
          </div>
          <input type="hidden" name="patient_id" />
          <div id="appointment-selected-patient" style="margin-top: var(--space-2); color: var(--text-secondary);">
            Ningún paciente seleccionado.
          </div>
          <div id="appointment-patient-results" style="margin-top: var(--space-2);"></div>
        </div>

        <div class="form-group" style="margin-top: var(--space-3); border-top: 1px solid var(--border-color); padding-top: var(--space-3);">
          <button type="button" id="toggle-new-patient-btn" class="btn btn-outline">+ Agregar Paciente Nuevo</button>
          <div id="new-patient-fields" style="display: none; margin-top: var(--space-3);">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3);">
              <div>
                <label class="form-label">Nombre</label>
                <input type="text" id="new-patient-first-name" class="form-input" />
              </div>
              <div>
                <label class="form-label">Apellido</label>
                <input type="text" id="new-patient-last-name" class="form-input" />
              </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); margin-top: var(--space-3);">
              <div>
                <label class="form-label">Teléfono</label>
                <input type="text" id="new-patient-phone" class="form-input" />
              </div>
              <div>
                <label class="form-label">Correo</label>
                <input type="email" id="new-patient-email" class="form-input" />
              </div>
            </div>
            <button type="button" id="create-patient-for-appointment-btn" class="btn btn-secondary" style="margin-top: var(--space-3);">Crear y Seleccionar Paciente</button>
          </div>
        </div>
        <div class="form-group" style="margin-top: var(--space-3);">
          <label class="form-label">Doctor</label>
          <select name="doctor_id" class="form-select" required>
            <option value="">Seleccione doctor</option>
            ${docOptions}
          </select>
        </div>
        <div class="form-group" style="margin-top: var(--space-3);">
          <label class="form-label">Fecha de la Cita</label>
          <input type="date" name="appointment_date" class="form-input" required />
        </div>
        <div class="form-group" style="margin-top: var(--space-3); display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3);">
          <div>
            <label class="form-label">Hora Inicio</label>
            <input type="time" name="start_time" class="form-input" required />
          </div>
          <div>
            <label class="form-label">Hora Fin</label>
            <input type="time" name="end_time" class="form-input" required />
          </div>
        </div>
        <div class="form-group" style="margin-top: var(--space-3);">
          <label class="form-label">Motivo de la Cita</label>
          <textarea name="reason" class="form-textarea" rows="2" placeholder="Escriba el motivo para usarlo luego en la cotización..."></textarea>
        </div>
      </form>
    `;

    Modal.show({
      title: 'Programar Nueva Cita Médica',
      content: content,
      confirmText: 'Programar Cita',
      onConfirm: async (modalBody) => {
        const form = modalBody.querySelector('#add-appointment-form');
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        data.patient_id = Number(data.patient_id);
        data.doctor_id = Number(data.doctor_id);

        if (!data.patient_id) {
          toast.error('Seleccione o cree un paciente antes de programar la cita');
          return false;
        }

        if (!data.doctor_id) {
          toast.error('Seleccione un doctor');
          return false;
        }

        try {
          await appointmentService.create(data);
          toast.success('Cita programada exitosamente');
          await this.render();
          this.mount();
          return true;
        } catch (err) {
          toast.error(err.message || 'Error al programar la cita (Verifique traslapes horarios)');
          return false;
        }
      }
    });

    const overlay = document.querySelector('.modal-overlay');
    const patientIdInput = overlay.querySelector('[name="patient_id"]');
    const searchInput = overlay.querySelector('#appointment-patient-search');
    const searchBtn = overlay.querySelector('#appointment-patient-search-btn');
    const selectedPatient = overlay.querySelector('#appointment-selected-patient');
    const resultsContainer = overlay.querySelector('#appointment-patient-results');
    const toggleNewPatientBtn = overlay.querySelector('#toggle-new-patient-btn');
    const newPatientFields = overlay.querySelector('#new-patient-fields');
    const createPatientBtn = overlay.querySelector('#create-patient-for-appointment-btn');

    const selectPatient = (patient) => {
      patientIdInput.value = patient.id;
      selectedPatient.innerHTML = `<strong>Paciente seleccionado:</strong> ${patient.first_name} ${patient.last_name}`;
      resultsContainer.innerHTML = '';
    };

    const renderPatientResults = (patients) => {
      if (!patients.length) {
        resultsContainer.innerHTML = '<p style="color: var(--text-secondary); margin: 0;">No se encontraron pacientes. Puede agregar uno nuevo.</p>';
        return;
      }

      resultsContainer.innerHTML = patients.map(patient => `
        <button type="button" class="btn btn-outline appointment-patient-result" data-id="${patient.id}" style="display: block; width: 100%; text-align: left; margin-bottom: var(--space-2);">
          ${patient.first_name} ${patient.last_name}${patient.phone ? ` - ${patient.phone}` : ''}${patient.email ? ` - ${patient.email}` : ''}
        </button>
      `).join('');

      resultsContainer.querySelectorAll('.appointment-patient-result').forEach(button => {
        button.addEventListener('click', () => {
          const patient = patients.find(p => String(p.id) === button.dataset.id);
          if (patient) selectPatient(patient);
        });
      });
    };

    const searchPatients = async () => {
      const term = searchInput.value.trim();
      if (term.length < 2) {
        toast.error('Escriba al menos 2 caracteres para buscar pacientes');
        return;
      }

      try {
        const patients = await patientService.search(term);
        renderPatientResults(patients || []);
      } catch (err) {
        toast.error(err.message || 'Error al buscar pacientes');
      }
    };

    searchBtn.addEventListener('click', searchPatients);
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        searchPatients();
      }
    });

    toggleNewPatientBtn.addEventListener('click', () => {
      newPatientFields.style.display = newPatientFields.style.display === 'none' ? 'block' : 'none';
    });

    createPatientBtn.addEventListener('click', async () => {
      const firstName = overlay.querySelector('#new-patient-first-name').value.trim();
      const lastName = overlay.querySelector('#new-patient-last-name').value.trim();
      const phone = overlay.querySelector('#new-patient-phone').value.trim();
      const email = overlay.querySelector('#new-patient-email').value.trim();

      if (!firstName || !lastName) {
        toast.error('Nombre y apellido son obligatorios para crear el paciente');
        return;
      }

      try {
        const patient = await patientService.create({
          first_name: firstName,
          last_name: lastName,
          phone: phone || undefined,
          email: email || undefined,
        });
        selectPatient(patient);
        newPatientFields.style.display = 'none';
        toast.success('Paciente creado y seleccionado');
      } catch (err) {
        toast.error(err.message || 'Error al crear paciente');
      }
    });
  }

  showChangeStatusModal(appointmentId) {
    // Find the appointment to show current status
    const appt = this.appointmentsList.find(a => String(a.id) === String(appointmentId));
    const currentStatus = appt?.status_name || '';

    const statuses = [
      { value: 'programada',  label: 'Programada',   color: '#0891b2', icon: '📅', desc: 'Cita agendada y pendiente' },
      { value: 'confirmada',  label: 'Confirmada',   color: '#16a34a', icon: '✅', desc: 'El paciente confirmó asistencia' },
      { value: 'en_consulta', label: 'En Consulta',  color: '#7c3aed', icon: '🩺', desc: 'El paciente está en atención' },
      { value: 'completada',  label: 'Completada',   color: '#15803d', icon: '🎉', desc: 'Consulta finalizada exitosamente' },
      { value: 'cancelada',   label: 'Cancelada',    color: '#dc2626', icon: '❌', desc: 'Cita cancelada (requiere motivo)' },
      { value: 'no_asistio',  label: 'No Asistió',   color: '#d97706', icon: '⚠️', desc: 'El paciente no se presentó' },
    ];

    const statusCards = statuses.map(s => `
      <label class="status-option-card ${s.value === currentStatus ? 'status-option-card--current' : ''}" style="--status-color: ${s.color};">
        <input type="radio" name="status_name" value="${s.value}" ${s.value === currentStatus ? 'checked' : ''} style="display:none;" />
        <div class="status-option-icon">${s.icon}</div>
        <div class="status-option-info">
          <strong>${s.label}</strong>
          <span>${s.desc}</span>
        </div>
        <div class="status-option-check">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
      </label>
    `).join('');

    const content = `
      <style>
        .status-option-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 14px;
          border: 2px solid var(--color-border-light);
          border-radius: var(--radius-md);
          cursor: pointer;
          margin-bottom: 8px;
          transition: all 0.18s ease;
          position: relative;
          background: var(--color-surface);
        }
        .status-option-card:hover {
          border-color: var(--status-color);
          background: color-mix(in srgb, var(--status-color) 5%, transparent);
        }
        .status-option-card:has(input:checked),
        .status-option-card--selected {
          border-color: var(--status-color);
          background: color-mix(in srgb, var(--status-color) 8%, transparent);
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--status-color) 15%, transparent);
        }
        .status-option-card--current {
          border-color: var(--status-color);
        }
        .status-option-icon {
          font-size: 20px;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: color-mix(in srgb, var(--status-color) 12%, transparent);
          border-radius: 8px;
          flex-shrink: 0;
        }
        .status-option-info {
          flex: 1;
          display: flex;
          flex-direction: column;
        }
        .status-option-info strong {
          font-size: 0.875rem;
          color: var(--color-text);
          font-weight: 600;
        }
        .status-option-info span {
          font-size: 0.75rem;
          color: var(--color-text-tertiary);
          margin-top: 1px;
        }
        .status-option-check {
          color: var(--status-color);
          opacity: 0;
          transition: opacity 0.15s;
          flex-shrink: 0;
        }
        .status-option-card:has(input:checked) .status-option-check {
          opacity: 1;
        }
        #cancellation-reason-group {
          margin-top: 12px;
          padding: 14px;
          background: rgba(220, 38, 38, 0.05);
          border: 1px solid rgba(220, 38, 38, 0.2);
          border-radius: var(--radius-md);
          animation: fadeIn 0.2s ease;
        }
        @keyframes fadeIn { from { opacity:0; transform:translateY(-4px); } to { opacity:1; transform:translateY(0); } }
        .current-status-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--color-text-secondary);
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border-light);
          padding: 4px 10px;
          border-radius: 999px;
          margin-bottom: 16px;
        }
      </style>
      <form id="change-status-form">
        ${appt ? `<div class="current-status-badge">Estado actual: <span style="color:${appt.status_color};">${appt.status_label || currentStatus}</span></div>` : ''}
        <div style="display: flex; flex-direction: column; gap: 0;">
          ${statusCards}
        </div>
        <div id="cancellation-reason-group" style="display: none;">
          <label class="form-label" style="color: #dc2626; font-weight: 600;">
            ⚠️ Motivo de Cancelación <span style="color: #dc2626;">*</span>
          </label>
          <input type="text" name="cancellation_reason" class="form-input" placeholder="Ej: Paciente solicitó reprogramar..." style="margin-top: 6px; border-color: rgba(220,38,38,0.4);" />
        </div>
      </form>
    `;

    Modal.show({
      title: 'Cambiar Estado de la Cita',
      content: content,
      confirmText: 'Actualizar Estado',
      size: 'md',
      onConfirm: async (modalBody) => {
        const form = modalBody.querySelector('#change-status-form');
        const selected = form.querySelector('[name="status_name"]:checked');
        if (!selected) {
          toast.error('Por favor seleccione un estado');
          return false;
        }
        const status = selected.value;
        const reason = form.querySelector('[name="cancellation_reason"]')?.value?.trim();

        if (status === 'cancelada' && !reason) {
          toast.error('El motivo de cancelación es requerido');
          return false;
        }

        try {
          await appointmentService.updateStatus(appointmentId, status, reason || null);
          toast.success('Estado de la cita actualizado');
          await this.render();
          this.mount();
          return true;
        } catch (err) {
          toast.error(err.message || 'Error al actualizar estado');
          return false;
        }
      }
    });

    // Dynamic show/hide of cancellation reason + visual card selection
    const overlay = document.querySelector('.modal-overlay');
    if (!overlay) return;

    const reasonGroup = overlay.querySelector('#cancellation-reason-group');
    const cards = overlay.querySelectorAll('.status-option-card');
    
    const updateSelected = () => {
      const checked = overlay.querySelector('[name="status_name"]:checked');
      cards.forEach(card => card.classList.remove('status-option-card--selected'));
      if (checked) {
        checked.closest('.status-option-card')?.classList.add('status-option-card--selected');
        if (reasonGroup) {
          reasonGroup.style.display = checked.value === 'cancelada' ? 'block' : 'none';
        }
      }
    };

    cards.forEach(card => {
      card.addEventListener('click', () => {
        const radio = card.querySelector('input[type="radio"]');
        if (radio) { radio.checked = true; updateSelected(); }
      });
    });

    updateSelected();
  }
}
