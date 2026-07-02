// ============================================
// Vista de Gestión de Doctores
// ============================================
import doctorService from '../../services/doctor.service.js';
import toast from '../../components/toast/toast.js';
import Modal from '../../components/modal/modal.js';

export class Doctors {
  constructor(container) {
    this.container = container;
    this.doctorsList = [];
    this.searchQuery = '';
  }

  async render() {
    try {
      const response = await doctorService.getAll();
      this.doctorsList = response || [];
      this.renderLayout();
      this.renderView();
    } catch (err) {
      toast.error('Error al cargar la lista de doctores');
    }
  }

  renderLayout() {
    this.container.innerHTML = `
      <div class="page-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-6);">
        <div>
          <h1 class="page-title">Personal Médico</h1>
          <p style="color: var(--text-secondary);">Directorio de odontólogos especialistas y gestión de horarios</p>
        </div>
        <button id="add-doctor-btn" class="btn btn-primary">+ Nuevo Doctor</button>
      </div>

      <div class="card" style="margin-bottom: var(--space-4); padding: var(--space-4);">
        <div style="display: flex; gap: var(--space-2);">
          <input type="text" id="doctor-search" class="form-input" placeholder="Buscar por Nombre o Especialidad..." style="flex: 1;" value="${this.searchQuery}" />
        </div>
      </div>

      <div id="doctors-cards-container" class="card-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: var(--space-4);">
        <!-- Cards will render here -->
      </div>
    `;
  }

  renderView() {
    const container = this.container.querySelector('#doctors-cards-container');
    if (!container) return;

    const query = (this.searchQuery || '').toLowerCase().trim();
    const filtered = this.doctorsList.filter(doc => 
      `${doc.first_name} ${doc.last_name}`.toLowerCase().includes(query) ||
      (doc.specialty || '').toLowerCase().includes(query)
    );

    let cards = filtered.map(doc => `
      <div class="card" style="border-top: 4px solid ${doc.color || '#0891b2'}; ${doc.is_active === false ? 'opacity: 0.7;' : ''}">
        <div style="display: flex; flex-direction: column; align-items: center; text-align: center; padding: var(--space-4);">
          <span style="font-size: 24px; font-weight: bold; background-color: ${doc.color || '#0891b2'}; color: white; width: 80px; height: 80px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: var(--space-3);">
            ${doc.first_name[0].toUpperCase()}${doc.last_name[0].toUpperCase()}
          </span>
          <h3 style="margin: 0;">Dr/a. ${doc.first_name} ${doc.last_name}</h3>
          <p style="color: var(--primary-600); font-weight: 500; font-size: var(--text-sm); margin: var(--space-1) 0;">${doc.specialty}</p>
          <p style="color: var(--text-secondary); font-size: var(--text-xs); margin-bottom: var(--space-4);">Lic. Profesional: ${doc.license_number || 'N/A'}</p>
          
          <div style="width: 100%; display: flex; gap: var(--space-2); margin-top: var(--space-2);">
            <button class="btn btn-sm btn-outline view-schedule-btn" data-id="${doc.id}" style="flex: 1;">Ver Horario</button>
            <button class="btn btn-sm btn-secondary add-unavail-btn" data-id="${doc.id}" style="flex: 1;">Inasistencias</button>
          </div>
          <div style="width: 100%; display: flex; gap: var(--space-2); margin-top: var(--space-2);">
            <button class="btn btn-sm btn-primary edit-doctor-btn" data-id="${doc.id}" style="flex: 1;">Editar</button>
            <button class="btn btn-sm ${doc.is_active !== false ? 'btn-outline' : 'btn-success'} toggle-active-btn" data-id="${doc.id}" data-active="${doc.is_active !== false}" style="flex: 1;">
              ${doc.is_active !== false ? 'Desactivar' : 'Activar'}
            </button>
          </div>
          <div style="width: 100%; margin-top: var(--space-2);">
            <button class="btn btn-sm btn-danger delete-doctor-btn" data-id="${doc.id}" style="width: 100%;">Eliminar</button>
          </div>
        </div>
      </div>
    `).join('');

    if (filtered.length === 0) {
      cards = `<p style="text-align: center; color: var(--text-secondary); grid-column: span 3; padding: var(--space-6);">No se encontraron doctores registrados.</p>`;
    }

    container.innerHTML = cards;
  }

  mount() {
    const searchInput = this.container.querySelector('#doctor-search');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        this.searchQuery = searchInput.value;
        this.renderView();
      });
    }

    this.addBtnClickListener = () => this.showDoctorModal();
    this.containerClickListener = async (e) => {
      if (e.target.classList.contains('view-schedule-btn')) {
        const id = e.target.getAttribute('data-id');
        this.showScheduleModal(id);
      }
      if (e.target.classList.contains('add-unavail-btn')) {
        const id = e.target.getAttribute('data-id');
        this.showUnavailabilityModal(id);
      }
      if (e.target.classList.contains('edit-doctor-btn')) {
        const id = e.target.getAttribute('data-id');
        this.showDoctorModal(id);
      }
      if (e.target.classList.contains('delete-doctor-btn')) {
        const id = e.target.getAttribute('data-id');
        this.showDeleteConfirm(id);
      }
      if (e.target.classList.contains('toggle-active-btn')) {
        const id = e.target.getAttribute('data-id');
        const isActive = e.target.getAttribute('data-active') === 'true';
        try {
          await doctorService.update(id, { isActive: !isActive });
          toast.success(`Doctor ${!isActive ? 'activado' : 'desactivado'} con éxito`);
          await this.render();
        } catch (err) {
          toast.error(err.message || 'Error al cambiar estado del doctor');
        }
      }
    };

    const addBtn = this.container.querySelector('#add-doctor-btn');
    if (addBtn) {
      addBtn.addEventListener('click', this.addBtnClickListener);
    }

    this.container.addEventListener('click', this.containerClickListener);
  }

  destroy() {
    const addBtn = this.container.querySelector('#add-doctor-btn');
    if (addBtn) {
      addBtn.removeEventListener('click', this.addBtnClickListener);
    }
    this.container.removeEventListener('click', this.containerClickListener);
  }

  async showDoctorModal(doctorId = null) {
    const isEdit = !!doctorId;
    const doc = isEdit ? this.doctorsList.find(d => d.id == doctorId) : {};

    const content = `
      <form id="doctor-form">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3);">
          <div class="form-group">
            <label class="form-label">Nombre</label>
            <input type="text" name="firstName" class="form-input" value="${doc.first_name || ''}" required />
          </div>
          <div class="form-group">
            <label class="form-label">Apellido</label>
            <input type="text" name="lastName" class="form-input" value="${doc.last_name || ''}" required />
          </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); margin-top: var(--space-3);">
          <div class="form-group">
            <label class="form-label">Correo electrónico</label>
            <input type="email" name="email" class="form-input" value="${doc.email || ''}" required />
          </div>
          <div class="form-group">
            <label class="form-label">Contraseña${isEdit ? ' (dejar vacío para no cambiar)' : ''}</label>
            <input type="password" name="password" class="form-input" ${isEdit ? '' : 'required'} />
          </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); margin-top: var(--space-3);">
          <div class="form-group">
            <label class="form-label">Teléfono</label>
            <input type="text" name="phone" class="form-input" value="${doc.phone || ''}" />
          </div>
          <div class="form-group">
            <label class="form-label">Especialidad</label>
            <input type="text" name="specialty" class="form-input" value="${doc.specialty || ''}" required />
          </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); margin-top: var(--space-3);">
          <div class="form-group">
            <label class="form-label">Cédula profesional</label>
            <input type="text" name="licenseNumber" class="form-input" value="${doc.license_number || ''}" />
          </div>
          <div class="form-group">
            <label class="form-label">Duración consulta (min)</label>
            <input type="number" name="consultationDuration" class="form-input" value="${doc.consultation_duration || '30'}" />
          </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); margin-top: var(--space-3);">
          <div class="form-group">
            <label class="form-label">Color</label>
            <input type="color" name="color" class="form-input" value="${doc.color || '#0891b2'}" style="padding: 2px; height: 40px;" />
          </div>
          <div class="form-group">
            <label class="form-label">Biografía</label>
            <textarea name="bio" class="form-textarea" rows="2">${doc.bio || ''}</textarea>
          </div>
        </div>
      </form>
    `;

    Modal.show({
      title: isEdit ? 'Editar Doctor' : 'Agregar Nuevo Doctor',
      content: content,
      confirmText: isEdit ? 'Guardar Cambios' : 'Crear Doctor',
      onConfirm: async (modalBody) => {
        const form = modalBody.querySelector('#doctor-form');
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        data.consultationDuration = data.consultationDuration ? Number(data.consultationDuration) : undefined;
        if (!data.password) delete data.password;
        if (!data.phone) delete data.phone;
        if (!data.licenseNumber) delete data.licenseNumber;
        if (!data.bio) delete data.bio;
        if (!data.consultationDuration) delete data.consultationDuration;

        try {
          if (isEdit) {
            await doctorService.update(doctorId, data);
            toast.success('Doctor actualizado exitosamente');
          } else {
            await doctorService.create(data);
            toast.success('Doctor creado exitosamente');
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
            modalBody.querySelector('#doctor-form').prepend(summary);
            fieldErrors.forEach(e => {
              const input = modalBody.querySelector(`[name="${e.field}"]`);
              if (input) input.style.borderColor = 'var(--danger-500)';
            });
          } else {
            toast.error(err.message || 'Error al procesar doctor');
          }
          return false;
        }
      }
    });
  }

  showDeleteConfirm(doctorId) {
    const doc = this.doctorsList.find(d => d.id == doctorId);
    const name = doc ? `${doc.first_name} ${doc.last_name}` : 'este doctor';

    Modal.confirm(
      'Eliminar Doctor',
      `¿Está seguro de eliminar a ${name}? Esta acción es reversible (desactivación lógica).`,
      async () => {
        try {
          await doctorService.remove(doctorId);
          toast.success('Doctor eliminado exitosamente');
          await this.render();
          this.mount();
          return true;
        } catch (err) {
          toast.error(err.message || 'Error al eliminar doctor');
          return false;
        }
      }
    );
  }

  async showScheduleModal(doctorId) {
    try {
      const schedule = await doctorService.getSchedule(doctorId);
      const days = [
        { value: 0, label: 'Domingo' },
        { value: 1, label: 'Lunes' },
        { value: 2, label: 'Martes' },
        { value: 3, label: 'Miércoles' },
        { value: 4, label: 'Jueves' },
        { value: 5, label: 'Viernes' },
        { value: 6, label: 'Sábado' },
      ];

      const getVal = (dow, field) => {
        const s = schedule.find(s => s.day_of_week === dow);
        return s ? s[field] : '';
      };
      const isActive = (dow) => {
        const s = schedule.find(s => s.day_of_week === dow);
        return s ? s.is_active : false;
      };

      const rows = days.map(d => {
        const bs = getVal(d.value, 'break_start');
        const be = getVal(d.value, 'break_end');
        return `
          <tr>
            <td style="padding: 8px 12px; font-weight: 600; font-size: var(--text-sm); color: var(--color-text); white-space: nowrap;">${d.label}</td>
            <td style="padding: 4px 6px;"><input type="time" name="start_${d.value}" class="form-input schedule-time" value="${getVal(d.value, 'start_time')?.substring(0, 5) || ''}" style="width: 110px;" /></td>
            <td style="padding: 4px 6px;"><input type="time" name="end_${d.value}" class="form-input schedule-time" value="${getVal(d.value, 'end_time')?.substring(0, 5) || ''}" style="width: 110px;" /></td>
            <td style="padding: 4px 6px; display: flex; gap: 4px; align-items: center;">
              <input type="time" name="break_start_${d.value}" class="form-input schedule-time" value="${bs ? bs.substring(0, 5) : ''}" style="width: 110px;" placeholder="Inicio" />
              <span style="color: var(--text-tertiary); font-size: 11px;">—</span>
              <input type="time" name="break_end_${d.value}" class="form-input schedule-time" value="${be ? be.substring(0, 5) : ''}" style="width: 110px;" placeholder="Fin" />
            </td>
            <td style="padding: 4px 6px; text-align: center;">
              <input type="checkbox" name="active_${d.value}" ${isActive(d.value) ? 'checked' : ''} style="width: 18px; height: 18px; cursor: pointer;" />
            </td>
          </tr>`;
      }).join('');

      Modal.show({
        title: 'Editar Horario Semanal',
        content: `
          <form id="schedule-form" style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; min-width: 600px;">
              <thead>
                <tr style="background: var(--color-bg-secondary, #f8f9fa);">
                  <th style="padding: 8px 12px; text-align: left; font-size: var(--text-xs); color: var(--text-secondary); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Día</th>
                  <th style="padding: 8px 6px; text-align: left; font-size: var(--text-xs); color: var(--text-secondary); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Entrada</th>
                  <th style="padding: 8px 6px; text-align: left; font-size: var(--text-xs); color: var(--text-secondary); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Salida</th>
                  <th style="padding: 8px 6px; text-align: left; font-size: var(--text-xs); color: var(--text-secondary); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Descanso</th>
                  <th style="padding: 8px 6px; text-align: center; font-size: var(--text-xs); color: var(--text-secondary); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Activo</th>
                </tr>
              </thead>
              <tbody>
                ${rows}
              </tbody>
            </table>
          </form>
          <p style="margin: 12px 0 0; font-size: var(--text-xs); color: var(--text-tertiary);">Marque "Activo" y configure entrada/salida para los días laborales. Deje en blanco los días no laborales.</p>
        `,
        confirmText: 'Guardar Horario',
        onConfirm: async (modalBody) => {
          const scheduleArray = [];
          for (const d of days) {
            const start = modalBody.querySelector(`[name="start_${d.value}"]`)?.value;
            const end = modalBody.querySelector(`[name="end_${d.value}"]`)?.value;
            const active = modalBody.querySelector(`[name="active_${d.value}"]`)?.checked;
            const breakStart = modalBody.querySelector(`[name="break_start_${d.value}"]`)?.value || null;
            const breakEnd = modalBody.querySelector(`[name="break_end_${d.value}"]`)?.value || null;
            if (active && start && end) {
              scheduleArray.push({
                day_of_week: d.value,
                start_time: start,
                end_time: end,
                break_start: breakStart,
                break_end: breakEnd,
                is_active: true,
              });
            } else {
              scheduleArray.push({
                day_of_week: d.value,
                start_time: start || '00:00',
                end_time: end || '00:00',
                break_start: null,
                break_end: null,
                is_active: false,
              });
            }
          }
          try {
            await doctorService.updateSchedule(doctorId, scheduleArray);
            toast.success('Horario guardado exitosamente');
            return true;
          } catch (err) {
            toast.error(err.message || 'Error al guardar horario');
            return false;
          }
        },
      });
    } catch {
      toast.error('Error al cargar el horario del doctor');
    }
  }

  showUnavailabilityModal(doctorId) {
    const content = `
      <form id="unavail-form">
        <div class="form-group">
          <label class="form-label">Fecha Inicio</label>
          <input type="date" name="start_date" class="form-input" required />
        </div>
        <div class="form-group" style="margin-top: var(--space-3);">
          <label class="form-label">Fecha Fin</label>
          <input type="date" name="end_date" class="form-input" required />
        </div>
        <div class="form-group" style="margin-top: var(--space-3);">
          <label class="form-label">Motivo</label>
          <select name="type" class="form-select">
            <option value="vacaciones">Vacaciones</option>
            <option value="personal">Asunto Personal</option>
            <option value="enfermedad">Enfermedad / Licencia Médica</option>
            <option value="conferencia">Conferencia / Congreso</option>
          </select>
        </div>
        <div class="form-group" style="margin-top: var(--space-3);">
          <label class="form-label">Detalles / Observaciones</label>
          <input type="text" name="reason" class="form-input" placeholder="Ej: Viaje familiar" />
        </div>
      </form>
    `;

    Modal.show({
      title: 'Registrar Inasistencia o Vacaciones',
      content: content,
      confirmText: 'Registrar Fechas',
      onConfirm: async (modalBody) => {
        const form = modalBody.querySelector('#unavail-form');
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        try {
          await doctorService.addUnavailability(doctorId, data);
          toast.success('Periodo de no disponibilidad guardado con éxito');
          return true;
        } catch (err) {
          toast.error(err.message || 'Error al guardar inasistencia');
          return false;
        }
      }
    });
  }
}
