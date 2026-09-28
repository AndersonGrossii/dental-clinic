// ============================================
// Página de Automatizaciones Clínicas & Copilot IA (100% Español)
// ============================================
import aiService from '../../services/ai.service.js';
import patientService from '../../services/patient.service.js';
import toast from '../../components/toast/toast.js';
import Modal from '../../components/modal/modal.js';
import { formatDate } from '../../utils/helpers.js';

export class Automations {
  constructor(container) {
    this.container = container;
    this.activeTab = 'rules'; // 'rules' | 'supervision' | 'knowledge' | 'logs' | 'briefing' | 'explainer'
    this.rules = [];
    this.stats = { kpis: {}, recentLogs: [], summary: [] };
    this.briefing = null;
    this.logStatusFilter = 'ALL';
    this.logSearch = '';
    this.patientsList = [];
    this.approvals = [];
    this.approvalFilter = 'PENDING_APPROVAL'; // 'PENDING_APPROVAL' | 'APPROVED' | 'DISCARDED' | 'ALL'
    this.knowledgeArticles = [];

    this.handleContainerClick = this._handleContainerClick.bind(this);
    this.handleContainerChange = this._handleContainerChange.bind(this);
    this.handleContainerInput = this._handleContainerInput.bind(this);
  }

  async render() {
    this.container.innerHTML = `
      <div style="text-align: center; padding: 40px;">
        <div class="spinner"></div>
        <p style="margin-top: 12px; color: var(--color-text-secondary);">Cargando Centro de Automatizaciones & IA...</p>
      </div>
    `;

    this.container.addEventListener('click', this.handleContainerClick);
    this.container.addEventListener('change', this.handleContainerChange);
    this.container.addEventListener('input', this.handleContainerInput);

    await this.loadData();
    this.renderView();
  }

  destroy() {
    this.container.removeEventListener('click', this.handleContainerClick);
    this.container.removeEventListener('change', this.handleContainerChange);
    this.container.removeEventListener('input', this.handleContainerInput);
  }

  async loadData() {
    try {
      const [rulesRes, statsRes, patientsRes, approvalsRes, knowledgeRes] = await Promise.all([
        aiService.getRules().catch(() => ({ data: [] })),
        aiService.getAutomationStats().catch(() => ({ data: {} })),
        patientService.getAll({ limit: 100 }).catch(() => ({ data: [] })),
        aiService.getApprovals('ALL').catch(() => ({ data: [] })),
        aiService.getKnowledge().catch(() => ({ data: [] })),
      ]);

      this.rules = rulesRes?.data || rulesRes || [];
      this.stats = statsRes?.data || statsRes || { kpis: {}, recentLogs: [], summary: [] };
      this.patientsList = patientsRes?.data || (Array.isArray(patientsRes) ? patientsRes : []);
      this.approvals = approvalsRes?.data || (Array.isArray(approvalsRes) ? approvalsRes : []);
      this.knowledgeArticles = knowledgeRes?.data || (Array.isArray(knowledgeRes) ? knowledgeRes : []);
    } catch (err) {
      toast.error('Error al cargar datos de automatizaciones');
    }
  }

  renderView() {
    const kpis = this.stats.kpis || {};
    const totalSent = kpis.totalSent || 0;
    const totalConfirmed = kpis.totalConfirmed || 0;
    const totalCancelled = kpis.totalCancelled || 0;
    const totalRecall = kpis.totalRecallSent || 0;
    const confirmationRate = kpis.confirmationRate !== undefined ? kpis.confirmationRate : 100;

    this.container.innerHTML = `
      <div class="automations-page">
        <!-- Hero Header -->
        <div class="auto-hero">
          <div>
            <div class="auto-hero__title">
              <span>🤖 Central de Automatizaciones & Copilot IA</span>
              <span class="auto-hero__badge">Omnicanal (WhatsApp & Instagram)</span>
            </div>
            <p class="auto-hero__desc">
              Automatice la confirmación de asistencia 24h antes de las citas, reactive pacientes ausentes mediante recall preventivo y genere briefings operativos matutinos en segundos.
            </p>
          </div>
          <div class="auto-hero__actions">
            <button id="hero-run-confirmations-btn" class="auto-hero__btn auto-hero__btn--primary">
              <span>📲</span> Disparar Confirmaciones 24h
            </button>
            <button id="hero-run-recall-btn" class="auto-hero__btn">
              <span>🔄</span> Ejecutar Recall Diario
            </button>
            <button id="hero-view-briefing-btn" class="auto-hero__btn">
              <span>☀️</span> Briefing del Día
            </button>
          </div>
        </div>

        <!-- KPI Metrics Grid -->
        <div class="auto-kpi-grid">
          <div class="auto-kpi-card">
            <div class="auto-kpi-icon auto-kpi-icon--blue">📲</div>
            <div>
              <div class="auto-kpi-val">${totalSent}</div>
              <div class="auto-kpi-lbl">Mensajes Enviados</div>
            </div>
          </div>
          <div class="auto-kpi-card">
            <div class="auto-kpi-icon auto-kpi-icon--green">✅</div>
            <div>
              <div class="auto-kpi-val">${totalConfirmed} <span style="font-size: 0.9rem; font-weight: 500; color: #16a34a;">(${confirmationRate}%)</span></div>
              <div class="auto-kpi-lbl">Citas Confirmadas</div>
            </div>
          </div>
          <div class="auto-kpi-card">
            <div class="auto-kpi-icon auto-kpi-icon--amber">⚡</div>
            <div>
              <div class="auto-kpi-val">${totalCancelled}</div>
              <div class="auto-kpi-lbl">Huecos Liberados (Cancelaciones)</div>
            </div>
          </div>
          <div class="auto-kpi-card">
            <div class="auto-kpi-icon auto-kpi-icon--purple">🔄</div>
            <div>
              <div class="auto-kpi-val">${totalRecall}</div>
              <div class="auto-kpi-lbl">Pacientes de Recall Contactados</div>
            </div>
          </div>
        </div>

        <!-- Navigation Tabs -->
        <div class="auto-tabs">
          <button class="auto-tab-btn ${this.activeTab === 'rules' ? 'auto-tab-btn--active' : ''}" data-tab="rules">
            <span>⚙️</span> Reglas & Flujos
          </button>
          <button class="auto-tab-btn ${this.activeTab === 'supervision' ? 'auto-tab-btn--active' : ''}" data-tab="supervision">
            <span>🛡️</span> Supervisión Presupuestos ${this.approvals.filter(a => a.status === 'PENDING_APPROVAL').length > 0 ? `<span class="badge" style="background:#ef4444;color:#fff;margin-left:4px;padding:2px 7px;border-radius:10px;font-size:0.75rem;">${this.approvals.filter(a => a.status === 'PENDING_APPROVAL').length}</span>` : `(${this.approvals.length})`}
          </button>
          <button class="auto-tab-btn ${this.activeTab === 'knowledge' ? 'auto-tab-btn--active' : ''}" data-tab="knowledge">
            <span>🧠</span> Base de Conocimiento IA (${this.knowledgeArticles.length})
          </button>
          <button class="auto-tab-btn ${this.activeTab === 'logs' ? 'auto-tab-btn--active' : ''}" data-tab="logs">
            <span>📋</span> Registro & Auditoría (${(this.stats.recentLogs || []).length})
          </button>
          <button class="auto-tab-btn ${this.activeTab === 'briefing' ? 'auto-tab-btn--active' : ''}" data-tab="briefing">
            <span>☀️</span> Briefing Operativo IA
          </button>
          <button class="auto-tab-btn ${this.activeTab === 'explainer' ? 'auto-tab-btn--active' : ''}" data-tab="explainer">
            <span>💬</span> Explicador de Presupuestos IA
          </button>
        </div>

        <!-- Tab Content Views -->
        <div class="auto-tab-content">
          ${this.renderTabContent()}
        </div>
      </div>
    `;
  }

  renderTabContent() {
    if (this.activeTab === 'rules') return this.renderRulesTab();
    if (this.activeTab === 'supervision') return this.renderSupervisionTab();
    if (this.activeTab === 'knowledge') return this.renderKnowledgeTab();
    if (this.activeTab === 'logs') return this.renderLogsTab();
    if (this.activeTab === 'briefing') return this.renderBriefingTab();
    if (this.activeTab === 'explainer') return this.renderExplainerTab();
    return '';
  }

  renderRulesTab() {
    const defaultRules = [
      {
        id: 1,
        rule_type: 'CONFIRMATION_24H',
        title: 'Confirmación de Cita 24h',
        icon: '📱',
        desc: 'Escanea citas programadas para el día siguiente y envía mensaje interactivo solicitando respuesta 1 (Confirmar) o 2 (Cancelar).',
        trigger_timing: '24h antes a las 09:00',
        channel: 'WHATSAPP',
        is_active: true,
        template_body: '¡Hola {{patient_name}}! 🦷 Le recordamos su cita mañana {{date}} a las {{time}} con {{doctor_name}} en Clínica Vides Dental.\n\nPor favor, responda:\n1️⃣ para CONFIRMAR su asistencia\n2️⃣ para SOLICITAR REAGENDAR o CANCELAR'
      },
      {
        id: 2,
        rule_type: 'RECALL_HYGIENE_6M',
        title: 'Recall Limpieza Semestral (+180 Días)',
        icon: '🔄',
        desc: 'Identifica pacientes cuya última profilaxis o limpieza dental fue hace 6 meses o más y no tienen citas programadas activas.',
        trigger_timing: '1x al día (Diario a las 10:00)',
        channel: 'WHATSAPP',
        is_active: true,
        template_body: '¡Hola {{patient_name}}! 🦷✨ Han pasado 6 meses desde su última limpieza dental en Clínica Vides Dental. La prevención es la clave para una sonrisa sana.\n\n¿Desea que le agendemos su revisión preventiva para esta semana?'
      },
      {
        id: 3,
        rule_type: 'RECALL_SURGERY_7D',
        title: 'Control Post-Quirúrgico (+7 Días)',
        icon: '🩹',
        desc: 'Detecta pacientes intervenidos quirúrgicamente hace 7 días para revisión clínica preventiva y retirada de suturas.',
        trigger_timing: '1x al día (Diario a las 11:00)',
        channel: 'WHATSAPP',
        is_active: true,
        template_body: '¡Hola {{patient_name}}! 🦷 Esperamos que su recuperación vaya excelente tras su procedimiento. Le recordamos su revisión de control y retiro de puntos.\n\n¿Qué horario le viene mejor esta semana?'
      },
      {
        id: 4,
        rule_type: 'RECALL_ORTHO_30D',
        title: 'Mantenimiento Ortodóntico Mensual (+30 Días)',
        icon: '🦷',
        desc: 'Identifica pacientes en tratamiento de ortodoncia con más de 30 días transcurridos desde su último ajuste de brackets o alineadores.',
        trigger_timing: '1x al día (Diario a las 11:30)',
        channel: 'WHATSAPP',
        is_active: true,
        template_body: '¡Hola {{patient_name}}! 🦷✨ Es momento de agendar su cita de ajuste y control ortodóntico mensual para continuar el progreso de su sonrisa.'
      }
    ];

    const displayRules = this.rules.length > 0 ? this.rules : defaultRules;

    return `
      <div class="auto-rules-grid">
        ${displayRules.map(rule => {
          const formattedBubble = this.formatTemplateBubble(rule.template_body);
          return `
            <div class="auto-rule-card">
              <div>
                <div class="auto-rule-header">
                  <div style="display: flex; gap: 12px; align-items: center;">
                    <div class="auto-rule-icon">${rule.icon || '🤖'}</div>
                    <div>
                      <h3 class="auto-rule-title">${this.escapeHtml(rule.title || rule.rule_type)}</h3>
                      <p class="auto-rule-desc">${this.escapeHtml(rule.desc || '')}</p>
                    </div>
                  </div>
                  <span class="auto-badge ${rule.is_active ? 'auto-badge--active' : 'auto-badge--paused'}">
                    ${rule.is_active ? '● Activo' : '○ Pausado'}
                  </span>
                </div>

                <div style="margin: 14px 0 6px 0;">
                  <span style="font-size: 0.74rem; font-weight: 700; color: var(--color-text-secondary); text-transform: uppercase;">Plantilla del Mensaje:</span>
                  <div class="auto-preview-bubble" style="margin-top: 6px;">${formattedBubble}</div>
                </div>
              </div>

              <div>
                <div class="auto-rule-meta">
                  <span>⏱️ Frecuencia: <strong>${this.escapeHtml(rule.trigger_timing || 'Diario')}</strong></span>
                  <span>📱 Canal: <strong>${rule.channel || 'WHATSAPP'}</strong></span>
                </div>

                <div class="auto-rule-actions" style="margin-top: 14px;">
                  <button class="btn btn-sm btn-primary run-rule-btn" data-rule="${rule.rule_type}" style="flex: 1;">
                    ▶️ Ejecutar Ahora
                  </button>
                  <button class="btn btn-sm btn-outline edit-rule-btn" data-rule-id="${rule.id}">
                    ✏️ Editar
                  </button>
                  <button class="btn btn-sm btn-outline toggle-rule-btn" data-rule-id="${rule.id}" data-active="${rule.is_active}">
                    ${rule.is_active ? '⏸️ Pausar' : '▶️ Activar'}
                  </button>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  renderLogsTab() {
    const rawLogs = this.stats.recentLogs || [];
    let filteredLogs = rawLogs;

    if (this.logStatusFilter !== 'ALL') {
      filteredLogs = filteredLogs.filter(l => l.status === this.logStatusFilter);
    }

    if (this.logSearch) {
      const q = this.logSearch.toLowerCase();
      filteredLogs = filteredLogs.filter(l => 
        (l.first_name || '').toLowerCase().includes(q) ||
        (l.last_name || '').toLowerCase().includes(q) ||
        (l.rule_type || '').toLowerCase().includes(q)
      );
    }

    const rows = filteredLogs.length > 0
      ? filteredLogs.map(log => {
          const dateStr = new Date(log.executed_at).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
          const badgeClass = log.status === 'CONFIRMED' 
            ? 'auto-badge--confirmed' 
            : log.status === 'CANCELLED' 
            ? 'auto-badge--cancelled' 
            : 'auto-badge--sent';

          return `
            <tr>
              <td><span style="font-size: 0.82rem; font-weight: 600;">📅 ${dateStr}</span></td>
              <td><strong>${this.escapeHtml(log.rule_type)}</strong></td>
              <td>
                ${log.patient_id 
                  ? `<a href="#/patients/${log.patient_id}" style="color: var(--color-primary); font-weight: 600; text-decoration: underline;">${this.escapeHtml(log.first_name || 'Paciente')} ${this.escapeHtml(log.last_name || '')}</a>`
                  : 'Paciente'}
              </td>
              <td><span class="badge" style="background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe;">📱 ${log.channel}</span></td>
              <td><span class="auto-badge ${badgeClass}">${log.status}</span></td>
              <td>
                <button class="btn btn-xs btn-outline view-log-details-btn" data-log-id="${log.id}">🔍 Ver Detalles</button>
              </td>
            </tr>
          `;
        }).join('')
      : `<tr><td colspan="6" style="text-align: center; color: var(--color-text-secondary); padding: 32px;">No se encontraron registros para los filtros seleccionados.</td></tr>`;

    return `
      <div class="auto-logs-card">
        <div class="auto-logs-filter-bar">
          <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
            <span style="font-size: 0.82rem; font-weight: 700; color: var(--color-text-secondary); text-transform: uppercase;">Filtrar Estado:</span>
            <button class="btn btn-xs ${this.logStatusFilter === 'ALL' ? 'btn-primary' : 'btn-outline'} filter-log-status" data-status="ALL">Todos</button>
            <button class="btn btn-xs ${this.logStatusFilter === 'CONFIRMED' ? 'btn-primary' : 'btn-outline'} filter-log-status" data-status="CONFIRMED">✅ Confirmados</button>
            <button class="btn btn-xs ${this.logStatusFilter === 'CANCELLED' ? 'btn-primary' : 'btn-outline'} filter-log-status" data-status="CANCELLED">❌ Cancelados</button>
            <button class="btn btn-xs ${this.logStatusFilter === 'SENT' ? 'btn-primary' : 'btn-outline'} filter-log-status" data-status="SENT">📤 Enviados</button>
          </div>

          <div style="min-width: 220px;">
            <input type="text" id="log-search-input" class="form-input" placeholder="Buscar por paciente..." value="${this.escapeHtml(this.logSearch)}" style="font-size: 0.82rem; padding: 6px 12px;" />
          </div>
        </div>

        <div class="table-container" style="margin: 0; border: none; border-radius: 0;">
          <table>
            <thead>
              <tr>
                <th>Fecha / Hora</th>
                <th>Regla</th>
                <th>Paciente</th>
                <th>Canal</th>
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

  renderBriefingTab() {
    return `
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h3 style="margin: 0; font-size: 1.15rem; font-weight: 700;">☀️ Briefing Operativo del Día (Recepción)</h3>
          <button id="refresh-briefing-btn" class="btn btn-sm btn-outline">🔄 Actualizar con IA</button>
        </div>

        <div id="briefing-content-container" class="auto-briefing-box">
          <div style="text-align: center; padding: 20px;">
            <div class="spinner"></div>
            <p style="margin-top: 8px;">Generando resumen inteligente...</p>
          </div>
        </div>
      </div>
    `;
  }

  renderExplainerTab() {
    const patientOptions = this.patientsList.map(p => 
      `<option value="${p.id}">${this.escapeHtml(p.first_name)} ${this.escapeHtml(p.last_name)} (${p.custom_id || 'ID ' + p.id})</option>`
    ).join('');

    return `
      <div class="auto-explainer-card">
        <div style="display: flex; flex-direction: column; gap: 14px;">
          <div>
            <h3 style="margin: 0 0 4px 0; font-size: 1.1rem; font-weight: 700;">💬 Traductor de Presupuestos para Pacientes</h3>
            <p style="margin: 0; font-size: 0.84rem; color: var(--color-text-secondary);">
              Genera una explicación cercana, empática y sin tecnicismos complejos para envío directo por WhatsApp.
            </p>
          </div>

          <div class="form-group" style="margin: 0;">
            <label class="form-label" style="font-size: 0.8rem;">Paciente Destinatario</label>
            <select id="explainer-patient-select" class="form-select">
              <option value="">Seleccione un paciente...</option>
              ${patientOptions}
            </select>
          </div>

          <div class="form-group" style="margin: 0;">
            <label class="form-label" style="font-size: 0.8rem;">Tratamientos / Procedimientos (Ej: Limpieza, 2 Obturaciones, Corona)</label>
            <textarea id="explainer-items-input" class="form-textarea" rows="3" placeholder="Ej: Profilaxis dental profunda, Obturación de resina pieza 16, Corona de porcelana..."></textarea>
          </div>

          <div class="form-group" style="margin: 0;">
            <label class="form-label" style="font-size: 0.8rem;">Importe Total (€ / $)</label>
            <input type="number" id="explainer-amount-input" class="form-input" placeholder="Ej: 250" />
          </div>

          <button id="generate-explanation-btn" class="btn btn-primary" style="margin-top: 6px;">
            ✨ Generar Explicación Cercana
          </button>
        </div>

        <div style="display: flex; flex-direction: column; gap: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 0.82rem; font-weight: 700; color: var(--color-text-secondary); text-transform: uppercase;">Mensaje Listo para WhatsApp:</span>
            <button id="copy-explanation-btn" class="btn btn-xs btn-outline" style="display: none;">📋 Copiar Texto</button>
          </div>
          <div id="explanation-output-box" class="auto-preview-bubble" style="min-height: 200px; display: flex; align-items: center; justify-content: center; color: #6b7280; font-style: italic;">
            Complete los datos de la izquierda y haga clic en "Generar Explicación Cercana".
          </div>
        </div>
      </div>
    `;
  }

  renderSupervisionTab() {
    const filteredApprovals = this.approvals.filter(a => {
      if (this.approvalFilter === 'ALL') return true;
      if (this.approvalFilter === 'APPROVED') return a.status === 'APPROVED' || a.status === 'SENT';
      return a.status === this.approvalFilter;
    });

    const pendingCount = this.approvals.filter(a => a.status === 'PENDING_APPROVAL').length;
    const approvedCount = this.approvals.filter(a => a.status === 'APPROVED' || a.status === 'SENT').length;
    const discardedCount = this.approvals.filter(a => a.status === 'DISCARDED').length;

    return `
      <div>
        <!-- Human-in-the-Loop Header Banner -->
        <div class="auto-supervision-header">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 1.25rem;">🛡️</span>
              <h3 style="margin: 0; font-size: 1.15rem; font-weight: 700; color: #92400e;">
                Cola de Supervisión Humana — Presupuestos (+48h)
              </h3>
            </div>
            <p style="margin: 6px 0 0 0; font-size: 0.88rem; color: #78350f; max-width: 680px; line-height: 1.45;">
              Seguimiento supervisado de presupuestos entregados hace más de 48 horas sin respuesta. Por protocolo de clínica, <strong>ningún mensaje se envía automáticamente</strong> sin validación previa por parte del equipo de recepción o dirección.
            </p>
          </div>
          <div>
            <button id="btn-scan-quotations" class="btn btn-primary" style="display: flex; align-items: center; gap: 8px;">
              <span>🔄</span> Escanear Presupuestos (+48h)
            </button>
          </div>
        </div>

        <!-- Filter Bar -->
        <div class="auto-supervision-filter-bar">
          <button class="btn btn-sm ${this.approvalFilter === 'PENDING_APPROVAL' ? 'btn-primary' : 'btn-outline'} filter-approval-status" data-status="PENDING_APPROVAL">
            ⏳ Pendientes de Revisión (${pendingCount})
          </button>
          <button class="btn btn-sm ${this.approvalFilter === 'APPROVED' ? 'btn-primary' : 'btn-outline'} filter-approval-status" data-status="APPROVED">
            ✅ Aprobados / Enviados (${approvedCount})
          </button>
          <button class="btn btn-sm ${this.approvalFilter === 'DISCARDED' ? 'btn-primary' : 'btn-outline'} filter-approval-status" data-status="DISCARDED">
            ❌ Descartados (${discardedCount})
          </button>
          <button class="btn btn-sm ${this.approvalFilter === 'ALL' ? 'btn-primary' : 'btn-outline'} filter-approval-status" data-status="ALL">
            Todos (${this.approvals.length})
          </button>
        </div>

        <!-- Approvals Grid / Empty State -->
        ${filteredApprovals.length === 0 ? `
          <div style="text-align: center; padding: 48px; background: #ffffff; border-radius: 12px; border: 1px dashed var(--color-border, #e5e7eb);">
            <div style="font-size: 2.2rem; margin-bottom: 8px;">🛡️</div>
            <h4 style="margin: 0 0 6px 0; font-size: 1.1rem; color: var(--color-text-primary);">No hay mensajes en esta bandeja</h4>
            <p style="margin: 0; font-size: 0.88rem; color: var(--color-text-secondary);">
              ${this.approvalFilter === 'PENDING_APPROVAL' 
                ? '¡Excelente! Todos los seguimientos de presupuestos pendientes han sido revisados.'
                : 'No existen registros para el filtro seleccionado.'}
            </p>
          </div>
        ` : `
          <div class="auto-supervision-grid">
            ${filteredApprovals.map(a => {
              const isPending = a.status === 'PENDING_APPROVAL';
              const isApproved = a.status === 'APPROVED' || a.status === 'SENT';
              const isDiscarded = a.status === 'DISCARDED';

              const statusBadge = isPending
                ? `<span class="auto-badge" style="background:#fef3c7; color:#b45309; border:1px solid #fde68a;">⏳ Pendiente de Aprobación</span>`
                : isApproved
                ? `<span class="auto-badge" style="background:#dcfce7; color:#15803d; border:1px solid #86efac;">✅ Aprobado / Enviado</span>`
                : `<span class="auto-badge" style="background:#fee2e2; color:#b91c1c; border:1px solid #fca5a5;">❌ Descartado</span>`;

              const patientName = a.patient_name || `${a.first_name || ''} ${a.last_name || ''}`.trim() || 'Paciente sin nombre';
              const phone = a.patient_phone || a.phone || 'Teléfono no registrado';
              const createdDate = new Date(a.created_at).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });

              return `
                <div class="auto-approval-card" data-id="${a.id}">
                  <div>
                    <div class="auto-approval-card__header">
                      <div>
                        <div class="auto-approval-card__patient">👤 ${this.escapeHtml(patientName)}</div>
                        <div class="auto-approval-card__meta">
                          📞 ${this.escapeHtml(phone)} &bull; Presupuesto #${a.quotation_id || a.reference_id || 'N/A'}
                        </div>
                      </div>
                      ${statusBadge}
                    </div>

                    <div style="margin-top: 14px;">
                      <div style="font-size: 0.78rem; font-weight: 700; color: #4b5563; text-transform: uppercase; margin-bottom: 6px;">
                        Mensaje WhatsApp Propuesto por Sofía:
                      </div>
                      <div class="auto-approval-card__bubble">
                        ${this.escapeHtml(a.proposed_message || '').replace(/\n/g, '<br/>')}
                      </div>
                    </div>
                  </div>

                  <div>
                    <div style="font-size: 0.76rem; color: #9ca3af; margin-bottom: 10px;">
                      Generado: ${createdDate} ${a.reviewed_at ? `&bull; Revisado: ${new Date(a.reviewed_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}` : ''}
                    </div>

                    ${isPending ? `
                      <div class="auto-approval-card__actions">
                        <button class="btn btn-sm btn-primary btn-approve-approval" data-id="${a.id}" title="Aprobar y disparar mensaje por WhatsApp">
                          <span>✓</span> Aprobar y Enviar
                        </button>
                        <button class="btn btn-sm btn-outline btn-edit-approval" data-id="${a.id}" title="Editar texto antes de enviar">
                          <span>✏️</span> Modificar
                        </button>
                        <button class="btn btn-sm btn-outline btn-discard-approval" data-id="${a.id}" style="color: #b91c1c;" title="Descartar este seguimiento">
                          <span>✕</span> Descartar
                        </button>
                      </div>
                    ` : `
                      <div style="font-size: 0.82rem; color: #6b7280; font-style: italic;">
                        ${isApproved ? '✓ Mensaje procesado y despachado al canal de WhatsApp.' : '✕ Mensaje descartado por el equipo.'}
                      </div>
                    `}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>
    `;
  }

  renderKnowledgeTab() {
    return `
      <div>
        <!-- RAG Header Banner -->
        <div class="auto-knowledge-header">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 1.25rem;">🧠</span>
              <h3 style="margin: 0; font-size: 1.15rem; font-weight: 700; color: #1e40af;">
                Base de Conocimiento IA (RAG Sofía)
              </h3>
            </div>
            <p style="margin: 6px 0 0 0; font-size: 0.88rem; color: #1e3a8a; max-width: 680px; line-height: 1.45;">
              Respuestas oficiales y contexto clínico por sede. Sofía consulta estos artículos para responder dudas de pacientes, <strong>garantizando el protocolo de cero precios</strong> y promoviendo la primera revisión gratuita en clínica.
            </p>
          </div>
          <div>
            <button id="btn-new-knowledge" class="btn btn-primary" style="display: flex; align-items: center; gap: 8px;">
              <span>➕</span> Nuevo Artículo RAG
            </button>
          </div>
        </div>

        <!-- Articles Grid / Empty State -->
        ${this.knowledgeArticles.length === 0 ? `
          <div style="text-align: center; padding: 48px; background: #ffffff; border-radius: 12px; border: 1px dashed var(--color-border, #e5e7eb);">
            <div style="font-size: 2.2rem; margin-bottom: 8px;">📚</div>
            <h4 style="margin: 0 0 6px 0; font-size: 1.1rem; color: var(--color-text-primary);">No hay artículos de conocimiento registrados</h4>
            <p style="margin: 0 0 16px 0; font-size: 0.88rem; color: var(--color-text-secondary);">
              Añada artículos para alimentar la memoria de Sofía y guiar las respuestas a los pacientes.
            </p>
            <button id="btn-new-knowledge-empty" class="btn btn-primary">➕ Añadir Primer Artículo</button>
          </div>
        ` : `
          <div class="auto-knowledge-grid">
            ${this.knowledgeArticles.map(art => `
              <div class="auto-knowledge-card">
                <div>
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span class="auto-badge" style="background:#dbeafe; color:#1d4ed8; text-transform:uppercase; font-size:0.7rem;">
                      ${this.escapeHtml(art.category || 'General')}
                    </span>
                    <span style="font-size: 0.75rem; color: #9ca3af;">
                      ${art.is_active !== false ? '🟢 Activo' : '⚪ Inactivo'}
                    </span>
                  </div>
                  <div class="auto-knowledge-card__topic">
                    ❓ ${this.escapeHtml(art.topic || '')}
                  </div>
                  <div class="auto-knowledge-card__answer">
                    💡 ${this.escapeHtml(art.answer || '').replace(/\n/g, '<br/>')}
                  </div>
                </div>
                <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; border-top: 1px solid #f3f4f6; padding-top: 10px;">
                  <button class="btn btn-xs btn-outline btn-edit-knowledge" data-id="${art.id}">
                    ✏️ Editar
                  </button>
                  <button class="btn btn-xs btn-outline btn-delete-knowledge" data-id="${art.id}" style="color: #dc2626;">
                    🗑️ Eliminar
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;
  }

  formatTemplateBubble(templateStr) {
    if (!templateStr) return '';
    return this.escapeHtml(templateStr)
      .replace(/\{\{(patient_name|date|time|doctor_name)\}\}/g, '<span class="var-pill">{{$1}}</span>')
      .replace(/\n/g, '<br/>');
  }

  async _handleContainerClick(e) {
    // 1. Cambio de pestaña
    const tabBtn = e.target.closest('.auto-tab-btn');
    if (tabBtn?.dataset.tab) {
      this.activeTab = tabBtn.dataset.tab;
      this.renderView();
      if (this.activeTab === 'briefing') {
        this.fetchAndRenderBriefing();
      }
      return;
    }

    // 2. Acciones rápidas del Hero
    if (e.target.id === 'hero-run-confirmations-btn') {
      await this.runConfirmations();
      return;
    }
    if (e.target.id === 'hero-run-recall-btn') {
      await this.runRecall();
      return;
    }
    if (e.target.id === 'hero-view-briefing-btn') {
      this.activeTab = 'briefing';
      this.renderView();
      this.fetchAndRenderBriefing();
      return;
    }

    // Acciones de Supervisión Humana
    if (e.target.id === 'btn-scan-quotations' || e.target.closest('#btn-scan-quotations')) {
      await this.scanQuotations();
      return;
    }

    const filterApprovalBtn = e.target.closest('.filter-approval-status');
    if (filterApprovalBtn?.dataset.status) {
      this.approvalFilter = filterApprovalBtn.dataset.status;
      const content = this.container.querySelector('.auto-tab-content');
      if (content && this.activeTab === 'supervision') {
        content.innerHTML = this.renderSupervisionTab();
      }
      return;
    }

    const approveBtn = e.target.closest('.btn-approve-approval');
    if (approveBtn?.dataset.id) {
      await this.approveApproval(parseInt(approveBtn.dataset.id, 10));
      return;
    }

    const editApprovalBtn = e.target.closest('.btn-edit-approval');
    if (editApprovalBtn?.dataset.id) {
      this.showEditApprovalModal(parseInt(editApprovalBtn.dataset.id, 10));
      return;
    }

    const discardApprovalBtn = e.target.closest('.btn-discard-approval');
    if (discardApprovalBtn?.dataset.id) {
      await this.discardApproval(parseInt(discardApprovalBtn.dataset.id, 10));
      return;
    }

    // Acciones de Base de Conocimiento RAG
    if (e.target.id === 'btn-new-knowledge' || e.target.closest('#btn-new-knowledge') || e.target.id === 'btn-new-knowledge-empty') {
      this.showNewKnowledgeModal();
      return;
    }

    const editKnowledgeBtn = e.target.closest('.btn-edit-knowledge');
    if (editKnowledgeBtn?.dataset.id) {
      this.showEditKnowledgeModal(parseInt(editKnowledgeBtn.dataset.id, 10));
      return;
    }

    const deleteKnowledgeBtn = e.target.closest('.btn-delete-knowledge');
    if (deleteKnowledgeBtn?.dataset.id) {
      await this.deleteKnowledge(parseInt(deleteKnowledgeBtn.dataset.id, 10));
      return;
    }

    // 3. Acciones de las tarjetas de regla
    const runBtn = e.target.closest('.run-rule-btn');
    if (runBtn?.dataset.rule) {
      const ruleType = runBtn.dataset.rule;
      if (ruleType === 'CONFIRMATION_24H') {
        await this.runConfirmations();
      } else {
        await this.runRecall();
      }
      return;
    }

    const editRuleBtn = e.target.closest('.edit-rule-btn');
    if (editRuleBtn?.dataset.ruleId) {
      this.showEditRuleModal(parseInt(editRuleBtn.dataset.ruleId, 10));
      return;
    }

    const toggleRuleBtn = e.target.closest('.toggle-rule-btn');
    if (toggleRuleBtn?.dataset.ruleId) {
      const ruleId = parseInt(toggleRuleBtn.dataset.ruleId, 10);
      const isCurrentlyActive = toggleRuleBtn.dataset.active === 'true';
      await this.toggleRule(ruleId, !isCurrentlyActive);
      return;
    }

    // 4. Filtros de logs
    const logStatusBtn = e.target.closest('.filter-log-status');
    if (logStatusBtn?.dataset.status) {
      this.logStatusFilter = logStatusBtn.dataset.status;
      const logsView = this.container.querySelector('.auto-tab-content');
      if (logsView && this.activeTab === 'logs') {
        logsView.innerHTML = this.renderLogsTab();
      }
      return;
    }

    // 5. Modal de detalles de log
    const viewLogBtn = e.target.closest('.view-log-details-btn');
    if (viewLogBtn?.dataset.logId) {
      this.showLogDetailsModal(parseInt(viewLogBtn.dataset.logId, 10));
      return;
    }

    // 6. Generación y copia de explicación de presupuesto
    if (e.target.id === 'generate-explanation-btn') {
      await this.generateQuotationExplanation();
      return;
    }
    if (e.target.id === 'copy-explanation-btn') {
      const outputBox = this.container.querySelector('#explanation-output-box');
      if (outputBox) {
        navigator.clipboard.writeText(outputBox.innerText);
        toast.success('¡Texto copiado al portapapeles!');
      }
      return;
    }

    if (e.target.id === 'refresh-briefing-btn') {
      this.fetchAndRenderBriefing();
      return;
    }
  }

  _handleContainerChange(e) {
    if (e.target.id === 'explainer-patient-select') {
      const selectedId = e.target.value;
      const patient = this.patientsList.find(p => String(p.id) === String(selectedId));
      if (patient) {
        toast.info(`Paciente ${patient.first_name} seleccionado`);
      }
    }
  }

  _handleContainerInput(e) {
    if (e.target.id === 'log-search-input') {
      this.logSearch = e.target.value;
      const logsView = this.container.querySelector('.auto-tab-content');
      if (logsView && this.activeTab === 'logs') {
        logsView.innerHTML = this.renderLogsTab();
      }
    }
  }

  async runConfirmations() {
    try {
      toast.info('Iniciando envío de confirmaciones para citas de mañana...');
      const res = await aiService.trigger24hConfirmations();
      const count = res?.data?.sent || res?.sent || 0;
      toast.success(`✅ ${count} confirmaciones de asistencia enviadas vía WhatsApp.`);
      await this.loadData();
      this.renderView();
    } catch (err) {
      toast.error('Error al disparar confirmaciones 24h');
    }
  }

  async runRecall() {
    try {
      toast.info('Iniciando barrido preventivo de pacientes...');
      const res = await aiService.triggerRecallSweep();
      const total = res?.data?.total || res?.total || 0;
      toast.success(`✅ ${total} mensajes de recall preventivo disparados.`);
      await this.loadData();
      this.renderView();
    } catch (err) {
      toast.error('Error al ejecutar recall');
    }
  }

  async toggleRule(ruleId, nextActiveState) {
    try {
      await aiService.updateRule(ruleId, { is_active: nextActiveState });
      toast.success(`Regla ${nextActiveState ? 'activada' : 'pausada'} con éxito.`);
      await this.loadData();
      this.renderView();
    } catch (err) {
      toast.error('Error al actualizar regla');
    }
  }

  showEditRuleModal(ruleId) {
    const rule = this.rules.find(r => r.id === ruleId) || {
      id: ruleId,
      template_body: '¡Hola {{patient_name}}! Le recordamos su cita.'
    };

    const content = `
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <p style="margin: 0; font-size: 0.85rem; color: var(--color-text-secondary);">
          Personalice la plantilla de mensaje enviada por WhatsApp. Variables admitidas: <code>{{patient_name}}</code>, <code>{{date}}</code>, <code>{{time}}</code>, <code>{{doctor_name}}</code>.
        </p>
        <div class="form-group" style="margin: 0;">
          <label class="form-label" style="font-size: 0.8rem;">Texto de la Plantilla</label>
          <textarea id="modal-template-input" class="form-textarea" rows="6">${this.escapeHtml(rule.template_body)}</textarea>
        </div>
      </div>
    `;

    Modal.show({
      title: '✏️ Editar Plantilla de Mensaje WhatsApp',
      content,
      confirmText: 'Guardar Cambios',
      cancelText: 'Cancelar',
      onConfirm: async () => {
        const newBody = document.getElementById('modal-template-input')?.value;
        if (!newBody) return false;
        try {
          await aiService.updateRule(rule.id, { template_body: newBody });
          toast.success('¡Plantilla actualizada!');
          await this.loadData();
          this.renderView();
          return true;
        } catch {
          toast.error('Error al guardar plantilla');
          return false;
        }
      }
    });
  }

  showLogDetailsModal(logId) {
    const log = (this.stats.recentLogs || []).find(l => l.id === logId);
    if (!log) return;

    const content = `
      <div style="display: flex; flex-direction: column; gap: 12px; font-size: 0.88rem;">
        <div style="display: flex; justify-content: space-between;">
          <span><strong>Regla:</strong> ${log.rule_type}</span>
          <span class="auto-badge auto-badge--confirmed">${log.status}</span>
        </div>
        <div>
          <strong>Paciente:</strong> ${log.first_name || ''} ${log.last_name || ''}
        </div>
        <div>
          <strong>Canal:</strong> ${log.channel}
        </div>
        <div>
          <strong>Fecha de Ejecución:</strong> ${new Date(log.executed_at).toLocaleString('es-ES')}
        </div>
        <div style="margin-top: 8px;">
          <strong>Detalles / Carga de Datos:</strong>
          <pre style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px; border-radius: 6px; font-size: 0.78rem; max-height: 180px; overflow: auto;">${JSON.stringify(log.details || {}, null, 2)}</pre>
        </div>
      </div>
    `;

    Modal.show({
      title: '🔍 Detalles de Ejecución de Automatización',
      content,
      cancelText: 'Cerrar',
    });
  }

  async fetchAndRenderBriefing() {
    const container = this.container.querySelector('#briefing-content-container');
    if (!container) return;

    try {
      const res = await aiService.getBriefing();
      const briefing = res?.data || res || {};
      const summaryText = briefing.summary || 'Resumen matutino no disponible en este momento.';

      container.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 16px;">
          <div>${summaryText.replace(/\n/g, '<br/>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</div>
          
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-top: 8px;">
            <div style="background: #ffffff; padding: 12px; border-radius: 8px; border: 1px solid #86efac; text-align: center;">
              <div style="font-size: 1.4rem; font-weight: 700; color: #166534;">${briefing.metrics?.totalAppointments || 0}</div>
              <div style="font-size: 0.76rem; color: #15803d;">Citas Programadas Hoy</div>
            </div>
            <div style="background: #ffffff; padding: 12px; border-radius: 8px; border: 1px solid #86efac; text-align: center;">
              <div style="font-size: 1.4rem; font-weight: 700; color: #854d0e;">${briefing.metrics?.pendingConfirmations || 0}</div>
              <div style="font-size: 0.76rem; color: #a16207;">Pendientes de Confirmar</div>
            </div>
            <div style="background: #ffffff; padding: 12px; border-radius: 8px; border: 1px solid #86efac; text-align: center;">
              <div style="font-size: 1.4rem; font-weight: 700; color: #9d174d;">${briefing.metrics?.recallsAvailable || 0}</div>
              <div style="font-size: 0.76rem; color: #be185d;">Oportunidades de Recall</div>
            </div>
          </div>
        </div>
      `;
    } catch {
      container.innerHTML = `<p style="color: #b91c1c;">Error al generar el briefing matutino de IA.</p>`;
    }
  }

  async generateQuotationExplanation() {
    const patientSelect = this.container.querySelector('#explainer-patient-select');
    const itemsInput = this.container.querySelector('#explainer-items-input');
    const amountInput = this.container.querySelector('#explainer-amount-input');
    const outputBox = this.container.querySelector('#explanation-output-box');
    const copyBtn = this.container.querySelector('#copy-explanation-btn');

    const patientName = patientSelect?.selectedOptions?.[0]?.text?.split(' (')[0] || 'Estimado/a Paciente';
    const rawItems = itemsInput?.value || '';
    const totalAmount = parseFloat(amountInput?.value) || 0;

    if (!rawItems) {
      toast.error('Indique al menos un procedimiento');
      return;
    }

    const items = rawItems.split('\n').filter(Boolean).map(line => ({ description: line.trim() }));

    outputBox.innerHTML = '<div class="spinner"></div><span style="margin-left: 8px;">Generando explicación cercana con IA...</span>';

    try {
      const res = await aiService.explainQuotation(patientName, items, totalAmount);
      const explanation = res?.data?.explanation || res?.explanation || 'Explicación generada.';
      outputBox.innerHTML = explanation.replace(/\n/g, '<br/>');
      outputBox.style.color = '#14532d';
      outputBox.style.fontStyle = 'normal';
      if (copyBtn) copyBtn.style.display = 'block';
    } catch {
      outputBox.innerHTML = '<span style="color: #b91c1c;">Error al generar explicación.</span>';
    }
  }

  async scanQuotations() {
    try {
      toast.info('Escaneando presupuestos sin aceptar (+48h)...');
      const res = await aiService.triggerQuotationFollowupScan();
      const count = res?.count ?? res?.data?.count ?? 0;
      toast.success(`✅ Escaneo completado: ${count} seguimiento(s) pendientes añadidos a la cola.`);
      await this.loadData();
      this.renderView();
    } catch (err) {
      toast.error('Error al escanear presupuestos: ' + (err.message || ''));
    }
  }

  async approveApproval(id) {
    try {
      toast.info('Aprobando y despachando mensaje por WhatsApp...');
      await aiService.approveMessage(id);
      toast.success('✅ ¡Mensaje aprobado y enviado al paciente!');
      await this.loadData();
      this.renderView();
    } catch (err) {
      toast.error('Error al aprobar mensaje: ' + (err.message || ''));
    }
  }

  showEditApprovalModal(id) {
    const approval = this.approvals.find(a => a.id === id);
    if (!approval) return;

    const content = `
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <p style="margin: 0; font-size: 0.86rem; color: var(--color-text-secondary);">
          Modifique el texto del mensaje antes de que sea validado y enviado por WhatsApp.
        </p>
        <div class="form-group" style="margin: 0;">
          <label class="form-label" style="font-size: 0.8rem;">Mensaje para el Paciente</label>
          <textarea id="modal-edit-approval-input" class="form-textarea" rows="6">${this.escapeHtml(approval.proposed_message || '')}</textarea>
        </div>
      </div>
    `;

    Modal.show({
      title: '✏️ Modificar Mensaje de Seguimiento',
      content,
      confirmText: 'Guardar Cambios',
      cancelText: 'Cancelar',
      onConfirm: async () => {
        const newText = document.getElementById('modal-edit-approval-input')?.value.trim();
        if (!newText) {
          toast.error('El mensaje no puede estar vacío');
          return false;
        }
        try {
          await aiService.editApprovalMessage(id, newText);
          toast.success('¡Mensaje modificado con éxito!');
          await this.loadData();
          this.renderView();
          return true;
        } catch (err) {
          toast.error('Error al actualizar mensaje: ' + (err.message || ''));
          return false;
        }
      }
    });
  }

  async discardApproval(id) {
    try {
      await aiService.discardApprovalMessage(id);
      toast.success('Seguimiento descartado.');
      await this.loadData();
      this.renderView();
    } catch (err) {
      toast.error('Error al descartar mensaje: ' + (err.message || ''));
    }
  }

  showNewKnowledgeModal() {
    const content = `
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <p style="margin: 0; font-size: 0.85rem; color: var(--color-text-secondary);">
          Añada información oficial para que Sofía asista a los pacientes por WhatsApp / Instagram.
        </p>
        <div class="form-group" style="margin: 0;">
          <label class="form-label" style="font-size: 0.8rem;">Categoría / Especialidad</label>
          <input type="text" id="modal-kb-category" class="form-input" placeholder="Ej: Primera Visita, Implantes, Ortodoncia, Horarios" required />
        </div>
        <div class="form-group" style="margin: 0;">
          <label class="form-label" style="font-size: 0.8rem;">Pregunta / Tema de Consulta</label>
          <input type="text" id="modal-kb-topic" class="form-input" placeholder="Ej: ¿Tiene coste la primera valoración médica?" required />
        </div>
        <div class="form-group" style="margin: 0;">
          <label class="form-label" style="font-size: 0.8rem;">Respuesta Oficial (Protocolo Clínico)</label>
          <textarea id="modal-kb-answer" class="form-textarea" rows="4" placeholder="Ej: La primera consulta de valoración y diagnóstico es 100% gratuita y sin compromiso..." required></textarea>
        </div>
      </div>
    `;

    Modal.show({
      title: '➕ Añadir Artículo a Base de Conocimiento RAG',
      content,
      confirmText: 'Guardar Artículo',
      cancelText: 'Cancelar',
      onConfirm: async () => {
        const category = document.getElementById('modal-kb-category')?.value.trim();
        const topic = document.getElementById('modal-kb-topic')?.value.trim();
        const answer = document.getElementById('modal-kb-answer')?.value.trim();

        if (!topic || !answer) {
          toast.error('Debe completar el tema y la respuesta oficial.');
          return false;
        }

        try {
          await aiService.createKnowledge({ category: category || 'General', topic, answer, is_active: true });
          toast.success('¡Artículo RAG añadido con éxito!');
          await this.loadData();
          this.renderView();
          return true;
        } catch (err) {
          toast.error('Error al guardar artículo: ' + (err.message || ''));
          return false;
        }
      }
    });
  }

  showEditKnowledgeModal(id) {
    const art = this.knowledgeArticles.find(a => a.id === id);
    if (!art) return;

    const content = `
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <div class="form-group" style="margin: 0;">
          <label class="form-label" style="font-size: 0.8rem;">Categoría / Especialidad</label>
          <input type="text" id="modal-kb-category" class="form-input" value="${this.escapeHtml(art.category || 'General')}" required />
        </div>
        <div class="form-group" style="margin: 0;">
          <label class="form-label" style="font-size: 0.8rem;">Pregunta / Tema de Consulta</label>
          <input type="text" id="modal-kb-topic" class="form-input" value="${this.escapeHtml(art.topic || '')}" required />
        </div>
        <div class="form-group" style="margin: 0;">
          <label class="form-label" style="font-size: 0.8rem;">Respuesta Oficial (Protocolo Clínico)</label>
          <textarea id="modal-kb-answer" class="form-textarea" rows="4" required>${this.escapeHtml(art.answer || '')}</textarea>
        </div>
      </div>
    `;

    Modal.show({
      title: '✏️ Editar Artículo de Conocimiento',
      content,
      confirmText: 'Guardar Cambios',
      cancelText: 'Cancelar',
      onConfirm: async () => {
        const category = document.getElementById('modal-kb-category')?.value.trim();
        const topic = document.getElementById('modal-kb-topic')?.value.trim();
        const answer = document.getElementById('modal-kb-answer')?.value.trim();

        if (!topic || !answer) {
          toast.error('Debe completar el tema y la respuesta.');
          return false;
        }

        try {
          await aiService.updateKnowledge(id, { category: category || 'General', topic, answer });
          toast.success('¡Artículo actualizado!');
          await this.loadData();
          this.renderView();
          return true;
        } catch (err) {
          toast.error('Error al actualizar artículo: ' + (err.message || ''));
          return false;
        }
      }
    });
  }

  async deleteKnowledge(id) {
    if (!confirm('¿Desea eliminar este artículo de la base de conocimiento?')) return;
    try {
      await aiService.deleteKnowledge(id);
      toast.success('Artículo eliminado.');
      await this.loadData();
      this.renderView();
    } catch (err) {
      toast.error('Error al eliminar artículo: ' + (err.message || ''));
    }
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
}
