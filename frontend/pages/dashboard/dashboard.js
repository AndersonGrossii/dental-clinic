// ============================================
// Vista del Dashboard Principal con Calendario de Citas
// ============================================
import reportService from '../../services/report.service.js';
import appointmentService from '../../services/appointment.service.js';
import state from '../../scripts/state.js';
import { formatCurrency, formatTime } from '../../utils/helpers.js';
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

  async render() {
    try {
      // Cargar datos iniciales del dashboard (que contienen estadísticas de "Hoy")
      const dashboardData = await reportService.getDashboard();
      const stats = dashboardData.stats || {};
      this.role = dashboardData.role || '';
      
      this._updateTodayDate();
      if (this.currentDate === this.todayDate) {
        this.appointmentsList = dashboardData.todayAppointments || [];
      } else {
        await this.loadAppointmentsForDate();
      }

      const user = state.get('user');
      const roleDisplayName = this.role.charAt(0).toUpperCase() + this.role.slice(1);

      let statsHtml = '';
      if (this.role === 'propietario') {
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
          </div>
        `;
      } else if (this.role === 'recepcionista') {
        statsHtml = `
          <div class="card stat-card">
            <div class="stat-card-title">Citas Programadas Hoy</div>
            <div class="stat-card-value">${stats.todayAppointmentsCount}</div>
          </div>
          <div class="card stat-card">
            <div class="stat-card-title">Facturas Pendientes</div>
            <div class="stat-card-value">${stats.pendingInvoicesCount}</div>
          </div>
          <div class="card stat-card">
            <div class="stat-card-title">Nuevos Pacientes Este Mes</div>
            <div class="stat-card-value">${stats.newPatientsThisMonth}</div>
          </div>
        `;
      } else { // Doctor
        statsHtml = `
          <div class="card stat-card">
            <div class="stat-card-title">Mis Citas Hoy</div>
            <div class="stat-card-value">${stats.todayAppointmentsCount}</div>
          </div>
          <div class="card stat-card">
            <div class="stat-card-title">Mis Pacientes Registrados</div>
            <div class="stat-card-value">${stats.myPatientsCount}</div>
          </div>
        `;
      }

      this.container.innerHTML = `
        <div class="page-header">
          <div>
            <h1 class="page-title">Dashboard</h1>
            <p style="color: var(--text-secondary);">Bienvenido al Sistema de Gestión de ${state.get('clinicInfo')?.name || 'Clinica Dental'}</p>
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

        <!-- Sección de Calendario de Citas del Día -->
        <div class="db-cal-container">
          <div class="db-cal-header">
            <div class="db-cal-title-section">
              <h3>Calendario de Citas</h3>
              <p id="db-cal-subtitle">Agenda diaria de consultas</p>
            </div>
            <div class="db-cal-nav">
              <button id="db-cal-prev" class="db-cal-btn" title="Día Anterior">◀</button>
              <div class="db-cal-picker-wrapper">
                <span id="db-cal-date-text" class="db-cal-date-display">Cargando fecha...</span>
                <button class="db-cal-btn" title="Seleccionar Fecha">📅
                  <input type="date" id="db-cal-picker-input" class="db-cal-picker" />
                </button>
              </div>
              <button id="db-cal-next" class="db-cal-btn" title="Día Siguiente">▶</button>
            </div>
          </div>
          <div id="db-cal-layout-container" class="db-cal-layout">
            <!-- El contenido dinámico del calendario se renderiza aquí -->
          </div>
        </div>
      `;

      this.renderCalendarContent();
    } catch (err) {
      toast.error('Error al cargar datos del Dashboard');
      this.container.innerHTML = `<div class="empty-state"><h3>Error al cargar Dashboard</h3><p>${err.message}</p></div>`;
    }
  }

  /**
   * Carga las citas de una fecha seleccionada usando el servicio de citas,
   * aplicando filtros basados en el rol (si es doctor, solo sus citas).
   */
  async loadAppointmentsForDate() {
    try {
      const user = state.get('user');
      const params = {
        date_from: this.currentDate,
        date_to: this.currentDate,
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
      toast.error('Error al cargar citas de la fecha seleccionada');
      this.appointmentsList = [];
    }
  }

  /**
   * Renderiza el contenido interno del calendario (sidebar y línea de tiempo).
   */
  renderCalendarContent() {
    const layoutContainer = this.container.querySelector('#db-cal-layout-container');
    const dateText = this.container.querySelector('#db-cal-date-text');
    const pickerInput = this.container.querySelector('#db-cal-picker-input');
    
    if (!layoutContainer) return;

    // Actualizar texto de fecha visible y valor del date picker
    dateText.textContent = this.formatDateFriendly(this.currentDate);
    if (pickerInput) {
      pickerInput.value = this.currentDate;
    }

    // Calcular estadísticas para el sidebar del calendario
    const totalAppointments = this.appointmentsList.length;
    const completedAppointments = this.appointmentsList.filter(
      app => (app.status_name || '').toLowerCase() === 'completada'
    ).length;
    const pendingAppointments = this.appointmentsList.filter(
      app => (app.status_name || '').toLowerCase() === 'programada' || (app.status_name || '').toLowerCase() === 'confirmada'
    ).length;

    const sidebarHtml = `
      <div class="db-cal-sidebar">
        <div class="db-cal-stat-box">
          <div class="db-cal-stat-num">${totalAppointments}</div>
          <div class="db-cal-stat-label">Citas Programadas</div>
        </div>
        <div class="db-cal-stat-box">
          <div class="db-cal-stat-num" style="color: var(--success-600);">${completedAppointments}</div>
          <div class="db-cal-stat-label">Completadas</div>
        </div>
        <div class="db-cal-stat-box">
          <div class="db-cal-stat-num" style="color: var(--info-600);">${pendingAppointments}</div>
          <div class="db-cal-stat-label">Pendientes / Activas</div>
        </div>
      </div>
    `;

    // Horas a mostrar en el timeline
    const hours = ['08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18'];
    
    const timelineHtml = hours.map(hour => {
      // Filtrar citas que inician en esta hora
      const apptsInHour = this.appointmentsList.filter(app => {
        if (!app.start_time) return false;
        const appHour = app.start_time.split(':')[0];
        return appHour === hour;
      });

      let eventsHtml = '';
      if (apptsInHour.length === 0) {
        eventsHtml = `<div class="db-cal-empty-slot">Sin citas programadas</div>`;
      } else {
        eventsHtml = apptsInHour.map(app => {
          const doctorNameHtml = this.role !== 'doctor' 
            ? `<span style="font-weight: var(--font-medium); opacity: 0.9;">Dr(a): ${app.doctor_name || 'Sin asignar'}</span>` 
            : '';
          
          return `
            <div class="db-cal-event-card" style="background-color: ${app.status_color || 'var(--primary-600)'};" data-id="${app.id}">
              <div class="db-cal-event-time">
                ${formatTime(app.start_time)} - ${formatTime(app.end_time)}
              </div>
              <div class="db-cal-event-patient">
                ${app.patient_name || 'Paciente sin nombre'}
              </div>
              <div class="db-cal-event-details">
                ${doctorNameHtml}
                <span class="db-cal-event-badge">${app.status_label || 'Programada'}</span>
              </div>
            </div>
          `;
        }).join('');
      }

      const hourLabel = parseInt(hour, 10) >= 12 
        ? `${hour}:00 PM` 
        : `${hour}:00 AM`;

      return `
        <div class="db-cal-hour-row">
          <div class="db-cal-hour-label">${hourLabel}</div>
          <div class="db-cal-events">
            ${eventsHtml}
          </div>
        </div>
      `;
    }).join('');

    layoutContainer.innerHTML = `
      ${sidebarHtml}
      <div class="db-cal-timeline">
        ${timelineHtml}
      </div>
    `;
  }

  /**
   * Modifica la fecha actual sumando/restando días y refresca los datos del calendario.
   */
  async changeDate(daysOffset) {
    const date = new Date(this.currentDate + 'T12:00:00'); // Evitar problemas de huso horario
    date.setDate(date.getDate() + daysOffset);
    this.currentDate = date.toISOString().split('T')[0];

    const subtitleElement = this.container.querySelector('#db-cal-subtitle');
    if (subtitleElement) {
      subtitleElement.textContent = 'Actualizando agenda...';
    }

    this._updateTodayDate();
    if (this.currentDate === this.todayDate) {
      // Si volvemos a hoy, podemos re-cargar del dashboard o recargar directamente
      const dashboardData = await reportService.getDashboard();
      this.appointmentsList = dashboardData.todayAppointments || [];
    } else {
      await this.loadAppointmentsForDate();
    }

    if (subtitleElement) {
      subtitleElement.textContent = 'Agenda del día seleccionado';
    }

    this.renderCalendarContent();
  }

  /**
   * Formatea un string YYYY-MM-DD a un texto amigable: "Lunes, 29 de junio de 2026"
   */
  formatDateFriendly(dateStr) {
    const parts = dateStr.split('-');
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    return date.toLocaleDateString('es-MX', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  mount() {
    // Botón Día Anterior
    const prevBtn = this.container.querySelector('#db-cal-prev');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => this.changeDate(-1));
    }

    // Botón Día Siguiente
    const nextBtn = this.container.querySelector('#db-cal-next');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => this.changeDate(1));
    }

    // Input Date Picker
    const pickerInput = this.container.querySelector('#db-cal-picker-input');
    if (pickerInput) {
      pickerInput.addEventListener('change', async (e) => {
        const val = e.target.value;
        if (val) {
          this.currentDate = val;
          const subtitleElement = this.container.querySelector('#db-cal-subtitle');
          if (subtitleElement) subtitleElement.textContent = 'Actualizando agenda...';
          
          this._updateTodayDate();
          if (this.currentDate === this.todayDate) {
            const dashboardData = await reportService.getDashboard();
            this.appointmentsList = dashboardData.todayAppointments || [];
          } else {
            await this.loadAppointmentsForDate();
          }
          
          if (subtitleElement) subtitleElement.textContent = 'Agenda del día seleccionado';
          this.renderCalendarContent();
        }
      });
    }

    // Redirección al hacer click en una tarjeta de cita
    const layoutContainer = this.container.querySelector('#db-cal-layout-container');
    if (layoutContainer) {
      layoutContainer.addEventListener('click', (e) => {
        const card = e.target.closest('.db-cal-event-card');
        if (card) {
          const apptId = card.getAttribute('data-id');
          // Redirige a la página de citas
          window.location.hash = `#/appointments`;
        }
      });
    }
  }
}
