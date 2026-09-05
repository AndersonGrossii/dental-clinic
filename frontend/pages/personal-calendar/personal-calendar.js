// ============================================
// Página: Agenda Personal & Productividad
// Tareas, Notas Adhesivas y Seguimientos Privados
// ============================================

import taskService from '../../services/task.service.js';
import patientService from '../../services/patient.service.js';
import state from '../../scripts/state.js';
import toast from '../../components/toast/toast.js';
import Modal from '../../components/modal/modal.js';
import { formatDate, formatTime } from '../../utils/helpers.js';

export class PersonalCalendarPage {
  constructor(container) {
    this.container = container;
    this.currentDate = new Date();
    this.viewMode = 'month'; // 'month' | 'week' | 'day' | 'list'
    this.filterType = 'all'; // 'all' | 'tasks' | 'notes' | 'followups' | 'mine' | 'received'
    this.tasksList = [];
    this.notesList = [];
    this.followupsList = [];
    this.staffList = [];
    this.currentUser = state.get('user') || {};
  }

  toDateStr(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  getVisibleRange() {
    const d = new Date(this.currentDate);
    if (this.viewMode === 'day') {
      const s = this.toDateStr(d);
      return { start: s, end: s };
    }
    if (this.viewMode === 'week') {
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const mon = new Date(d.setDate(diff));
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      return { start: this.toDateStr(mon), end: this.toDateStr(sun) };
    }
    // Month view (with margin)
    const y = d.getFullYear();
    const m = d.getMonth();
    const start = new Date(y, m - 1, 20);
    const end = new Date(y, m + 2, 10);
    return { start: this.toDateStr(start), end: this.toDateStr(end) };
  }

  async loadData() {
    try {
      this.currentUser = state.get('user') || {};
      const range = this.getVisibleRange();

      const [tasksRes, notesRes, followupsRes, staffRes] = await Promise.all([
        taskService.getTasks({ start_date: range.start, end_date: range.end }).catch(() => []),
        taskService.getNotes({ start_date: range.start, end_date: range.end }).catch(() => []),
        taskService.getFollowups({ start_date: range.start, end_date: range.end }).catch(() => []),
        this.staffList.length > 0 ? Promise.resolve(this.staffList) : taskService.getStaff().catch(() => []),
      ]);

      this.tasksList = Array.isArray(tasksRes) ? tasksRes : (tasksRes?.data || []);
      this.notesList = Array.isArray(notesRes) ? notesRes : (notesRes?.data || []);
      this.followupsList = Array.isArray(followupsRes) ? followupsRes : (followupsRes?.data || []);
      const loadedStaff = Array.isArray(staffRes) ? staffRes : (staffRes?.data || []);
      if (loadedStaff.length > 0) this.staffList = loadedStaff;
    } catch (err) {
      toast.error('Error al cargar la agenda personal');
    }
  }

  async ensureStaffLoaded() {
    if (!this.staffList || this.staffList.length === 0) {
      try {
        const staffRes = await taskService.getStaff();
        const loaded = Array.isArray(staffRes) ? staffRes : (staffRes?.data || []);
        if (loaded.length > 0) this.staffList = loaded;
      } catch (err) {
        console.error('Error cargando lista de personal:', err);
      }
    }
  }

  async render() {
    await this.loadData();
    this.renderView();
    this.initEventListeners();
  }

  formatDateTitle() {
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const d = new Date(this.currentDate);
    if (this.viewMode === 'day') {
      return `${d.getDate()} de ${months[d.getMonth()]} de ${d.getFullYear()}`;
    }
    return `${months[d.getMonth()]} ${d.getFullYear()}`;
  }

  getFilteredItemsForDate(dateStr) {
    const myId = this.currentUser?.id;

    let tasks = this.tasksList.filter(t => (t.due_date ? String(t.due_date).substring(0, 10) : '') === dateStr);
    let notes = this.notesList.filter(n => (n.note_date ? String(n.note_date).substring(0, 10) : '') === dateStr);
    let followups = this.followupsList.filter(f => (f.followup_date ? String(f.followup_date).substring(0, 10) : '') === dateStr);

    if (this.filterType === 'tasks') { notes = []; followups = []; }
    else if (this.filterType === 'notes') { tasks = []; followups = []; }
    else if (this.filterType === 'followups') { tasks = []; notes = []; }
    else if (this.filterType === 'mine') {
      tasks = tasks.filter(t => t.created_by_user_id === myId);
      notes = notes.filter(n => n.user_id === myId);
      followups = followups.filter(f => f.created_by_user_id === myId);
    } else if (this.filterType === 'received') {
      tasks = tasks.filter(t => t.created_by_user_id !== myId);
      notes = notes.filter(n => n.user_id !== myId);
      followups = followups.filter(f => f.created_by_user_id !== myId);
    }

    return { tasks, notes, followups };
  }

  renderView() {
    const pendingTasksCount = this.tasksList.filter(t => t.status !== 'COMPLETED').length;
    const notesCount = this.notesList.length;
    const pendingFollowupsCount = this.followupsList.filter(f => f.status === 'PENDING').length;

    let calendarContent = '';
    if (this.viewMode === 'month') calendarContent = this.renderMonthView();
    else if (this.viewMode === 'week') calendarContent = this.renderWeekView();
    else if (this.viewMode === 'day') calendarContent = this.renderDayView();
    else calendarContent = this.renderListView();

    this.container.innerHTML = `
      <div class="personal-calendar-page">
        <!-- Header -->
        <div class="pc-header">
          <div>
            <h1 class="page-title" style="display:flex;align-items:center;gap:8px;">
              <span>🗓️ Agenda Personal</span>
              <span class="badge badge-primary" style="font-size:0.75rem;font-weight:600;">Personal y Privada</span>
            </h1>
            <p style="color:var(--color-text-secondary);margin-top:2px;">
              Gestión personal de tareas, notas adhesivas y seguimientos privados o dirigidos.
            </p>
          </div>
          <div class="pc-actions">
            <button id="pc-add-task-btn" class="btn btn-outline" style="background:#eff6ff;color:#1e40af;border-color:#93c5fd;">📋 + Nueva Tarea</button>
            <button id="pc-add-note-btn" class="btn btn-outline" style="background:#fefce8;color:#854d0e;border-color:#fde047;">📌 + Nueva Nota</button>
            <button id="pc-add-followup-btn" class="btn btn-outline" style="background:#fef2f2;color:#991b1b;border-color:#fca5a5;">🔔 + Seguimiento</button>
          </div>
        </div>

        <!-- Metric Cards -->
        <div class="pc-metrics-bar">
          <div class="pc-metric-card ${this.filterType === 'tasks' ? 'active' : ''}" data-filter-quick="tasks">
            <div class="pc-metric-icon">📋</div>
            <div class="pc-metric-info">
              <span class="pc-metric-value">${pendingTasksCount}</span>
              <span class="pc-metric-label">Tareas Pendientes</span>
            </div>
          </div>
          <div class="pc-metric-card ${this.filterType === 'notes' ? 'active' : ''}" data-filter-quick="notes">
            <div class="pc-metric-icon">📌</div>
            <div class="pc-metric-info">
              <span class="pc-metric-value">${notesCount}</span>
              <span class="pc-metric-label">Notas Adhesivas</span>
            </div>
          </div>
          <div class="pc-metric-card ${this.filterType === 'followups' ? 'active' : ''}" data-filter-quick="followups">
            <div class="pc-metric-icon">🔔</div>
            <div class="pc-metric-info">
              <span class="pc-metric-value">${pendingFollowupsCount}</span>
              <span class="pc-metric-label">Seguimientos Activos</span>
            </div>
          </div>
        </div>

        <!-- Controls, Views & Filter Chips -->
        <div class="card" style="margin-bottom:var(--space-4);">
          <div class="card-body" style="padding:var(--space-3) var(--space-4);">
            <div class="pc-nav-bar">
              <div class="cal-view-tabs" style="display:flex;border:1px solid var(--color-border);border-radius:var(--radius-md);overflow:hidden;">
                <button class="cal-view-btn btn-sm ${this.viewMode === 'month' ? 'active' : ''}" data-view="month" style="border:none;padding:6px 14px;cursor:pointer;font-size:var(--text-sm);font-weight:600;background:${this.viewMode === 'month' ? 'var(--primary-600)' : 'transparent'};color:${this.viewMode === 'month' ? '#fff' : 'var(--color-text-secondary)'};">Mes</button>
                <button class="cal-view-btn btn-sm ${this.viewMode === 'week' ? 'active' : ''}" data-view="week" style="border:none;padding:6px 14px;cursor:pointer;font-size:var(--text-sm);font-weight:600;background:${this.viewMode === 'week' ? 'var(--primary-600)' : 'transparent'};color:${this.viewMode === 'week' ? '#fff' : 'var(--color-text-secondary)'};border-left:1px solid var(--color-border);">Semana</button>
                <button class="cal-view-btn btn-sm ${this.viewMode === 'day' ? 'active' : ''}" data-view="day" style="border:none;padding:6px 14px;cursor:pointer;font-size:var(--text-sm);font-weight:600;background:${this.viewMode === 'day' ? 'var(--primary-600)' : 'transparent'};color:${this.viewMode === 'day' ? '#fff' : 'var(--color-text-secondary)'};border-left:1px solid var(--color-border);">Día</button>
                <button class="cal-view-btn btn-sm ${this.viewMode === 'list' ? 'active' : ''}" data-view="list" style="border:none;padding:6px 14px;cursor:pointer;font-size:var(--text-sm);font-weight:600;background:${this.viewMode === 'list' ? 'var(--primary-600)' : 'transparent'};color:${this.viewMode === 'list' ? '#fff' : 'var(--color-text-secondary)'};border-left:1px solid var(--color-border);">Listado</button>
              </div>

              <div style="display:flex;align-items:center;gap:var(--space-2);">
                <button id="pc-prev-btn" class="btn btn-ghost btn-icon btn-sm">◀</button>
                <span style="font-size:var(--text-base);font-weight:700;min-width:180px;text-align:center;color:var(--color-text);">${this.formatDateTitle()}</span>
                <button id="pc-next-btn" class="btn btn-ghost btn-icon btn-sm">▶</button>
                <button id="pc-today-btn" class="btn btn-outline btn-sm" style="margin-left:var(--space-2);">Hoy</button>
              </div>
            </div>

            <!-- Filter Chips -->
            <div class="pc-filter-chips">
              <span style="font-size:var(--text-xs);font-weight:700;color:var(--color-text-secondary);text-transform:uppercase;">Filtrar:</span>
              <button class="pc-filter-chip ${this.filterType === 'all' ? 'active' : ''}" data-filter="all">Todos</button>
              <button class="pc-filter-chip ${this.filterType === 'tasks' ? 'active' : ''}" data-filter="tasks">📋 Tareas</button>
              <button class="pc-filter-chip ${this.filterType === 'notes' ? 'active' : ''}" data-filter="notes">📌 Notas</button>
              <button class="pc-filter-chip ${this.filterType === 'followups' ? 'active' : ''}" data-filter="followups">🔔 Seguimientos</button>
              <button class="pc-filter-chip ${this.filterType === 'mine' ? 'active' : ''}" data-filter="mine">📤 Creados por mí</button>
              <button class="pc-filter-chip ${this.filterType === 'received' ? 'active' : ''}" data-filter="received">📥 Asignados a mí</button>
            </div>
          </div>
        </div>

        <!-- Main View Area -->
        <div class="card">
          <div class="card-body" style="padding:var(--space-4);">
            ${calendarContent}
          </div>
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

    let html = `<div class="pc-calendar-grid">`;
    html += dayNames.map(dn => `<div class="pc-calendar-header-day">${dn}</div>`).join('');

    for (let i = 0; i < totalCells; i++) {
      const dayNum = i - padStart + 1;
      const isOtherMonth = dayNum < 1 || dayNum > daysInMonth;
      const cellDate = isOtherMonth ? '' : `${y}-${String(m + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      const isToday = cellDate === todayStr;

      html += `<div class="pc-calendar-cell ${isOtherMonth ? 'other-month' : ''} ${isToday ? 'today' : ''}" ${cellDate ? `data-date="${cellDate}"` : ''}>`;
      html += `
        <div class="pc-cell-header">
          <span class="pc-day-number">${isOtherMonth ? '' : dayNum}</span>
          ${cellDate ? `<span class="btn-add-cell-item" title="Agregar elemento este día" style="font-size:0.75rem;color:var(--color-text-secondary);cursor:pointer;opacity:0.6;">+</span>` : ''}
        </div>
      `;

      if (cellDate) {
        const { tasks, notes, followups } = this.getFilteredItemsForDate(cellDate);
        html += `<div class="pc-items-container">`;

        // Tasks
        tasks.slice(0, 3).forEach(t => {
          const isDone = t.status === 'COMPLETED';
          html += `
            <div class="pc-chip task ${isDone ? 'completed' : ''}" data-task-id="${t.id}" title="${this.escapeHtml(t.title)}">
              <span class="pc-chip-badge" style="background:#dbeafe;color:#1e40af;">${t.priority}</span>
              <span class="pc-chip-text">${this.escapeHtml(t.title)}</span>
            </div>
          `;
        });

        // Notes
        notes.slice(0, 2).forEach(n => {
          html += `
            <div class="pc-chip note" data-note-id="${n.id}" style="background:${n.color || '#fef08a'};" title="${this.escapeHtml(n.content)}">
              <span>📌</span>
              <span class="pc-chip-text">${this.escapeHtml(n.title || n.content)}</span>
            </div>
          `;
        });

        // Followups
        followups.slice(0, 2).forEach(f => {
          const isDone = f.status !== 'PENDING';
          html += `
            <div class="pc-chip followup ${isDone ? 'concluded' : ''}" data-followup-id="${f.id}" title="${this.escapeHtml(f.reason)}">
              <span>🔔</span>
              <span class="pc-chip-text">${this.escapeHtml(f.reason)}</span>
            </div>
          `;
        });

        const totalItems = tasks.length + notes.length + followups.length;
        const visibleItems = Math.min(tasks.length, 3) + Math.min(notes.length, 2) + Math.min(followups.length, 2);
        if (totalItems > visibleItems) {
          html += `<div style="font-size:0.68rem;color:var(--color-text-secondary);padding:1px 4px;">+${totalItems - visibleItems} más</div>`;
        }

        html += `</div>`;
      }

      html += `</div>`;
    }

    html += `</div>`;
    return html;
  }

  renderWeekView() {
    const d = new Date(this.currentDate);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const mon = new Date(d.setDate(diff));
    const todayStr = this.toDateStr(new Date());
    const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

    let html = `<div style="display:grid;grid-template-columns:repeat(7, 1fr);gap:10px;">`;

    for (let i = 0; i < 7; i++) {
      const cur = new Date(mon);
      cur.setDate(mon.getDate() + i);
      const curStr = this.toDateStr(cur);
      const isToday = curStr === todayStr;
      const { tasks, notes, followups } = this.getFilteredItemsForDate(curStr);

      html += `
        <div style="background:var(--color-surface,#fff);border:1px solid ${isToday ? '#22c55e' : 'var(--color-border,#e2e8f0)'};border-radius:8px;padding:8px;display:flex;flex-direction:column;gap:8px;min-height:300px;">
          <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e2e8f0;padding-bottom:6px;">
            <span style="font-weight:700;font-size:0.85rem;color:${isToday ? '#15803d' : 'inherit'};">${dayNames[i]} ${cur.getDate()}</span>
            <button class="btn btn-xs btn-ghost btn-add-day-direct" data-date="${curStr}" style="padding:1px 5px;">+</button>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;flex:1;overflow-y:auto;">
            ${tasks.map(t => {
              const isDone = t.status === 'COMPLETED';
              return `
                <div class="pc-chip task ${isDone ? 'completed' : ''}" data-task-id="${t.id}">
                  <span class="pc-chip-badge" style="background:#dbeafe;">${t.priority}</span>
                  <span class="pc-chip-text">${this.escapeHtml(t.title)}</span>
                </div>
              `;
            }).join('')}
            ${notes.map(n => `
              <div class="pc-chip note" data-note-id="${n.id}" style="background:${n.color || '#fef08a'};">
                <span>📌</span>
                <span class="pc-chip-text">${this.escapeHtml(n.title || n.content)}</span>
              </div>
            `).join('')}
            ${followups.map(f => {
              const isDone = f.status !== 'PENDING';
              return `
                <div class="pc-chip followup ${isDone ? 'concluded' : ''}" data-followup-id="${f.id}">
                  <span>🔔</span>
                  <span class="pc-chip-text">${this.escapeHtml(f.reason)}</span>
                </div>
              `;
            }).join('')}
            ${tasks.length === 0 && notes.length === 0 && followups.length === 0 ? `<span style="font-size:0.75rem;color:#94a3b8;margin:auto;">Sin actividades</span>` : ''}
          </div>
        </div>
      `;
    }

    html += `</div>`;
    return html;
  }

  renderDayView() {
    const curStr = this.toDateStr(this.currentDate);
    const { tasks, notes, followups } = this.getFilteredItemsForDate(curStr);

    return `
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(300px, 1fr));gap:var(--space-4);">
        <!-- Tareas del Día -->
        <div style="border:1px solid var(--color-border);border-radius:8px;padding:14px;background:#ffffff;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <h3 style="margin:0;font-size:1rem;font-weight:700;">📋 Tareas del Día (${tasks.length})</h3>
            <button id="pc-add-task-btn" class="btn btn-xs btn-outline">+ Tarea</button>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            ${tasks.length === 0 ? '<p style="color:#94a3b8;font-size:0.85rem;">No hay tareas para este día</p>' : tasks.map(t => {
              const isDone = t.status === 'COMPLETED';
              const textStyle = isDone ? 'text-decoration: line-through; opacity: 0.65;' : '';
              return `
                <div class="task-item-inline" data-task-id="${t.id}" style="padding:8px;border:1px solid #e2e8f0;border-radius:6px;display:flex;align-items:center;gap:8px;cursor:pointer;${textStyle}">
                  <input type="checkbox" class="pc-task-toggle" data-task-id="${t.id}" ${isDone ? 'checked' : ''} onclick="event.stopPropagation();" />
                  <span class="badge badge-primary" style="font-size:0.68rem;">${t.priority}</span>
                  <span style="flex:1;font-weight:600;font-size:0.88rem;">${this.escapeHtml(t.title)}</span>
                  ${t.due_time ? `<span style="font-size:0.75rem;color:#64748b;">${t.due_time.substring(0,5)}</span>` : ''}
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Notas del Día -->
        <div style="border:1px solid var(--color-border);border-radius:8px;padding:14px;background:#ffffff;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <h3 style="margin:0;font-size:1rem;font-weight:700;">📌 Notas Adhesivas (${notes.length})</h3>
            <button id="pc-add-note-btn" class="btn btn-xs btn-outline">+ Nota</button>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            ${notes.length === 0 ? '<p style="color:#94a3b8;font-size:0.85rem;">Sin notas adhesivas</p>' : notes.map(n => `
              <div data-note-id="${n.id}" style="background:${n.color || '#fef08a'};padding:10px;border-radius:8px;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,0.06);color:#374151;">
                ${n.title ? `<strong style="font-size:0.9rem;display:block;margin-bottom:4px;">${this.escapeHtml(n.title)}</strong>` : ''}
                <p style="margin:0;font-size:0.85rem;line-height:1.4;">${this.escapeHtml(n.content)}</p>
                ${n.author_first_name ? `<span style="font-size:0.72rem;color:#6b7280;margin-top:6px;display:block;">✍️ Por: ${n.author_first_name}</span>` : ''}
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Seguimientos del Día -->
        <div style="border:1px solid var(--color-border);border-radius:8px;padding:14px;background:#ffffff;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <h3 style="margin:0;font-size:1rem;font-weight:700;">🔔 Seguimientos (${followups.length})</h3>
            <button id="pc-add-followup-btn" class="btn btn-xs btn-outline">+ Seg.</button>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            ${followups.length === 0 ? '<p style="color:#94a3b8;font-size:0.85rem;">Sin seguimientos para este día</p>' : followups.map(f => {
              const isDone = f.status !== 'PENDING';
              const textStyle = isDone ? 'text-decoration: line-through; opacity: 0.65;' : '';
              return `
                <div data-followup-id="${f.id}" style="padding:8px 10px;border:1px solid #e2e8f0;border-radius:6px;display:flex;flex-direction:column;gap:3px;cursor:pointer;${textStyle}">
                  <div style="display:flex;justify-content:space-between;">
                    <span class="badge ${isDone ? 'badge-success' : 'badge-primary'}" style="font-size:0.68rem;">${f.status}</span>
                    ${f.patient_first_name ? `<span style="font-size:0.8rem;font-weight:600;">${this.escapeHtml(f.patient_first_name)} ${this.escapeHtml(f.patient_last_name || '')}</span>` : ''}
                  </div>
                  <span style="font-size:0.88rem;color:var(--primary-700);font-weight:600;">${this.escapeHtml(f.reason)}</span>
                  ${f.notes ? `<span style="font-size:0.78rem;color:#64748b;">${this.escapeHtml(f.notes)}</span>` : ''}
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;
  }

  renderListView() {
    const datesSet = new Set([
      ...this.tasksList.map(t => t.due_date ? String(t.due_date).substring(0, 10) : ''),
      ...this.notesList.map(n => n.note_date ? String(n.note_date).substring(0, 10) : ''),
      ...this.followupsList.map(f => f.followup_date ? String(f.followup_date).substring(0, 10) : '')
    ]);
    datesSet.delete('');
    const sortedDates = Array.from(datesSet).sort();

    if (sortedDates.length === 0) {
      return `<div style="text-align:center;padding:40px;color:#94a3b8;">No hay registros en la agenda personal para este período.</div>`;
    }

    let html = `<div class="pc-list-container">`;
    sortedDates.forEach(dateStr => {
      const { tasks, notes, followups } = this.getFilteredItemsForDate(dateStr);
      if (tasks.length === 0 && notes.length === 0 && followups.length === 0) return;

      html += `
        <div class="pc-list-day-group">
          <div class="pc-list-day-header">
            <span>📅 ${formatDate(dateStr)}</span>
            <span style="font-size:0.75rem;color:#64748b;">${tasks.length} Tareas • ${notes.length} Notas • ${followups.length} Seguimientos</span>
          </div>
          <div class="pc-list-items">
            ${tasks.map(t => {
              const isDone = t.status === 'COMPLETED';
              const textStyle = isDone ? 'text-decoration: line-through; opacity: 0.65;' : '';
              return `
                <div class="pc-chip task ${isDone ? 'completed' : ''}" data-task-id="${t.id}" style="padding:6px 10px;font-size:0.85rem;${textStyle}">
                  <span class="pc-chip-badge" style="background:#dbeafe;color:#1e40af;">TAREA [${t.priority}]</span>
                  <span style="flex:1;font-weight:600;">${this.escapeHtml(t.title)}</span>
                  ${t.due_time ? `<span>${t.due_time.substring(0,5)}</span>` : ''}
                </div>
              `;
            }).join('')}
            ${notes.map(n => `
              <div class="pc-chip note" data-note-id="${n.id}" style="background:${n.color || '#fef08a'};padding:6px 10px;font-size:0.85rem;">
                <span>📌 NOTA:</span>
                <span style="flex:1;font-weight:600;">${this.escapeHtml(n.title || n.content)}</span>
              </div>
            `).join('')}
            ${followups.map(f => {
              const isDone = f.status !== 'PENDING';
              const textStyle = isDone ? 'text-decoration: line-through; opacity: 0.65;' : '';
              return `
                <div class="pc-chip followup ${isDone ? 'concluded' : ''}" data-followup-id="${f.id}" style="padding:6px 10px;font-size:0.85rem;${textStyle}">
                  <span>🔔 SEGUIMIENTO [${f.status}]:</span>
                  <span style="flex:1;font-weight:600;">${this.escapeHtml(f.reason)}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    });
    html += `</div>`;
    return html;
  }

  // -------------------------------------------------------------
  // Helpers para el Selector de Destinatarios en los Modales
  // -------------------------------------------------------------
  renderRecipientScopeHtml() {
    const currentUserId = Number(this.currentUser?.id || 0);
    const staffOptions = (this.staffList || [])
      .filter(s => Number(s.id) !== currentUserId)
      .map(s => `
        <label class="pc-staff-checkbox-item">
          <input type="checkbox" name="assigned_user_ids" value="${s.id}" />
          <span>${this.escapeHtml(s.first_name)} ${this.escapeHtml(s.last_name)} (${this.escapeHtml(s.role_name || 'Personal')})</span>
        </label>
      `).join('');

    return `
      <div class="pc-scope-box">
        <label class="form-label" style="font-weight:700;margin-bottom:6px;">🎯 Destinatario / Alcance del Registro:</label>
        <div class="pc-scope-options">
          <label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:0.85rem;">
            <input type="radio" name="scope_mode" value="self" checked />
            <span>👤 Para mí (Personal)</span>
          </label>
          <label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:0.85rem;">
            <input type="radio" name="scope_mode" value="all" />
            <span>🌐 Para todos (Toda la clínica)</span>
          </label>
          <label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:0.85rem;">
            <input type="radio" name="scope_mode" value="specific" />
            <span>👥 Compañeros específicos</span>
          </label>
        </div>

        <div id="pc-staff-selector-container" style="display:none;margin-top:8px;">
          <span style="font-size:var(--text-xs);color:var(--color-text-secondary);display:block;margin-bottom:4px;">Selecciona uno o más compañeros que podrán ver este registro:</span>
          <div class="pc-staff-multiselect">
            ${staffOptions || '<span style="font-size:0.75rem;color:#94a3b8;">No hay otros empleados registrados</span>'}
          </div>
        </div>
      </div>
    `;
  }

  attachScopeEvents(modalBody) {
    const radios = modalBody.querySelectorAll('input[name="scope_mode"]');
    const container = modalBody.querySelector('#pc-staff-selector-container');
    const multiselect = modalBody.querySelector('.pc-staff-multiselect');
    radios.forEach(r => {
      r.addEventListener('change', async () => {
        if (container) {
          container.style.display = r.value === 'specific' ? 'block' : 'none';
          if (r.value === 'specific' && multiselect) {
            await this.ensureStaffLoaded();
            const currentUserId = this.currentUser?.id;
            const staffOptions = this.staffList
              .filter(s => s.id !== currentUserId)
              .map(s => `
                <label class="pc-staff-checkbox-item">
                  <input type="checkbox" name="assigned_user_ids" value="${s.id}" />
                  <span>${this.escapeHtml(s.first_name)} ${this.escapeHtml(s.last_name)} (${s.role_name})</span>
                </label>
              `).join('');
            if (staffOptions) {
              multiselect.innerHTML = staffOptions;
            }
          }
        }
      });
    });
  }

  parseScopePayload(formData) {
    const mode = formData.get('scope_mode') || 'self';
    if (mode === 'all') {
      return { is_team_visible: true, assigned_user_ids: [] };
    }
    if (mode === 'specific') {
      const selected = formData.getAll('assigned_user_ids').map(Number).filter(Boolean);
      return { is_team_visible: false, assigned_user_ids: selected };
    }
    // 'self'
    return { is_team_visible: false, assigned_user_ids: [this.currentUser?.id] };
  }

  // -------------------------------------------------------------
  // Modales de Creación
  // -------------------------------------------------------------
  async showAddTaskModal(defaults = {}) {
    await this.ensureStaffLoaded();
    const dueDate = defaults.date || this.toDateStr(this.currentDate);

    const content = `
      <form id="pc-task-form">
        <div class="form-group">
          <label class="form-label">Título de la Tarea *</label>
          <input type="text" name="title" class="form-input" placeholder="Ej: Revisar radiografías o pedir material" required />
        </div>
        <div class="form-group">
          <label class="form-label">Descripción / Detalles</label>
          <textarea name="description" class="form-input" rows="2" placeholder="Detalles de la tarea..."></textarea>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3);">
          <div class="form-group">
            <label class="form-label">Fecha Límite *</label>
            <input type="date" name="due_date" class="form-input" value="${dueDate}" required />
          </div>
          <div class="form-group">
            <label class="form-label">Hora (Opcional)</label>
            <input type="time" name="due_time" class="form-input" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Prioridad</label>
          <select name="priority" class="form-select">
            <option value="LOW">Baja</option>
            <option value="MEDIUM" selected>Media</option>
            <option value="HIGH">Alta</option>
            <option value="URGENT">Urgente</option>
          </select>
        </div>
        ${this.renderRecipientScopeHtml()}
      </form>
    `;

    Modal.show({
      title: '📋 Nueva Tarea',
      content,
      confirmText: 'Crear Tarea',
      onConfirm: async (modalEl) => {
        const form = modalEl.querySelector('#pc-task-form');
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        if (!data.title || !data.title.trim()) {
          toast.error('El título de la tarea es obligatorio');
          return false;
        }

        const scope = this.parseScopePayload(formData);
        const payload = {
          ...data,
          ...scope,
        };

        try {
          await taskService.createTask(payload);
          toast.success('Tarea creada exitosamente');
          await this.loadData();
          this.renderView();
          return true;
        } catch (err) {
          toast.error(err.message || 'Error al crear la tarea');
          return false;
        }
      }
    });

    setTimeout(() => {
      const modalEl = document.querySelector('.modal-body');
      if (modalEl) this.attachScopeEvents(modalEl);
    }, 50);
  }

  async showAddNoteModal(defaults = {}) {
    await this.ensureStaffLoaded();
    const noteDate = defaults.date || this.toDateStr(this.currentDate);

    const content = `
      <form id="pc-note-form">
        <div class="form-group">
          <label class="form-label">Fecha de la Nota *</label>
          <input type="date" name="note_date" class="form-input" value="${noteDate}" required />
        </div>
        <div class="form-group">
          <label class="form-label">Título (Opcional)</label>
          <input type="text" name="title" class="form-input" placeholder="Ej: Recordatorio personal o clínico" />
        </div>
        <div class="form-group">
          <label class="form-label">Contenido de la Nota *</label>
          <textarea name="content" class="form-input" rows="3" placeholder="Escribe tu nota aquí..." required></textarea>
        </div>
        <div style="display:flex;gap:var(--space-3);align-items:center;margin-bottom:var(--space-3);">
          <div class="form-group" style="margin:0;">
            <label class="form-label">Color:</label>
            <select name="color" class="form-select" style="width:auto;">
              <option value="#fef08a" selected>Amarillo 🟨</option>
              <option value="#bfdbfe">Azul 🟦</option>
              <option value="#bbf7d0">Verde 🟩</option>
              <option value="#fbcfe8">Rosa 🟪</option>
              <option value="#fed7aa">Naranja 🟧</option>
            </select>
          </div>
          <label style="display:flex;align-items:center;gap:4px;cursor:pointer;margin-top:18px;">
            <input type="checkbox" name="is_pinned" value="true" />
            <span>📌 Fijar nota</span>
          </label>
        </div>
        ${this.renderRecipientScopeHtml()}
      </form>
    `;

    Modal.show({
      title: '📌 Nueva Nota Adhesiva',
      content,
      confirmText: 'Guardar Nota',
      onConfirm: async (modalEl) => {
        const form = modalEl.querySelector('#pc-note-form');
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        if (!data.content || !data.content.trim()) {
          toast.error('El contenido de la nota no puede estar vacío');
          return false;
        }

        const scope = this.parseScopePayload(formData);
        const payload = {
          ...data,
          ...scope,
        };

        try {
          await taskService.createNote(payload);
          toast.success('Nota guardada');
          await this.loadData();
          this.renderView();
          return true;
        } catch (err) {
          toast.error(err.message || 'Error al guardar la nota');
          return false;
        }
      }
    });

    setTimeout(() => {
      const modalEl = document.querySelector('.modal-body');
      if (modalEl) this.attachScopeEvents(modalEl);
    }, 50);
  }

  async showAddFollowupModal(defaults = {}) {
    await this.ensureStaffLoaded();
    const fDate = defaults.date || this.toDateStr(this.currentDate);

    const content = `
      <form id="pc-followup-form">
        <div class="form-group">
          <label class="form-label">Paciente (Opcional)</label>
          <input type="text" id="pc-patient-search" class="form-input" placeholder="Buscar paciente por nombre o teléfono..." autocomplete="off" />
          <input type="hidden" name="patient_id" id="pc-patient-id" />
          <div id="pc-patient-results" style="max-height:120px;overflow-y:auto;background:#fff;border:1px solid #e2e8f0;border-radius:6px;display:none;margin-top:4px;"></div>
        </div>
        <div class="form-group">
          <label class="form-label">Fecha de Seguimiento *</label>
          <input type="date" name="followup_date" class="form-input" value="${fDate}" required />
        </div>
        <div class="form-group">
          <label class="form-label">Motivo del Seguimiento *</label>
          <input type="text" name="reason" class="form-input" placeholder="Ej: Control post-tratamiento o llamada" required />
        </div>
        <div class="form-group">
          <label class="form-label">Notas o Indicaciones</label>
          <textarea name="notes" class="form-input" rows="2" placeholder="Detalles de la llamada o evolución..."></textarea>
        </div>
        ${this.renderRecipientScopeHtml()}
      </form>
    `;

    Modal.show({
      title: '🔔 Nuevo Seguimiento',
      content,
      confirmText: 'Guardar Seguimiento',
      onConfirm: async (modalEl) => {
        const form = modalEl.querySelector('#pc-followup-form');
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        if (!data.reason || !data.reason.trim()) {
          toast.error('El motivo del seguimiento es obligatorio');
          return false;
        }

        const scope = this.parseScopePayload(formData);
        const payload = {
          ...data,
          ...scope,
        };

        try {
          await taskService.createFollowup(payload);
          toast.success('Seguimiento registrado exitosamente');
          await this.loadData();
          this.renderView();
          return true;
        } catch (err) {
          toast.error(err.message || 'Error al registrar seguimiento');
          return false;
        }
      }
    });

    setTimeout(() => {
      const modalEl = document.querySelector('.modal-body');
      if (modalEl) {
        this.attachScopeEvents(modalEl);

        const searchInput = modalEl.querySelector('#pc-patient-search');
        const patientIdInput = modalEl.querySelector('#pc-patient-id');
        const resultsEl = modalEl.querySelector('#pc-patient-results');

        if (searchInput && resultsEl) {
          searchInput.addEventListener('input', async () => {
            const q = searchInput.value.trim();
            if (q.length < 2) {
              resultsEl.style.display = 'none';
              return;
            }
            try {
              const res = await patientService.getAll({ search: q, limit: 5 });
              const patients = res.data || res.items || res || [];
              if (patients.length === 0) {
                resultsEl.style.display = 'none';
                return;
              }
              resultsEl.style.display = 'block';
              resultsEl.innerHTML = patients.map(p => `
                <div class="pc-patient-opt" data-id="${p.id}" data-name="${p.first_name} ${p.last_name}" style="padding:6px 10px;cursor:pointer;font-size:0.85rem;border-bottom:1px solid #f1f5f9;">
                  <strong>${p.first_name} ${p.last_name}</strong> (${p.custom_id || '#' + p.id})
                </div>
              `).join('');

              resultsEl.querySelectorAll('.pc-patient-opt').forEach(opt => {
                opt.addEventListener('click', () => {
                  patientIdInput.value = opt.dataset.id;
                  searchInput.value = opt.dataset.name;
                  resultsEl.style.display = 'none';
                });
              });
            } catch {
              resultsEl.style.display = 'none';
            }
          });
        }
      }
    }, 50);
  }

  // -------------------------------------------------------------
  // Modales de Detalle y Edición
  // -------------------------------------------------------------
  showTaskModal(taskId) {
    const task = this.tasksList.find(t => t.id === taskId);
    if (!task) return;

    const myId = this.currentUser?.id;
    const isOwner = (this.currentUser?.role_name || '').toLowerCase() === 'propietario';
    const isAuthor = task.created_by_user_id === myId;
    const canDelete = isAuthor || isOwner;

    const isDone = task.status === 'COMPLETED';
    const textStyle = isDone ? 'text-decoration: line-through; opacity: 0.7;' : '';

    let scopeLabel = '👤 Personal (Solo tú)';
    if (task.is_team_visible) scopeLabel = '🌐 Para todo el equipo';
    else if (task.assigned_first_name) scopeLabel = `👥 Para: ${task.assigned_first_name} ${task.assigned_last_name || ''}`;

    const content = `
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span class="priority-flag ${task.priority}">${task.priority}</span>
          <span class="badge ${isDone ? 'badge-success' : 'badge-primary'}">${task.status}</span>
        </div>
        <h3 style="margin:0;font-size:1.15rem;font-weight:700;${textStyle}">${this.escapeHtml(task.title)}</h3>
        <p style="color:var(--color-text-secondary);font-size:0.9rem;margin:0;${textStyle}">${this.escapeHtml(task.description || 'Sin descripción detallada')}</p>
        
        <div style="font-size:0.82rem;color:var(--color-text-secondary);background:#f8fafc;padding:10px;border-radius:6px;border:1px solid #e2e8f0;">
          <p style="margin:2px 0;">📅 Fecha Límite: <strong>${formatDate(task.due_date)}</strong> ${task.due_time ? 'a las ' + task.due_time.substring(0,5) : ''}</p>
          <p style="margin:2px 0;">🎯 Alcance: <strong>${scopeLabel}</strong></p>
          ${task.created_by_first_name ? `<p style="margin:2px 0;">✍️ Creado por: <strong>${task.created_by_first_name} ${task.created_by_last_name || ''}</strong></p>` : ''}
          ${task.patient_first_name ? `<p style="margin:2px 0;">📂 Paciente: <a href="#/patients/${task.patient_id}"><strong>${task.patient_first_name} ${task.patient_last_name}</strong></a></p>` : ''}
        </div>

        ${canDelete ? `
          <div style="display:flex;justify-content:flex-end;margin-top:6px;padding-top:8px;border-top:1px solid #f1f5f9;">
            <button type="button" class="btn btn-xs btn-outline" id="btn-delete-pc-task" style="color:#dc2626;border-color:#fca5a5;">
              🗑️ Eliminar Tarea
            </button>
          </div>
        ` : ''}
      </div>
    `;

    Modal.show({
      title: '📋 Detalle de la Tarea',
      content,
      confirmText: isDone ? 'Reabrir Tarea' : 'Marcar como Completada ✅',
      cancelText: 'Cerrar',
      onConfirm: async () => {
        const nextStatus = isDone ? 'PENDING' : 'COMPLETED';
        await taskService.updateTaskStatus(task.id, nextStatus);
        toast.success(nextStatus === 'COMPLETED' ? 'Tarea completada ✅' : 'Tarea reabierta');
        await this.loadData();
        this.renderView();
        return true;
      }
    });

    if (canDelete) {
      setTimeout(() => {
        const btn = document.getElementById('btn-delete-pc-task');
        if (btn) {
          btn.onclick = async () => {
            if (confirm('¿Está seguro de que desea eliminar esta tarea?')) {
              try {
                await taskService.deleteTask(task.id);
                toast.success('Tarea eliminada exitosamente');
                Modal.closeAll();
                await this.loadData();
                this.renderView();
              } catch (err) {
                toast.error(err.message || 'Error al eliminar tarea');
              }
            }
          };
        }
      }, 50);
    }
  }

  showNoteModal(noteId) {
    const note = this.notesList.find(n => n.id === noteId);
    if (!note) return;

    const myId = this.currentUser?.id;
    const isOwner = (this.currentUser?.role_name || '').toLowerCase() === 'propietario';
    const isAuthor = note.user_id === myId;
    const canDelete = isAuthor || isOwner || (note.assigned_to_user_id === myId);

    let scopeLabel = '👤 Personal (Solo tú)';
    if (note.is_team_visible) scopeLabel = '🌐 Para todo el equipo';
    else if (note.assigned_first_name) scopeLabel = `👥 Para: ${note.assigned_first_name} ${note.assigned_last_name || ''}`;

    const content = `
      <div style="padding:14px;border-radius:8px;background:${note.color || '#fef08a'};color:#374151;">
        <h4 style="margin:0 0 8px 0;font-size:1.05rem;font-weight:700;">${this.escapeHtml(note.title || 'Nota Adhesiva')}</h4>
        <p style="margin:0;font-size:0.92rem;line-height:1.5;">${this.escapeHtml(note.content)}</p>
        <div style="margin-top:12px;font-size:0.78rem;color:#6b7280;border-top:1px solid rgba(0,0,0,0.08);padding-top:6px;">
          <div>📅 ${formatDate(note.note_date)} • 🎯 ${scopeLabel}</div>
          ${note.author_first_name ? `<div>✍️ Creada por: <strong>${note.author_first_name} ${note.author_last_name || ''}</strong></div>` : ''}
        </div>
      </div>
    `;

    Modal.show({
      title: '📌 Nota Adhesiva',
      content,
      confirmText: canDelete ? '🗑️ Eliminar Nota' : 'Cerrar',
      cancelText: canDelete ? 'Cancelar' : '',
      onConfirm: async () => {
        if (!canDelete) return true;
        try {
          await taskService.deleteNote(note.id);
          toast.success('Nota eliminada');
          await this.loadData();
          this.renderView();
          return true;
        } catch (err) {
          toast.error('Error al eliminar nota');
          return false;
        }
      }
    });
  }

  showFollowupModal(followupId) {
    const f = this.followupsList.find(x => x.id === followupId);
    if (!f) return;

    const myId = this.currentUser?.id;
    const isOwner = (this.currentUser?.role_name || '').toLowerCase() === 'propietario';
    const isAuthor = f.created_by_user_id === myId;
    const canDelete = isAuthor || isOwner;

    const isDone = f.status !== 'PENDING';
    const textStyle = isDone ? 'text-decoration: line-through; opacity: 0.7;' : '';

    let scopeLabel = '👤 Personal (Solo tú)';
    if (f.is_team_visible) scopeLabel = '🌐 Para todo el equipo';
    else if (f.assigned_first_name) scopeLabel = `👥 Para: ${f.assigned_first_name} ${f.assigned_last_name || ''}`;

    const content = `
      <div style="display:flex;flex-direction:column;gap:10px;">
        <div style="display:flex;justify-content:space-between;">
          <span class="badge ${isDone ? 'badge-success' : 'badge-primary'}">${f.status}</span>
          <span style="font-size:0.8rem;color:var(--color-text-secondary);">📅 ${formatDate(f.followup_date)}</span>
        </div>
        ${f.patient_first_name ? `<h4 style="margin:0;font-size:1.05rem;${textStyle}">${this.escapeHtml(f.patient_first_name)} ${this.escapeHtml(f.patient_last_name || '')}</h4>` : ''}
        <p style="margin:0;font-size:0.92rem;font-weight:600;color:var(--primary-700);${textStyle}">Motivo: ${this.escapeHtml(f.reason)}</p>
        ${f.notes ? `<p style="margin:0;font-size:0.85rem;color:var(--color-text-secondary);${textStyle}">${this.escapeHtml(f.notes)}</p>` : ''}
        
        <div style="font-size:0.8rem;color:var(--color-text-secondary);background:#f8fafc;padding:8px;border-radius:6px;margin-top:4px;">
          <p style="margin:2px 0;">🎯 Alcance: <strong>${scopeLabel}</strong></p>
          ${f.author_first_name ? `<p style="margin:2px 0;">✍️ Creado por: <strong>${f.author_first_name} ${f.author_last_name || ''}</strong></p>` : ''}
          ${f.patient_phone ? `<p style="margin:2px 0;">📞 Teléfono: <strong>${f.patient_phone}</strong></p>` : ''}
        </div>

        ${canDelete ? `
          <div style="display:flex;justify-content:flex-end;margin-top:6px;padding-top:8px;border-top:1px solid #f1f5f9;">
            <button type="button" class="btn btn-xs btn-outline" id="btn-delete-pc-followup" style="color:#dc2626;border-color:#fca5a5;">
              🗑️ Eliminar Seguimiento
            </button>
          </div>
        ` : ''}
      </div>
    `;

    Modal.show({
      title: '🔔 Seguimiento',
      content,
      confirmText: f.status === 'CONTACTED' ? 'Marcar como Agendado' : (f.status === 'SCHEDULED' ? 'Reabrir Seguimiento' : 'Marcar como Contactado ✅'),
      cancelText: 'Cerrar',
      onConfirm: async () => {
        let nextStatus = 'CONTACTED';
        if (f.status === 'CONTACTED') nextStatus = 'SCHEDULED';
        else if (f.status === 'SCHEDULED') nextStatus = 'PENDING';

        try {
          await taskService.updateFollowupStatus(f.id, nextStatus);
          toast.success('Seguimiento actualizado');
          await this.loadData();
          this.renderView();
          return true;
        } catch (err) {
          toast.error('Error al actualizar seguimiento');
          return false;
        }
      }
    });

    if (canDelete) {
      setTimeout(() => {
        const btn = document.getElementById('btn-delete-pc-followup');
        if (btn) {
          btn.onclick = async () => {
            if (confirm('¿Está seguro de que desea eliminar este seguimiento?')) {
              try {
                await taskService.deleteFollowup(f.id);
                toast.success('Seguimiento eliminado exitosamente');
                Modal.closeAll();
                await this.loadData();
                this.renderView();
              } catch (err) {
                toast.error(err.message || 'Error al eliminar seguimiento');
              }
            }
          };
        }
      }, 50);
    }
  }

  // -------------------------------------------------------------
  // Controladores de Eventos
  // -------------------------------------------------------------
  initEventListeners() {
    this.container.addEventListener('click', async (e) => {
      // Views
      const viewBtn = e.target.closest('.cal-view-btn');
      if (viewBtn) {
        this.viewMode = viewBtn.dataset.view;
        this.renderView();
        return;
      }

      // Quick filter metric cards
      const quickCard = e.target.closest('[data-filter-quick]');
      if (quickCard) {
        const f = quickCard.dataset.filterQuick;
        this.filterType = this.filterType === f ? 'all' : f;
        this.renderView();
        return;
      }

      // Filter chips
      const filterChip = e.target.closest('.pc-filter-chip');
      if (filterChip) {
        this.filterType = filterChip.dataset.filter;
        this.renderView();
        return;
      }

      // Navigation
      if (e.target.id === 'pc-prev-btn') {
        if (this.viewMode === 'month') this.currentDate.setMonth(this.currentDate.getMonth() - 1);
        else if (this.viewMode === 'week') this.currentDate.setDate(this.currentDate.getDate() - 7);
        else this.currentDate.setDate(this.currentDate.getDate() - 1);
        await this.loadData();
        this.renderView();
        return;
      }
      if (e.target.id === 'pc-next-btn') {
        if (this.viewMode === 'month') this.currentDate.setMonth(this.currentDate.getMonth() + 1);
        else if (this.viewMode === 'week') this.currentDate.setDate(this.currentDate.getDate() + 7);
        else this.currentDate.setDate(this.currentDate.getDate() + 1);
        await this.loadData();
        this.renderView();
        return;
      }
      if (e.target.id === 'pc-today-btn') {
        this.currentDate = new Date();
        await this.loadData();
        this.renderView();
        return;
      }

      // Action buttons
      if (e.target.id === 'pc-add-task-btn') {
        this.showAddTaskModal();
        return;
      }
      if (e.target.id === 'pc-add-note-btn') {
        this.showAddNoteModal();
        return;
      }
      if (e.target.id === 'pc-add-followup-btn') {
        this.showAddFollowupModal();
        return;
      }

      // Add item on specific day from cell header
      const addCellBtn = e.target.closest('.btn-add-cell-item');
      if (addCellBtn) {
        const cell = addCellBtn.closest('[data-date]');
        const date = cell?.dataset.date;
        if (date) this.showAddTaskModal({ date });
        return;
      }
      const addDayDirect = e.target.closest('.btn-add-day-direct');
      if (addDayDirect) {
        const date = addDayDirect.dataset.date;
        if (date) this.showAddTaskModal({ date });
        return;
      }

      // Task toggle checkbox
      if (e.target.classList.contains('pc-task-toggle')) {
        const taskId = parseInt(e.target.dataset.taskId, 10);
        const nextStatus = e.target.checked ? 'COMPLETED' : 'PENDING';
        try {
          await taskService.updateTaskStatus(taskId, nextStatus);
          const task = this.tasksList.find(t => t.id === taskId);
          if (task) task.status = nextStatus;
          toast.success(nextStatus === 'COMPLETED' ? 'Tarea completada ✅' : 'Tarea reabierta');
          this.renderView();
        } catch (err) {
          toast.error('Error al actualizar tarea');
        }
        return;
      }

      // Item click
      const taskEl = e.target.closest('[data-task-id]');
      if (taskEl && !e.target.classList.contains('pc-task-toggle')) {
        const taskId = parseInt(taskEl.dataset.taskId, 10);
        this.showTaskModal(taskId);
        return;
      }
      const noteEl = e.target.closest('[data-note-id]');
      if (noteEl) {
        const noteId = parseInt(noteEl.dataset.noteId, 10);
        this.showNoteModal(noteId);
        return;
      }
      const followupEl = e.target.closest('[data-followup-id]');
      if (followupEl) {
        const followupId = parseInt(followupEl.dataset.followupId, 10);
        this.showFollowupModal(followupId);
        return;
      }
    });
  }
}

export default PersonalCalendarPage;
