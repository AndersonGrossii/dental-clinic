import reportService from '../../services/report.service.js';
import appointmentService from '../../services/appointment.service.js';
import state from '../../scripts/state.js';
import { formatCurrency } from '../../utils/helpers.js';
import toast from '../../components/toast/toast.js';

export class Dashboard {
  constructor(container) {
    this.container = container;
    this._updateTodayDate();
    this.currentDate = this.todayDate;
    this.appointmentsList = [];
    this.role = '';
  }

  _todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  _updateTodayDate() {
    this.todayDate = this._todayStr();
  }

  getMonday(date) {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
    d.setHours(0, 0, 0, 0);
    return d;
  }

  toDateStr(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  formatWeekRange() {
    const mon = this.getMonday(new Date(this.currentDate + 'T12:00:00'));
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const y = mon.getFullYear();
    const monD = mon.getDate();
    const monM = monthNames[mon.getMonth()];
    const sunD = sun.getDate();
    const sunM = monthNames[sun.getMonth()];
    if (mon.getMonth() === sun.getMonth()) {
      return `${monD} al ${sunD} de ${monM} de ${y}`;
    }
    return `${monD} de ${monM} al ${sunD} de ${sunM} de ${y}`;
  }

  async loadAppointmentsForWeek() {
    try {
      const mon = this.getMonday(new Date(this.currentDate + 'T12:00:00'));
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      const user = state.get('user');
      const params = {
        date_from: this.toDateStr(mon),
        date_to: this.toDateStr(sun),
        limit: 999,
        sortBy: 'a.start_time',
        sortOrder: 'ASC'
      };
      if (this.role === 'doctor' && user?.doctor_id) {
        params.doctor_id = user.doctor_id;
      }
      const list = await appointmentService.getAll(params);
      this.appointmentsList = Array.isArray(list) ? list : [];
    } catch (err) {
      toast.error('Error al cargar citas de la semana');
      this.appointmentsList = [];
    }
  }

  async render() {
    try {
      const dashboardData = await reportService.getDashboard();
      const stats = dashboardData.stats || {};
      this.role = dashboardData.role || '';
      this.todayAppointments = dashboardData.todayAppointments || [];

      await this.loadAppointmentsForWeek();

      const user = state.get('user');
      const roleDisplayName = this.role.charAt(0).toUpperCase() + this.role.slice(1);

      let statsHtml = '';
      if (this.role === 'propietario' || this.role === 'direccion') {
        statsHtml = `
          <div class="card stat-card">
            <div class="stat-card-title">Ingresos Hoy</div>
            <div class="stat-card-value" style="color: var(--success-600);">${formatCurrency(stats.todayRevenue)}</div>
          </div>
          <div class="card stat-card">
            <div class="stat-card-title">Facturas Pendientes</div>
            <div class="stat-card-value" style="color: var(--warning-600);">${formatCurrency(stats.pendingInvoicesAmount)}</div>
            <div class="stat-card-sub">${stats.pendingInvoicesCount} facturas pendientes</div>
          </div>
          <div class="card stat-card">
            <div class="stat-card-title">Pacientes Activos</div>
            <div class="stat-card-value">${stats.activePatients}</div>
          </div>
          <div class="card stat-card">
            <div class="stat-card-title">Citas de Hoy</div>
            <div class="stat-card-value">${stats.todayAppointmentsCount}</div>
          </div>`;
      } else if (this.role === 'recepcionista') {
        statsHtml = `
          <div class="card stat-card">
            <div class="stat-card-title">Citas Programadas Hoy</div>
            <div class="stat-card-value">${stats.todayAppointmentsCount}</div>
          </div>
          <div class="card stat-card">
            <div class="stat-card-title">Pacientes Activos</div>
            <div class="stat-card-value">${stats.activePatients}</div>
          </div>
          <div class="card stat-card">
            <div class="stat-card-title">Nuevos Pacientes Este Mes</div>
            <div class="stat-card-value">${stats.newPatientsThisMonth}</div>
          </div>`;
      } else {
        statsHtml = `
          <div class="card stat-card">
            <div class="stat-card-title">Mis Citas Hoy</div>
            <div class="stat-card-value">${stats.todayAppointmentsCount}</div>
          </div>`;
      }

      this.container.innerHTML = `
        <div class="page-header">
          <div>
            <h1 class="page-title">Dashboard</h1>
            <p style="color: var(--text-secondary);">Bienvenido, ${user?.first_name || 'Usuario'}, al Sistema de Gestión de ${state.get('clinicInfo')?.name || 'Clinica Dental'}</p>
          </div>
          <div style="text-align: right;">
            <span class="badge badge-success" style="padding: var(--space-2) var(--space-4); font-size: var(--text-xs);">
              Sesión activa: ${roleDisplayName}
            </span>
          </div>
        </div>

        <div class="card-grid" style="margin-top: var(--space-6);">
          ${statsHtml}
        </div>

        <div class="db-cal-container">
          <div class="db-cal-header">
            <div class="db-cal-title-section">
              <h3>Calendario Semanal</h3>
              <p id="db-cal-subtitle">Vista semanal de consultas</p>
            </div>
            <div class="db-cal-nav">
              <button id="db-cal-prev" class="db-cal-btn" title="Semana Anterior">◀</button>
              <div class="db-cal-picker-wrapper">
                <span id="db-cal-date-text" class="db-cal-date-display">Cargando...</span>
                <button class="db-cal-btn" title="Seleccionar Semana">📅
                  <input type="date" id="db-cal-picker-input" class="db-cal-picker" />
                </button>
              </div>
              <button id="db-cal-next" class="db-cal-btn" title="Semana Siguiente">▶</button>
            </div>
          </div>
          <div id="db-cal-layout-container" class="db-cal-layout">
          </div>
        </div>`;

      this.renderCalendarContent();
    } catch (err) {
      toast.error('Error al cargar Dashboard');
      this.container.innerHTML = `<div class="empty-state"><h3>Error al cargar Dashboard</h3><p>${err.message}</p></div>`;
    }
  }

  renderCalendarContent() {
    const layoutContainer = this.container.querySelector('#db-cal-layout-container');
    const dateText = this.container.querySelector('#db-cal-date-text');
    const pickerInput = this.container.querySelector('#db-cal-picker-input');

    if (!layoutContainer) return;

    const mon = this.getMonday(new Date(this.currentDate + 'T12:00:00'));
    const todayStr = this.toDateStr(new Date());

    dateText.textContent = `Semana del ${this.formatWeekRange()}`;
    if (pickerInput) pickerInput.value = this.toDateStr(mon);

    const total = this.appointmentsList.length;
    const completed = this.appointmentsList.filter(
      a => (a.status_name || '').toLowerCase() === 'completada'
    ).length;
    const pending = this.appointmentsList.filter(
      a => (a.status_name || '').toLowerCase() === 'programada' || (a.status_name || '').toLowerCase() === 'confirmada'
    ).length;

    let todayApptsHtml = '';
    const todayAppts = this.todayAppointments || [];
    if (todayAppts.length === 0) {
      todayApptsHtml = `<div style="color: var(--text-secondary); font-size: var(--text-xs); text-align: center; padding: var(--space-4);">No hay citas para hoy</div>`;
    } else {
      todayApptsHtml = todayAppts.map(a => `
        <div style="padding: var(--space-2); border-bottom: 1px solid var(--color-border-light); font-size: var(--text-xs);">
          <div style="display: flex; justify-content: space-between; font-weight: 600; gap: 4px;">
            <span style="white-space: nowrap;">${a.start_time.substring(0, 5)} - ${a.end_time.substring(0, 5)}</span>
            <span style="color: ${a.status_color || 'var(--primary-600)'}; white-space: nowrap;">${a.status_label || 'Agendada'}</span>
          </div>
          <div style="color: var(--color-text); font-weight: 500; margin-top: 2px;">${a.patient_name}</div>
          <div style="color: var(--color-text-secondary); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${a.reason || 'Consulta'}</div>
        </div>
      `).join('');
    }

    const sidebarHtml = `
      <div class="db-cal-sidebar">
        <div class="db-cal-stat-box">
          <div class="db-cal-stat-num">${total}</div>
          <div class="db-cal-stat-label">Citas de la Semana</div>
        </div>
        <div class="db-cal-stat-box">
          <div class="db-cal-stat-num" style="color: var(--success-600);">${completed}</div>
          <div class="db-cal-stat-label">Completadas</div>
        </div>
        <div class="db-cal-stat-box">
          <div class="db-cal-stat-num" style="color: var(--info-600);">${pending}</div>
          <div class="db-cal-stat-label">Pendientes</div>
        </div>

        <div style="margin-top: var(--space-6); background: var(--color-bg-secondary); padding: var(--space-3); border-radius: var(--radius-md); border: 1px solid var(--color-border);">
          <h4 style="margin: 0 0 var(--space-2) 0; font-size: var(--text-xs); text-transform: uppercase; color: var(--primary-700); font-weight: 600;">Citas de Hoy</h4>
          <div style="max-height: 200px; overflow-y: auto;">
            ${todayApptsHtml}
          </div>
        </div>

      </div>`;

    const dayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    const slotDuration = 30;
    const slots = [];
    for (let m = 540; m < 1200; m += slotDuration) {
      slots.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
    }

    const getDocName = (a) => a.doctor_name || a.doctor?.fullName || '';

    let cells = '';

    cells += `<div class="db-wg-time-header"></div>`;
    for (let i = 0; i < 7; i++) {
      const date = new Date(mon);
      date.setDate(mon.getDate() + i);
      const dateStr = this.toDateStr(date);
      const isToday = dateStr === todayStr;
      const isWeekend = i >= 5;
      cells += `<div class="db-wg-day-header ${isToday ? 'today' : ''} ${isWeekend ? 'weekend' : ''}">
        <div class="db-wg-day-name">${dayNames[i]}</div>
        <div class="db-wg-day-num ${isToday ? 'today' : ''}">${date.getDate()}</div>
      </div>`;
    }

    slots.forEach(slot => {
      cells += `<div class="db-wg-time-label">${slot}</div>`;
      for (let i = 0; i < 7; i++) {
        const date = new Date(mon);
        date.setDate(mon.getDate() + i);
        const dateStr = this.toDateStr(date);
        const isWeekend = i >= 5;

        const sm = parseInt(slot.split(':')[0]) * 60 + parseInt(slot.split(':')[1]) + 30;
        const ns = `${String(Math.floor(sm / 60)).padStart(2, '0')}:${String(sm % 60).padStart(2, '0')}`;
        const matches = this.appointmentsList.filter(a => {
          if (String(a.appointment_date).substring(0, 10) !== dateStr) return false;
          const s = a.start_time ? a.start_time.substring(0, 5) : '';
          const e = a.end_time ? a.end_time.substring(0, 5) : '';
          return s < ns && e > slot;
        });

        if (matches.length === 0) {
          cells += `<div class="db-wg-cell empty ${isWeekend ? 'weekend' : ''}"></div>`;
        } else {
          let inner = '';
          matches.forEach(m => {
            const patientName = m.patient_name || '—';
            const doctorName = getDocName(m);
            inner += `<div class="db-wg-event" data-id="${m.id}" data-patient-id="${m.patient_id}" style="background-color: ${m.status_color || '#0891b2'}; cursor: pointer;">
              <div class="db-wg-event-patient">${patientName}</div>
              ${doctorName ? `<div class="db-wg-event-doctor">${doctorName}</div>` : ''}
            </div>`;
          });
          cells += `<div class="db-wg-cell ${isWeekend ? 'weekend' : ''}">${inner}</div>`;
        }
      }
    });

    const gridHtml = `<div class="db-wg-grid">${cells}</div>`;

    layoutContainer.innerHTML = `${sidebarHtml}${gridHtml}`;
  }

  async changeWeek(dir) {
    const d = new Date(this.currentDate + 'T12:00:00');
    d.setDate(d.getDate() + 7 * dir);
    this.currentDate = this.toDateStr(d);

    const subtitleEl = this.container.querySelector('#db-cal-subtitle');
    if (subtitleEl) subtitleEl.textContent = 'Actualizando agenda...';

    this._updateTodayDate();
    await this.loadAppointmentsForWeek();

    if (subtitleEl) subtitleEl.textContent = 'Vista semanal';
    this.renderCalendarContent();
  }

  mount() {
    const prevBtn = this.container.querySelector('#db-cal-prev');
    if (prevBtn) prevBtn.addEventListener('click', () => this.changeWeek(-1));

    const nextBtn = this.container.querySelector('#db-cal-next');
    if (nextBtn) nextBtn.addEventListener('click', () => this.changeWeek(1));

    const pickerInput = this.container.querySelector('#db-cal-picker-input');
    if (pickerInput) {
      pickerInput.addEventListener('change', async (e) => {
        const val = e.target.value;
        if (!val) return;
        this.currentDate = val;
        const subtitleEl = this.container.querySelector('#db-cal-subtitle');
        if (subtitleEl) subtitleEl.textContent = 'Actualizando agenda...';
        this._updateTodayDate();
        await this.loadAppointmentsForWeek();
        if (subtitleEl) subtitleEl.textContent = 'Vista semanal';
        this.renderCalendarContent();
      });
    }

    const layoutContainer = this.container.querySelector('#db-cal-layout-container');
    if (layoutContainer) {
      layoutContainer.addEventListener('click', (e) => {
        const eventEl = e.target.closest('.db-wg-event');
        if (eventEl) {
          const patientId = eventEl.dataset.patientId;
          const userRole = state.get('user')?.role_name;
          if ((userRole === 'doctor' || userRole === 'higienista') && patientId) {
            window.location.hash = `#/patients/${patientId}`;
          } else {
            window.location.hash = '#/appointments';
          }
        }
      });
    }
  }
}
