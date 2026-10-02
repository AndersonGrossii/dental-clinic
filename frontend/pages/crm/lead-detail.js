// ============================================
// Vista de Detalle Consolidado del Lead (CRM)
// ============================================
import crmService from '../../services/crm.service.js';
import patientService from '../../services/patient.service.js';
import userService from '../../services/user.service.js';
import aiService from '../../services/ai.service.js';
import toast from '../../components/toast/toast.js';
import Modal from '../../components/modal/modal.js';
import state from '../../scripts/state.js';
import { formatCurrency, formatDate, escapeHtml } from '../../utils/helpers.js';

export class LeadDetailPage {
  constructor(container, params = {}) {
    this.container = container;
    this.leadId = params?.id;
    if (!this.leadId || this.leadId === 'undefined') {
      const match = (window.location.hash || '').match(/#\/crm\/leads\/([^/?#]+)/);
      if (match && match[1] && match[1] !== 'undefined') {
        this.leadId = match[1];
      }
    }
    this.lead = null;
    this.isLoading = false;
  }

  async render(params = {}) {
    if (params?.id && params.id !== 'undefined') {
      this.leadId = params.id;
    }
    this.injectStyles();
    await this.loadLeadData();
    if (!this.lead) {
      this.container.innerHTML = `
        <div style="text-align: center; padding: var(--space-8);">
          <h2>❌ Lead no encontrado</h2>
          <p style="color: var(--text-secondary);">El lead solicitado no existe o fue eliminado.</p>
          <a href="#/crm" class="btn btn-primary" style="margin-top: var(--space-3);">Volver al CRM</a>
        </div>
      `;
      return;
    }
    this.renderView();
    this.bindEvents();
  }

  injectStyles() {
    if (!document.getElementById('crm-styles')) {
      const link = document.createElement('link');
      link.id = 'crm-styles';
      link.rel = 'stylesheet';
      link.href = 'pages/crm/crm.css?v=24';
      document.head.appendChild(link);
    }
  }

  async loadLeadData() {
    if (!this.leadId || this.leadId === 'undefined' || isNaN(parseInt(this.leadId, 10))) {
      console.warn('LeadDetailPage: ID de lead inválido o no especificado:', this.leadId);
      this.lead = null;
      return;
    }
    this.isLoading = true;
    try {
      this.lead = await crmService.getLeadById(this.leadId);
    } catch (err) {
      toast.error('Error al cargar detalle del lead: ' + (err.message || ''));
      this.lead = null;
    } finally {
      this.isLoading = false;
    }
  }

  renderView() {
    const l = this.lead;
    const features = state.get('features') || {};
    const opps = l.opportunities || [];
    const notes = l.notes || [];
    const activities = l.activities || [];
    const tasks = l.tasks || [];
    const convs = l.conversations || [];

    this.container.innerHTML = `
      <div style="margin-bottom: var(--space-3); display: flex; justify-content: space-between; align-items: center;">
        <a href="#/crm" style="color: var(--text-secondary); text-decoration: none; font-size: 0.9rem; display: inline-flex; align-items: center; gap: 6px; font-weight: 500;">
          ← Volver a Gestión de CRM & Leads
        </a>
        <div style="font-size: 0.8rem; color: var(--text-secondary);">
          Lead ID: <strong>#${l.id}</strong> &bull; Registrado: ${formatDate(l.created_at)}
        </div>
      </div>

      <!-- Banner Destacado si el Lead ya fue convertido en Paciente Clínico -->
      ${l.patient_id ? `
        <div class="crm-converted-banner animate-fade-in">
          <div class="crm-converted-banner__content">
            <div class="crm-converted-banner__icon">🦷</div>
            <div>
              <h4 class="crm-converted-banner__title">Lead Convertido a Paciente Clínico Oficial</h4>
              <div class="crm-converted-banner__subtitle">
                Expediente: <strong>#${l.patient_custom_id || l.patient_id}</strong> &bull; Paciente: <strong>${l.patient_first_name || ''} ${l.patient_last_name || ''}</strong> ${l.converted_at ? `&bull; Convertido el: ${formatDate(l.converted_at)}` : ''}
              </div>
            </div>
          </div>
          <div class="crm-converted-banner__action">
            <a href="#/patients/${l.patient_id}" class="btn btn-sm" style="background: #059669; color: #ffffff; font-weight: 600; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 1px 2px rgba(0,0,0,0.1);">
              Ver Historia Clínica / Expediente ➔
            </a>
          </div>
        </div>
      ` : ''}

      <!-- Cabecera Principal del Lead -->
      <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: var(--space-4); margin-bottom: var(--space-4); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
        <div style="display: flex; align-items: center; gap: 16px;">
          <div style="width: 56px; height: 56px; border-radius: 50%; background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%); color: #4338ca; display: flex; align-items: center; justify-content: center; font-size: 1.6rem; font-weight: 700; box-shadow: 0 2px 4px rgba(67, 56, 202, 0.15);">
            ${(l.contact_name || l.contact_phone || 'L')[0].toUpperCase()}
          </div>
          <div>
            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
              <h1 style="margin: 0; font-size: 1.55rem; color: var(--text-primary);">
                ${l.contact_name || l.contact_phone}
              </h1>
              <span class="badge badge--lead-${l.status}" style="font-size: 0.85rem; padding: 4px 10px; font-weight: 600;">
                ${this.formatStatus(l.status)}
              </span>
            </div>
            <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 6px; display: flex; gap: 14px; flex-wrap: wrap; align-items: center;">
              <span>📞 <strong>${l.contact_phone}</strong></span>
              ${l.contact_email ? `<span>✉️ <strong>${l.contact_email}</strong></span>` : ''}
              <span>🌐 Origen: <strong class="badge badge--source-${l.source}">${this.formatSource(l.source)}</strong></span>
              ${l.patient_id ? `
                <a href="#/patients/${l.patient_id}" class="badge" style="background: #dcfce7; color: #15803d; text-decoration: none; font-weight: 600;" title="Ver expediente médico clínico">
                  🦷 Ficha #${l.patient_custom_id || l.patient_id} ➔
                </a>
              ` : ''}
            </div>
          </div>
        </div>

        <!-- Acciones Rápidas & Selector Inmediato de Estado -->
        <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
          <!-- Fast Status Changer -->
          <div style="display: flex; align-items: center; gap: 6px; background: var(--bg-surface-2, #f1f5f9); padding: 4px 10px; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
            <span style="font-size: 0.8rem; font-weight: 600; color: var(--text-secondary);">Estado:</span>
            <select id="fast-status-selector" class="form-control form-control-sm" style="font-size: 0.85rem; font-weight: 600; padding: 3px 8px; height: auto; border: 1px solid var(--border-color); background: var(--bg-surface);">
              <option value="new" ${l.status === 'new' ? 'selected' : ''}>🆕 Nuevo</option>
              <option value="contacted" ${l.status === 'contacted' ? 'selected' : ''}>📞 Contactado</option>
              <option value="qualified" ${l.status === 'qualified' ? 'selected' : ''}>⭐ Calificado</option>
              <option value="appointment_scheduled" ${l.status === 'appointment_scheduled' ? 'selected' : ''}>📅 Cita Agendada</option>
              <option value="converted" ${l.status === 'converted' ? 'selected' : ''}>🦷 Convertido</option>
              <option value="lost" ${l.status === 'lost' ? 'selected' : ''}>❌ Perdido</option>
            </select>
          </div>

          ${!l.patient_id ? `
            <button id="btn-convert-patient" class="btn btn-sm" style="background: #10b981; color: #ffffff; border: none; font-weight: 600; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 1px 2px rgba(16, 185, 129, 0.2);" title="Crear expediente clínico o vincular a paciente existente">
              <span>🦷</span> Convertir en Paciente
            </button>
          ` : ''}
          <button id="btn-add-note" class="btn btn-secondary btn-sm" style="display: inline-flex; align-items: center; gap: 6px;">
            <span>📝</span> Nota
          </button>
          <button id="btn-add-task-header" class="btn btn-secondary btn-sm" style="display: inline-flex; align-items: center; gap: 6px;">
            <span>📋</span> + Tarea
          </button>
          <button id="btn-add-opp" class="btn btn-primary btn-sm" style="display: inline-flex; align-items: center; gap: 6px;">
            <span>💼</span> + Oportunidad
          </button>
          ${features.omnichannelMessaging ? `
            <a href="#/messages" class="btn btn-outline btn-sm" title="Ir al chat omnicanal" style="display: inline-flex; align-items: center; gap: 6px;">
              <span>💬</span> Chat
            </a>
          ` : ''}
        </div>
      </div>

      <!-- Cuadrícula Principal: Oportunidades & Notas (Izquierda) vs Información & Actividades (Derecha) -->
      <div class="crm-detail-grid">
        <!-- Columna Izquierda: Oportunidades Comerciales & Notas -->
        <div>
          <!-- Oportunidades Comerciales -->
          <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: var(--space-4); margin-bottom: var(--space-4);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-3);">
              <div>
                <h3 style="margin: 0; font-size: 1.1rem;">💼 Oportunidades Comerciales (${opps.length})</h3>
                <small style="color: var(--text-secondary);">Tratamientos presupuestados o en negociación</small>
              </div>
              <button id="btn-add-opp-inner" class="btn btn-sm btn-outline">+ Nueva Oportunidad</button>
            </div>

            ${opps.length === 0 ? `
              <div style="text-align: center; color: var(--text-secondary); padding: var(--space-4); background: var(--bg-surface-2); border-radius: var(--radius-md); border: 1px dashed var(--border-color);">
                No hay oportunidades registradas para este lead.
                <div style="margin-top: 8px;">
                  <button id="btn-create-first-opp" class="btn btn-sm btn-primary">+ Crear Primera Oportunidad</button>
                </div>
              </div>
            ` : `
              <div style="display: flex; flex-direction: column; gap: 10px;">
                ${opps.map(opp => `
                  <div style="border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: var(--space-3); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; background: var(--bg-surface);">
                    <div>
                      <div style="font-weight: 600; font-size: 0.95rem; color: var(--text-primary);">${opp.name}</div>
                      <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 2px;">
                        ${opp.service_interest ? `🎯 <em>${opp.service_interest}</em> &bull; ` : ''}Creada: ${formatDate(opp.created_at)}
                      </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 12px;">
                      <span style="font-size: 1.15rem; font-weight: 700; color: #10b981;">
                        ${formatCurrency(opp.estimated_value)}
                      </span>
                      <select class="form-control form-control-sm opp-status-selector" data-id="${opp.id}" style="width: auto; font-size: 0.82rem; font-weight: 600;">
                        <option value="open" ${opp.status === 'open' ? 'selected' : ''}>Abierta</option>
                        <option value="in_progress" ${opp.status === 'in_progress' ? 'selected' : ''}>En Progreso</option>
                        <option value="won" ${opp.status === 'won' ? 'selected' : ''}>Ganada</option>
                        <option value="lost" ${opp.status === 'lost' ? 'selected' : ''}>Perdida</option>
                      </select>
                    </div>
                  </div>
                `).join('')}
              </div>
            `}
          </div>

          <!-- Notas Comerciales de CRM -->
          <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: var(--space-4); margin-bottom: var(--space-4);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-3);">
              <div>
                <h3 style="margin: 0; font-size: 1.1rem;">📝 Notas Comerciales (${notes.length})</h3>
                <small style="color: var(--text-secondary); font-size: 0.75rem;">Uso de recepción y seguimiento de ventas (separadas de historia clínica)</small>
              </div>
              <button id="btn-add-note-inner" class="btn btn-sm btn-outline">+ Nueva Nota</button>
            </div>

            <!-- Formulario rápido de nota con botón con estado de carga -->
            <div style="display: flex; gap: 8px; margin-bottom: var(--space-4);">
              <input type="text" id="quick-note-input" class="form-control form-control-sm" placeholder="Escribe una nota rápida de seguimiento..." />
              <button id="quick-note-btn" class="btn btn-sm btn-primary" style="white-space: nowrap;">Guardar</button>
            </div>

            ${notes.length === 0 ? `
              <div style="text-align: center; color: var(--text-secondary); padding: var(--space-4); background: var(--bg-surface-2); border-radius: var(--radius-md); border: 1px dashed var(--border-color);">
                Sin notas comerciales registradas.
              </div>
            ` : `
              <div style="display: flex; flex-direction: column; gap: 10px;">
                ${notes.map(n => `
                  <div style="background: var(--bg-surface-2, #f8fafc); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: var(--space-3);">
                    <div style="font-size: 0.9rem; color: var(--text-primary); line-height: 1.45;">${n.note}</div>
                    <div style="display: flex; justify-content: space-between; margin-top: 6px; font-size: 0.75rem; color: var(--text-secondary); align-items: center;">
                      <span>
                        ${n.created_by_type === 'ai' ? `<span class="badge" style="background:#eff6ff; color:#1d4ed8; font-weight:700; margin-right:4px;">🤖 IA Sofía</span>` : ''}
                        ✍️ ${n.author_first_name} ${n.author_last_name || ''}
                      </span>
                      <span>${formatDate(n.created_at)}</span>
                    </div>
                  </div>
                `).join('')}
              </div>
            `}
          </div>

          <!-- Tareas Comerciales de Seguimiento -->
          <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: var(--space-4); margin-bottom: var(--space-4);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-3);">
              <div>
                <h3 style="margin: 0; font-size: 1.1rem;">📋 Tareas Comerciales (${tasks.length})</h3>
                <small style="color: var(--text-secondary); font-size: 0.75rem;">Seguimiento y llamadas asignadas al equipo comercial</small>
              </div>
              <button id="btn-add-task-inner" class="btn btn-sm btn-outline">+ Nueva Tarea</button>
            </div>

            ${tasks.length === 0 ? `
              <div style="text-align: center; color: var(--text-secondary); padding: var(--space-4); background: var(--bg-surface-2); border-radius: var(--radius-md); border: 1px dashed var(--border-color);">
                Sin tareas pendientes para este lead.
                <div style="margin-top: 8px;">
                  <button id="btn-create-first-task" class="btn btn-sm btn-primary">+ Crear Tarea de Seguimiento</button>
                </div>
              </div>
            ` : `
              <div style="display: flex; flex-direction: column; gap: 8px;">
                ${tasks.map(t => {
                  const isCompleted = t.status === 'COMPLETED';
                  const isOverdue = t.status === 'PENDING' && t.due_date && new Date(t.due_date) < new Date(new Date().setHours(0,0,0,0));
                  return `
                    <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 10px 12px; display: flex; justify-content: space-between; align-items: center; gap: 10px; ${isCompleted ? 'opacity: 0.68;' : ''}">
                      <div style="display: flex; align-items: center; gap: 10px;">
                        <input 
                          type="checkbox" 
                          class="lead-task-checkbox" 
                          data-id="${t.id}" 
                          ${isCompleted ? 'checked' : ''} 
                          style="cursor: pointer; width: 17px; height: 17px; accent-color: var(--crm-primary);"
                          title="${isCompleted ? 'Reabrir tarea' : 'Completar tarea'}"
                        />
                        <div>
                          <div style="font-weight: 600; font-size: 0.88rem; color: var(--text-primary); ${isCompleted ? 'text-decoration: line-through;' : ''}">
                            ${this.escapeHtml(t.title)}
                          </div>
                          ${t.description ? `
                            <div style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 2px;">
                              ${this.escapeHtml(t.description)}
                            </div>
                          ` : ''}
                          <div style="font-size: 0.72rem; color: var(--text-secondary); margin-top: 3px; display: flex; gap: 8px; align-items: center;">
                            <span style="${isOverdue ? 'color: #dc2626; font-weight: 700;' : ''}">
                              📅 ${t.due_date ? formatDate(t.due_date) : 'Sin fecha'} ${t.due_time ? t.due_time.substring(0, 5) : ''}
                            </span>
                            ${isOverdue ? '<span class="badge" style="background:#fee2e2; color:#b91c1c; font-size:0.65rem; padding: 0 4px;">Vencida</span>' : ''}
                            ${t.assigned_first_name ? `<span>👤 ${this.escapeHtml(t.assigned_first_name)}</span>` : ''}
                          </div>
                        </div>
                      </div>
                      <div>
                        <span class="badge" style="font-size: 0.7rem; font-weight: 600; ${t.priority === 'URGENT' ? 'background:#fee2e2; color:#b91c1c;' : t.priority === 'HIGH' ? 'background:#ffedd5; color:#c2410c;' : 'background:var(--bg-surface-2); color:var(--text-secondary);'}">
                          ${t.priority === 'URGENT' ? '🔥 Urgente' : t.priority === 'HIGH' ? '⚡ Alta' : 'Normal'}
                        </span>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            `}
          </div>
        </div>

        <!-- Columna Derecha: Resumen Comercial, Conversaciones y Timeline -->
        <div>
          <!-- Panel de Inteligencia Artificial (Sofía) -->
          ${features.aiAutomations ? `
          <div style="background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%); border: 1px solid #86efac; border-radius: var(--radius-lg); padding: var(--space-4); margin-bottom: var(--space-4);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
              <h4 style="margin: 0; font-size: 0.95rem; display: flex; align-items: center; gap: 6px; color: #166534;">
                <span>✨</span> Diagnóstico IA (Sofía)
              </h4>
              <button id="btn-re-qualify-lead" class="btn btn-xs btn-outline" style="background: #ffffff; border-color: #86efac; color: #15803d; font-weight: 600;" title="Reanalizar lead con IA">
                🔄 Re-evaluar
              </button>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px;">
              <div style="background: #ffffff; padding: 10px; border-radius: 8px; border: 1px solid #bbf7d0; text-align: center;">
                <div style="font-size: 1.35rem; font-weight: 800; color: ${l.ai_score >= 80 ? '#b45309' : l.ai_score >= 50 ? '#15803d' : '#6b7280'};">
                  ${l.ai_score !== null && l.ai_score !== undefined ? `${l.ai_score}/100` : 'S/C'}
                </div>
                <div style="font-size: 0.72rem; color: #166534; font-weight: 600; text-transform: uppercase;">Scoring Comercial</div>
              </div>
              <div style="background: #ffffff; padding: 10px; border-radius: 8px; border: 1px solid #bbf7d0; text-align: center;">
                <div style="font-size: 1.05rem; font-weight: 700; color: ${l.ai_urgency === 'HIGH' ? '#dc2626' : l.ai_urgency === 'MEDIUM' ? '#d97706' : '#15803d'};">
                  ${l.ai_urgency === 'HIGH' ? '⚠️ ALTA' : l.ai_urgency === 'MEDIUM' ? '⚡ MEDIA' : '🟢 NORMAL'}
                </div>
                <div style="font-size: 0.72rem; color: #166534; font-weight: 600; text-transform: uppercase;">Nivel de Urgencia</div>
              </div>
            </div>

            ${l.ai_extracted_interest ? `
              <div style="font-size: 0.82rem; margin-bottom: 8px;">
                <span style="color: #15803d; font-weight: 600;">Interés Detectado por IA:</span><br/>
                <strong style="color: #14532d;">${this.escapeHtml(l.ai_extracted_interest)}</strong>
              </div>
            ` : ''}

            ${l.ai_summary ? `
              <div style="font-size: 0.82rem; margin-bottom: 8px;">
                <span style="color: #15803d; font-weight: 600;">Resumen Clínico-Comercial:</span>
                <div style="background: rgba(255, 255, 255, 0.7); padding: 8px 10px; border-radius: 6px; margin-top: 4px; color: #1e293b; line-height: 1.4;">
                  ${this.escapeHtml(l.ai_summary)}
                </div>
              </div>
            ` : ''}

            ${l.ai_recommended_action ? `
              <div style="font-size: 0.82rem; margin-top: 8px; background: #ffffff; padding: 8px 10px; border-radius: 6px; border-left: 3px solid #10b981;">
                <span style="color: #047857; font-weight: 700;">Próxima Acción Sugerida:</span><br/>
                <span style="color: #1f2937;">${this.escapeHtml(l.ai_recommended_action)}</span>
              </div>
            ` : ''}
          </div>
          ` : ''}

          <!-- Resumen del Lead -->
          <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: var(--space-4); margin-bottom: var(--space-4);">
            <h4 style="margin-top: 0; margin-bottom: var(--space-3); font-size: 0.95rem; display: flex; align-items: center; gap: 6px;">
              <span>🎯</span> Resumen de Interés
            </h4>
            <div style="font-size: 0.85rem; margin-bottom: var(--space-2);">
              <span style="color: var(--text-secondary);">Tratamiento de interés:</span><br/>
              <strong style="color: var(--text-primary);">${l.interest || 'No especificado'}</strong>
            </div>
            <div style="font-size: 0.85rem; margin-bottom: var(--space-2);">
              <span style="color: var(--text-secondary);">Asignado a:</span><br/>
              <strong>${l.assigned_user_first_name ? `${l.assigned_user_first_name} ${l.assigned_user_last_name || ''}` : 'Sin asignar'}</strong>
            </div>
            ${l.loss_reason ? `
              <div style="font-size: 0.85rem; margin-bottom: var(--space-2); color: #dc2626;">
                <span>Motivo de Descarte:</span><br/>
                <strong>${l.loss_reason}</strong>
              </div>
            ` : ''}
            ${l.notes ? `
              <div style="font-size: 0.85rem; margin-top: var(--space-3); padding-top: var(--space-3); border-top: 1px solid var(--border-color);">
                <span style="color: var(--text-secondary);">Nota de registro inicial:</span><br/>
                <em style="color: var(--text-primary);">${l.notes}</em>
              </div>
            ` : ''}
          </div>

          <!-- Canales de Conversación -->
          <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: var(--space-4); margin-bottom: var(--space-4);">
            <h4 style="margin-top: 0; margin-bottom: var(--space-3); font-size: 0.95rem; display: flex; align-items: center; gap: 6px;">
              <span>💬</span> Canales Omnicanal
            </h4>
            ${convs.length === 0 ? `
              <div style="color: var(--text-secondary); font-size: 0.8rem;">Sin conversaciones previas registradas.</div>
            ` : convs.map(c => `
              <div style="padding: 6px 0; border-bottom: 1px solid var(--border-color); font-size: 0.85rem;">
                <div style="display: flex; justify-content: space-between;">
                  <strong>${c.channel}</strong>
                  <span class="badge" style="font-size: 0.7rem;">${c.status}</span>
                </div>
                <div style="font-size: 0.78rem; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px;">
                  ${c.last_message_preview || 'Sin mensajes'}
                </div>
              </div>
            `).join('')}
          </div>

          <!-- Línea de Tiempo de Actividades Polished -->
          <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: var(--space-4);">
            <h4 style="margin-top: 0; margin-bottom: var(--space-3); font-size: 0.95rem; display: flex; align-items: center; gap: 6px;">
              <span>🕒</span> Historial de Actividades
            </h4>
            <div style="max-height: 420px; overflow-y: auto; padding-top: 6px;">
              ${activities.length === 0 ? `
                <div style="color: var(--text-secondary); font-size: 0.8rem;">Sin actividades registradas.</div>
              ` : activities.map(act => {
                let dotClass = 'crm-timeline-dot';
                let icon = '📌';
                if (act.activity_type === 'LEAD_CREATED') {
                  dotClass += ' crm-timeline-dot--created';
                  icon = '🎯';
                } else if (act.activity_type === 'STATUS_CHANGED') {
                  dotClass += ' crm-timeline-dot--status';
                  icon = '🔄';
                } else if (act.activity_type === 'OPPORTUNITY_CREATED') {
                  dotClass += ' crm-timeline-dot--opportunity';
                  icon = '💼';
                } else if (act.activity_type === 'OPPORTUNITY_STATUS_CHANGED') {
                  dotClass += ' crm-timeline-dot--opp-status';
                  icon = '📈';
                } else if (act.activity_type === 'NOTE_ADDED') {
                  dotClass += ' crm-timeline-dot--note';
                  icon = '📝';
                } else if (act.activity_type === 'LEAD_CONVERTED_TO_PATIENT') {
                  dotClass += ' crm-timeline-dot--converted';
                  icon = '🦷';
                }
                return `
                  <div class="crm-timeline-item">
                    <div class="${dotClass}"></div>
                    <div style="font-size: 0.84rem; font-weight: 600; display: flex; align-items: center; gap: 6px;">
                      <span>${icon}</span> <span>${act.title}</span>
                    </div>
                    ${act.description ? `<div style="font-size: 0.77rem; color: var(--text-secondary); margin-top: 2px;">${act.description}</div>` : ''}
                    <div style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 3px;">
                      ${formatDate(act.created_at)} ${act.user_first_name ? `&bull; ${act.user_first_name} ${act.user_last_name || ''}` : ''}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
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

  formatSource(src) {
    const map = {
      whatsapp: 'WhatsApp',
      instagram: 'Instagram',
      website: 'Sitio Web',
      manual: 'Manual',
      other: 'Otro',
    };
    return map[src] || src;
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
    // Convertir en paciente
    const btnConvert = document.getElementById('btn-convert-patient');
    if (btnConvert) {
      btnConvert.addEventListener('click', () => this.openConvertToPatientModal());
    }

    // Re-evaluar / Calificar Lead con IA (Sofía)
    const btnReQualify = document.getElementById('btn-re-qualify-lead');
    if (btnReQualify) {
      btnReQualify.addEventListener('click', async () => {
        try {
          btnReQualify.disabled = true;
          btnReQualify.innerHTML = '<span>⏳</span> Analizando...';
          toast.info('Analizando interacciones y scoring con Sofía IA...');
          const res = await aiService.qualifyLead(this.lead.id);
          const qual = res?.qualification || res?.data?.qualification || {};
          toast.success(`✨ Análisis completado: Score ${qual.score || 0}/100`);
          await this.render();
        } catch (err) {
          toast.error('Error al re-evaluar lead: ' + (err.message || ''));
          btnReQualify.disabled = false;
          btnReQualify.innerHTML = '🔄 Re-evaluar';
        }
      });
    }

    // Fast status selector directamente en cabecera
    const fastStatus = document.getElementById('fast-status-selector');
    if (fastStatus) {
      fastStatus.addEventListener('change', async (e) => {
        const newStatus = e.target.value;
        if (newStatus === 'lost') {
          this.openChangeStatusModal('lost');
          return;
        }
        if (newStatus === 'converted' && !this.lead.patient_id) {
          this.openConvertToPatientModal();
          return;
        }

        try {
          fastStatus.disabled = true;
          await crmService.updateLeadStatus(this.lead.id, newStatus);
          toast.success('Estado actualizado a: ' + this.formatStatus(newStatus));
          await this.render();
        } catch (err) {
          toast.error(err.message || 'Error al actualizar estado');
          fastStatus.disabled = false;
        }
      });
    }

    // Modal agregar nota
    const btnNote = document.getElementById('btn-add-note');
    const btnNoteInner = document.getElementById('btn-add-note-inner');
    if (btnNote) btnNote.addEventListener('click', () => this.openAddNoteModal());
    if (btnNoteInner) btnNoteInner.addEventListener('click', () => this.openAddNoteModal());

    // Nota rápida con disabled feedback
    const quickNoteBtn = document.getElementById('quick-note-btn');
    const quickNoteInput = document.getElementById('quick-note-input');
    if (quickNoteBtn && quickNoteInput) {
      const handleQuickNote = async () => {
        const noteText = quickNoteInput.value.trim();
        if (!noteText) return;

        quickNoteBtn.disabled = true;
        const originalText = quickNoteBtn.innerHTML;
        quickNoteBtn.innerHTML = '<span class="crm-spinner"></span> Guardando...';

        try {
          await crmService.addNote({
            contact_id: this.lead.contact_id,
            lead_id: this.lead.id,
            note: noteText,
          });
          toast.success('Nota comercial registrada');
          await this.render();
        } catch (err) {
          toast.error(err.message || 'Error al guardar nota');
          quickNoteBtn.disabled = false;
          quickNoteBtn.innerHTML = originalText;
        }
      };

      quickNoteBtn.addEventListener('click', handleQuickNote);
      quickNoteInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleQuickNote();
      });
    }

    // Modal agregar oportunidad
    const btnOpp = document.getElementById('btn-add-opp');
    const btnOppInner = document.getElementById('btn-add-opp-inner');
    const btnCreateFirstOpp = document.getElementById('btn-create-first-opp');
    if (btnOpp) btnOpp.addEventListener('click', () => this.openAddOpportunityModal());
    if (btnOppInner) btnOppInner.addEventListener('click', () => this.openAddOpportunityModal());
    if (btnCreateFirstOpp) btnCreateFirstOpp.addEventListener('click', () => this.openAddOpportunityModal());

    // Cambio de estado directo en selectores de oportunidades
    document.querySelectorAll('.opp-status-selector').forEach(sel => {
      sel.addEventListener('change', async (e) => {
        const oppId = e.target.dataset.id;
        const newStatus = e.target.value;
        try {
          sel.disabled = true;
          await crmService.updateOpportunityStatus(oppId, newStatus);
          toast.success('Estado de oportunidad actualizado');
          await this.render();
        } catch (err) {
          toast.error(err.message || 'Error al actualizar oportunidad');
          sel.disabled = false;
        }
      });
    });

    // Modal agregar tarea comercial
    const btnTaskHeader = document.getElementById('btn-add-task-header');
    const btnTaskInner = document.getElementById('btn-add-task-inner');
    const btnCreateFirstTask = document.getElementById('btn-create-first-task');
    if (btnTaskHeader) btnTaskHeader.addEventListener('click', () => this.openNewTaskModal());
    if (btnTaskInner) btnTaskInner.addEventListener('click', () => this.openNewTaskModal());
    if (btnCreateFirstTask) btnCreateFirstTask.addEventListener('click', () => this.openNewTaskModal());

    // Checkbox de estado de tareas
    document.querySelectorAll('.lead-task-checkbox').forEach(cb => {
      cb.addEventListener('change', async (e) => {
        const taskId = e.target.dataset.id;
        const newStatus = e.target.checked ? 'COMPLETED' : 'PENDING';
        try {
          cb.disabled = true;
          await crmService.updateCRMTaskStatus(taskId, newStatus);
          toast.success(newStatus === 'COMPLETED' ? 'Tarea completada' : 'Tarea reabierta');
          await this.render();
        } catch (err) {
          toast.error(err.message || 'Error al actualizar tarea');
          cb.disabled = false;
          cb.checked = !cb.checked;
        }
      });
    });
  }

  async openNewTaskModal() {
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

    const todayStr = new Date().toISOString().split('T')[0];

    const modalContent = `
      <form id="new-lead-task-form">
        <div class="form-group" style="margin-bottom: var(--space-3);">
          <label class="form-label">Título de la Tarea Comercial *</label>
          <input type="text" id="modal-lead-task-title" class="form-control" placeholder="Ej: Llamar para confirmar cita de valoración..." required />
        </div>
        <div class="form-group" style="margin-bottom: var(--space-3);">
          <label class="form-label">Descripción / Instrucciones</label>
          <textarea id="modal-lead-task-desc" class="form-control" rows="2" placeholder="Detalles de la gestión comercial a realizar..."></textarea>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: var(--space-3);">
          <div class="form-group">
            <label class="form-label">Fecha de Vencimiento *</label>
            <input type="date" id="modal-lead-task-due-date" class="form-control" value="${todayStr}" required />
          </div>
          <div class="form-group">
            <label class="form-label">Hora (opcional)</label>
            <input type="time" id="modal-lead-task-due-time" class="form-control" />
          </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div class="form-group">
            <label class="form-label">Prioridad</label>
            <select id="modal-lead-task-priority" class="form-control">
              <option value="LOW">Baja</option>
              <option value="MEDIUM" selected>Normal (Media)</option>
              <option value="HIGH">Alta</option>
              <option value="URGENT">Urgente</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Asignado a</label>
            <select id="modal-lead-task-assigned" class="form-control">
              <option value="">-- Sin asignar --</option>
              ${userOptions}
            </select>
          </div>
        </div>
      </form>
    `;

    Modal.show({
      title: '📋 Nueva Tarea para Lead #' + this.lead.id,
      content: modalContent,
      confirmText: 'Guardar Tarea',
      cancelText: 'Cancelar',
      size: 'md',
      onConfirm: async (modalBody) => {
        const title = modalBody.querySelector('#modal-lead-task-title')?.value.trim();
        const description = modalBody.querySelector('#modal-lead-task-desc')?.value.trim();
        const dueDate = modalBody.querySelector('#modal-lead-task-due-date')?.value;
        const dueTime = modalBody.querySelector('#modal-lead-task-due-time')?.value || null;
        const priority = modalBody.querySelector('#modal-lead-task-priority')?.value || 'MEDIUM';
        const assignedUserId = modalBody.querySelector('#modal-lead-task-assigned')?.value || null;

        if (!title) {
          toast.error('El título de la tarea es obligatorio');
          return false;
        }
        if (!dueDate) {
          toast.error('La fecha de vencimiento es obligatoria');
          return false;
        }

        try {
          await crmService.createCRMTask({
            title,
            description: description || null,
            dueDate,
            dueTime: dueTime || null,
            priority,
            assignedUserId: assignedUserId ? parseInt(assignedUserId, 10) : null,
            leadId: this.lead.id,
            contactId: this.lead.contact_id,
          });
          toast.success('¡Tarea de seguimiento registrada exitosamente!');
          await this.render();
          return true;
        } catch (err) {
          toast.error(err.message || 'Error al crear tarea comercial');
          return false;
        }
      },
    });
  }

  openChangeStatusModal(defaultStatus = null) {
    const targetStatus = defaultStatus || this.lead.status;
    const modalContent = `
      <form id="change-status-form">
        <div class="form-group" style="margin-bottom: var(--space-3);">
          <label class="form-label">Nuevo Estado del Lead *</label>
          <select id="modal-status-select" class="form-control">
            <option value="new" ${targetStatus === 'new' ? 'selected' : ''}>🆕 Nuevo</option>
            <option value="contacted" ${targetStatus === 'contacted' ? 'selected' : ''}>📞 Contactado</option>
            <option value="qualified" ${targetStatus === 'qualified' ? 'selected' : ''}>⭐ Calificado (Interés confirmado)</option>
            <option value="appointment_scheduled" ${targetStatus === 'appointment_scheduled' ? 'selected' : ''}>📅 Cita Agendada</option>
            <option value="converted" ${targetStatus === 'converted' ? 'selected' : ''}>🦷 Convertido a Paciente</option>
            <option value="lost" ${targetStatus === 'lost' ? 'selected' : ''}>❌ Perdido (Descartado)</option>
          </select>
        </div>
        <div id="loss-reason-group" class="form-group" style="margin-bottom: var(--space-3); display: ${targetStatus === 'lost' ? 'block' : 'none'};">
          <label class="form-label">Motivo de Descarte / Pérdida *</label>
          <input type="text" id="modal-loss-reason" class="form-control" placeholder="Ej: Precio alto, eligió otra clínica, no responde..." value="${this.lead.loss_reason || ''}" />
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
        const newStatus = select ? select.value : this.lead.status;
        const lossReason = modalBody.querySelector('#modal-loss-reason')?.value.trim();

        if (newStatus === 'converted' && !this.lead.patient_id) {
          Modal.close();
          this.openConvertToPatientModal();
          return false;
        }

        try {
          await crmService.updateLeadStatus(this.lead.id, newStatus, lossReason || null);
          toast.success('Estado actualizado exitosamente');
          await this.render();
          return true;
        } catch (err) {
          toast.error(err.message || 'Error al cambiar estado');
          return false;
        }
      },
    });
  }

  openAddNoteModal() {
    const modalContent = `
      <form id="add-note-form">
        <div class="crm-form-section">
          <div class="crm-form-section__header">
            <span class="crm-form-section__title">📝 Contenido de la Nota Comercial</span>
          </div>
          <div class="form-group">
            <textarea id="modal-note-text" class="form-control" rows="4" placeholder="Registra objeciones, preguntas del paciente, facilidades de pago o información relevante..." required></textarea>
          </div>
        </div>
        <small style="color: var(--text-secondary); font-size: 0.78rem;">
          🔒 Esta nota queda vinculada exclusivamente al ámbito comercial del CRM y no formará parte de la historia clínica médica.
        </small>
      </form>
    `;

    Modal.show({
      title: '📝 Agregar Nota Comercial de CRM',
      content: modalContent,
      confirmText: 'Guardar Nota',
      cancelText: 'Cancelar',
      size: 'md',
      onConfirm: async (modalBody) => {
        const note = modalBody.querySelector('#modal-note-text')?.value.trim();
        if (!note) {
          toast.error('La nota comercial no puede estar vacía');
          return false;
        }
        try {
          await crmService.addNote({
            contact_id: this.lead.contact_id,
            lead_id: this.lead.id,
            note,
          });
          toast.success('Nota comercial guardada con éxito');
          await this.render();
          return true;
        } catch (err) {
          toast.error(err.message || 'Error al agregar nota');
          return false;
        }
      },
    });
  }

  openAddOpportunityModal() {
    const modalContent = `
      <form id="add-opp-form">
        <!-- Sección 1: Concepto de la Oportunidad -->
        <div class="crm-form-section">
          <div class="crm-form-section__header">
            <span class="crm-form-section__title">💼 Concepto del Tratamiento</span>
          </div>
          <div class="form-group" style="margin-bottom: var(--space-3);">
            <label class="form-label">Nombre o Concepto *</label>
            <input type="text" id="modal-opp-name" class="form-control" placeholder="Ej: Implantes Dentales + Corona Zirconio" required />
          </div>
          <div class="form-group">
            <label class="form-label">Especialidad / Tratamiento de Interés</label>
            <input type="text" id="modal-opp-interest" class="form-control" placeholder="Ej: Implantología, Ortodoncia, Estética" value="${this.lead.interest || ''}" />
          </div>
        </div>

        <!-- Sección 2: Estimación Económica & Estado -->
        <div class="crm-form-section">
          <div class="crm-form-section__header">
            <span class="crm-form-section__title">💶 Valor Estimado & Pipeline</span>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div class="form-group">
              <label class="form-label">Valor Estimado (€)</label>
              <div class="crm-currency-wrapper">
                <span class="crm-currency-symbol">€</span>
                <input type="number" step="0.01" min="0" id="modal-opp-val" class="form-control crm-currency-input" placeholder="0.00" value="0.00" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Estado Inicial</label>
              <select id="modal-opp-st" class="form-control">
                <option value="open" selected>Abierta</option>
                <option value="in_progress">En Progreso</option>
                <option value="won">Ganada</option>
              </select>
            </div>
          </div>
        </div>
      </form>
    `;

    Modal.show({
      title: '💼 Nueva Oportunidad Comercial',
      content: modalContent,
      confirmText: 'Crear Oportunidad',
      cancelText: 'Cancelar',
      size: 'md',
      onConfirm: async (modalBody) => {
        const name = modalBody.querySelector('#modal-opp-name')?.value.trim();
        const serviceInterest = modalBody.querySelector('#modal-opp-interest')?.value.trim();
        const estimatedValue = parseFloat(modalBody.querySelector('#modal-opp-val')?.value) || 0.00;
        const status = modalBody.querySelector('#modal-opp-st')?.value || 'open';

        if (!name) {
          toast.error('El concepto o nombre de la oportunidad es obligatorio');
          return false;
        }

        try {
          await crmService.createOpportunity({
            contact_id: this.lead.contact_id,
            lead_id: this.lead.id,
            name,
            service_interest: serviceInterest || null,
            estimated_value: estimatedValue,
            status,
          });
          toast.success('Oportunidad creada exitosamente');
          await this.render();
          return true;
        } catch (err) {
          toast.error(err.message || 'Error al crear oportunidad');
          return false;
        }
      },
    });
  }

  async openConvertToPatientModal() {
    const l = this.lead;
    const fullName = l.contact_name || '';
    const nameParts = fullName.trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || (firstName ? 'Registrado' : '');
    const phone = l.contact_phone && !l.contact_phone.startsWith('sintel_') ? l.contact_phone : '';
    const email = l.contact_email || '';

    // Cargar pacientes existentes para la opción de vincular
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
        
        <!-- Toggle Pills para alternar entre nuevo o existente -->
        <div class="crm-toggle-pills">
          <button type="button" class="crm-toggle-pill is-active" data-mode="new">
            <span>➕</span> Crear Nuevo Paciente
          </button>
          <button type="button" class="crm-toggle-pill" data-mode="existing">
            <span>🔗</span> Vincular a Paciente Existente
          </button>
        </div>

        <!-- Modo 1: Crear Nuevo Paciente -->
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
                <input type="text" id="modal-patient-firstname" class="form-control" value="${firstName}" placeholder="Nombre..." required />
              </div>
              <div class="form-group">
                <label class="form-label">Apellidos *</label>
                <input type="text" id="modal-patient-lastname" class="form-control" value="${lastName}" placeholder="Apellidos..." required />
              </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: var(--space-3);">
              <div class="form-group">
                <label class="form-label">Teléfono / WhatsApp</label>
                <input type="tel" id="modal-patient-phone" class="form-control" value="${phone}" placeholder="Teléfono..." />
              </div>
              <div class="form-group">
                <label class="form-label">Correo Electrónico</label>
                <input type="email" id="modal-patient-email" class="form-control" value="${email}" placeholder="correo@ejemplo.com" />
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

        <!-- Modo 2: Vincular Paciente Existente -->
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

        // Filtrado en tiempo real de pacientes existentes
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
            await crmService.convertToPatient(this.lead.id, { patientId: parseInt(patientId, 10) });
            toast.success('¡Lead vinculado al paciente clínico exitosamente!');
            await this.render();
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
            await crmService.convertToPatient(this.lead.id, {
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
            await this.render();
            return true;
          } catch (err) {
            toast.error(err.message || 'Error al crear el expediente del paciente');
            return false;
          }
        }
      },
    });
  }
}
