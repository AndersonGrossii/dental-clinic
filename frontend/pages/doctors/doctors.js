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
  }

  async render() {
    try {
      const response = await doctorService.getAll();
      this.doctorsList = response || [];
      this.renderView();
    } catch (err) {
      toast.error('Error al cargar la lista de doctores');
    }
  }

  renderView() {
    let cards = this.doctorsList.map(doc => `
      <div class="card" style="border-top: 4px solid ${doc.color || '#0891b2'};">
        <div style="display: flex; flex-direction: column; align-items: center; text-align: center; padding: var(--space-4);">
          <span style="font-size: 48px; background-color: var(--gray-100); width: 80px; height: 80px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--primary-600); margin-bottom: var(--space-3);">
            👨‍⚕️
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
            <button class="btn btn-sm btn-danger delete-doctor-btn" data-id="${doc.id}" style="flex: 1;">Eliminar</button>
          </div>
        </div>
      </div>
    `).join('');

    if (this.doctorsList.length === 0) {
      cards = `<p style="text-align: center; color: var(--text-secondary); grid-column: span 3;">No hay doctores registrados.</p>`;
    }

    this.container.innerHTML = `
      <div class="page-header" style="display: flex; justify-content: between; align-items: center; margin-bottom: var(--space-6);">
        <div>
          <h1 class="page-title">Personal Médico</h1>
          <p style="color: var(--text-secondary);">Directorio de odontólogos especialistas y gestión de horarios</p>
        </div>
        <button id="add-doctor-btn" class="btn btn-primary">+ Nuevo Doctor</button>
      </div>

      <div class="card-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: var(--space-4);">
        ${cards}
      </div>
    `;
  }

  mount() {
    const addBtn = this.container.querySelector('#add-doctor-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => this.showDoctorModal());
    }

    this.container.addEventListener('click', async (e) => {
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
    });
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
      const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      
      let rows = schedule.map(s => `
        <tr>
          <td><strong>${days[s.day_of_week]}</strong></td>
          <td>${s.start_time.substring(0, 5)} - ${s.end_time.substring(0, 5)}</td>
          <td>${s.break_start ? `${s.break_start.substring(0, 5)} - ${s.break_end.substring(0, 5)}` : 'Sin descanso'}</td>
          <td><span class="badge badge-success">Activo</span></td>
        </tr>
      `).join('');

      if (schedule.length === 0) {
        rows = `<tr><td colspan="4" style="text-align: center; color: var(--text-secondary);">No hay horarios configurados.</td></tr>`;
      }

      Modal.show({
        title: 'Horario Semanal de Consulta',
        content: `
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>Día</th>
                  <th>Jornada</th>
                  <th>Descanso (Comida)</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                ${rows}
              </tbody>
            </table>
          </div>
        `,
        confirmText: 'Cerrar',
        cancelText: '',
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
