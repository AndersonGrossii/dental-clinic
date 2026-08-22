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
    );    let cards = filtered.map(doc => `
      <div class="card doctor-card" style="border-top: 4px solid ${doc.color || '#0891b2'}; ${doc.is_active === false ? 'opacity: 0.75;' : ''} padding: var(--space-4); display: flex; flex-direction: column; justify-content: space-between; position: relative; border-radius: var(--radius-lg, 12px); box-shadow: 0 2px 10px rgba(0,0,0,0.03);">
        
        <!-- Header Actions & Active Status -->
        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; margin-bottom: var(--space-3);">
          <span style="font-size: 11px; padding: 2px 10px; border-radius: 12px; font-weight: 600; background: ${doc.is_active !== false ? 'var(--success-50, #f0fdf4)' : 'var(--danger-50, #fef2f2)'}; color: ${doc.is_active !== false ? 'var(--success-700, #15803d)' : 'var(--danger-700, #b91c1c)'}; border: 1px solid ${doc.is_active !== false ? 'var(--success-200, #bbf7d0)' : 'var(--danger-200, #fecaca)'};">
            ${doc.is_active !== false ? '● Activo' : '○ Inactivo'}
          </span>
          <div style="display: flex; gap: 4px;">
            <button class="btn btn-xs btn-outline edit-doctor-btn" data-id="${doc.id}" title="Editar Perfil Doctor" style="padding: 3px 8px; font-size: 12px; border-radius: 6px;">✏️ Editar</button>
            <button class="btn btn-xs ${doc.is_active !== false ? 'btn-outline' : 'btn-success'} toggle-active-btn" data-id="${doc.id}" data-active="${doc.is_active !== false}" title="${doc.is_active !== false ? 'Desactivar Doctor' : 'Activar Doctor'}" style="padding: 3px 8px; font-size: 12px; border-radius: 6px;">
              ${doc.is_active !== false ? '⏸️' : '▶️'}
            </button>
            <button class="btn btn-xs btn-danger delete-doctor-btn" data-id="${doc.id}" title="Eliminar Doctor" style="padding: 3px 8px; font-size: 12px; border-radius: 6px;">🗑️</button>
          </div>
        </div>

        <!-- Doctor Avatar & Profile Info -->
        <div style="display: flex; flex-direction: column; align-items: center; text-align: center; margin-bottom: var(--space-4);">
          <span style="font-size: 22px; font-weight: bold; background-color: ${doc.color || '#0891b2'}; color: white; width: 70px; height: 70px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: var(--space-2); box-shadow: 0 4px 12px rgba(0,0,0,0.12);">
            ${((doc.first_name || 'D')[0] || 'D').toUpperCase()}${((doc.last_name || 'D')[0] || 'D').toUpperCase()}
          </span>
          <h3 style="margin: 0; font-size: 16px; font-weight: 700; color: var(--text-primary);">Dr/a. ${doc.first_name} ${doc.last_name}</h3>
          <p style="color: var(--primary-700, #0369a1); font-weight: 600; font-size: var(--text-xs); margin: 4px 0 6px 0; background: var(--primary-50, #f0f9ff); padding: 3px 12px; border-radius: 12px; border: 1px solid var(--primary-100, #e0f2fe); display: inline-block;">
            ${doc.specialty}
          </p>
          <p style="color: var(--text-secondary); font-size: 11px; margin: 0;">Cédula: <strong>${doc.license_number || 'N/A'}</strong></p>
        </div>

        <!-- Schedule & Availability Actions -->
        <div style="width: 100%; display: flex; flex-direction: column; gap: 6px; margin-top: auto; padding-top: var(--space-3); border-top: 1px dashed var(--border-color, #e2e8f0);">
          <div style="display: flex; gap: 6px;">
            <button class="btn btn-sm btn-outline view-schedule-btn" data-id="${doc.id}" style="flex: 1; font-size: 11px; padding: 6px 8px; border-radius: 8px; display: flex; align-items: center; justify-content: center; gap: 4px; font-weight: 600;">
              🗓️ Horario Semanal
            </button>
            <button class="btn btn-sm view-workdays-btn" data-id="${doc.id}" style="flex: 1; font-size: 11px; padding: 6px 8px; border-radius: 8px; display: flex; align-items: center; justify-content: center; gap: 4px; font-weight: 600; background: var(--primary-50, #f0f9ff); color: var(--primary-700, #0369a1); border: 1px solid var(--primary-200, #bae6fd);">
              📍 Días Específicos
            </button>
          </div>
          <button class="btn btn-sm btn-secondary add-unavail-btn" data-id="${doc.id}" style="width: 100%; font-size: 11px; padding: 6px 8px; border-radius: 8px; display: flex; align-items: center; justify-content: center; gap: 4px; font-weight: 500;">
            🌴 Ausencias y Vacaciones
          </button>
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
      const scheduleBtn = e.target.closest('.view-schedule-btn');
      if (scheduleBtn) {
        const id = scheduleBtn.getAttribute('data-id');
        this.showScheduleModal(id);
        return;
      }

      const workdaysBtn = e.target.closest('.view-workdays-btn');
      if (workdaysBtn) {
        const id = workdaysBtn.getAttribute('data-id');
        this.showWorkdaysModal(id);
        return;
      }

      const unavailBtn = e.target.closest('.add-unavail-btn');
      if (unavailBtn) {
        const id = unavailBtn.getAttribute('data-id');
        this.showUnavailabilityModal(id);
        return;
      }

      const editBtn = e.target.closest('.edit-doctor-btn');
      if (editBtn) {
        const id = editBtn.getAttribute('data-id');
        this.showDoctorModal(id);
        return;
      }

      const deleteBtn = e.target.closest('.delete-doctor-btn');
      if (deleteBtn) {
        const id = deleteBtn.getAttribute('data-id');
        this.showDeleteConfirm(id);
        return;
      }

      const toggleBtn = e.target.closest('.toggle-active-btn');
      if (toggleBtn) {
        const id = toggleBtn.getAttribute('data-id');
        const isActive = toggleBtn.getAttribute('data-active') === 'true';
        try {
          await doctorService.update(id, { isActive: !isActive });
          toast.success(`Doctor ${!isActive ? 'activado' : 'desactivado'} con éxito`);
          await this.render();
        } catch (err) {
          toast.error(err.message || 'Error al cambiar estado del doctor');
        }
        return;
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

  async showWorkdaysModal(doctorId) {
    let records = [];
    try {
      const res = await doctorService.getWorkdays(doctorId);
      records = res?.data || res || [];
    } catch (err) {
      toast.error('Error al cargar días específicos de atención');
    }

    const doc = this.doctorsList.find(d => d.id == doctorId) || {};

    const renderList = () => {
      if (!records || records.length === 0) {
        return `<p style="text-align: center; color: var(--text-secondary); font-size: var(--text-sm); margin: var(--space-3) 0;">No se han configurado días específicos. El doctor utiliza la agenda semanal estándar.</p>`;
      }
      return `
        <div style="max-height: 180px; overflow-y: auto; margin-bottom: var(--space-3); border: 1px solid var(--border-color); border-radius: var(--radius);">
          <table style="width: 100%; border-collapse: collapse; font-size: var(--text-xs);">
            <thead>
              <tr style="background: var(--gray-100); text-align: left;">
                <th style="padding: 6px 10px;">Fecha</th>
                <th style="padding: 6px 10px;">Horario</th>
                <th style="padding: 6px 10px;">Notas</th>
                <th style="padding: 6px 10px; text-align: right;">Acción</th>
              </tr>
            </thead>
            <tbody>
              ${records.map(r => {
                const dateStr = typeof r.work_date === 'string' ? r.work_date.split('T')[0] : new Date(r.work_date).toISOString().split('T')[0];
                return `
                  <tr style="border-top: 1px solid var(--border-color);">
                    <td style="padding: 6px 10px; font-weight: 600;">${dateStr}</td>
                    <td style="padding: 6px 10px;">${r.start_time.substring(0, 5)} - ${r.end_time.substring(0, 5)}</td>
                    <td style="padding: 6px 10px; color: var(--text-secondary);">${r.notes || '-'}</td>
                    <td style="padding: 6px 10px; text-align: right;">
                      <button class="btn btn-xs btn-danger delete-workday" data-id="${r.id}" style="padding: 2px 6px; font-size: 10px;">Eliminar</button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    };

    const renderForm = () => {
      const todayStr = new Date().toISOString().split('T')[0];
      return `
        <form id="workday-form" style="background: var(--gray-50); padding: var(--space-3); border-radius: var(--radius); border: 1px solid var(--border-color);">
          <h4 style="margin: 0 0 var(--space-2) 0; font-size: var(--text-sm);">+ Agregar Día Específico de Atención</h4>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2);">
            <div class="form-group">
              <label class="form-label" style="font-size: var(--text-xs);">Fecha de Atención</label>
              <input type="date" name="work_date" class="form-input" min="${todayStr}" required />
            </div>
            <div class="form-group">
              <label class="form-label" style="font-size: var(--text-xs);">Notas / Motivo</label>
              <input type="text" name="notes" class="form-input" placeholder="Ej: Especialista Cirugía" />
            </div>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2); margin-top: var(--space-2);">
            <div class="form-group">
              <label class="form-label" style="font-size: var(--text-xs);">Hora Inicio</label>
              <input type="time" name="start_time" class="form-input" value="09:00" required />
            </div>
            <div class="form-group">
              <label class="form-label" style="font-size: var(--text-xs);">Hora Fin</label>
              <input type="time" name="end_time" class="form-input" value="18:00" required />
            </div>
          </div>
          <div style="margin-top: var(--space-3);">
            <button type="submit" class="btn btn-primary btn-sm" style="width: 100%;">Guardar Fecha de Atención</button>
          </div>
        </form>
      `;
    };

    const modalContainer = document.createElement('div');

    const refreshUI = () => {
      modalContainer.innerHTML = `
        <div id="workday-list-section">
          <p style="font-size: var(--text-xs); color: var(--text-secondary); margin-bottom: var(--space-2);">
            Doctor/a: <strong>Dr/a. ${doc.first_name} ${doc.last_name}</strong>. Agregue fechas específicas si el doctor solo atiende días seleccionados.
          </p>
          ${renderList()}
        </div>
        <div id="workday-form-section">${renderForm()}</div>
      `;

      const form = modalContainer.querySelector('#workday-form');
      if (form) {
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const formData = new FormData(form);
          const data = Object.fromEntries(formData.entries());
          try {
            await doctorService.addWorkday(doctorId, data);
            const res = await doctorService.getWorkdays(doctorId);
            records = res?.data || res || [];
            refreshUI();
            toast.success('Día específico registrado con éxito');
          } catch (err) {
            toast.error(err.message || 'Error al guardar fecha');
          }
        });
      }
    };

    refreshUI();

    Modal.show({
      title: 'Días Específicos de Atención (Visiting Doctor)',
      content: modalContainer,
      size: 'md',
      confirmText: null,
      onConfirm: null,
    });

    modalContainer.addEventListener('click', async (e) => {
      const deleteBtn = e.target.closest('.delete-workday');
      if (deleteBtn) {
        const id = deleteBtn.getAttribute('data-id');
        if (!confirm('¿Eliminar esta fecha específica de atención?')) return;
        try {
          await doctorService.removeWorkday(doctorId, id);
          records = records.filter(r => String(r.id) !== String(id));
          refreshUI();
          toast.success('Fecha específica eliminada');
        } catch (err) {
          toast.error(err.message || 'Error al eliminar');
        }
      }
    });
  }

  async showWorkdaysModal(doctorId) {
    let records = [];
    try {
      const res = await doctorService.getWorkdays(doctorId);
      records = res?.data || res || [];
    } catch (err) {
      toast.error('Error al cargar días específicos de atención');
    }

    const doc = this.doctorsList.find(d => d.id == doctorId) || {};

    const renderList = () => {
      if (!records || records.length === 0) {
        return `<p style="text-align: center; color: var(--text-secondary); font-size: var(--text-sm); margin: var(--space-3) 0;">No se han configurado días específicos. El doctor utiliza la agenda semanal estándar.</p>`;
      }
      return `
        <div style="max-height: 200px; overflow-y: auto; margin-bottom: var(--space-3); border: 1px solid var(--border-color); border-radius: var(--radius);">
          <table style="width: 100%; border-collapse: collapse; font-size: var(--text-xs);">
            <thead>
              <tr style="background: var(--gray-100); text-align: left;">
                <th style="padding: 6px 10px;">Fecha</th>
                <th style="padding: 6px 10px;">Horario</th>
                <th style="padding: 6px 10px;">Notas</th>
                <th style="padding: 6px 10px; text-align: right;">Acción</th>
              </tr>
            </thead>
            <tbody>
              ${records.map(r => {
                const dateStr = typeof r.work_date === 'string' ? r.work_date.split('T')[0] : new Date(r.work_date).toISOString().split('T')[0];
                return `
                  <tr style="border-top: 1px solid var(--border-color);">
                    <td style="padding: 6px 10px; font-weight: 600;">${dateStr}</td>
                    <td style="padding: 6px 10px;">${(r.start_time || '').substring(0, 5)} - ${(r.end_time || '').substring(0, 5)}</td>
                    <td style="padding: 6px 10px; color: var(--text-secondary);">${r.notes || '-'}</td>
                    <td style="padding: 6px 10px; text-align: right;">
                      <button class="btn btn-xs btn-danger delete-workday" data-id="${r.id}" style="padding: 2px 6px; font-size: 10px;">Eliminar</button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    };

    const renderForm = () => {
      const todayStr = new Date().toISOString().split('T')[0];
      return `
        <form id="workday-form" style="background: var(--gray-50); padding: var(--space-3); border-radius: var(--radius); border: 1px solid var(--border-color);">
          <h4 style="margin: 0 0 var(--space-2) 0; font-size: var(--text-sm);">+ Agregar Día Específico de Atención</h4>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2);">
            <div class="form-group">
              <label class="form-label" style="font-size: var(--text-xs);">Fecha de Atención</label>
              <input type="date" name="work_date" class="form-input" min="${todayStr}" required />
            </div>
            <div class="form-group">
              <label class="form-label" style="font-size: var(--text-xs);">Notas / Motivo</label>
              <input type="text" name="notes" class="form-input" placeholder="Ej: Especialista Cirugía" />
            </div>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2); margin-top: var(--space-2);">
            <div class="form-group">
              <label class="form-label" style="font-size: var(--text-xs);">Hora Inicio</label>
              <input type="time" name="start_time" class="form-input" value="09:00" required />
            </div>
            <div class="form-group">
              <label class="form-label" style="font-size: var(--text-xs);">Hora Fin</label>
              <input type="time" name="end_time" class="form-input" value="18:00" required />
            </div>
          </div>
          <div style="margin-top: var(--space-3);">
            <button type="submit" class="btn btn-primary btn-sm" style="width: 100%;">Guardar Fecha de Atención</button>
          </div>
        </form>
      `;
    };

    const modalContainer = document.createElement('div');

    const refreshUI = () => {
      modalContainer.innerHTML = `
        <div id="workday-list-section">
          <p style="font-size: var(--text-xs); color: var(--text-secondary); margin-bottom: var(--space-2);">
            Doctor/a: <strong>Dr/a. ${doc.first_name} ${doc.last_name}</strong>. Configurar fechas de atendimento específicas para doutores visitantes.
          </p>
          ${renderList()}
        </div>
        <div id="workday-form-section">${renderForm()}</div>
      `;

      const form = modalContainer.querySelector('#workday-form');
      if (form) {
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const formData = new FormData(form);
          const data = Object.fromEntries(formData.entries());
          try {
            await doctorService.addWorkday(doctorId, data);
            const res = await doctorService.getWorkdays(doctorId);
            records = res?.data || res || [];
            refreshUI();
            toast.success('Día específico registrado con éxito');
          } catch (err) {
            toast.error(err.message || 'Error al guardar fecha');
          }
        });
      }
    };

    refreshUI();

    Modal.show({
      title: 'Días Específicos de Atención (Visiting Doctor)',
      content: modalContainer,
      size: 'md',
      confirmText: null,
      onConfirm: null,
    });

    modalContainer.addEventListener('click', async (e) => {
      const deleteBtn = e.target.closest('.delete-workday');
      if (deleteBtn) {
        const id = deleteBtn.getAttribute('data-id');
        if (!confirm('¿Eliminar esta fecha específica de atención?')) return;
        try {
          await doctorService.removeWorkday(doctorId, id);
          records = records.filter(r => String(r.id) !== String(id));
          refreshUI();
          toast.success('Fecha específica eliminada');
        } catch (err) {
          toast.error(err.message || 'Error al eliminar');
        }
      }
    });
  }

  async showUnavailabilityModal(doctorId) {
    const now = new Date();
    const rangeStart = `${now.getFullYear() - 1}-01-01`;
    const rangeEnd = `${now.getFullYear() + 1}-12-31`;

    let records = [];
    try {
      records = await doctorService.getUnavailability(doctorId, rangeStart, rangeEnd);
    } catch (_) { records = []; }

    const renderList = () => {
      if (records.length === 0) {
        return `<p style="color: var(--text-secondary); font-size: var(--text-sm); text-align: center; padding: var(--space-4);">No hay periodos registrados.</p>`;
      }
      const typeLabels = { vacaciones: 'Vacaciones', personal: 'Asunto Personal', enfermedad: 'Enfermedad / Licencia Médica', conferencia: 'Conferencia / Congreso', otro: 'Otro' };
      return records.map(r => {
        const start = (r.start_date || '').slice(0, 10);
        const end = (r.end_date || '').slice(0, 10);
        const label = typeLabels[r.type] || r.type || '—';
        const reason = r.reason || '';
        return `<div style="display: flex; align-items: center; justify-content: space-between; padding: var(--space-2) var(--space-3); border: 1px solid var(--color-border-light); border-radius: var(--radius-md); margin-bottom: var(--space-2); background: var(--color-surface);">
          <div style="flex: 1; font-size: var(--text-sm);">
            <span style="font-weight: 600;">${start}</span> → <span style="font-weight: 600;">${end}</span>
            <span style="display: inline-block; margin-left: var(--space-2); padding: 1px 6px; border-radius: 4px; background: var(--color-bg-secondary); font-size: 10px;">${label}</span>
            ${reason ? `<br><span style="color: var(--text-secondary); font-size: 10px;">${reason}</span>` : ''}
          </div>
          <div style="display: flex; gap: var(--space-1); flex-shrink: 0;">
            <button class="btn btn-sm btn-outline edit-unavail" data-id="${r.id}" style="font-size: 11px; padding: 2px 8px;">Editar</button>
            <button class="btn btn-sm btn-danger delete-unavail" data-id="${r.id}" style="font-size: 11px; padding: 2px 8px;">Eliminar</button>
          </div>
        </div>`;
      }).join('');
    };

    const renderForm = (editRecord = null) => {
      const startVal = editRecord ? (editRecord.start_date || '').slice(0, 10) : '';
      const endVal = editRecord ? (editRecord.end_date || '').slice(0, 10) : '';
      const typeVal = editRecord ? (editRecord.type || 'vacaciones') : 'vacaciones';
      const reasonVal = editRecord ? (editRecord.reason || '') : '';
      return `
        <div style="margin-top: var(--space-3); padding-top: var(--space-3); border-top: 1px solid var(--color-border-light);">
          <h4 style="margin: 0 0 var(--space-2) 0; font-size: var(--text-sm);">${editRecord ? 'Editar Periodo' : 'Nuevo Periodo'}</h4>
          <form id="unavail-form">
            <input type="hidden" name="edit_id" value="${editRecord ? editRecord.id : ''}" />
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2);">
              <div class="form-group">
                <label class="form-label" style="font-size: var(--text-xs);">Fecha Inicio</label>
                <input type="date" name="start_date" class="form-input" value="${startVal}" required />
              </div>
              <div class="form-group">
                <label class="form-label" style="font-size: var(--text-xs);">Fecha Fin</label>
                <input type="date" name="end_date" class="form-input" value="${endVal}" required />
              </div>
            </div>
            <div class="form-group" style="margin-top: var(--space-2);">
              <label class="form-label" style="font-size: var(--text-xs);">Motivo</label>
              <select name="type" class="form-select">
                <option value="vacaciones" ${typeVal === 'vacaciones' ? 'selected' : ''}>Vacaciones</option>
                <option value="personal" ${typeVal === 'personal' ? 'selected' : ''}>Asunto Personal</option>
                <option value="enfermedad" ${typeVal === 'enfermedad' ? 'selected' : ''}>Enfermedad / Licencia Médica</option>
                <option value="conferencia" ${typeVal === 'conferencia' ? 'selected' : ''}>Conferencia / Congreso</option>
              </select>
            </div>
            <div class="form-group" style="margin-top: var(--space-2);">
              <label class="form-label" style="font-size: var(--text-xs);">Detalles / Observaciones</label>
              <input type="text" name="reason" class="form-input" value="${reasonVal}" placeholder="Ej: Viaje familiar" />
            </div>
            <div style="margin-top: var(--space-2); display: flex; gap: var(--space-2);">
              <button type="submit" class="btn btn-primary" style="flex: 1;">${editRecord ? 'Actualizar' : 'Registrar'}</button>
              ${editRecord ? `<button type="button" class="btn btn-outline cancel-edit-unavail" style="flex: 1;">Cancelar</button>` : ''}
            </div>
          </form>
        </div>`;
    };

    const modalContainer = document.createElement('div');

    const attachFormHandler = () => {
      const form = modalContainer.querySelector('#unavail-form');
      if (form && !form._unavailHandler) {
        form._unavailHandler = true;
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          const formData = new FormData(form);
          const data = Object.fromEntries(formData.entries());
          const editId = data.edit_id;

          (async () => {
            try {
              if (editId) {
                await doctorService.removeUnavailability(doctorId, editId);
                records = records.filter(r => String(r.id) !== String(editId));
              }
              await doctorService.addUnavailability(doctorId, data);
              const newRecords = await doctorService.getUnavailability(doctorId, rangeStart, rangeEnd);
              records = newRecords || [];
              refreshUI();
              toast.success(editId ? 'Periodo actualizado' : 'Periodo registrado');
            } catch (err) {
              toast.error(err.message || 'Error al guardar');
            }
          })();
        });
      }
    };

    const refreshUI = (editingRecord = null) => {
      modalContainer.innerHTML = `
        <div id="unavail-list-section">
          <h4 style="margin: 0 0 var(--space-2) 0; font-size: var(--text-sm);">Periodos Registrados</h4>
          <div id="unavail-list">${renderList()}</div>
        </div>
        <div id="unavail-form-section">${renderForm(editingRecord)}</div>
      `;
      attachFormHandler();
    };

    refreshUI();

    Modal.show({
      title: 'Gestionar Inasistencias y Vacaciones',
      content: modalContainer,
      size: 'md',
      confirmText: null,
      onConfirm: null,
    });

    modalContainer.addEventListener('click', async (e) => {
      const deleteBtn = e.target.closest('.delete-unavail');
      if (deleteBtn) {
        const id = deleteBtn.getAttribute('data-id');
        if (!confirm('¿Eliminar este periodo de no disponibilidad?')) return;
        try {
          await doctorService.removeUnavailability(doctorId, id);
          records = records.filter(r => String(r.id) !== String(id));
          refreshUI();
          toast.success('Periodo eliminado');
        } catch (err) {
          toast.error(err.message || 'Error al eliminar');
        }
        return;
      }

      const editBtn = e.target.closest('.edit-unavail');
      if (editBtn) {
        const id = editBtn.getAttribute('data-id');
        const rec = records.find(r => String(r.id) === String(id));
        if (rec) refreshUI(rec);
        return;
      }

      if (e.target.closest('.cancel-edit-unavail')) {
        refreshUI();
        return;
      }
    });
  }
}
