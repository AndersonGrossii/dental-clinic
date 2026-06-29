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
    this.viewMode = 'month';
    this.currentDate = new Date();
    this._initDelegation();
  }

  _initDelegation() {
    this.container.addEventListener('click', (e) => {
      const viewBtn = e.target.closest('.cal-view-btn');
      if (viewBtn?.dataset.view) {
        this.switchView(viewBtn.dataset.view);
        return;
      }
      const calCell = e.target.closest('.calendar-cell');
      if (calCell?.dataset.date && this.viewMode === 'month') {
        this.currentDate = new Date(calCell.dataset.date + 'T12:00:00');
        this.switchView('day');
        return;
      }
      const eventEl = e.target.closest('.calendar-event, .cal-week-event, .cal-day-event');
      if (eventEl?.dataset.id) {
        this.showChangeStatusModal(eventEl.dataset.id);
        return;
      }
      if (e.target.classList.contains('change-status-btn')) {
        this.showChangeStatusModal(e.target.dataset.id);
      }
      if (e.target.id === 'print-daily-btn') this.printDailyAgenda();
      if (e.target.id === 'add-appointment-btn') this.showAddAppointmentModal();
      if (e.target.id === 'apply-filters-btn') this.applyFilters();
      if (e.target.id === 'clear-filters-btn') this.clearFilters();
      if (e.target.id === 'cal-prev-btn') this.navigate(-1);
      if (e.target.id === 'cal-next-btn') this.navigate(1);
      if (e.target.id === 'cal-today-btn') this.goToToday();
    });
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
      if (this.isDoctor) this.filters.doctor_id = user.doctor_id;

      const range = this.getVisibleRange();
      const params = { date_from: range.start, date_to: range.end };
      if (this.filters.doctor_id) params.doctor_id = this.filters.doctor_id;
      if (this.filters.search) params.search = this.filters.search;

      const apptsResponse = await appointmentService.getAll(params);
      this.appointmentsList = apptsResponse || [];

      if (!this.isDoctor) {
        const docsResponse = await doctorService.getAll();
        this.doctorsList = docsResponse || [];
      }
    } catch (err) {
      toast.error('Error al cargar la agenda de citas');
    }
  }

  getVisibleRange() {
    const d = new Date(this.currentDate);
    const y = d.getFullYear();
    const m = d.getMonth();

    if (this.viewMode === 'month') {
      const first = new Date(y, m, 1);
      const last = new Date(y, m + 1, 0);
      const startDoW = first.getDay();
      const start = new Date(first);
      start.setDate(first.getDate() - (startDoW === 0 ? 6 : startDoW - 1));
      const endDoW = last.getDay();
      const end = new Date(last);
      end.setDate(last.getDate() + (endDoW === 0 ? 0 : 7 - endDoW));
      return { start: this.toDateStr(start), end: this.toDateStr(end) };
    }

    if (this.viewMode === 'week') {
      const start = this.getMonday(d);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return { start: this.toDateStr(start), end: this.toDateStr(end) };
    }

    return { start: this.toDateStr(d), end: this.toDateStr(d) };
  }

  getMonday(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d;
  }

  toDateStr(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  formatDateTitle() {
    const d = new Date(this.currentDate);
    const y = d.getFullYear();
    const m = d.getMonth();
    const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const dayNames = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];

    if (this.viewMode === 'month') {
      return `${monthNames[m]} ${y}`;
    }
    if (this.viewMode === 'week') {
      const mon = this.getMonday(d);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      const monM = monthNames[mon.getMonth()];
      const sunM = monthNames[sun.getMonth()];
      if (mon.getMonth() === sun.getMonth()) {
        return `${mon.getDate()} - ${sun.getDate()} ${monM} ${y}`;
      }
      return `${mon.getDate()} ${monM} - ${sun.getDate()} ${sunM} ${y}`;
    }
    return `${dayNames[d.getDay()]}, ${d.getDate()} ${monthNames[m]} ${y}`;
  }

  getEventsForDate(dateStr) {
    return this.appointmentsList.filter(a => {
      const aptDate = a.appointment_date ? String(a.appointment_date).substring(0, 10) : '';
      return aptDate === dateStr;
    });
  }

  renderView() {
    const docOptions = this.doctorsList.map(d =>
      `<option value="${d.id}" ${this.filters.doctor_id == d.id ? 'selected' : ''}>${d.first_name} ${d.last_name}</option>`
    ).join('');

    const doctorFilterHtml = this.isDoctor
      ? ''
      : `<div class="form-group" style="margin: 0;">
           <label class="form-label" style="font-size: var(--text-xs);">Doctor</label>
           <select id="filter-doctor" class="form-select" style="min-width: 140px;">
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

    const calContent = this.viewMode === 'month' ? this.renderMonthView()
      : this.viewMode === 'week' ? this.renderWeekView()
      : this.renderDayView();

    this.container.innerHTML = `
      <div class="page-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4); flex-wrap: wrap; gap: var(--space-3);">
        <div>
          <h1 class="page-title">Agenda y Citas</h1>
          <p style="color: var(--color-text-secondary); margin-top: 2px;">Programación y calendario de consultas</p>
        </div>
        <div style="display: flex; gap: var(--space-2); align-items: center; flex-wrap: wrap;">
          <select id="slot-duration" class="form-select" style="width: auto; min-width: 80px;">
            <option value="15">15 min</option>
            <option value="30" selected>30 min</option>
            <option value="60">60 min</option>
          </select>
          <button id="print-daily-btn" class="btn btn-outline">Imprimir Agenda</button>
          <button id="add-appointment-btn" class="btn btn-primary">+ Nueva Cita</button>
        </div>
      </div>

      <div class="card" style="margin-bottom: var(--space-4);">
        <div class="card-body" style="padding: var(--space-3) var(--space-4);">
          <div class="appointment-filters" style="display: flex; flex-wrap: wrap; gap: var(--space-3); align-items: flex-end;">
            <div class="form-group" style="margin: 0; flex: 1; min-width: 180px;">
              <label class="form-label" style="font-size: var(--text-xs);">Buscar paciente</label>
              <input type="text" id="filter-search" class="form-input" placeholder="Nombre o teléfono..." value="${this.filters.search || ''}" />
            </div>
            ${doctorFilterHtml}
            <div style="display: flex; gap: var(--space-2); padding-bottom: 1px;">
              <button id="apply-filters-btn" class="btn btn-primary btn-sm">Filtrar</button>
              <button id="clear-filters-btn" class="btn btn-outline btn-sm">Limpiar</button>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-body" style="padding: var(--space-4);">
          <div class="cal-nav-bar" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: var(--space-3); margin-bottom: var(--space-4);">
            <div class="cal-view-tabs" style="display: flex; border: 1px solid var(--color-border); border-radius: var(--radius-md); overflow: hidden;">
              <button class="cal-view-btn btn-cal-view btn-sm ${this.viewMode === 'day' ? 'active' : ''}" data-view="day" style="border: none; border-radius: 0; padding: 6px 14px; cursor: pointer; font-size: var(--text-sm); font-weight: var(--font-medium); background: ${this.viewMode === 'day' ? 'var(--primary-600)' : 'transparent'}; color: ${this.viewMode === 'day' ? '#fff' : 'var(--color-text-secondary)'}; transition: all 0.15s;">Día</button>
              <button class="cal-view-btn btn-cal-view btn-sm ${this.viewMode === 'week' ? 'active' : ''}" data-view="week" style="border: none; border-radius: 0; padding: 6px 14px; cursor: pointer; font-size: var(--text-sm); font-weight: var(--font-medium); background: ${this.viewMode === 'week' ? 'var(--primary-600)' : 'transparent'}; color: ${this.viewMode === 'week' ? '#fff' : 'var(--color-text-secondary)'}; transition: all 0.15s; border-left: 1px solid var(--color-border);">Semana</button>
              <button class="cal-view-btn btn-cal-view btn-sm ${this.viewMode === 'month' ? 'active' : ''}" data-view="month" style="border: none; border-radius: 0; padding: 6px 14px; cursor: pointer; font-size: var(--text-sm); font-weight: var(--font-medium); background: ${this.viewMode === 'month' ? 'var(--primary-600)' : 'transparent'}; color: ${this.viewMode === 'month' ? '#fff' : 'var(--color-text-secondary)'}; transition: all 0.15s; border-left: 1px solid var(--color-border);">Mes</button>
            </div>
            <div class="cal-nav-center" style="display: flex; align-items: center; gap: var(--space-2);">
              <button id="cal-prev-btn" class="btn btn-ghost btn-icon btn-sm" title="Anterior">◀</button>
              <span class="cal-nav-title" style="font-size: var(--text-base); font-weight: var(--font-semibold); min-width: 180px; text-align: center; color: var(--color-text);">${this.formatDateTitle()}</span>
              <button id="cal-next-btn" class="btn btn-ghost btn-icon btn-sm" title="Siguiente">▶</button>
              <button id="cal-today-btn" class="btn btn-outline btn-sm" style="margin-left: var(--space-2);">Hoy</button>
            </div>
          </div>
          <div class="cal-view-container">
            ${calContent}
          </div>
        </div>
      </div>

      <div class="card" style="margin-top: var(--space-4);">
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

  renderMonthView() {
    const d = new Date(this.currentDate);
    const y = d.getFullYear();
    const m = d.getMonth();
    const first = new Date(y, m, 1);
    const last = new Date(y, m + 1, 0);
    const daysInMonth = last.getDate();
    const startDay = first.getDay();
    const padStart = startDay === 0 ? 6 : startDay - 1;
    const totalCells = Math.ceil((padStart + daysInMonth) / 7) * 7;

    const todayStr = this.toDateStr(new Date());
    const dayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

    let html = `<div class="calendar-grid">`;
    html += dayNames.map(dn => `<div class="calendar-grid-header">${dn}</div>`).join('');

    for (let i = 0; i < totalCells; i++) {
      const dayNum = i - padStart + 1;
      const isOtherMonth = dayNum < 1 || dayNum > daysInMonth;
      const cellDate = isOtherMonth ? '' : `${y}-${String(m + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      const isToday = cellDate === todayStr;
      const isWeekend = !isOtherMonth && (i % 7 >= 5);
      const events = cellDate ? this.getEventsForDate(cellDate) : [];
      const maxVisible = window.innerWidth < 480 ? 1 : 3;

      html += `<div class="calendar-cell ${isOtherMonth ? 'other-month' : ''} ${isToday ? 'today' : ''} ${isWeekend ? 'weekend' : ''}" ${cellDate ? `data-date="${cellDate}"` : ''}>`;
      html += `<div class="calendar-day-number">${isOtherMonth ? '' : dayNum}</div>`;
      if (isWeekend && !isOtherMonth && events.length === 0) {
        html += `<div class="weekend-badge" style="font-size: 9px; color: var(--color-danger, #e53e3e); text-align: center; padding: 4px 0;">Cerrado</div>`;
      }
      events.slice(0, maxVisible).forEach(ev => {
        html += `<div class="calendar-event ${ev.status_name || ''}" title="${ev.patient_name} — ${formatTime(ev.start_time)}" data-id="${ev.id}" style="background-color: ${ev.status_color}; color: #fff; border-radius: 4px; padding: 1px 6px; margin: 1px 0; font-size: 11px; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          ${formatTime(ev.start_time)} ${ev.patient_name}
        </div>`;
      });
      if (events.length > maxVisible) {
        html += `<div style="font-size: 10px; color: var(--color-text-tertiary); padding: 1px 4px;">+${events.length - maxVisible} más</div>`;
      }
      html += `</div>`;
    }

    html += `</div>`;
    return html;
  }

  renderWeekView() {
    const mon = this.getMonday(this.currentDate);
    const todayStr = this.toDateStr(new Date());
    const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

    let html = `<div class="cal-week-grid" style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 1px; background-color: var(--color-border-light); border-radius: var(--radius-lg); overflow: hidden;">`;

    for (let i = 0; i < 7; i++) {
      const date = new Date(mon);
      date.setDate(mon.getDate() + i);
      const dateStr = this.toDateStr(date);
      const isToday = dateStr === todayStr;
      const dayNum = date.getDate();
      const isWeekend = i >= 5;

      html += `<div class="cal-week-col ${isWeekend ? 'weekend' : ''}" style="background: var(--color-surface); min-height: 120px; ${isWeekend ? 'background: var(--color-bg-secondary);' : ''}">
        <div class="cal-week-header" style="padding: 8px 6px; text-align: center; border-bottom: 1px solid var(--color-border-light); background: ${isToday ? 'var(--primary-50)' : 'transparent'};">
          <div style="font-size: 10px; color: var(--color-text-tertiary); text-transform: uppercase;">${dayNames[i].substring(0, 3)}</div>
          <div style="font-size: var(--text-lg); font-weight: ${isToday ? 'var(--font-bold)' : 'var(--font-medium)'}; color: ${isToday ? 'var(--primary-600)' : 'var(--color-text)'};">${dayNum}</div>
        </div>
        <div style="padding: 4px;">
          ${isWeekend
            ? '<div style="font-size: 10px; color: var(--color-danger, #e53e3e); text-align: center; padding: 12px 4px; font-weight: var(--font-medium);">Cerrado</div>'
            : (this.getEventsForDate(dateStr).map(ev => `
              <div class="cal-week-event" data-id="${ev.id}" style="background-color: ${ev.status_color}; color: #fff; border-radius: 4px; padding: 3px 6px; margin-bottom: 3px; font-size: 10px; cursor: pointer; line-height: 1.3;">
                <div style="font-weight: 600;">${formatTime(ev.start_time)}</div>
                <div>${ev.patient_name}</div>
              </div>
            `).join('') || '<div style="font-size: 10px; color: var(--color-text-tertiary); padding: 8px 4px; text-align: center;">—</div>')}
        </div>
      </div>`;
    }

    html += `</div>`;
    return html;
  }

  renderDayView() {
    const dateStr = this.toDateStr(this.currentDate);
    const todayStr = this.toDateStr(new Date());
    const isToday = dateStr === todayStr;
    const dayNames = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
    const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const dayName = dayNames[this.currentDate.getDay()];
    const monthName = monthNames[this.currentDate.getMonth()];
    const dayNum = this.currentDate.getDate();

    const events = this.getEventsForDate(dateStr);
    const isWeekendDay = this.currentDate.getDay() === 0 || this.currentDate.getDay() === 6;
    const hours = [];
    for (let h = 8; h <= 20; h++) {
      hours.push(h);
    }

    let html = `<div style="margin-bottom: var(--space-3); text-align: center;">
      <h3 style="margin: 0; font-size: var(--text-lg); font-weight: var(--font-bold); color: ${isToday ? 'var(--primary-600)' : 'var(--color-text)'};">${dayName}, ${dayNum} ${monthName}</h3>
    </div>`;

    if (isWeekendDay) {
      html += `<div style="text-align: center; padding: var(--space-3); background: #fff5f5; border: 1px solid #fecaca; border-radius: var(--radius-lg); margin-bottom: var(--space-4);">
        <span style="color: var(--color-danger, #e53e3e); font-weight: var(--font-semibold); font-size: var(--text-sm);">Este día es fin de semana — solo el propietario puede agendar citas.</span>
      </div>`;
    }

    if (events.length === 0) {
      html += `<div style="text-align: center; padding: var(--space-8); color: var(--color-text-tertiary); font-size: var(--text-sm);">No hay citas programadas para este día.</div>`;
    } else {
      html += `<div class="calendar-day-grid">`;
      hours.forEach(h => {
        const hourStr = `${String(h).padStart(2, '0')}:00`;
        const hourEvents = events.filter(ev => {
          const startH = parseInt(ev.start_time?.split(':')[0] || '0', 10);
          return startH === h;
        });
        html += `<div class="calendar-time-slot">${hourStr}</div>`;
        html += `<div class="calendar-slot-content" style="padding: 4px 8px; min-height: 60px;">`;
        hourEvents.forEach(ev => {
          html += `<div class="cal-day-event" data-id="${ev.id}" style="background-color: ${ev.status_color}; color: #fff; border-radius: 6px; padding: 6px 10px; margin-bottom: 4px; cursor: pointer;">
            <div style="font-weight: 600; font-size: var(--text-sm);">${formatTime(ev.start_time)} — ${ev.patient_name}</div>
            <div style="font-size: var(--text-xs); opacity: 0.85;">${ev.doctor_name || ''}${ev.treatment_name ? ' · ' + ev.treatment_name : ''}</div>
          </div>`;
        });
        html += `</div>`;
      });
      html += `</div>`;
    }

    return html;
  }

  mount() {
    // All event listeners use delegation via _initDelegation
  }

  navigate(dir) {
    const d = new Date(this.currentDate);
    if (this.viewMode === 'month') d.setMonth(d.getMonth() + dir);
    else if (this.viewMode === 'week') d.setDate(d.getDate() + 7 * dir);
    else d.setDate(d.getDate() + dir);
    this.currentDate = d;
    this.render();
  }

  goToToday() {
    this.currentDate = new Date();
    this.render();
  }

  switchView(mode) {
    this.viewMode = mode;
    this.render();
  }

  applyFilters() {
    const filters = {
      search: this.container.querySelector('#filter-search')?.value?.trim() || undefined,
      doctor_id: this.isDoctor ? state.get('user')?.doctor_id : (this.container.querySelector('#filter-doctor')?.value || undefined),
    };
    Object.keys(filters).forEach(k => { if (!filters[k]) delete filters[k]; });
    this.render(filters);
  }

  clearFilters() {
    this.filters = {};
    this.render({});
  }

  async printDailyAgenda() {
    const slotDuration = parseInt(this.container.querySelector('#slot-duration')?.value || '30', 10);
    const today = this.toDateStr(new Date());

    try {
      const appointments = await appointmentService.getAll({
        date_from: today, date_to: today,
        limit: 9999,
        sortBy: 'a.start_time', sortOrder: 'ASC'
      });
      const list = Array.isArray(appointments) ? appointments : [];

      const groups = {};
      list.forEach(a => {
        const key = a.doctor_name || 'Sin doctor';
        if (!groups[key]) groups[key] = { doctor_name: a.doctor_name, doctor_specialty: a.doctor_specialty || '', appointments: [] };
        groups[key].appointments.push(a);
      });

      const allIds = new Set(list.map(a => a.id));
      const totalAppts = allIds.size;

      const slots = [];
      for (let m = 540; m < 1200; m += slotDuration) {
        slots.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
      }

      const clinic = state.get('clinicInfo') || {};
      const dateParts = new Date();
      const dayNames = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
      const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
      const dateLabel = `${dayNames[dateParts.getDay()]}, ${dateParts.getDate()} de ${monthNames[dateParts.getMonth()]} de ${dateParts.getFullYear()}`;

      const cellStyle = 'border: 1px solid #ddd; padding: 6px 10px; font-size: 12px;';
      const thStyle = `${cellStyle} background: #f0f0f0; font-weight: 600; text-align: left;`;

      let bodyHtml = '';

      Object.values(groups).forEach(group => {
        const sorted = [...group.appointments].sort((a, b) =>
          (a.start_time || '').localeCompare(b.start_time || '')
        );
        let rows = '';
        slots.forEach(slot => {
          const match = sorted.find(a => {
            const s = a.start_time ? a.start_time.substring(0, 5) : '';
            const e = a.end_time ? a.end_time.substring(0, 5) : '';
            return s <= slot && e > slot;
          });
          const isEmpty = !match;
          rows += `<tr style="${isEmpty ? 'background: #fafafa;' : ''}">
            <td style="${cellStyle}${isEmpty ? ' color: #bbb;' : ''}">${slot}</td>
            <td style="${cellStyle}">${match ? match.patient_name : ''}</td>
            <td style="${cellStyle}">${match ? (match.treatment_name || '') : ''}</td>
            <td style="${cellStyle}">${match ? (match.notes || '') : ''}</td>
            <td style="${cellStyle}">${match ? (match.status_label || '') : ''}</td>
          </tr>`;
        });
        bodyHtml += `
          <h2 style="font-size: 15px; margin: 24px 0 8px; padding-bottom: 4px; border-bottom: 2px solid #333; color: #1a1a1a;">${group.doctor_name}${group.doctor_specialty ? ' — ' + group.doctor_specialty : ''}</h2>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px;">
            <thead><tr>
              <th style="${thStyle}width: 60px;">Hora</th>
              <th style="${thStyle}">Paciente</th>
              <th style="${thStyle}width: 120px;">Tratamiento</th>
              <th style="${thStyle}">Notas</th>
              <th style="${thStyle}width: 80px;">Estado</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>`;
      });

      const printWindow = window.open('', '_blank');
      printWindow.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Agenda del Día</title></head>
<body style="font-family: Arial, sans-serif; padding: 30px 40px; color: #333; margin: 0;">
  <div style="text-align: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 3px double #ccc;">
    <h1 style="margin: 0; font-size: 22px; color: #111;">${clinic.name || 'Clinica Vides Dental'}</h1>
    <p style="margin: 4px 0 0; font-size: 13px; color: #555;">${clinic.address || ''}${clinic.phone ? ' — Tel: ' + clinic.phone : ''}</p>
    <h2 style="margin: 12px 0 0; font-size: 17px; color: #333;">Agenda del Día</h2>
    <p style="margin: 2px 0 0; font-size: 13px; color: #666;">${dateLabel}</p>
  </div>
  ${bodyHtml}
  <div style="margin-top: 20px; padding-top: 12px; border-top: 1px solid #ddd; font-size: 13px; color: #555;">
    Total: <strong>${totalAppts}</strong> cita${totalAppts !== 1 ? 's' : ''} programada${totalAppts !== 1 ? 's' : ''}
    &nbsp;|&nbsp; Intervalo: ${slotDuration} min
  </div>
</body></html>`);
      printWindow.document.close();
      printWindow.print();
    } catch (err) {
      toast.error('Error al cargar la agenda del día');
    }
  }

  showAddAppointmentModal() {
    const userRole = state.get('user')?.role_name;
    const dow = this.currentDate.getDay();
    const isWeekendDay = dow === 0 || dow === 6;
    if (isWeekendDay && userRole !== 'owner') {
      toast.error('Solo el propietario puede agendar citas en fin de semana.');
      return;
    }

    const docOptions = this.doctorsList.map(d => `
      <option value="${d.id}">Dr/a. ${d.first_name} ${d.last_name} (${d.specialty})</option>
    `).join('');

    const defaultDate = this.toDateStr(this.currentDate);

    const content = `
      <form id="add-appointment-form">
        <div class="form-group">
          <label class="form-label">Buscar Paciente</label>
          <div style="display: flex; gap: var(--space-2);">
            <input type="text" id="appointment-patient-search" class="form-input" placeholder="Nombre, DNI, teléfono o correo" />
            <button type="button" id="appointment-patient-search-btn" class="btn btn-secondary">Buscar</button>
          </div>
          <input type="hidden" name="patient_id" />
          <div id="appointment-selected-patient" style="margin-top: var(--space-2); color: var(--color-text-secondary);">
            Ningún paciente seleccionado.
          </div>
          <div id="appointment-patient-results" style="margin-top: var(--space-2);"></div>
        </div>
        <div class="form-group" style="margin-top: var(--space-3); border-top: 1px solid var(--color-border); padding-top: var(--space-3);">
          <button type="button" id="toggle-new-patient-btn" class="btn btn-outline">+ Agregar Paciente Nuevo</button>
          <div id="new-patient-fields" style="display: none; margin-top: var(--space-3);">
            <div class="form-row-responsive">
              <div class="form-group" style="margin: 0;">
                <label class="form-label">Nombre</label>
                <input type="text" id="new-patient-first-name" class="form-input" />
              </div>
              <div class="form-group" style="margin: 0;">
                <label class="form-label">Apellido</label>
                <input type="text" id="new-patient-last-name" class="form-input" />
              </div>
            </div>
            <div class="form-row-responsive" style="margin-top: var(--space-3);">
              <div class="form-group" style="margin: 0;">
                <label class="form-label">Teléfono</label>
                <input type="text" id="new-patient-phone" class="form-input" />
              </div>
              <div class="form-group" style="margin: 0;">
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
          <input type="date" name="appointment_date" class="form-input" value="${defaultDate}" required />
        </div>
        <div class="form-row-responsive">
          <div class="form-group" style="margin: 0;">
            <label class="form-label">Hora Inicio</label>
            <input type="time" name="start_time" class="form-input" required />
          </div>
          <div class="form-group" style="margin: 0;">
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
      size: 'md',
      onConfirm: async (modalBody) => {
        const form = modalBody.querySelector('#add-appointment-form');
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        data.patient_id = Number(data.patient_id);
        data.doctor_id = Number(data.doctor_id);
        if (!data.patient_id) { toast.error('Seleccione o cree un paciente'); return false; }
        if (!data.doctor_id) { toast.error('Seleccione un doctor'); return false; }
        const selDate = new Date(data.appointment_date + 'T12:00:00');
        const selDow = selDate.getDay();
        if ((selDow === 0 || selDow === 6) && state.get('user')?.role_name !== 'owner') {
          toast.error('Solo el propietario puede agendar citas en fin de semana.');
          return false;
        }
        try {
          await appointmentService.create(data);
          toast.success('Cita programada exitosamente');
          await this.render();
          this.mount();
          return true;
        } catch (err) {
          toast.error(err.message || 'Error al programar la cita');
          return false;
        }
      }
    });

    const overlay = document.querySelector('.modal-overlay');
    if (!overlay) return;
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
        resultsContainer.innerHTML = '<p style="color: var(--color-text-secondary); margin: 0;">No se encontraron pacientes. Puede agregar uno nuevo.</p>';
        return;
      }
      resultsContainer.innerHTML = patients.map(p => `
        <button type="button" class="btn btn-outline appointment-patient-result" data-id="${p.id}" style="display: block; width: 100%; text-align: left; margin-bottom: var(--space-2);">
          ${p.first_name} ${p.last_name}${p.phone ? ` - ${p.phone}` : ''}${p.email ? ` - ${p.email}` : ''}
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
      if (term.length < 2) { toast.error('Escriba al menos 2 caracteres'); return; }
      try {
        const patients = await patientService.search(term);
        renderPatientResults(patients || []);
      } catch (err) {
        toast.error(err.message || 'Error al buscar pacientes');
      }
    };

    searchBtn.addEventListener('click', searchPatients);
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); searchPatients(); }
    });
    toggleNewPatientBtn.addEventListener('click', () => {
      newPatientFields.style.display = newPatientFields.style.display === 'none' ? 'block' : 'none';
    });
    createPatientBtn.addEventListener('click', async () => {
      const firstName = overlay.querySelector('#new-patient-first-name').value.trim();
      const lastName = overlay.querySelector('#new-patient-last-name').value.trim();
      if (!firstName || !lastName) { toast.error('Nombre y apellido obligatorios'); return; }
      try {
        const phone = overlay.querySelector('#new-patient-phone').value.trim();
        const email = overlay.querySelector('#new-patient-email').value.trim();
        const patient = await patientService.create({ first_name: firstName, last_name: lastName, phone: phone || undefined, email: email || undefined });
        selectPatient(patient);
        newPatientFields.style.display = 'none';
        toast.success('Paciente creado y seleccionado');
      } catch (err) {
        toast.error(err.message || 'Error al crear paciente');
      }
    });
  }

  showChangeStatusModal(appointmentId) {
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
        <div class="status-option-check"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg></div>
      </label>
    `).join('');

    const content = `
      <style>
        .status-option-card { display:flex; align-items:center; gap:12px; padding:12px 14px; border:2px solid var(--color-border-light); border-radius:var(--radius-md); cursor:pointer; margin-bottom:8px; transition:all 0.18s ease; position:relative; background:var(--color-surface); }
        .status-option-card:hover { border-color:var(--status-color); background:color-mix(in srgb, var(--status-color) 5%, transparent); }
        .status-option-card:has(input:checked), .status-option-card--selected { border-color:var(--status-color); background:color-mix(in srgb, var(--status-color) 8%, transparent); box-shadow:0 0 0 3px color-mix(in srgb, var(--status-color) 15%, transparent); }
        .status-option-card--current { border-color:var(--status-color); }
        .status-option-icon { font-size:20px; width:36px; height:36px; display:flex; align-items:center; justify-content:center; background:color-mix(in srgb, var(--status-color) 12%, transparent); border-radius:8px; flex-shrink:0; }
        .status-option-info { flex:1; display:flex; flex-direction:column; }
        .status-option-info strong { font-size:0.875rem; color:var(--color-text); font-weight:600; }
        .status-option-info span { font-size:0.75rem; color:var(--color-text-tertiary); margin-top:1px; }
        .status-option-check { color:var(--status-color); opacity:0; transition:opacity 0.15s; flex-shrink:0; }
        .status-option-card:has(input:checked) .status-option-check { opacity:1; }
        #cancellation-reason-group { margin-top:12px; padding:14px; background:rgba(220,38,38,0.05); border:1px solid rgba(220,38,38,0.2); border-radius:var(--radius-md); animation:fadeIn 0.2s ease; }
        @keyframes fadeIn { from { opacity:0; transform:translateY(-4px); } to { opacity:1; transform:translateY(0); } }
        .current-status-badge { display:inline-flex; align-items:center; gap:6px; font-size:0.75rem; font-weight:600; color:var(--color-text-secondary); background:var(--color-bg-secondary); border:1px solid var(--color-border-light); padding:4px 10px; border-radius:999px; margin-bottom:16px; }
      </style>
      <form id="change-status-form">
        ${appt ? `<div class="current-status-badge">Estado actual: <span style="color:${appt.status_color};">${appt.status_label || currentStatus}</span></div>` : ''}
        <div style="display: flex; flex-direction: column; gap: 0;">${statusCards}</div>
        <div id="cancellation-reason-group" style="display: none;">
          <label class="form-label" style="color: #dc2626; font-weight: 600;">⚠️ Motivo de Cancelación <span style="color: #dc2626;">*</span></label>
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
        if (!selected) { toast.error('Seleccione un estado'); return false; }
        const status = selected.value;
        const reason = form.querySelector('[name="cancellation_reason"]')?.value?.trim();
        if (status === 'cancelada' && !reason) { toast.error('El motivo de cancelación es requerido'); return false; }
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

    const overlay = document.querySelector('.modal-overlay');
    if (!overlay) return;
    const reasonGroup = overlay.querySelector('#cancellation-reason-group');
    const cards = overlay.querySelectorAll('.status-option-card');
    const updateSelected = () => {
      const checked = overlay.querySelector('[name="status_name"]:checked');
      cards.forEach(card => card.classList.remove('status-option-card--selected'));
      if (checked) {
        checked.closest('.status-option-card')?.classList.add('status-option-card--selected');
        if (reasonGroup) reasonGroup.style.display = checked.value === 'cancelada' ? 'block' : 'none';
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
