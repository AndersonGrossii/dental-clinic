// ============================================
// Vista de Agenda por Gabinetes
// ============================================
import appointmentService from '../../services/appointment.service.js';
import toast from '../../components/toast/toast.js';
import state from '../../scripts/state.js';
import { formatDate } from '../../utils/helpers.js';

export class Cabinets {
  constructor(container) {
    this.container = container;
    this.currentDate = new Date();
    this.viewMode = 'week'; // 'week' o 'day'
    this.selectedCabinet = 'Gabinete 1'; // 'Gabinete 1' o 'Gabinete 2'
    this.appointmentsList = [];
  }

  async render() {
    try {
      await this.loadAppointments();
      this.renderView();
      this.mount();
    } catch (err) {
      toast.error('Error al cargar la agenda de gabinetes');
      this.container.innerHTML = `<div class="empty-state"><h3>Error al cargar</h3><p>${err.message}</p></div>`;
    }
  }

  async loadAppointments() {
    const mon = this.getMonday(this.currentDate);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);

    const params = {
      date_from: this.toDateStr(mon),
      date_to: this.toDateStr(sun),
      limit: 999,
      sortBy: 'a.start_time',
      sortOrder: 'ASC'
    };

    // Obtener todas las citas de la semana
    this.appointmentsList = await appointmentService.getAll(params) || [];
  }

  renderView() {
    const todayStr = this.toDateStr(new Date());
    const mon = this.getMonday(this.currentDate);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);

    const dateRangeStr = this.viewMode === 'week'
      ? `Semana del ${formatDate(this.toDateStr(mon))} al ${formatDate(this.toDateStr(sun))}`
      : `Día: ${formatDate(this.toDateStr(this.currentDate))}`;

    const contentHtml = this.viewMode === 'week'
      ? this.renderWeekView()
      : this.renderDayView();

    this.container.innerHTML = `
      <div class="page-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-6); flex-wrap: wrap; gap: var(--space-4);">
        <div>
          <h1 class="page-title">Agenda por Gabinetes</h1>
          <p style="color: var(--text-secondary); margin-top: 2px;">Visualización del uso de Gabinete 1 y Gabinete 2</p>
        </div>
        
        <div style="display: flex; gap: var(--space-2); align-items: center;">
          <!-- Navegación de Fecha -->
          <div class="btn-group">
            <button id="cab-prev-btn" class="btn btn-secondary btn-sm">◀</button>
            <button id="cab-today-btn" class="btn btn-secondary btn-sm">Hoy</button>
            <button id="cab-next-btn" class="btn btn-secondary btn-sm">▶</button>
          </div>
          
          <span style="font-weight: 600; font-size: var(--text-sm); color: var(--color-text); margin: 0 var(--space-2);">${dateRangeStr}</span>

          <!-- Alternar Vista Semana / Día -->
          <div class="btn-group">
            <button id="cab-view-week" class="btn btn-sm ${this.viewMode === 'week' ? 'btn-primary' : 'btn-ghost'}">Semana</button>
            <button id="cab-view-day" class="btn btn-sm ${this.viewMode === 'day' ? 'btn-primary' : 'btn-ghost'}">Día</button>
          </div>

          <!-- Selector de Gabinete (solo para vista semanal) -->
          ${this.viewMode === 'week' ? `
            <select id="cab-cabinet-select" class="form-select" style="width: auto; margin-left: var(--space-2);">
              <option value="Gabinete 1" ${this.selectedCabinet === 'Gabinete 1' ? 'selected' : ''}>Gabinete 1</option>
              <option value="Gabinete 2" ${this.selectedCabinet === 'Gabinete 2' ? 'selected' : ''}>Gabinete 2</option>
            </select>
          ` : ''}
        </div>
      </div>

      <div class="card" style="padding: var(--space-4); overflow-x: auto; background-color: var(--color-surface); border: 1px solid var(--color-border-light);">
        ${contentHtml}
      </div>
    `;
  }

  renderWeekView() {
    const mon = this.getMonday(this.currentDate);
    const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const todayStr = this.toDateStr(new Date());

    // Crear slots de 30 min de 9:00 a 20:00
    const slots = [];
    for (let m = 540; m < 1200; m += 30) {
      slots.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
    }

    let cells = '';

    // Encabezado de Hora
    cells += `<div class="db-wg-time-header">Hora</div>`;
    
    // Encabezados de Días
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

    // Renderizar slots
    slots.forEach(slot => {
      cells += `<div class="db-wg-time-label">${slot}</div>`;
      
      for (let i = 0; i < 7; i++) {
        const date = new Date(mon);
        date.setDate(mon.getDate() + i);
        const dateStr = this.toDateStr(date);
        const isWeekend = i >= 5;

        // Filtrar citas para este día, este slot, y el gabinete seleccionado
        const slotEndMin = parseInt(slot.split(':')[0]) * 60 + parseInt(slot.split(':')[1]) + 30;
        const slotEndStr = `${String(Math.floor(slotEndMin / 60)).padStart(2, '0')}:${String(slotEndMin % 60).padStart(2, '0')}`;

        const appts = this.appointmentsList.filter(a => {
          if (a.appointment_date.substring(0, 10) !== dateStr) return false;
          if (a.gabinete !== this.selectedCabinet) return false;
          
          const s = a.start_time.substring(0, 5);
          const e = a.end_time.substring(0, 5);
          return s < slotEndStr && e > slot;
        });

        let eventsHtml = '';
        appts.forEach(appt => {
          const docColor = appt.doctor?.color || '#0891b2';
          eventsHtml += `
            <div class="db-wg-event" style="background-color: color-mix(in srgb, ${docColor} 12%, var(--color-surface)) !important; border: 1.5px solid ${docColor} !important; border-radius: var(--radius-sm); padding: 4px; display: flex; flex-direction: column; margin-bottom: 2px;" title="Doctor/a: Dr/a. ${appt.doctor_name || ''}">
              <div style="font-weight: 600; font-size: 10px; color: var(--color-text); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">
                ${appt.patient_name || '—'}
              </div>
              <div style="font-size: 8px; color: var(--color-text-secondary); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">
                Dr/a. ${appt.doctor?.lastName || appt.doctor_name || ''}
              </div>
              <div style="font-size: 8px; color: ${appt.status_color || '#6b7280'}; font-weight: 500;">
                ● ${appt.status_label || appt.status_name}
              </div>
            </div>
          `;
        });

        if (isWeekend) {
          cells += `<div class="db-wg-cell weekend">${eventsHtml}</div>`;
        } else {
          cells += `<div class="db-wg-cell">${eventsHtml}</div>`;
        }
      }
    });

    return `<div class="db-wg-grid">${cells}</div>`;
  }

  renderDayView() {
    const dateStr = this.toDateStr(this.currentDate);
    const isWeekendDay = this.currentDate.getDay() === 0 || this.currentDate.getDay() === 6;

    // Slots de 30 min de 9:00 a 20:00
    const slots = [];
    for (let m = 540; m < 1200; m += 30) {
      slots.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
    }

    let cells = '';

    // Encabezado de la cuadrícula
    cells += `<div class="db-wg-time-header">Hora</div>`;
    cells += `<div class="db-wg-day-header today" style="text-align: center; font-weight: 700;">Gabinete 1</div>`;
    cells += `<div class="db-wg-day-header today" style="text-align: center; font-weight: 700;">Gabinete 2</div>`;

    slots.forEach(slot => {
      cells += `<div class="db-wg-time-label">${slot}</div>`;
      
      const slotEndMin = parseInt(slot.split(':')[0]) * 60 + parseInt(slot.split(':')[1]) + 30;
      const slotEndStr = `${String(Math.floor(slotEndMin / 60)).padStart(2, '0')}:${String(slotEndMin % 60).padStart(2, '0')}`;

      // Gabinete 1
      const appts1 = this.appointmentsList.filter(a => {
        if (a.appointment_date.substring(0, 10) !== dateStr) return false;
        if (a.gabinete !== 'Gabinete 1') return false;
        const s = a.start_time.substring(0, 5);
        const e = a.end_time.substring(0, 5);
        return s < slotEndStr && e > slot;
      });

      // Gabinete 2
      const appts2 = this.appointmentsList.filter(a => {
        if (a.appointment_date.substring(0, 10) !== dateStr) return false;
        if (a.gabinete !== 'Gabinete 2') return false;
        const s = a.start_time.substring(0, 5);
        const e = a.end_time.substring(0, 5);
        return s < slotEndStr && e > slot;
      });

      const renderEvents = (appts) => {
        return appts.map(appt => {
          const docColor = appt.doctor?.color || '#0891b2';
          return `
            <div class="db-wg-event" style="background-color: color-mix(in srgb, ${docColor} 12%, var(--color-surface)) !important; border: 1.5px solid ${docColor} !important; border-radius: var(--radius-sm); padding: 6px; display: flex; flex-direction: column; height: 100%; justify-content: center;" title="Doctor/a: Dr/a. ${appt.doctor_name || ''}">
              <div style="font-weight: 600; font-size: 11px; color: var(--color-text); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">
                ${appt.patient_name || '—'}
              </div>
              <div style="font-size: 9px; color: var(--color-text-secondary); text-overflow: ellipsis; overflow: hidden; white-space: nowrap; margin-top: 1px;">
                Doctor: Dr/a. ${appt.doctor?.lastName || appt.doctor_name || ''}
              </div>
              <div style="font-size: 9px; color: ${appt.status_color || '#6b7280'}; font-weight: 600; margin-top: 2px;">
                ● ${appt.status_label || appt.status_name}
              </div>
            </div>
          `;
        }).join('');
      };

      cells += `<div class="db-wg-cell ${isWeekendDay ? 'weekend' : ''}">${renderEvents(appts1)}</div>`;
      cells += `<div class="db-wg-cell ${isWeekendDay ? 'weekend' : ''}">${renderEvents(appts2)}</div>`;
    });

    return `<div class="db-wg-grid" style="grid-template-columns: 80px 1fr 1fr;">${cells}</div>`;
  }

  mount() {
    // Evento anterior
    const prevBtn = this.container.querySelector('#cab-prev-btn');
    if (prevBtn) {
      prevBtn.addEventListener('click', async () => {
        const offset = this.viewMode === 'week' ? 7 : 1;
        this.currentDate.setDate(this.currentDate.getDate() - offset);
        await this.render();
      });
    }

    // Evento hoy
    const todayBtn = this.container.querySelector('#cab-today-btn');
    if (todayBtn) {
      todayBtn.addEventListener('click', async () => {
        this.currentDate = new Date();
        await this.render();
      });
    }

    // Evento siguiente
    const nextBtn = this.container.querySelector('#cab-next-btn');
    if (nextBtn) {
      nextBtn.addEventListener('click', async () => {
        const offset = this.viewMode === 'week' ? 7 : 1;
        this.currentDate.setDate(this.currentDate.getDate() + offset);
        await this.render();
      });
    }

    // Cambiar a vista de semana
    const viewWeek = this.container.querySelector('#cab-view-week');
    if (viewWeek) {
      viewWeek.addEventListener('click', async () => {
        this.viewMode = 'week';
        this.renderView();
        this.mount();
      });
    }

    // Cambiar a vista de día
    const viewDay = this.container.querySelector('#cab-view-day');
    if (viewDay) {
      viewDay.addEventListener('click', async () => {
        this.viewMode = 'day';
        this.renderView();
        this.mount();
      });
    }

    // Cambiar gabinete seleccionado
    const cabinetSelect = this.container.querySelector('#cab-cabinet-select');
    if (cabinetSelect) {
      cabinetSelect.addEventListener('change', async (e) => {
        this.selectedCabinet = e.target.value;
        this.renderView();
        this.mount();
      });
    }
  }

  // Helpers
  getMonday(d) {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(date.setDate(diff));
  }

  toDateStr(date) {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
