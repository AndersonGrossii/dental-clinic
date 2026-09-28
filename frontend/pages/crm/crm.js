import crmService from '../../services/crm.service.js';
import patientService from '../../services/patient.service.js';
import userService from '../../services/user.service.js';
import aiService from '../../services/ai.service.js';
import toast from '../../components/toast/toast.js';
import Modal from '../../components/modal/modal.js';
import { formatCurrency, formatDate } from '../../utils/helpers.js';

export class CrmPage {
  constructor(container) {
    this.container = container;
    this.activeTab = 'leads'; // 'leads' | 'opportunities' | 'dashboard'
    this.leadsViewMode = 'table'; // 'table' | 'kanban'
    this.oppsViewMode = 'kanban'; // 'kanban' | 'table'
    this.leadsData = { rows: [], total: 0 };
    this.opportunitiesData = { rows: [], total: 0 };
    this.dashboardKPIs = null;
    this.searchQuery = '';
    this.statusFilter = '';
    this.sourceFilter = '';
    this.currentPage = 1;
    this.pageSize = 15;
    this.isLoading = false;
  }

  async render() {
    this.injectStyles();
    await this.loadInitialData();
    this.renderLayout();
    this.renderActiveTab();
    this.bindEvents();
  }

  injectStyles() {
    let link = document.getElementById('crm-styles');
    if (!link) {
      link = document.createElement('link');
      link.id = 'crm-styles';
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    link.href = 'pages/crm/crm.css?v=24';
  }

  async loadInitialData() {
    this.isLoading = true;
    try {
      // Siempre obtener KPIs del Dashboard para sincronizar contadores globales y píldoras
      const dashboardPromise = crmService.getDashboard().catch(err => {
        console.warn('No se pudieron cargar KPIs del CRM:', err);
        return null;
      });

      if (this.activeTab === 'leads') {
        const limit = this.leadsViewMode === 'kanban' ? 100 : this.pageSize;
        const [kpiRes, res] = await Promise.all([
          dashboardPromise,
          crmService.getLeads({
            status: this.statusFilter || undefined,
            source: this.sourceFilter || undefined,
            search: this.searchQuery || undefined,
            page: this.currentPage,
            limit,
          }),
        ]);

        if (kpiRes) this.dashboardKPIs = kpiRes;

        if (res && Array.isArray(res.rows)) {
          this.leadsData = res;
        } else if (Array.isArray(res)) {
          this.leadsData = { rows: res, total: res.length };
        } else if (res && Array.isArray(res.data)) {
          this.leadsData = { rows: res.data, total: res.pagination?.total ?? res.data.length };
        } else {
          this.leadsData = { rows: [], total: 0 };
        }
      } else if (this.activeTab === 'opportunities') {
        const [kpiRes, res] = await Promise.all([
          dashboardPromise,
          crmService.getOpportunities({
            status: this.statusFilter || undefined,
            search: this.searchQuery || undefined,
            page: this.currentPage,
            limit: 100, // Cargar suficientes para el pipeline Kanban y Tabla
          }),
        ]);

        if (kpiRes) this.dashboardKPIs = kpiRes;

        if (res && Array.isArray(res.rows)) {
          this.opportunitiesData = res;
        } else if (Array.isArray(res)) {
          this.opportunitiesData = { rows: res, total: res.length };
        } else if (res && Array.isArray(res.data)) {
          this.opportunitiesData = { rows: res.data, total: res.pagination?.total ?? res.data.length };
        } else {
          this.opportunitiesData = { rows: [], total: 0 };
        }
      } else if (this.activeTab === 'dashboard') {
        this.dashboardKPIs = await dashboardPromise;
      }
    } catch (err) {
      toast.error('Error al cargar datos del CRM: ' + (err.message || 'Error desconocido'));
    } finally {
      this.isLoading = false;
    }
  }

  renderLayout() {
    const totalLeads = this.dashboardKPIs?.leads?.total_leads ?? this.leadsData.total ?? 0;
    const newLeads = this.dashboardKPIs?.leads?.new_leads ?? 0;
    const totalOpps = this.dashboardKPIs?.opportunities?.total_opportunities ?? this.opportunitiesData.total ?? 0;
    const pipelineValue = formatCurrency(this.dashboardKPIs?.opportunities?.open_pipeline_value || 0);

    this.container.innerHTML = `
      <!-- Cabecera Principal del Módulo CRM -->
      <div class="crm-header animate-fade-in">
        <div class="crm-header__main">
          <div class="crm-header__title-row">
            <h1 class="crm-header__title">🎯 CRM & Embudo Comercial</h1>
          </div>
          <p class="crm-header__subtitle">
            Captación de prospectos, pipeline de oportunidades comerciales y trazabilidad omnicanal de pacientes.
          </p>
          <div class="crm-header__stats">
            <span class="crm-header-stat">
              👥 <strong>${totalLeads}</strong> Leads registrados
            </span>
            <span class="crm-header-stat crm-header-stat--new">
              🆕 <strong>${newLeads}</strong> Nuevos sin contactar
            </span>
            <span class="crm-header-stat crm-header-stat--pipeline">
              💶 <strong>${pipelineValue}</strong> en Pipeline activo
            </span>
          </div>
        </div>

        <div class="crm-header__actions">
          <button id="btn-new-lead" class="btn btn-primary crm-btn-primary" title="Registrar nuevo contacto o lead comercial">
            <span>➕</span> Nuevo Lead
          </button>
          <button id="btn-new-opp" class="btn btn-secondary crm-btn-secondary" title="Crear nueva oportunidad de tratamiento presupuestado">
            <span>💼</span> Nueva Oportunidad
          </button>
        </div>
      </div>

      <!-- Navegación Segmentada por Pestañas -->
      <div class="crm-tabs-nav">
        <div class="crm-segmented-tabs">
          <button class="crm-tab-btn ${this.activeTab === 'leads' ? 'is-active' : ''} tab-switch" data-tab="leads">
            <span>👥 Leads</span>
            <span class="crm-tab-badge">${totalLeads}</span>
          </button>
          <button class="crm-tab-btn ${this.activeTab === 'opportunities' ? 'is-active' : ''} tab-switch" data-tab="opportunities">
            <span>📈 Oportunidades</span>
            <span class="crm-tab-badge">${totalOpps}</span>
          </button>
          <button class="crm-tab-btn ${this.activeTab === 'dashboard' ? 'is-active' : ''} tab-switch" data-tab="dashboard">
            <span>📊 Métricas & Embudo</span>
          </button>
        </div>
      </div>

      <!-- Contenedor del contenido dinámico de la pestaña -->
      <div id="crm-tab-content"></div>
    `;
  }

  renderActiveTab() {
    const content = document.getElementById('crm-tab-content');
    if (!content) return;

    if (this.activeTab === 'leads') {
      content.innerHTML = this.renderLeadsView();
    } else if (this.activeTab === 'opportunities') {
      content.innerHTML = this.renderOpportunitiesView();
    } else if (this.activeTab === 'dashboard') {
      content.innerHTML = this.renderDashboardView();
    }

    this.bindTabSpecificEvents();
  }

  renderLeadsView() {
    const rows = this.leadsData.rows || [];
    const kpis = this.dashboardKPIs?.leads || {};

    const statusPills = [
      { key: '', label: 'Todos', count: kpis.total_leads ?? this.leadsData.total ?? 0, icon: '📋' },
      { key: 'new', label: 'Nuevos', count: kpis.new_leads ?? 0, icon: '🆕' },
      { key: 'contacted', label: 'Contactados', count: kpis.contacted_leads ?? 0, icon: '📞' },
      { key: 'qualified', label: 'Calificados', count: kpis.qualified_leads ?? 0, icon: '⭐' },
      { key: 'appointment_scheduled', label: 'Con Cita', count: kpis.appointment_scheduled_leads ?? 0, icon: '📅' },
      { key: 'converted', label: 'Convertidos', count: kpis.converted_leads ?? 0, icon: '🦷' },
      { key: 'lost', label: 'Perdidos', count: kpis.lost_leads ?? 0, icon: '❌' },
    ];

    return `
      <!-- Barra de Filtros Rápidos (Chips de Estado) -->
      <div class="crm-quick-filters">
        ${statusPills.map(p => `
          <button 
            type="button" 
            class="crm-filter-pill ${this.statusFilter === p.key ? 'is-active' : ''}" 
            data-status="${p.key}"
          >
            <span>${p.icon}</span>
            <span>${p.label}</span>
            <span class="crm-filter-pill__count">${p.count}</span>
          </button>
        `).join('')}
      </div>

      <!-- Toolbar de Búsqueda y Modos de Vista -->
      <div class="crm-toolbar">
        <div class="crm-toolbar__left">
          <div class="crm-search-wrapper">
            <span class="crm-search-icon">🔍</span>
            <input 
              type="text" 
              id="lead-search-input" 
              class="form-control form-control-sm crm-search-input" 
              placeholder="Buscar por nombre, teléfono, interés, expediente..." 
              value="${this.escapeHtml(this.searchQuery)}"
            />
          </div>

          <select id="lead-source-filter" class="form-control form-control-sm" style="min-width: 170px;">
            <option value="">🌐 Todos los Orígenes</option>
            <option value="whatsapp" ${this.sourceFilter === 'whatsapp' ? 'selected' : ''}>WhatsApp</option>
            <option value="instagram" ${this.sourceFilter === 'instagram' ? 'selected' : ''}>Instagram</option>
            <option value="website" ${this.sourceFilter === 'website' ? 'selected' : ''}>Sitio Web</option>
            <option value="manual" ${this.sourceFilter === 'manual' ? 'selected' : ''}>Manual / Presencial</option>
            <option value="other" ${this.sourceFilter === 'other' ? 'selected' : ''}>Otro</option>
          </select>
        </div>

        <div class="crm-toolbar__right">
          <!-- Conmutador de Vistas Tabla vs Kanban -->
          <div class="crm-view-switcher">
            <button 
              type="button" 
              class="crm-view-btn ${this.leadsViewMode === 'table' ? 'is-active' : ''}" 
              data-mode="table" 
              title="Vista de Tabla / Lista"
            >
              <span>📋</span> Lista
            </button>
            <button 
              type="button" 
              class="crm-view-btn ${this.leadsViewMode === 'kanban' ? 'is-active' : ''}" 
              data-mode="kanban" 
              title="Vista de Embudo Kanban"
            >
              <span>🗂️</span> Embudo Kanban
            </button>
          </div>

          <div style="font-size: 0.85rem; color: var(--text-secondary);">
            Mostrando <strong>${rows.length}</strong> de <strong>${this.leadsData.total || 0}</strong>
          </div>
        </div>
      </div>

      <!-- Contenedor Principal: Vista de Tabla o Embudo Kanban -->
      ${this.leadsViewMode === 'kanban' ? this.renderLeadsKanban(rows) : this.renderLeadsTable(rows)}
    `;
  }

  renderLeadsTable(rows) {
    if (rows.length === 0) {
      return `
        <div class="crm-table-container">
          <div class="crm-empty-state">
            <div class="crm-empty-state__icon">🔍</div>
            <h3 class="crm-empty-state__title">No se encontraron leads</h3>
            <p class="crm-empty-state__subtitle">
              No hay prospectos comerciales que coincidan con los filtros aplicados. Prueba limpiando la búsqueda o el filtro de estado.
            </p>
          </div>
        </div>
      `;
    }

    return `
      <div class="crm-table-container">
        <div class="table-responsive">
          <table class="crm-table">
            <thead>
              <tr>
                <th>Contacto / Lead</th>
                <th>Canal de Origen</th>
                <th>Tratamiento de Interés</th>
                <th>Estado del Embudo</th>
                <th>Oportunidades</th>
                <th>Notas</th>
                <th>Fecha de Registro</th>
                <th style="text-align: right; min-width: 170px;">Acciones Rápidas</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(lead => `
                <tr class="lead-row" data-id="${lead.id}" style="cursor: pointer;">
                  <td>
                    <div style="display: flex; align-items: center; gap: 10px;">
                      <div class="crm-lead-card__avatar">
                        ${(lead.contact_name || lead.contact_phone || 'L')[0].toUpperCase()}
                      </div>
                      <div>
                        <div style="font-weight: 700; color: var(--text-primary);">
                          ${this.escapeHtml(lead.contact_name || lead.contact_phone)}
                        </div>
                        <div style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 2px;">
                          📞 ${this.escapeHtml(lead.contact_phone)} ${lead.contact_email ? `&bull; ✉️ ${this.escapeHtml(lead.contact_email)}` : ''}
                        </div>
                        ${lead.patient_id ? `
                          <span class="badge badge--patient-linked" style="margin-top: 4px;">
                            <a href="#/patients/${lead.patient_id}" onclick="event.stopPropagation();">
                              🦷 Paciente #${lead.patient_custom_id || lead.patient_id}
                            </a>
                          </span>
                        ` : ''}
                        ${lead.ai_score !== null && lead.ai_score !== undefined ? `
                          <div style="margin-top: 4px; display: flex; gap: 4px; align-items: center; flex-wrap: wrap;">
                            <span class="badge" style="background: ${lead.ai_score >= 80 ? '#fef3c7; color:#b45309; border: 1px solid #fde68a;' : lead.ai_score >= 50 ? '#eff6ff; color:#1d4ed8; border: 1px solid #bfdbfe;' : '#f3f4f6; color:#6b7280;'}; font-weight: 700; font-size: 0.72rem; padding: 1px 6px;">
                              🔥 IA: ${lead.ai_score}/100
                            </span>
                            ${lead.ai_urgency === 'HIGH' ? `<span class="badge" style="background:#fee2e2; color:#b91c1c; font-weight:700; font-size:0.68rem; padding: 1px 6px;">⚠️ Urgente</span>` : lead.ai_urgency === 'MEDIUM' ? `<span class="badge" style="background:#fef9c3; color:#854d0e; font-size:0.68rem; padding: 1px 6px;">⚡ Media</span>` : ''}
                            ${lead.ai_recommended_action ? `<span style="font-size:0.72rem; color:var(--text-secondary); max-width: 170px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${this.escapeHtml(lead.ai_recommended_action)}">💡 ${this.escapeHtml(lead.ai_recommended_action)}</span>` : ''}
                          </div>
                        ` : ''}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span class="badge badge--source-${lead.source}">
                      ${this.formatSourceBadge(lead.source)}
                    </span>
                  </td>
                  <td>
                    <span style="font-size: 0.85rem; font-weight: 500;">
                      ${lead.interest ? `🎯 ${this.escapeHtml(lead.interest)}` : '<em style="color: var(--text-secondary);">General</em>'}
                    </span>
                  </td>
                  <td>
                    <span class="badge badge--lead-${lead.status}">
                      ${this.formatStatus(lead.status)}
                    </span>
                  </td>
                  <td>
                    <span class="badge" style="background: var(--bg-surface-2); color: var(--text-secondary); font-weight: 600;">
                      💼 ${lead.opportunities_count || 0}
                    </span>
                  </td>
                  <td>
                    <span class="badge" style="background: var(--bg-surface-2); color: var(--text-secondary); font-weight: 600;">
                      📝 ${lead.notes_count || 0}
                    </span>
                  </td>
                  <td style="font-size: 0.82rem; color: var(--text-secondary); white-space: nowrap;">
                    ${formatDate(lead.created_at)}
                    <div style="font-size: 0.72rem; color: var(--text-secondary); margin-top: 2px;">
                      ${this.formatRelativeTime(lead.created_at)}
                    </div>
                  </td>
                  <td style="text-align: right;" onclick="event.stopPropagation();">
                    <div class="crm-table-actions">
                      <a href="#/crm/leads/${lead.id}" class="btn btn-sm btn-outline crm-action-btn" title="Ver ficha completa del lead">
                        👁️ Ficha
                      </a>
                      <button class="btn btn-sm btn-outline crm-action-btn btn-qualify-lead" data-id="${lead.id}" title="Calificar o Re-analizar con IA (Sofía)">
                        🤖
                      </button>
                      ${!lead.patient_id ? `
                        <button class="btn btn-sm crm-action-btn btn-quick-convert" data-id="${lead.id}" style="background: #10b981; color: #ffffff; border: none; font-weight: 600;" title="Convertir a Paciente Clínico Oficial">
                          🦷 Convertir
                        </button>
                      ` : ''}
                      <button class="btn btn-sm btn-outline crm-action-btn btn-quick-status" data-id="${lead.id}" data-status="${lead.status}" title="Cambiar estado del lead">
                        🔄
                      </button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  renderLeadsKanban(rows) {
    const columns = [
      { key: 'new', label: 'Nuevo', icon: '🆕', cssClass: 'crm-kanban-col--new' },
      { key: 'contacted', label: 'Contactado', icon: '📞', cssClass: 'crm-kanban-col--contacted' },
      { key: 'qualified', label: 'Calificado', icon: '⭐', cssClass: 'crm-kanban-col--qualified' },
      { key: 'appointment_scheduled', label: 'Cita Agendada', icon: '📅', cssClass: 'crm-kanban-col--appointment' },
      { key: 'converted', label: 'Convertido', icon: '🦷', cssClass: 'crm-kanban-col--converted' },
      { key: 'lost', label: 'Perdido', icon: '❌', cssClass: 'crm-kanban-col--lost' },
    ];

    return `
      <div class="crm-kanban-board">
        ${columns.map(col => {
          const colLeads = rows.filter(l => l.status === col.key);
          return `
            <div class="crm-kanban-col ${col.cssClass}" data-col-status="${col.key}">
              <div class="crm-kanban-col__header">
                <div class="crm-kanban-col__title">
                  <span>${col.icon}</span>
                  <span>${col.label}</span>
                </div>
                <span class="crm-kanban-col__badge">${colLeads.length}</span>
              </div>

              <div class="crm-kanban-col__cards">
                ${colLeads.length === 0 ? `
                  <div class="crm-empty-column">
                    Sin leads en esta fase
                  </div>
                ` : colLeads.map(lead => `
                  <div class="crm-lead-card" data-id="${lead.id}">
                    <div class="crm-lead-card__header">
                      <div class="crm-lead-card__profile">
                        <div class="crm-lead-card__avatar">
                          ${(lead.contact_name || lead.contact_phone || 'L')[0].toUpperCase()}
                        </div>
                        <div class="crm-lead-card__name-block">
                          <a href="#/crm/leads/${lead.id}" class="crm-lead-card__name" title="Ver ficha del lead">
                            ${this.escapeHtml(lead.contact_name || lead.contact_phone)}
                          </a>
                          <span class="badge badge--source-${lead.source}" style="font-size: 0.68rem; padding: 1px 6px;">
                            ${this.formatSourceBadge(lead.source)}
                          </span>
                        </div>
                      </div>
                      <span class="crm-lead-card__time" title="${formatDate(lead.created_at)}">
                        🕒 ${this.formatRelativeTime(lead.created_at)}
                      </span>
                    </div>

                    <div class="crm-lead-card__info-row">
                      <div>📞 <strong>${this.escapeHtml(lead.contact_phone)}</strong></div>
                      ${lead.interest ? `
                        <div class="crm-lead-card__interest">
                          🎯 ${this.escapeHtml(lead.interest)}
                        </div>
                      ` : ''}
                    </div>

                    ${lead.ai_score !== null && lead.ai_score !== undefined ? `
                      <div style="margin: 4px 0; display: flex; gap: 4px; align-items: center; flex-wrap: wrap;">
                        <span class="badge" style="background: ${lead.ai_score >= 80 ? '#fef3c7; color:#b45309; border: 1px solid #fde68a;' : lead.ai_score >= 50 ? '#eff6ff; color:#1d4ed8; border: 1px solid #bfdbfe;' : '#f3f4f6; color:#6b7280;'}; font-weight: 700; font-size: 0.68rem; padding: 1px 6px;">
                          🔥 ${lead.ai_score}/100
                        </span>
                        ${lead.ai_urgency === 'HIGH' ? `<span class="badge" style="background:#fee2e2; color:#b91c1c; font-weight:700; font-size:0.68rem; padding: 1px 6px;">⚠️ Urgente</span>` : lead.ai_urgency === 'MEDIUM' ? `<span class="badge" style="background:#fef9c3; color:#854d0e; font-size:0.68rem; padding: 1px 6px;">⚡ Media</span>` : ''}
                      </div>
                      ${lead.ai_recommended_action ? `
                        <div style="font-size: 0.72rem; color: #475569; margin-bottom: 4px; line-height: 1.3;" title="${this.escapeHtml(lead.ai_recommended_action)}">
                          💡 ${this.escapeHtml(lead.ai_recommended_action)}
                        </div>
                      ` : ''}
                    ` : ''}

                    <div class="crm-lead-card__meta-tags">
                      ${lead.patient_id ? `
                        <span class="badge badge--patient-linked">
                          <a href="#/patients/${lead.patient_id}">
                            🦷 Paciente #${lead.patient_custom_id || lead.patient_id}
                          </a>
                        </span>
                      ` : ''}
                      <span class="badge" style="background: var(--bg-surface-2); font-size: 0.72rem; color: var(--text-secondary);">
                        💼 ${lead.opportunities_count || 0}
                      </span>
                      <span class="badge" style="background: var(--bg-surface-2); font-size: 0.72rem; color: var(--text-secondary);">
                        📝 ${lead.notes_count || 0}
                      </span>
                    </div>

                    <div class="crm-lead-card__footer">
                      <div class="crm-lead-card__actions">
                        <a href="#/crm/leads/${lead.id}" class="btn btn-xs btn-outline" style="font-size: 0.75rem; padding: 2px 7px;">
                          👁️ Ver
                        </a>
                        <button class="btn btn-xs btn-outline btn-qualify-lead" data-id="${lead.id}" title="Calificar con IA (Sofía)" style="font-size: 0.75rem; padding: 2px 6px;">
                          🤖
                        </button>
                        ${!lead.patient_id ? `
                          <button class="btn btn-xs btn-quick-convert" data-id="${lead.id}" style="background: #10b981; color: #ffffff; border: none; font-size: 0.75rem; padding: 2px 7px; font-weight: 600;">
                            🦷 Convertir
                          </button>
                        ` : ''}
                      </div>

                      <!-- 1-Click Stage Advancement -->
                      <select class="form-control form-control-sm lead-card-stage-select" data-id="${lead.id}" style="font-size: 0.75rem; padding: 2px 6px; width: auto; font-weight: 600;" onclick="event.stopPropagation();">
                        <option value="new" ${lead.status === 'new' ? 'selected' : ''}>🆕 Nuevo</option>
                        <option value="contacted" ${lead.status === 'contacted' ? 'selected' : ''}>📞 Contactado</option>
                        <option value="qualified" ${lead.status === 'qualified' ? 'selected' : ''}>⭐ Calificado</option>
                        <option value="appointment_scheduled" ${lead.status === 'appointment_scheduled' ? 'selected' : ''}>📅 Cita</option>
                        <option value="converted" ${lead.status === 'converted' ? 'selected' : ''}>🦷 Convertido</option>
                        <option value="lost" ${lead.status === 'lost' ? 'selected' : ''}>❌ Perdido</option>
                      </select>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  renderOpportunitiesView() {
    const rows = this.opportunitiesData.rows || [];

    return `
      <!-- Toolbar de Oportunidades -->
      <div class="crm-toolbar">
        <div class="crm-toolbar__left">
          <div class="crm-search-wrapper">
            <span class="crm-search-icon">🔍</span>
            <input 
              type="text" 
              id="opp-search-input" 
              class="form-control form-control-sm crm-search-input" 
              placeholder="Buscar por oportunidad, paciente, tratamiento..." 
              value="${this.escapeHtml(this.searchQuery)}"
            />
          </div>

          <select id="opp-status-filter" class="form-control form-control-sm" style="min-width: 170px;">
            <option value="">Todos los Estados</option>
            <option value="open" ${this.statusFilter === 'open' ? 'selected' : ''}>📂 Abierta</option>
            <option value="in_progress" ${this.statusFilter === 'in_progress' ? 'selected' : ''}>⏳ En Progreso</option>
            <option value="won" ${this.statusFilter === 'won' ? 'selected' : ''}>🏆 Ganada</option>
            <option value="lost" ${this.statusFilter === 'lost' ? 'selected' : ''}>❌ Perdida</option>
          </select>
        </div>

        <div class="crm-toolbar__right">
          <!-- Conmutador de Vistas Kanban vs Tabla -->
          <div class="crm-view-switcher">
            <button 
              type="button" 
              class="crm-view-btn ${this.oppsViewMode === 'kanban' ? 'is-active' : ''}" 
              data-mode="kanban" 
              title="Vista de Pipeline Kanban"
            >
              <span>🗂️</span> Pipeline Kanban
            </button>
            <button 
              type="button" 
              class="crm-view-btn ${this.oppsViewMode === 'table' ? 'is-active' : ''}" 
              data-mode="table" 
              title="Vista de Lista / Tabla"
            >
              <span>📋</span> Lista
            </button>
          </div>

          <div style="font-size: 0.85rem; color: var(--text-secondary);">
            Total: <strong>${this.opportunitiesData.total || rows.length}</strong> oportunidades
          </div>
        </div>
      </div>

      <!-- Contenedor Principal de Oportunidades: Kanban o Tabla -->
      ${this.oppsViewMode === 'table' ? this.renderOpportunitiesTable(rows) : this.renderOpportunitiesKanban(rows)}
    `;
  }

  renderOpportunitiesKanban(rows) {
    const columns = [
      { key: 'open', label: 'Abierta', icon: '📂', cssClass: 'crm-kanban-col--open' },
      { key: 'in_progress', label: 'En Progreso', icon: '⏳', cssClass: 'crm-kanban-col--in-progress' },
      { key: 'won', label: 'Ganada', icon: '🏆', cssClass: 'crm-kanban-col--won' },
      { key: 'lost', label: 'Perdida', icon: '❌', cssClass: 'crm-kanban-col--lost' },
    ];

    return `
      <div class="crm-kanban-board">
        ${columns.map(col => {
          const colOpps = rows.filter(o => o.status === col.key);
          const colSum = colOpps.reduce((acc, o) => acc + (parseFloat(o.estimated_value) || 0), 0);
          return `
            <div class="crm-kanban-col ${col.cssClass}" data-col-status="${col.key}">
              <div class="crm-kanban-col__header">
                <div class="crm-kanban-col__title">
                  <span>${col.icon}</span>
                  <span>${col.label}</span>
                  <span class="crm-kanban-col__badge">${colOpps.length}</span>
                </div>
                <div class="crm-kanban-col__revenue">
                  ${formatCurrency(colSum)}
                </div>
              </div>

              <div class="crm-kanban-col__cards">
                ${colOpps.length === 0 ? `
                  <div class="crm-empty-column">
                    Sin oportunidades
                  </div>
                ` : colOpps.map(opp => `
                  <div class="crm-opp-card" data-id="${opp.id}">
                    <div>
                      <div class="crm-opp-card__title" onclick="if ('${opp.lead_id || ''}') window.location.hash = '#/crm/leads/${opp.lead_id}';">
                        ${this.escapeHtml(opp.name)}
                      </div>
                      <div class="crm-opp-card__contact" style="margin-top: 4px;">
                        <span>👤 <strong>${this.escapeHtml(opp.contact_name || opp.contact_phone)}</strong></span>
                        ${opp.patient_id ? `
                          <span class="badge badge--patient-linked" style="font-size: 0.7rem;">
                            🦷 Paciente #${opp.patient_custom_id || opp.patient_id}
                          </span>
                        ` : ''}
                      </div>
                      ${opp.service_interest ? `
                        <div style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 4px;">
                          🎯 <em>${this.escapeHtml(opp.service_interest)}</em>
                        </div>
                      ` : ''}
                    </div>

                    <div class="crm-opp-card__footer">
                      <span class="crm-opp-card__val">${formatCurrency(opp.estimated_value)}</span>
                      <select class="form-control form-control-sm opp-card-stage-select" data-id="${opp.id}" style="width: auto; font-size: 0.75rem; font-weight: 600; padding: 2px 6px; height: auto;" onclick="event.stopPropagation();">
                        <option value="open" ${opp.status === 'open' ? 'selected' : ''}>📂 Abierta</option>
                        <option value="in_progress" ${opp.status === 'in_progress' ? 'selected' : ''}>⏳ En Progreso</option>
                        <option value="won" ${opp.status === 'won' ? 'selected' : ''}>🏆 Ganada</option>
                        <option value="lost" ${opp.status === 'lost' ? 'selected' : ''}>❌ Perdida</option>
                      </select>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  renderOpportunitiesTable(rows) {
    if (rows.length === 0) {
      return `
        <div class="crm-table-container">
          <div class="crm-empty-state">
            <div class="crm-empty-state__icon">💼</div>
            <h3 class="crm-empty-state__title">No hay oportunidades comerciales</h3>
            <p class="crm-empty-state__subtitle">
              No se han encontrado oportunidades que coincidan con la búsqueda o el filtro seleccionado.
            </p>
          </div>
        </div>
      `;
    }

    return `
      <div class="crm-table-container">
        <div class="table-responsive">
          <table class="crm-table">
            <thead>
              <tr>
                <th>Oportunidad Comercial</th>
                <th>Contacto / Paciente</th>
                <th>Tratamiento de Interés</th>
                <th>Valor Estimado (€)</th>
                <th>Estado</th>
                <th>Fecha Creación</th>
                <th style="text-align: right; min-width: 140px;">Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(opp => `
                <tr>
                  <td>
                    <div style="font-weight: 700; color: var(--text-primary);">
                      ${opp.lead_id ? `
                        <a href="#/crm/leads/${opp.lead_id}" style="color: inherit; text-decoration: none;">
                          ${this.escapeHtml(opp.name)} ↗
                        </a>
                      ` : this.escapeHtml(opp.name)}
                    </div>
                  </td>
                  <td>
                    <div style="font-weight: 600; font-size: 0.88rem;">
                      ${this.escapeHtml(opp.contact_name || opp.contact_phone)}
                    </div>
                    ${opp.patient_id ? `
                      <span class="badge badge--patient-linked" style="margin-top: 3px;">
                        <a href="#/patients/${opp.patient_id}">
                          🦷 Paciente #${opp.patient_custom_id || opp.patient_id}
                        </a>
                      </span>
                    ` : ''}
                  </td>
                  <td>
                    <span style="font-size: 0.85rem;">
                      ${opp.service_interest ? `🎯 ${this.escapeHtml(opp.service_interest)}` : '<em>General</em>'}
                    </span>
                  </td>
                  <td>
                    <span style="font-weight: 700; font-size: 1rem; color: var(--crm-success);">
                      ${formatCurrency(opp.estimated_value)}
                    </span>
                  </td>
                  <td>
                    <span class="badge badge--opp-${opp.status}">
                      ${this.formatOppStatus(opp.status)}
                    </span>
                  </td>
                  <td style="font-size: 0.82rem; color: var(--text-secondary); white-space: nowrap;">
                    ${formatDate(opp.created_at)}
                    <div style="font-size: 0.72rem; color: var(--text-secondary); margin-top: 2px;">
                      ${this.formatRelativeTime(opp.created_at)}
                    </div>
                  </td>
                  <td style="text-align: right;">
                    <div class="crm-table-actions">
                      <select class="form-control form-control-sm opp-card-stage-select" data-id="${opp.id}" style="width: auto; font-size: 0.78rem; font-weight: 600; padding: 3px 6px;">
                        <option value="open" ${opp.status === 'open' ? 'selected' : ''}>📂 Abierta</option>
                        <option value="in_progress" ${opp.status === 'in_progress' ? 'selected' : ''}>⏳ En Progreso</option>
                        <option value="won" ${opp.status === 'won' ? 'selected' : ''}>🏆 Ganada</option>
                        <option value="lost" ${opp.status === 'lost' ? 'selected' : ''}>❌ Perdida</option>
                      </select>
                      ${opp.lead_id ? `
                        <a href="#/crm/leads/${opp.lead_id}" class="btn btn-sm btn-outline crm-action-btn" title="Ver ficha del lead">
                          👁️ Ficha
                        </a>
                      ` : ''}
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  renderDashboardView() {
    const kpis = this.dashboardKPIs || { leads: {}, opportunities: {}, recentActivities: [] };
    const leads = kpis.leads || {};
    const opps = kpis.opportunities || {};
    const activities = kpis.recentActivities || [];

    return `
      <div class="crm-kpi-grid">
        <div class="crm-kpi-card crm-kpi-card--highlight">
          <span class="crm-kpi-card__title">Total Leads</span>
          <span class="crm-kpi-card__value">${leads.total_leads || 0}</span>
          <span class="crm-kpi-card__subtitle">Prospectos captados en clínica</span>
        </div>
        <div class="crm-kpi-card crm-kpi-card--purple">
          <span class="crm-kpi-card__title">Nuevos Leads</span>
          <span class="crm-kpi-card__value" style="color: #6d28d9;">${leads.new_leads || 0}</span>
          <span class="crm-kpi-card__subtitle">Pendientes de primer contacto</span>
        </div>
        <div class="crm-kpi-card crm-kpi-card--warning">
          <span class="crm-kpi-card__title">Calificados / Citas</span>
          <span class="crm-kpi-card__value" style="color: #b45309;">${(leads.qualified_leads || 0) + (leads.appointment_scheduled_leads || 0)}</span>
          <span class="crm-kpi-card__subtitle">Interés confirmado en consulta</span>
        </div>
        <div class="crm-kpi-card crm-kpi-card--success">
          <span class="crm-kpi-card__title">Pipeline Activo</span>
          <span class="crm-kpi-card__value" style="color: #10b981;">${formatCurrency(opps.open_pipeline_value || 0)}</span>
          <span class="crm-kpi-card__subtitle">${opps.open_count || 0} oportunidades abiertas</span>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: var(--space-4); margin-top: var(--space-4);">
        <!-- Embudo de Conversión -->
        <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: var(--space-4); box-shadow: var(--crm-card-shadow);">
          <h3 style="margin-top: 0; margin-bottom: var(--space-3); font-size: 1.1rem; display: flex; align-items: center; gap: 8px;">
            <span>📈</span> Embudo de Conversión Comercial
          </h3>
          <div style="display: flex; flex-direction: column; gap: 12px;">
            ${this.renderFunnelBar('1. Nuevos', leads.new_leads || 0, leads.total_leads, '#8b5cf6')}
            ${this.renderFunnelBar('2. Contactados', leads.contacted_leads || 0, leads.total_leads, '#0284c7')}
            ${this.renderFunnelBar('3. Calificados', leads.qualified_leads || 0, leads.total_leads, '#f59e0b')}
            ${this.renderFunnelBar('4. Cita Agendada', leads.appointment_scheduled_leads || 0, leads.total_leads, '#0d9488')}
            ${this.renderFunnelBar('5. Convertidos a Paciente', leads.converted_leads || 0, leads.total_leads, '#10b981')}
            ${this.renderFunnelBar('6. Descartados / Perdidos', leads.lost_leads || 0, leads.total_leads, '#ef4444')}
          </div>
        </div>

        <!-- Actividad Reciente del CRM -->
        <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: var(--space-4); box-shadow: var(--crm-card-shadow);">
          <h3 style="margin-top: 0; margin-bottom: var(--space-3); font-size: 1.1rem; display: flex; align-items: center; gap: 8px;">
            <span>🕒</span> Registro de Actividad Reciente
          </h3>
          <div style="max-height: 340px; overflow-y: auto;">
            ${activities.length === 0 ? `
              <div style="color: var(--text-secondary); text-align: center; padding: 30px 10px;">Sin actividades recientes</div>
            ` : activities.map(act => `
              <div style="padding: 10px 0; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; font-size: 0.85rem;">
                <div>
                  <strong style="color: var(--text-primary);">${this.escapeHtml(act.title)}</strong>
                  ${act.description ? `<div style="color: var(--text-secondary); font-size: 0.8rem; margin-top: 2px;">${this.escapeHtml(act.description)}</div>` : ''}
                </div>
                <div style="color: var(--text-secondary); font-size: 0.75rem; white-space: nowrap; margin-left: 10px;">
                  ${formatDate(act.created_at)}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  renderFunnelBar(label, count, total, color) {
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return `
      <div>
        <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 4px;">
          <span style="font-weight: 600;">${label}</span>
          <span><strong>${count}</strong> <small style="color: var(--text-secondary);">(${pct}%)</small></span>
        </div>
        <div style="height: 10px; background: var(--bg-surface-2, #e2e8f0); border-radius: 6px; overflow: hidden;">
          <div style="width: ${pct}%; height: 100%; background: ${color}; border-radius: 6px; transition: width 0.4s ease;"></div>
        </div>
      </div>
    `;
  }

  formatStatus(st) {
    const map = {
      new: '🆕 Nuevo',
      contacted: '📞 Contactado',
      qualified: '⭐ Calificado',
      appointment_scheduled: '📅 Cita Agendada',
      converted: '🦷 Convertido',
      lost: '❌ Perdido',
    };
    return map[st] || st;
  }

  formatOppStatus(st) {
    const map = {
      open: '📂 Abierta',
      in_progress: '⏳ En Progreso',
      won: '🏆 Ganada',
      lost: '❌ Perdida',
    };
    return map[st] || st;
  }

  formatSourceBadge(src) {
    const map = {
      whatsapp: '🟢 WhatsApp',
      instagram: '📸 Instagram',
      website: '🌐 Web',
      manual: '🏢 Manual',
      other: '📁 Otro',
    };
    return map[src] || src;
  }

  formatRelativeTime(dateString) {
    if (!dateString) return '';
    const d = new Date(dateString);
    const now = new Date();
    const diffMs = now - d;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSec < 60) return 'Ahora';
    if (diffMin < 60) return `${diffMin}m`;
    if (diffHours < 24 && d.getDate() === now.getDate()) return `Hoy ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    if (diffDays === 1) return 'Ayer';
    if (diffDays > 1 && diffDays < 7) return `Hace ${diffDays} días`;
    return formatDate(dateString);
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  bindEvents() {
    // Cambio de pestañas
    this.container.querySelectorAll('.tab-switch').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        this.activeTab = e.currentTarget.dataset.tab;
        this.statusFilter = '';
        this.searchQuery = '';
        this.currentPage = 1;
        await this.loadInitialData();
        this.renderLayout();
        this.renderActiveTab();
        this.bindEvents();
      });
    });

    // Botón Nuevo Lead
    const btnNewLead = this.container.querySelector('#btn-new-lead');
    if (btnNewLead) {
      btnNewLead.addEventListener('click', () => this.openNewLeadModal());
    }

    // Botón Nueva Oportunidad
    const btnNewOpp = this.container.querySelector('#btn-new-opp');
    if (btnNewOpp) {
      btnNewOpp.addEventListener('click', () => this.openNewOpportunityModal());
    }
  }

  bindTabSpecificEvents() {
    // -------------------------------------------------------------
    // Eventos de Leads
    // -------------------------------------------------------------
    if (this.activeTab === 'leads') {
      // Conmutador de vista Lista vs Kanban
      document.querySelectorAll('.crm-view-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const mode = e.currentTarget.dataset.mode;
          if (this.leadsViewMode !== mode) {
            this.leadsViewMode = mode;
            await this.loadInitialData();
            this.renderActiveTab();
          }
        });
      });

      // Quick status filter chips
      document.querySelectorAll('.crm-filter-pill').forEach(pill => {
        pill.addEventListener('click', async (e) => {
          const st = e.currentTarget.dataset.status;
          this.statusFilter = st;
          this.currentPage = 1;
          await this.loadInitialData();
          this.renderActiveTab();
        });
      });

      // Búsqueda de Leads
      const searchInput = document.getElementById('lead-search-input');
      if (searchInput) {
        let timeout;
        searchInput.addEventListener('input', (e) => {
          clearTimeout(timeout);
          timeout = setTimeout(async () => {
            this.searchQuery = e.target.value.trim();
            this.currentPage = 1;
            await this.loadInitialData();
            this.renderActiveTab();
          }, 320);
        });
      }

      // Filtro de Origen
      const sourceFilter = document.getElementById('lead-source-filter');
      if (sourceFilter) {
        sourceFilter.addEventListener('change', async (e) => {
          this.sourceFilter = e.target.value;
          this.currentPage = 1;
          await this.loadInitialData();
          this.renderActiveTab();
        });
      }

      // Clic en fila de lead para ir a ficha
      document.querySelectorAll('.lead-row').forEach(row => {
        row.addEventListener('click', () => {
          const leadId = row.dataset.id;
          window.location.hash = `#/crm/leads/${leadId}`;
        });
      });

      // Quick Convert Button en tabla y kanban
      document.querySelectorAll('.btn-quick-convert').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const leadId = btn.dataset.id;
          await this.openConvertToPatientModal(leadId);
        });
      });

      // Quick Status Button en tabla
      document.querySelectorAll('.btn-quick-status').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const leadId = btn.dataset.id;
          const currentStatus = btn.dataset.status;
          this.openChangeStatusModal(leadId, currentStatus);
        });
      });

      // 1-Click Stage Select en tarjeta Kanban de Lead
      document.querySelectorAll('.lead-card-stage-select').forEach(sel => {
        sel.addEventListener('change', async (e) => {
          e.stopPropagation();
          const leadId = e.target.dataset.id;
          const newStatus = e.target.value;

          if (newStatus === 'converted') {
            await this.openConvertToPatientModal(leadId);
            return;
          }

          if (newStatus === 'lost') {
            this.openChangeStatusModal(leadId, 'lost');
            return;
          }

          try {
            sel.disabled = true;
            await crmService.updateLeadStatus(leadId, newStatus);
            toast.success('Estado del lead actualizado');
            await this.loadInitialData();
            this.renderActiveTab();
          } catch (err) {
            toast.error(err.message || 'Error al cambiar estado');
            sel.disabled = false;
          }
        });
      });

      // Calificar con IA (Sofía)
      document.querySelectorAll('.btn-qualify-lead').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const leadId = parseInt(btn.dataset.id, 10);
          try {
            toast.info('Analizando lead con Sofía IA...');
            btn.disabled = true;
            const res = await aiService.qualifyLead(leadId);
            const qual = res?.qualification || res?.data?.qualification || {};
            toast.success(`✨ Lead calificado: ${qual.score || 0}/100 (${qual.urgency || 'Normal'})`);
            await this.loadInitialData();
            this.renderActiveTab();
          } catch (err) {
            toast.error('Error al calificar lead: ' + (err.message || ''));
            btn.disabled = false;
          }
        });
      });
    }

    // -------------------------------------------------------------
    // Eventos de Oportunidades
    // -------------------------------------------------------------
    if (this.activeTab === 'opportunities') {
      // Conmutador de vista Kanban vs Lista
      document.querySelectorAll('.crm-view-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const mode = e.currentTarget.dataset.mode;
          if (this.oppsViewMode !== mode) {
            this.oppsViewMode = mode;
            await this.loadInitialData();
            this.renderActiveTab();
          }
        });
      });

      // Búsqueda de oportunidades
      const oppSearch = document.getElementById('opp-search-input');
      if (oppSearch) {
        let timeout;
        oppSearch.addEventListener('input', (e) => {
          clearTimeout(timeout);
          timeout = setTimeout(async () => {
            this.searchQuery = e.target.value.trim();
            await this.loadInitialData();
            this.renderActiveTab();
          }, 320);
        });
      }

      // Filtro de estado de oportunidades
      const oppStatus = document.getElementById('opp-status-filter');
      if (oppStatus) {
        oppStatus.addEventListener('change', async (e) => {
          this.statusFilter = e.target.value;
          await this.loadInitialData();
          this.renderActiveTab();
        });
      }

      // Quick stage selector en tarjeta/fila de oportunidad
      document.querySelectorAll('.opp-card-stage-select').forEach(sel => {
        sel.addEventListener('change', async (e) => {
          e.stopPropagation();
          const oppId = e.target.dataset.id;
          const newStatus = e.target.value;
          try {
            sel.disabled = true;
            await crmService.updateOpportunityStatus(oppId, newStatus);
            toast.success('Estado de oportunidad actualizado');
            await this.loadInitialData();
            this.renderActiveTab();
          } catch (err) {
            toast.error(err.message || 'Error al mover oportunidad');
            sel.disabled = false;
          }
        });
      });
    }
  }

  async openNewLeadModal() {
    let staffUsers = [];
    try {
      const uRes = await userService.getAll();
      staffUsers = uRes?.data || (Array.isArray(uRes) ? uRes : (uRes?.rows || []));
    } catch {
      // Continuar si falla
    }

    const userOptions = staffUsers.map(u => `
      <option value="${u.id}">${u.first_name} ${u.last_name || ''} (${u.role_name})</option>
    `).join('');

    const modalContent = `
      <form id="new-lead-form">
        <!-- Grupo 1: Datos de Contacto -->
        <div class="crm-form-section">
          <div class="crm-form-section__header">
            <span class="crm-form-section__title">👤 Datos de Contacto</span>
          </div>
          <div class="form-group" style="margin-bottom: var(--space-3);">
            <label class="form-label">Nombre del Contacto / Lead *</label>
            <input type="text" id="modal-lead-name" class="form-control" placeholder="Ej: María Gómez" required />
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div class="form-group">
              <label class="form-label">Teléfono / WhatsApp *</label>
              <input type="tel" id="modal-lead-phone" class="form-control" placeholder="Ej: +34 612 345 678" required />
            </div>
            <div class="form-group">
              <label class="form-label">Correo Electrónico (opcional)</label>
              <input type="email" id="modal-lead-email" class="form-control" placeholder="maria@ejemplo.com" />
            </div>
          </div>
          <!-- Alerta de Duplicados en Vivo -->
          <div id="modal-duplicate-warning" style="display: none; margin-top: var(--space-3);"></div>
        </div>

        <!-- Grupo 2: Interés Comercial -->
        <div class="crm-form-section">
          <div class="crm-form-section__header">
            <span class="crm-form-section__title">🎯 Interés Comercial</span>
          </div>
          <div class="form-group" style="margin-bottom: var(--space-3);">
            <label class="form-label">Tratamiento o Especialidad de Interés</label>
            <input type="text" id="modal-lead-interest" class="form-control" placeholder="Ej: Implantes dentales, Ortodoncia invisible, Carillas..." />
          </div>
          <div id="modal-lead-estimated-group" class="form-group" style="display: none; margin-bottom: var(--space-3);">
            <label class="form-label" style="display: flex; justify-content: space-between; align-items: center;">
              <span>Importe Estimado (€)</span>
              <span style="font-size: 0.75rem; color: var(--crm-primary); font-weight: 500;">(para Oportunidad de Paciente)</span>
            </label>
            <input type="number" id="modal-lead-estimated-value" class="form-control" placeholder="0.00" step="0.01" min="0" />
          </div>
          <div class="form-group">
            <label class="form-label">Nota Inicial Comercial (opcional)</label>
            <textarea id="modal-lead-notes" class="form-control" rows="2" placeholder="Información comercial relevante, dudas o requerimientos del paciente..."></textarea>
          </div>
        </div>

        <!-- Grupo 3: Origen & Asignación -->
        <div class="crm-form-section">
          <div class="crm-form-section__header">
            <span class="crm-form-section__title">🌐 Origen & Asignación</span>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
            <div class="form-group">
              <label class="form-label">Canal de Origen *</label>
              <select id="modal-lead-source" class="form-control">
                <option value="whatsapp">WhatsApp</option>
                <option value="instagram">Instagram</option>
                <option value="website">Sitio Web</option>
                <option value="manual" selected>Manual / Presencial</option>
                <option value="other">Otro</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Estado Inicial</label>
              <select id="modal-lead-status" class="form-control">
                <option value="new" selected>🆕 Nuevo</option>
                <option value="contacted">📞 Contactado</option>
                <option value="qualified">⭐ Calificado</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Asignado a</label>
              <select id="modal-lead-assigned" class="form-control">
                <option value="">-- Sin asignar --</option>
                ${userOptions}
              </select>
            </div>
          </div>
        </div>
      </form>
    `;

    Modal.show({
      title: '➕ Registrar Nuevo Lead en CRM',
      content: modalContent,
      confirmText: 'Guardar Lead',
      cancelText: 'Cancelar',
      size: 'md',
      onOpen: (modalBody, overlay) => {
        const phoneInput = modalBody.querySelector('#modal-lead-phone');
        const emailInput = modalBody.querySelector('#modal-lead-email');
        const nameInput = modalBody.querySelector('#modal-lead-name');
        const warningBox = modalBody.querySelector('#modal-duplicate-warning');
        const estimatedGroup = modalBody.querySelector('#modal-lead-estimated-group');
        const confirmBtn = overlay?.querySelector('.modal-btn-confirm') || modalBody.closest('.modal')?.querySelector('.modal-btn-confirm');

        let debounceTimer = null;
        let lastCheckedKey = '';

        const runDuplicateCheck = async () => {
          const phoneVal = phoneInput?.value.trim() || '';
          const emailVal = emailInput?.value.trim() || '';
          const currentKey = `${phoneVal}|${emailVal}`;

          if (currentKey === lastCheckedKey) return;
          lastCheckedKey = currentKey;

          const digits = phoneVal.replace(/\D/g, '');
          const hasPhone = digits.length >= 3;
          const hasEmail = emailVal.includes('@') && emailVal.length >= 5;

          if (!hasPhone && !hasEmail) {
            if (warningBox) {
              warningBox.style.display = 'none';
              warningBox.innerHTML = '';
            }
            if (estimatedGroup) estimatedGroup.style.display = 'none';
            if (confirmBtn) confirmBtn.innerHTML = 'Guardar Lead';
            return;
          }

          try {
            const res = await crmService.checkDuplicate({
              phone: phoneVal || undefined,
              email: emailVal || undefined,
            });

            if (!warningBox) return;

            if (res && res.exists && (res.patient || res.activeLead)) {
              let itemsHtml = '';

              if (res.patient) {
                const patName = `${res.patient.firstName || ''} ${res.patient.lastName || ''}`.trim();
                const patId = res.patient.customId || res.patient.id;
                itemsHtml += `
                  <div class="crm-duplicate-item" style="border-left: 4px solid var(--crm-primary); background: rgba(79, 70, 229, 0.08); padding: 10px 14px; border-radius: 6px;">
                    <span class="crm-duplicate-icon" style="font-size: 1.25rem; margin-right: 8px;">ℹ️</span>
                    <div class="crm-duplicate-text" style="line-height: 1.4;">
                      <strong>Paciente Registrado:</strong> Este contacto ya es paciente de la clínica (<strong>${patName}</strong> - Ficha #${patId}). Al guardar, se creará automáticamente como una Oportunidad Comercial en su expediente clínico.
                      <div style="margin-top: 6px; display: flex; gap: 8px; align-items: center;">
                        <a href="#/patients/${res.patient.id}" target="_blank" class="crm-duplicate-link" style="color: var(--crm-primary); font-weight: 500;">Ver Paciente ↗</a>
                        ${(!nameInput.value.trim() || nameInput.value.trim().toLowerCase() === 'nuevo lead') ? `
                          <button type="button" class="btn btn-xs btn-outline btn-autofill-name" style="font-size: 0.75rem; padding: 2px 8px;">Usar nombre</button>
                        ` : ''}
                      </div>
                    </div>
                  </div>
                `;

                if (estimatedGroup) estimatedGroup.style.display = 'block';
                if (confirmBtn) confirmBtn.innerHTML = '💼 Crear como Oportunidad de Paciente';
              } else {
                if (estimatedGroup) estimatedGroup.style.display = 'none';
                if (confirmBtn) confirmBtn.innerHTML = 'Guardar Lead';
              }

              if (res.activeLead) {
                const statusBadge = this.formatStatus(res.activeLead.status);
                itemsHtml += `
                  <div class="crm-duplicate-item">
                    <span class="crm-duplicate-icon">⚠️</span>
                    <div class="crm-duplicate-text">
                      <strong>Lead Activo Existente:</strong> Ya existe un lead abierto (#${res.activeLead.id}) en fase <strong>${statusBadge}</strong> para este contacto.
                      <a href="#/crm/leads/${res.activeLead.id}" target="_blank" class="crm-duplicate-link">Abrir Lead ↗</a>
                    </div>
                  </div>
                  <div class="crm-duplicate-allow-toggle">
                    <label>
                      <input type="checkbox" id="modal-allow-duplicate" />
                      <span>Crear otro lead comercial de todas formas para un tratamiento distinto</span>
                    </label>
                  </div>
                `;
              }

              warningBox.innerHTML = `
                <div class="crm-duplicate-alert">
                  ${itemsHtml}
                </div>
              `;
              warningBox.style.display = 'block';

              const btnAutofill = warningBox.querySelector('.btn-autofill-name');
              if (btnAutofill && res.patient) {
                btnAutofill.addEventListener('click', () => {
                  if (nameInput) {
                    nameInput.value = `${res.patient.firstName || ''} ${res.patient.lastName || ''}`.trim();
                    btnAutofill.remove();
                  }
                });
              }
            } else {
              warningBox.style.display = 'none';
              warningBox.innerHTML = '';
              if (estimatedGroup) estimatedGroup.style.display = 'none';
              if (confirmBtn) confirmBtn.innerHTML = 'Guardar Lead';
            }
          } catch (err) {
            console.warn('Error en verificación de duplicados de lead:', err);
          }
        };

        const handleInput = () => {
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(runDuplicateCheck, 300);
        };

        phoneInput?.addEventListener('input', handleInput);
        emailInput?.addEventListener('input', handleInput);
      },
      onConfirm: async (modalBody) => {
        const name = modalBody.querySelector('#modal-lead-name')?.value.trim();
        const phone = modalBody.querySelector('#modal-lead-phone')?.value.trim();
        const email = modalBody.querySelector('#modal-lead-email')?.value.trim();
        const source = modalBody.querySelector('#modal-lead-source')?.value || 'manual';
        const status = modalBody.querySelector('#modal-lead-status')?.value || 'new';
        const interest = modalBody.querySelector('#modal-lead-interest')?.value.trim();
        const notes = modalBody.querySelector('#modal-lead-notes')?.value.trim();
        const assignedUserId = modalBody.querySelector('#modal-lead-assigned')?.value;
        const allowDuplicate = modalBody.querySelector('#modal-allow-duplicate')?.checked || false;
        const estimatedValInput = modalBody.querySelector('#modal-lead-estimated-value')?.value;
        const estimatedValue = estimatedValInput !== '' && !isNaN(parseFloat(estimatedValInput))
          ? parseFloat(estimatedValInput)
          : undefined;

        if (!name && !phone) {
          toast.error('Debe ingresar al menos el nombre o teléfono del lead');
          return false;
        }

        try {
          const res = await crmService.createLead({
            name: name || undefined,
            phone: phone || undefined,
            email: email || null,
            source,
            status,
            interest: interest || null,
            notes: notes || null,
            assigned_user_id: assignedUserId ? parseInt(assignedUserId, 10) : null,
            allow_duplicate: allowDuplicate,
            estimated_value: estimatedValue,
          });

          const isPatientOpp = Boolean(res?.convertedToOpportunity || res?.isPatient);

          if (isPatientOpp) {
            toast.success(res?.message || '¡Paciente existente detectado! Se ha creado una Oportunidad Comercial en su expediente clínico.');
            this.activeTab = 'opportunities';
          } else {
            toast.success('Lead creado exitosamente');
            this.activeTab = 'leads';
          }

          this.searchQuery = '';
          this.statusFilter = '';
          this.sourceFilter = '';
          this.currentPage = 1;
          await this.loadInitialData();
          this.renderLayout();
          this.renderActiveTab();
          this.bindEvents();
          return true;
        } catch (err) {
          toast.error(err.message || 'Error al crear lead');
          return false;
        }
      },
    });
  }

  async openNewOpportunityModal() {
    let leadsList = this.leadsData.rows || [];
    if (leadsList.length === 0) {
      try {
        const res = await crmService.getLeads({ limit: 100 });
        leadsList = res.rows || (Array.isArray(res) ? res : (res.data || []));
      } catch (e) {
        console.warn('No se pudieron precargar leads para el selector de oportunidad', e);
      }
    }

    const leadsOptions = (leadsList || []).map(l => `
      <option value="${l.id}" data-contact="${l.contact_id}">${l.contact_name || l.contact_phone} (${l.interest || 'General'})</option>
    `).join('');

    const modalContent = `
      <form id="new-opp-form">
        <!-- Grupo 1: Lead Asociado -->
        <div class="crm-form-section">
          <div class="crm-form-section__header">
            <span class="crm-form-section__title">👤 Lead o Contacto Vinculado</span>
          </div>
          <div class="form-group">
            <label class="form-label">Seleccionar Lead Comercial *</label>
            <select id="modal-opp-lead" class="form-control" required>
              <option value="">-- Seleccionar Lead --</option>
              ${leadsOptions}
            </select>
          </div>
        </div>

        <!-- Grupo 2: Concepto del Tratamiento -->
        <div class="crm-form-section">
          <div class="crm-form-section__header">
            <span class="crm-form-section__title">💼 Concepto del Tratamiento</span>
          </div>
          <div class="form-group" style="margin-bottom: var(--space-3);">
            <label class="form-label">Nombre / Concepto de la Oportunidad *</label>
            <input type="text" id="modal-opp-name" class="form-control" placeholder="Ej: Tratamiento Completo de Implantes" required />
          </div>
          <div class="form-group">
            <label class="form-label">Tratamiento o Servicio de Interés</label>
            <input type="text" id="modal-opp-interest" class="form-control" placeholder="Ej: Implantes, Carillas, Ortodoncia" />
          </div>
        </div>

        <!-- Grupo 3: Estimación Económica & Estado -->
        <div class="crm-form-section">
          <div class="crm-form-section__header">
            <span class="crm-form-section__title">💶 Valor Estimado & Pipeline</span>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div class="form-group">
              <label class="form-label">Valor Estimado (€)</label>
              <div class="crm-currency-wrapper">
                <span class="crm-currency-symbol">€</span>
                <input type="number" step="0.01" min="0" id="modal-opp-value" class="form-control crm-currency-input" placeholder="0.00" value="0.00" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Estado Inicial</label>
              <select id="modal-opp-status" class="form-control">
                <option value="open" selected>📂 Abierta</option>
                <option value="in_progress">⏳ En Progreso</option>
                <option value="won">🏆 Ganada</option>
              </select>
            </div>
          </div>
        </div>
      </form>
    `;

    Modal.show({
      title: '💼 Crear Oportunidad Comercial',
      content: modalContent,
      confirmText: 'Guardar Oportunidad',
      cancelText: 'Cancelar',
      size: 'md',
      onConfirm: async (modalBody) => {
        const leadSelect = modalBody.querySelector('#modal-opp-lead');
        const selectedOpt = leadSelect?.options[leadSelect.selectedIndex];
        const contactId = selectedOpt ? selectedOpt.dataset.contact : null;
        const leadId = leadSelect?.value;
        const name = modalBody.querySelector('#modal-opp-name')?.value.trim();
        const serviceInterest = modalBody.querySelector('#modal-opp-interest')?.value.trim();
        const estimatedValue = parseFloat(modalBody.querySelector('#modal-opp-value')?.value) || 0.00;
        const status = modalBody.querySelector('#modal-opp-status')?.value || 'open';

        if (!contactId || !leadId) {
          toast.error('Debe seleccionar un lead válido');
          return false;
        }

        if (!name) {
          toast.error('El nombre de la oportunidad es obligatorio');
          return false;
        }

        try {
          await crmService.createOpportunity({
            contact_id: parseInt(contactId, 10),
            lead_id: parseInt(leadId, 10),
            name,
            service_interest: serviceInterest || null,
            estimated_value: estimatedValue,
            status,
          });

          toast.success('Oportunidad creada exitosamente');
          this.activeTab = 'opportunities';
          this.searchQuery = '';
          this.statusFilter = '';
          this.currentPage = 1;
          await this.loadInitialData();
          this.renderLayout();
          this.renderActiveTab();
          this.bindEvents();
          return true;
        } catch (err) {
          toast.error(err.message || 'Error al crear oportunidad');
          return false;
        }
      },
    });
  }

  async openConvertToPatientModal(leadId) {
    let lead = null;
    try {
      lead = await crmService.getLeadById(leadId);
    } catch {
      toast.error('No se pudo cargar la información del lead');
      return;
    }

    const fullName = lead.contact_name || '';
    const nameParts = fullName.trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || (firstName ? 'Registrado' : '');
    const phone = lead.contact_phone && !lead.contact_phone.startsWith('sintel_') ? lead.contact_phone : '';
    const email = lead.contact_email || '';

    let existingPatients = [];
    try {
      const pRes = await patientService.getAll({ limit: 150 });
      existingPatients = pRes?.data || (Array.isArray(pRes) ? pRes : (pRes?.rows || []));
    } catch {
      // Continuar si falla
    }

    const patientOptions = existingPatients.map(p => `
      <option value="${p.id}">${p.first_name} ${p.last_name} (${p.custom_id || 'ID #' + p.id} - ${p.phone || p.email || 'Sin contacto'})</option>
    `).join('');

    const modalContent = `
      <div style="margin-bottom: var(--space-3);">
        <p style="font-size: 0.88rem; color: var(--text-secondary); margin-top: 0; margin-bottom: 12px;">
          Convierte este Lead en paciente formal para abrir su historia clínica dental y agenda de citas, o vincúlalo a un expediente ya existente.
        </p>
        
        <div class="crm-toggle-pills">
          <button type="button" class="crm-toggle-pill is-active" data-mode="new">
            <span>➕</span> Crear Nuevo Paciente
          </button>
          <button type="button" class="crm-toggle-pill" data-mode="existing">
            <span>🔗</span> Vincular a Paciente Existente
          </button>
        </div>

        <div id="convert-mode-new-section">
          <div class="crm-info-box crm-info-box--success">
            <span style="font-size: 1.1rem;">💡</span>
            <div>
              <strong>Código de Expediente Automático:</strong> El número de ficha médica (ej. <em>2026-0001-XUQ</em>) se generará de manera correlativa y 100% libre de colisiones. Si tu clínica requiere un código específico, puedes indicarlo abajo.
            </div>
          </div>

          <div class="crm-form-section">
            <div class="crm-form-section__header">
              <span class="crm-form-section__title">👤 Datos Personales del Expediente</span>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: var(--space-3);">
              <div class="form-group">
                <label class="form-label">Nombre *</label>
                <input type="text" id="modal-patient-firstname" class="form-control" value="${this.escapeHtml(firstName)}" placeholder="Nombre..." required />
              </div>
              <div class="form-group">
                <label class="form-label">Apellidos *</label>
                <input type="text" id="modal-patient-lastname" class="form-control" value="${this.escapeHtml(lastName)}" placeholder="Apellidos..." required />
              </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: var(--space-3);">
              <div class="form-group">
                <label class="form-label">Teléfono / WhatsApp</label>
                <input type="tel" id="modal-patient-phone" class="form-control" value="${this.escapeHtml(phone)}" placeholder="Teléfono..." />
              </div>
              <div class="form-group">
                <label class="form-label">Correo Electrónico</label>
                <input type="email" id="modal-patient-email" class="form-control" value="${this.escapeHtml(email)}" placeholder="correo@ejemplo.com" />
              </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div class="form-group">
                <label class="form-label">DNI / NIE / Pasaporte (opcional)</label>
                <input type="text" id="modal-patient-dni" class="form-control" placeholder="12345678X" />
              </div>
              <div class="form-group">
                <label class="form-label">Código Personalizado <small style="color: var(--text-secondary);">(opcional)</small></label>
                <input type="text" id="modal-patient-customid" class="form-control" placeholder="Dejar vacío para auto-generar" />
              </div>
            </div>
          </div>
        </div>

        <div id="convert-mode-existing-section" style="display: none;">
          <div class="crm-info-box">
            <span style="font-size: 1.1rem;">🔗</span>
            <div>
              <strong>Unificación de Historial:</strong> El canal de chat, las oportunidades y notas del lead se enlazarán directamente con el paciente seleccionado.
            </div>
          </div>

          <div class="crm-form-section">
            <div class="crm-form-section__header">
              <span class="crm-form-section__title">🔍 Buscar Paciente Existente</span>
            </div>
            <div class="form-group" style="margin-bottom: var(--space-3);">
              <input type="text" id="filter-existing-patients" class="form-control form-control-sm" placeholder="🔍 Filtrar por nombre, DNI o teléfono..." />
            </div>
            <div class="form-group">
              <label class="form-label">Seleccionar Paciente *</label>
              <select id="modal-patient-existing-id" class="form-control" size="6" style="height: auto;">
                <option value="" disabled>-- Selecciona un paciente de la lista --</option>
                ${patientOptions}
              </select>
            </div>
          </div>
        </div>
      </div>
    `;

    Modal.show({
      title: '🦷 Convertir Lead a Paciente Clínico',
      content: modalContent,
      confirmText: 'Confirmar Conversión',
      cancelText: 'Cancelar',
      size: 'md',
      onOpen: (modalBody) => {
        let currentMode = 'new';
        const pills = modalBody.querySelectorAll('.crm-toggle-pill');
        const newSec = modalBody.querySelector('#convert-mode-new-section');
        const existSec = modalBody.querySelector('#convert-mode-existing-section');
        const filterInput = modalBody.querySelector('#filter-existing-patients');
        const selectExisting = modalBody.querySelector('#modal-patient-existing-id');

        pills.forEach(p => {
          p.addEventListener('click', (e) => {
            pills.forEach(x => x.classList.remove('is-active'));
            const target = e.currentTarget;
            target.classList.add('is-active');
            currentMode = target.dataset.mode;

            if (currentMode === 'new') {
              newSec.style.display = 'block';
              existSec.style.display = 'none';
            } else {
              newSec.style.display = 'none';
              existSec.style.display = 'block';
            }
          });
        });

        if (filterInput && selectExisting) {
          filterInput.addEventListener('input', (e) => {
            const val = e.target.value.toLowerCase().trim();
            Array.from(selectExisting.options).forEach(opt => {
              if (!opt.value) return;
              const text = opt.textContent.toLowerCase();
              opt.style.display = text.includes(val) ? '' : 'none';
            });
          });
        }
      },
      onConfirm: async (modalBody) => {
        const activePill = modalBody.querySelector('.crm-toggle-pill.is-active');
        const mode = activePill ? activePill.dataset.mode : 'new';

        if (mode === 'existing') {
          const patientId = modalBody.querySelector('#modal-patient-existing-id')?.value;
          if (!patientId) {
            toast.error('Debe seleccionar un paciente existente de la lista');
            return false;
          }
          try {
            await crmService.convertToPatient(lead.id, { patientId: parseInt(patientId, 10) });
            toast.success('¡Lead vinculado al paciente clínico exitosamente!');
            await this.loadInitialData();
            this.renderLayout();
            this.renderActiveTab();
            this.bindEvents();
            return true;
          } catch (err) {
            toast.error(err.message || 'Error al vincular paciente');
            return false;
          }
        } else {
          const firstName = modalBody.querySelector('#modal-patient-firstname')?.value.trim();
          const lastName = modalBody.querySelector('#modal-patient-lastname')?.value.trim();
          const phoneVal = modalBody.querySelector('#modal-patient-phone')?.value.trim();
          const emailVal = modalBody.querySelector('#modal-patient-email')?.value.trim();
          const dniVal = modalBody.querySelector('#modal-patient-dni')?.value.trim();
          const customIdVal = modalBody.querySelector('#modal-patient-customid')?.value.trim();

          if (!firstName || !lastName) {
            toast.error('Nombre y apellidos son obligatorios para crear el expediente del paciente');
            return false;
          }

          try {
            await crmService.convertToPatient(lead.id, {
              patientData: {
                first_name: firstName,
                last_name: lastName,
                phone: phoneVal || null,
                email: emailVal || null,
                dni: dniVal || null,
                custom_id: customIdVal || undefined,
              },
            });
            toast.success('¡Expediente creado y lead convertido a paciente exitosamente!');
            await this.loadInitialData();
            this.renderLayout();
            this.renderActiveTab();
            this.bindEvents();
            return true;
          } catch (err) {
            toast.error(err.message || 'Error al crear el expediente del paciente');
            return false;
          }
        }
      },
    });
  }

  openChangeStatusModal(leadId, currentStatus) {
    const modalContent = `
      <form id="change-status-form">
        <div class="form-group" style="margin-bottom: var(--space-3);">
          <label class="form-label">Nuevo Estado del Lead *</label>
          <select id="modal-status-select" class="form-control">
            <option value="new" ${currentStatus === 'new' ? 'selected' : ''}>🆕 Nuevo</option>
            <option value="contacted" ${currentStatus === 'contacted' ? 'selected' : ''}>📞 Contactado</option>
            <option value="qualified" ${currentStatus === 'qualified' ? 'selected' : ''}>⭐ Calificado (Interés confirmado)</option>
            <option value="appointment_scheduled" ${currentStatus === 'appointment_scheduled' ? 'selected' : ''}>📅 Cita Agendada</option>
            <option value="converted" ${currentStatus === 'converted' ? 'selected' : ''}>🦷 Convertido a Paciente</option>
            <option value="lost" ${currentStatus === 'lost' ? 'selected' : ''}>❌ Perdido (Descartado)</option>
          </select>
        </div>
        <div id="loss-reason-group" class="form-group" style="margin-bottom: var(--space-3); display: ${currentStatus === 'lost' ? 'block' : 'none'};">
          <label class="form-label">Motivo de Descarte / Pérdida *</label>
          <input type="text" id="modal-loss-reason" class="form-control" placeholder="Ej: Precio alto, eligió otra clínica, no responde..." />
        </div>
      </form>
    `;

    Modal.show({
      title: '🔄 Cambiar Estado del Lead',
      content: modalContent,
      confirmText: 'Actualizar Estado',
      cancelText: 'Cancelar',
      size: 'sm',
      onOpen: (modalBody) => {
        const select = modalBody.querySelector('#modal-status-select');
        const lossGroup = modalBody.querySelector('#loss-reason-group');
        if (select && lossGroup) {
          select.addEventListener('change', (e) => {
            lossGroup.style.display = e.target.value === 'lost' ? 'block' : 'none';
          });
        }
      },
      onConfirm: async (modalBody) => {
        const select = modalBody.querySelector('#modal-status-select');
        const newStatus = select ? select.value : currentStatus;
        const lossReason = modalBody.querySelector('#modal-loss-reason')?.value.trim();

        if (newStatus === 'converted') {
          Modal.close();
          this.openConvertToPatientModal(leadId);
          return false;
        }

        try {
          await crmService.updateLeadStatus(leadId, newStatus, lossReason || null);
          toast.success('Estado actualizado exitosamente');
          await this.loadInitialData();
          this.renderActiveTab();
          return true;
        } catch (err) {
          toast.error(err.message || 'Error al cambiar estado');
          return false;
        }
      },
    });
  }
}
