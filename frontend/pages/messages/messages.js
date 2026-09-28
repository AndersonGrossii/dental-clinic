// ============================================
// Vista del Centro de Mensajería y WhatsApp Inbox
// ============================================
import messagingService from '../../services/messaging.service.js';
import patientService from '../../services/patient.service.js';
import crmService from '../../services/crm.service.js';
import aiService from '../../services/ai.service.js';
import toast from '../../components/toast/toast.js';
import Modal from '../../components/modal/modal.js';
import state from '../../scripts/state.js';
import { formatDate } from '../../utils/helpers.js';

export class Messages {
  constructor(container) {
    this.container = container;
    this.conversations = [];
    this.activeConversationId = null;
    this.activeConversation = null;
    this.activeMessages = [];
    this.templates = [];
    this.currentFilter = 'ALL'; // ALL, OPEN, PENDING, CLOSED
    this.currentChannel = 'ALL'; // ALL, WHATSAPP, INSTAGRAM
    this.searchQuery = '';
    this.pollInterval = null;
    this.abortController = null;
  }

  destroy() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  async render() {
    try {
      this.container.innerHTML = `
        <div class="messaging-container">
          <div class="messaging-sidebar">
            <div class="messaging-sidebar-header">
              <div class="messaging-title-row">
                <h2>💬 Mensajería Omnicanal</h2>
                <div style="display:flex;gap:6px;align-items:center;">
                  <button type="button" class="btn btn-xs btn-outline" id="btn-simulate-inbound" title="Simular mensaje entrante para pruebas">+ Simular</button>
                  <span class="badge badge-primary" id="msg-stats-badge">0</span>
                </div>
              </div>
              
              <!-- Selector de Canal -->
              <div class="messaging-channel-tabs" style="display:flex;gap:4px;border-bottom:1px solid var(--border-light);padding-bottom:6px;">
                <button class="messaging-filter-tab channel-tab active" data-channel="ALL">Todos</button>
                <button class="messaging-filter-tab channel-tab" data-channel="WHATSAPP">📱 WhatsApp</button>
                <button class="messaging-filter-tab channel-tab" data-channel="INSTAGRAM">📸 Instagram</button>
              </div>

              <input type="text" class="messaging-search-input" id="msg-search-input" placeholder="Buscar contacto, usuario o teléfono..." />
              
              <div class="messaging-filter-tabs">
                <button class="messaging-filter-tab status-tab active" data-filter="ALL">Todos</button>
                <button class="messaging-filter-tab status-tab" data-filter="OPEN">Abiertos</button>
                <button class="messaging-filter-tab status-tab" data-filter="PENDING">Pendientes</button>
                <button class="messaging-filter-tab status-tab" data-filter="CLOSED">Cerrados</button>
              </div>
            </div>
            <div class="conversations-list" id="conversations-list">
              <div class="empty-state" style="padding: 20px;">Cargando conversaciones...</div>
            </div>
          </div>
          <div class="messaging-main" id="messaging-main">
            <div class="messaging-empty-state">
              <div class="messaging-empty-icon">💬</div>
              <h3>Bandeja de Mensajería Unificada</h3>
              <p>Gestiona WhatsApp Business e Instagram Direct desde un único panel clínico centralizado.</p>
            </div>
          </div>
        </div>
      `;

      await this.loadConversations();
      await this.loadTemplates();
      this.mountEvents();
      this.startPolling();
    } catch (err) {
      toast.error('Error al inicializar el centro de mensajería');
    }
  }

  startPolling() {
    this.pollInterval = setInterval(async () => {
      await this.refreshConversationsSilently();
      if (this.activeConversationId) {
        await this.refreshMessagesSilently();
      }
    }, 4000);
  }

  async loadTemplates() {
    try {
      this.templates = await messagingService.getTemplates() || [];
    } catch {
      this.templates = [];
    }
  }

  async loadConversations() {
    try {
      const params = { limit: 50 };
      if (this.currentFilter !== 'ALL') {
        params.status = this.currentFilter;
      }
      if (this.searchQuery) {
        params.search = this.searchQuery;
      }

      const res = await messagingService.getConversations(params);
      this.conversations = Array.isArray(res) ? res : (res?.data || res?.rows || []);
      this.renderConversationsList();
    } catch (err) {
      const listEl = document.getElementById('conversations-list');
      if (listEl) {
        listEl.innerHTML = `<div class="empty-state" style="padding: 20px; color: var(--danger-600);">Error al cargar conversaciones</div>`;
      }
    }
  }

  async refreshConversationsSilently() {
    try {
      const params = { limit: 50 };
      if (this.currentFilter !== 'ALL') params.status = this.currentFilter;
      if (this.searchQuery) params.search = this.searchQuery;

      const res = await messagingService.getConversations(params);
      const newItems = Array.isArray(res) ? res : (res?.data || res?.rows || []);
      this.conversations = newItems;
      this.renderConversationsList();
    } catch {
      // Ignorar errores silenciosos en polling
    }
  }

  async refreshMessagesSilently() {
    if (!this.activeConversationId) return;
    try {
      const data = await messagingService.getMessages(this.activeConversationId);
      const messages = data?.messages || [];
      if (messages.length !== this.activeMessages.length) {
        this.activeMessages = messages;
        this.renderMessagesTimeline();
      }
    } catch {
      // Ignorar
    }
  }

  renderConversationsList() {
    const listEl = document.getElementById('conversations-list');
    const badgeEl = document.getElementById('msg-stats-badge');
    if (!listEl) return;

    let filtered = this.conversations;
    if (this.currentChannel !== 'ALL') {
      filtered = filtered.filter(c => c.channel === this.currentChannel);
    }

    if (badgeEl) {
      const unreadTotal = this.conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);
      badgeEl.textContent = `${unreadTotal} no leídos`;
      badgeEl.style.display = unreadTotal > 0 ? 'inline-block' : 'none';
    }

    if (filtered.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state" style="padding: 30px 20px; text-align: center; color: var(--text-tertiary);">
          <p>No se encontraron conversaciones en este canal</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = filtered.map(conv => {
      const isActive = conv.id === this.activeConversationId ? 'active' : '';
      const isIg = conv.channel === 'INSTAGRAM';
      const initial = isIg ? '📸' : (conv.contact_name || conv.contact_phone || 'W')[0].toUpperCase();
      const channelBadge = isIg 
        ? `<span class="channel-badge INSTAGRAM">📸 Instagram</span>` 
        : `<span class="channel-badge WHATSAPP">📱 WhatsApp</span>`;

      const patientTag = conv.patient_id 
        ? `<span class="patient-linked-badge" title="Paciente: ${conv.patient_first_name || ''}">👤 ${conv.patient_custom_id || 'Expediente'}</span>`
        : '';
      const unreadBadge = conv.unread_count > 0 
        ? `<span class="unread-badge">${conv.unread_count}</span>` 
        : '';
      const timeStr = conv.last_message_at ? new Date(conv.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

      return `
        <div class="conversation-item ${isActive}" data-id="${conv.id}">
          <div class="conversation-avatar ${conv.channel}">${initial}</div>
          <div class="conversation-info">
            <div class="conversation-header-row">
              <span class="conversation-contact-name">${conv.contact_name || conv.contact_phone}</span>
              <span class="conversation-time">${timeStr}</span>
            </div>
            <div class="conversation-preview-row">
              <p class="conversation-preview">${conv.last_message_preview || 'Sin mensajes'}</p>
              <div class="conversation-badges">
                ${channelBadge}
                ${patientTag}
                ${unreadBadge}
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Re-vincular clicks
    listEl.querySelectorAll('.conversation-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = parseInt(item.getAttribute('data-id'), 10);
        this.selectConversation(id);
      });
    });
  }

  async selectConversation(id) {
    this.activeConversationId = id;
    this.renderConversationsList();

    const mainEl = document.getElementById('messaging-main');
    if (!mainEl) return;

    mainEl.innerHTML = `<div class="empty-state" style="padding: 40px; text-align: center;">Cargando mensajes...</div>`;

    try {
      const data = await messagingService.getMessages(id);
      this.activeConversation = data?.conversation;
      this.activeMessages = data?.messages || [];
      this.renderChatWindow();
    } catch (err) {
      mainEl.innerHTML = `<div class="empty-state" style="padding: 40px; color: var(--danger-600);">Error al cargar conversación</div>`;
    }
  }

  renderChatWindow() {
    const mainEl = document.getElementById('messaging-main');
    if (!mainEl || !this.activeConversation) return;

    const conv = this.activeConversation;
    const isAuto = conv.automation_enabled;
    const isIg = conv.channel === 'INSTAGRAM';
    const initial = isIg ? '📸' : (conv.contact_name || conv.contact_phone || 'W')[0].toUpperCase();

    const patientSection = conv.patient_id
      ? `<a href="#/patients/${conv.patient_id}" class="badge badge-primary" style="text-decoration: none;">📂 Ver Paciente (${conv.patient_custom_id || 'ID #' + conv.patient_id})</a>`
      : `<button type="button" class="btn btn-sm btn-outline" id="btn-link-patient">🔗 Vincular a Paciente</button>`;

    const userRole = (state.get('user')?.role_name || '').toLowerCase();
    const canAccessCrm = ['propietario', 'direccion', 'recepcionista'].includes(userRole);
    const crmPlaceholder = canAccessCrm
      ? `<span>•</span><span id="chat-crm-container"><span class="badge" style="background:var(--bg-tertiary); font-size:0.75rem;">...</span></span>`
      : '';

    const channelTitle = isIg ? `📸 Instagram Direct (@${conv.contact_phone})` : `📱 WhatsApp (${conv.contact_phone})`;
    const placeholderText = isIg ? 'Escribe un mensaje directo de Instagram...' : 'Escribe un mensaje de WhatsApp...';

    mainEl.innerHTML = `
      <div class="chat-header">
        <div class="chat-header-user">
          <div class="conversation-avatar ${conv.channel}" style="width: 38px; height: 38px; font-size: 0.9rem;">${initial}</div>
          <div>
            <h3 class="chat-header-title">${conv.contact_name || conv.contact_phone}</h3>
            <div class="chat-header-subtitle">
              <span>${channelTitle}</span>
              <span>•</span>
              ${patientSection}
              ${crmPlaceholder}
            </div>
          </div>
        </div>
        <div class="chat-header-actions" style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
          <button type="button" class="btn btn-sm btn-outline" id="btn-copilot-suggest" title="Sugerir respuesta con IA según historial y protocolo clínico" style="border-color: #38bdf8; color: #0284c7; font-weight: 600;">
            ✨ Sugerir Respuesta
          </button>
          <button type="button" class="btn btn-sm btn-outline" id="btn-copilot-summarize" title="Crear resumen clínico y comercial en el CRM" style="border-color: #a855f7; color: #7e22ce; font-weight: 600;">
            📝 Resumir en CRM
          </button>
          <button type="button" class="automation-toggle-btn ${isAuto ? 'active' : 'human'}" id="btn-toggle-automation">
            ${isAuto ? '🤖 Auto-Bot Activo' : '👤 Modo Atención Humana'}
          </button>
          <select class="form-select form-select-sm" id="select-conv-status" style="width: 120px;">
            <option value="OPEN" ${conv.status === 'OPEN' ? 'selected' : ''}>Abierto</option>
            <option value="PENDING" ${conv.status === 'PENDING' ? 'selected' : ''}>Pendiente</option>
            <option value="CLOSED" ${conv.status === 'CLOSED' ? 'selected' : ''}>Cerrado</option>
          </select>
        </div>
      </div>

      <div class="messages-timeline" id="messages-timeline"></div>

      <div class="chat-input-container">
        <button type="button" class="chat-template-btn" id="btn-copilot-suggest-bar" title="Sugerencia rápida de Sofía" style="border-color: #bae6fd; background: #f0f9ff; color: #0369a1; font-weight: 600;">
          ✨ Sugerencia IA
        </button>
        ${!isIg ? `
          <button type="button" class="chat-template-btn" id="btn-open-templates" title="Insertar Plantilla">
            📄 Plantillas
          </button>
        ` : ''}
        <textarea class="chat-input-field" id="chat-message-input" placeholder="${placeholderText}" rows="1"></textarea>
        <button type="button" class="chat-send-btn" id="btn-send-message" title="Enviar Mensaje">
          ➤
        </button>
      </div>
    `;

    this.renderMessagesTimeline();
    this.mountChatEvents();
  }

  renderMessagesTimeline() {
    const timelineEl = document.getElementById('messages-timeline');
    if (!timelineEl) return;

    if (this.activeMessages.length === 0) {
      timelineEl.innerHTML = `
        <div class="empty-state" style="padding: 20px; text-align: center; color: var(--text-tertiary);">
          <p>No hay mensajes en esta conversación todavía.</p>
        </div>
      `;
      return;
    }

    timelineEl.innerHTML = this.activeMessages.map(msg => {
      const isOut = msg.direction === 'OUTBOUND';
      const wrapperClass = isOut ? 'outbound' : 'inbound';
      const timeStr = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const statusIcon = isOut ? (msg.status === 'READ' ? '✓✓' : msg.status === 'DELIVERED' ? '✓' : '•') : '';

      return `
        <div class="message-bubble-wrapper ${wrapperClass}">
          <div class="message-bubble">${this.escapeHtml(msg.body)}</div>
          <div class="message-meta">
            <span>${timeStr}</span>
            ${isOut ? `<span>${statusIcon}</span>` : ''}
          </div>
        </div>
      `;
    }).join('');

    // Auto-scroll al fondo
    timelineEl.scrollTop = timelineEl.scrollHeight;
  }

  mountEvents() {
    // 1. Filtros por Canal (WhatsApp / Instagram / Todos)
    this.container.querySelectorAll('.channel-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.container.querySelectorAll('.channel-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.currentChannel = tab.getAttribute('data-channel');
        this.renderConversationsList();
      });
    });

    // 2. Filtros por Estado (Abiertos / Pendientes / Cerrados)
    this.container.querySelectorAll('.status-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.container.querySelectorAll('.status-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.currentFilter = tab.getAttribute('data-filter');
        this.loadConversations();
      });
    });

    // 3. Simular Mensaje Entrante (Sandbox Local)
    const simBtn = this.container.querySelector('#btn-simulate-inbound');
    if (simBtn) {
      simBtn.addEventListener('click', () => {
        this.openSimulationModal();
      });
    }

    // 4. Búsqueda con debounce
    const searchInput = document.getElementById('msg-search-input');
    if (searchInput) {
      let timeout;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          this.searchQuery = e.target.value.trim();
          this.loadConversations();
        }, 300);
      });
    }
  }

  mountChatEvents() {
    const sendBtn = document.getElementById('btn-send-message');
    const inputField = document.getElementById('chat-message-input');
    const autoToggleBtn = document.getElementById('btn-toggle-automation');
    const statusSelect = document.getElementById('select-conv-status');
    const linkPatientBtn = document.getElementById('btn-link-patient');
    const templatesBtn = document.getElementById('btn-open-templates');
    const suggestBtn = document.getElementById('btn-copilot-suggest');
    const suggestBarBtn = document.getElementById('btn-copilot-suggest-bar');
    const summarizeBtn = document.getElementById('btn-copilot-summarize');

    // Enviar mensaje
    const handleSend = async () => {
      const text = inputField.value.trim();
      if (!text || !this.activeConversationId) return;

      try {
        const sent = await messagingService.sendMessage(this.activeConversationId, {
          message_type: 'TEXT',
          body: text,
        });
        inputField.value = '';
        this.activeMessages.push(sent);
        this.renderMessagesTimeline();
        // Si estaba en auto, ahora se cambió a human
        this.activeConversation.automation_enabled = false;
        if (autoToggleBtn) {
          autoToggleBtn.className = 'automation-toggle-btn human';
          autoToggleBtn.innerHTML = '👤 Modo Atención Humana';
        }
      } catch (err) {
        toast.error(err.message || 'Error al enviar mensaje');
      }
    };

    if (sendBtn) sendBtn.addEventListener('click', handleSend);

    if (inputField) {
      inputField.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleSend();
        }
      });
    }

    // Toggle Human Takeover
    if (autoToggleBtn) {
      autoToggleBtn.addEventListener('click', async () => {
        const current = this.activeConversation.automation_enabled;
        const nextState = !current;
        try {
          await messagingService.toggleAutomation(this.activeConversationId, nextState);
          this.activeConversation.automation_enabled = nextState;
          autoToggleBtn.className = `automation-toggle-btn ${nextState ? 'active' : 'human'}`;
          autoToggleBtn.innerHTML = nextState ? '🤖 Auto-Bot Activo' : '👤 Modo Atención Humana';
          toast.success(nextState ? 'Auto-Bot activado' : 'Atención humana activada');
        } catch (err) {
          toast.error('Error al cambiar modo de automatización');
        }
      });
    }

    // Cambiar estado
    if (statusSelect) {
      statusSelect.addEventListener('change', async (e) => {
        try {
          await messagingService.updateStatus(this.activeConversationId, e.target.value);
          toast.success('Estado de conversación actualizado');
          this.loadConversations();
        } catch (err) {
          toast.error('Error al actualizar estado');
        }
      });
    }

    // Vincular Paciente
    if (linkPatientBtn) {
      linkPatientBtn.addEventListener('click', () => {
        this.openLinkPatientModal();
      });
    }

    // Insertar Plantilla
    if (templatesBtn) {
      templatesBtn.addEventListener('click', () => {
        this.openTemplatesModal();
      });
    }

    // Copilot IA: Sugerir Respuesta Asistida con RAG
    const handleCopilotSuggest = async () => {
      if (!this.activeConversationId) return;
      try {
        toast.info('Consultando a Sofía (analizando contexto clínico y RAG)...');
        const res = await aiService.suggestReply(this.activeConversationId);
        const reply = res?.suggestion || res?.data?.suggestion || '';
        if (reply) {
          inputField.value = reply;
          inputField.focus();
          toast.success('✨ Sugerencia de Sofía cargada en el campo de texto.');
        } else {
          toast.info('No se obtuvo sugerencia para esta conversación.');
        }
      } catch (err) {
        toast.error('Error al obtener sugerencia de Sofía: ' + (err.message || ''));
      }
    };

    if (suggestBtn) suggestBtn.addEventListener('click', handleCopilotSuggest);
    if (suggestBarBtn) suggestBarBtn.addEventListener('click', handleCopilotSuggest);

    // Copilot IA: Resumir en CRM
    if (summarizeBtn) {
      summarizeBtn.addEventListener('click', async () => {
        if (!this.activeConversationId) return;
        try {
          toast.info('Generando resumen clínico-comercial estructurado...');
          const res = await aiService.summarizeConversation(this.activeConversationId);
          const summary = res?.summary || res?.data?.summary || 'Resumen generado con éxito.';

          Modal.show({
            title: '📝 Resumen Clínico & Comercial IA (CRM)',
            content: `
              <div style="display: flex; flex-direction: column; gap: 12px; font-size: 0.9rem;">
                <p style="margin: 0; color: var(--text-secondary);">
                  Se ha registrado una nota en el CRM asociada a este contacto. Visible para <strong>Propietario, Dirección y Recepción</strong>.
                </p>
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; line-height: 1.5; color: #1e293b;">
                  ${this.escapeHtml(summary).replace(/\n/g, '<br/>')}
                </div>
              </div>
            `,
            cancelText: 'Cerrar',
          });
          toast.success('✅ ¡Resumen clínico guardado en notas de CRM!');
        } catch (err) {
          toast.error('Error al generar resumen CRM: ' + (err.message || ''));
        }
      });
    }

    // Cargar contexto de CRM si tiene permisos y contact_id
    const crmContainer = document.getElementById('chat-crm-container');
    const conv = this.activeConversation;
    if (crmContainer && conv?.contact_id) {
      crmService.getContactContext(conv.contact_id).then(context => {
        if (!context) {
          crmContainer.innerHTML = '';
          return;
        }
        if (context.lead) {
          crmContainer.innerHTML = `
            <a href="#/crm/leads/${context.lead.id}" class="badge badge-warning" style="text-decoration: none; font-size: 0.75rem; font-weight: 600;" title="Ver Lead en CRM">
              🎯 Lead CRM (${context.lead.status})
            </a>
          `;
        } else {
          crmContainer.innerHTML = `
            <button type="button" class="btn btn-xs btn-outline" id="btn-quick-create-lead" style="font-size:0.75rem; padding: 2px 8px;" title="Registrar como Lead Comercial">
              + 🎯 Crear Lead CRM
            </button>
          `;
          const createBtn = document.getElementById('btn-quick-create-lead');
          if (createBtn) {
            createBtn.addEventListener('click', () => {
              this.openCreateLeadModal(conv);
            });
          }
        }
      }).catch(() => {
        crmContainer.innerHTML = '';
      });
    }
  }

  openCreateLeadModal(conv) {
    const defaultSource = conv.channel === 'INSTAGRAM' ? 'instagram' : 'whatsapp';
    const modalContent = `
      <div style="display: flex; flex-direction: column; gap: 14px;">
        <p style="font-size: 0.85rem; color: var(--text-secondary);">
          Registra a <strong>${conv.contact_name || conv.contact_phone}</strong> como nuevo Lead comercial en el CRM de la clínica.
        </p>
        <div>
          <label class="form-label">Nombre del Contacto</label>
          <input type="text" class="form-input" id="crm-modal-lead-name" value="${conv.contact_name || ''}" placeholder="Nombre..." />
        </div>
        <div>
          <label class="form-label">Origen / Canal</label>
          <select class="form-select" id="crm-modal-lead-source">
            <option value="whatsapp" ${defaultSource === 'whatsapp' ? 'selected' : ''}>WhatsApp</option>
            <option value="instagram" ${defaultSource === 'instagram' ? 'selected' : ''}>Instagram Direct</option>
            <option value="manual">Entrada Manual / Teléfono</option>
            <option value="website">Sitio Web / Formulario</option>
            <option value="other">Otro</option>
          </select>
        </div>
        <div>
          <label class="form-label">Interés o Tratamiento Buscado</label>
          <input type="text" class="form-input" id="crm-modal-lead-interest" placeholder="Ej: Implante, Ortodoncia invisible, Limpieza..." />
        </div>
      </div>
    `;

    Modal.show({
      title: '🎯 Crear Lead en CRM',
      content: modalContent,
      confirmText: 'Crear Lead',
      onConfirm: async () => {
        const name = document.getElementById('crm-modal-lead-name')?.value.trim();
        const source = document.getElementById('crm-modal-lead-source')?.value || 'manual';
        const interest = document.getElementById('crm-modal-lead-interest')?.value.trim();

        try {
          const lead = await crmService.createLead({
            contact_id: conv.contact_id,
            name: name || conv.contact_name || 'Prospecto',
            phone: conv.contact_phone || undefined,
            source,
            status: 'contacted',
            interest: interest || null,
          });
          toast.success('Lead creado exitosamente en el CRM');
          window.location.hash = `#/crm/leads/${lead.id}`;
        } catch (err) {
          toast.error(err.message || 'Error al crear el Lead');
        }
      },
    });
  }

  openTemplatesModal() {
    if (this.templates.length === 0) {
      toast.info('No hay plantillas de WhatsApp registradas');
      return;
    }

    const modalContent = `
      <div style="display: flex; flex-direction: column; gap: 14px;">
        <label class="form-label">Seleccionar Plantilla Aprobada:</label>
        <select class="form-select" id="modal-template-select">
          ${this.templates.map(t => `<option value="${t.name}">${t.name} (${t.category})</option>`).join('')}
        </select>
        <div id="modal-template-preview" style="padding: 12px; background: var(--bg-primary); border-radius: 8px; font-size: 0.85rem; color: var(--text-secondary);">
          ${this.templates[0]?.body || ''}
        </div>
        <div id="modal-template-params-container"></div>
      </div>
    `;

    Modal.show({
      title: '📄 Insertar Plantilla de WhatsApp',
      content: modalContent,
      confirmText: 'Enviar Plantilla',
      onConfirm: async () => {
        const select = document.getElementById('modal-template-select');
        const templateName = select.value;
        const selectedTpl = this.templates.find(t => t.name === templateName);
        const contactName = (this.activeConversation?.contact_name || '').split(' ')[0] || 'Paciente';

        try {
          await messagingService.sendMessage(this.activeConversationId, {
            message_type: 'TEMPLATE',
            template_name: templateName,
            parameters: [contactName, formatDate(new Date()), '10:00'],
          });
          toast.success('Plantilla enviada exitosamente');
          const data = await messagingService.getMessages(this.activeConversationId);
          this.activeMessages = data?.messages || [];
          this.renderMessagesTimeline();
        } catch (err) {
          toast.error(err.message || 'Error al enviar plantilla');
        }
      },
    });

    const selectEl = document.getElementById('modal-template-select');
    const previewEl = document.getElementById('modal-template-preview');
    if (selectEl && previewEl) {
      selectEl.addEventListener('change', (e) => {
        const tpl = this.templates.find(t => t.name === e.target.value);
        if (tpl) previewEl.textContent = tpl.body;
      });
    }
  }

  openLinkPatientModal() {
    const modalContent = `
      <div style="display: flex; flex-direction: column; gap: 14px;">
        <p style="font-size: 0.85rem; color: var(--text-secondary);">Busca un expediente de paciente para vincularlo a este número de WhatsApp:</p>
        <input type="text" class="form-input" id="link-patient-search" placeholder="Escribe nombre o DNI del paciente..." />
        <div id="link-patient-results" style="max-height: 200px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px;"></div>
      </div>
    `;

    let selectedPatientId = null;

    Modal.show({
      title: '🔗 Vincular Contacto a Paciente',
      content: modalContent,
      confirmText: 'Vincular Paciente',
      onConfirm: async () => {
        if (!selectedPatientId) {
          toast.warn('Selecciona un paciente de la lista');
          return false;
        }
        try {
          await messagingService.linkPatient(this.activeConversationId, selectedPatientId);
          toast.success('Expediente vinculado exitosamente');
          await this.selectConversation(this.activeConversationId);
        } catch (err) {
          toast.error(err.message || 'Error al vincular paciente');
        }
      },
    });

    const searchInput = document.getElementById('link-patient-search');
    const resultsContainer = document.getElementById('link-patient-results');

    if (searchInput && resultsContainer) {
      searchInput.addEventListener('input', async (e) => {
        const query = e.target.value.trim();
        if (query.length < 2) {
          resultsContainer.innerHTML = '';
          return;
        }
        try {
          const res = await patientService.search(query);
          const patients = Array.isArray(res) ? res : (res?.data || res?.rows || []);
          if (patients.length === 0) {
            resultsContainer.innerHTML = `<div style="font-size: 0.8rem; color: var(--text-tertiary); padding: 8px;">No se encontraron pacientes</div>`;
            return;
          }
          resultsContainer.innerHTML = patients.map(p => `
            <div class="patient-select-item" data-id="${p.id}" style="padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; display: flex; justify-content: space-between; font-size: 0.85rem;">
              <span><strong>${p.first_name} ${p.last_name}</strong> (${p.custom_id || 'ID #' + p.id})</span>
              <span style="color: var(--text-tertiary);">${p.phone || ''}</span>
            </div>
          `).join('');

          resultsContainer.querySelectorAll('.patient-select-item').forEach(item => {
            item.addEventListener('click', () => {
              resultsContainer.querySelectorAll('.patient-select-item').forEach(i => i.style.background = '#ffffff');
              item.style.background = 'var(--primary-100)';
              selectedPatientId = parseInt(item.getAttribute('data-id'), 10);
            });
          });
        } catch {
          resultsContainer.innerHTML = '';
        }
      });
    }
  }

  openSimulationModal() {
    const modalContent = `
      <form id="simulation-form" style="display: flex; flex-direction: column; gap: 14px;">
        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 10px 14px; font-size: 0.82rem; color: #1e40af;">
          ℹ️ <strong>Simulador Local Sandbox:</strong> Permite probar la recepción de mensajes, respuestas automáticas e hilos de conversación sin necesidad de tener las API keys de Meta configuradas.
        </div>

        <div class="form-group">
          <label class="form-label">Canal de Entrada *</label>
          <select name="channel" class="form-select" id="sim-channel-select">
            <option value="INSTAGRAM" selected>📸 Instagram Direct (DM)</option>
            <option value="WHATSAPP">📱 WhatsApp Business Cloud API</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Identificador del Remitente *</label>
          <input type="text" name="sender_id" class="form-input" id="sim-sender-id" value="ig_user_7788" placeholder="Ej: ig_user_7788 o 34699887766" required />
        </div>

        <div class="form-group">
          <label class="form-label">Nombre del Contacto (Opcional)</label>
          <input type="text" name="sender_name" class="form-input" id="sim-sender-name" value="Carlos Ruiz" placeholder="Nombre completo" />
        </div>

        <div class="form-group">
          <label class="form-label">Texto del Mensaje Entrante *</label>
          <textarea name="text" class="form-input" rows="3" required>¡Hola! Quisiera información sobre el tratamiento de ortodoncia invisible y los precios.</textarea>
        </div>
      </form>
    `;

    Modal.show({
      title: '🧪 Simular Mensaje Entrante (Sandbox)',
      content: modalContent,
      confirmText: 'Enviar Mensaje Simulado',
      onConfirm: async (modalEl) => {
        const form = modalEl.querySelector('#simulation-form');
        const formData = new FormData(form);
        const channel = formData.get('channel');
        const senderId = formData.get('sender_id');
        const senderName = formData.get('sender_name');
        const text = formData.get('text');

        try {
          if (channel === 'INSTAGRAM') {
            // Estructura de payload de Instagram Graph API
            const payload = {
              object: 'instagram',
              entry: [{
                id: '17841400000000000',
                time: Date.now(),
                messaging: [{
                  sender: { id: senderId },
                  recipient: { id: '17841400000000000' },
                  timestamp: Date.now(),
                  message: {
                    mid: `m_ig_${Date.now()}`,
                    text: text,
                  }
                }]
              }]
            };

            await fetch('/api/v1/webhooks/instagram', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });
          } else {
            // Estructura de payload de WhatsApp Cloud API
            const payload = {
              object: 'whatsapp_business_account',
              entry: [{
                id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
                changes: [{
                  value: {
                    messaging_product: 'whatsapp',
                    metadata: { display_phone_number: '34912345678', phone_number_id: '123456789' },
                    contacts: [{ profile: { name: senderName || 'Contacto' }, wa_id: senderId }],
                    messages: [{
                      from: senderId,
                      id: `wamid.HBgL${Date.now()}`,
                      timestamp: String(Math.floor(Date.now() / 1000)),
                      text: { body: text },
                      type: 'text'
                    }]
                  },
                  field: 'messages'
                }]
              }]
            };

            await fetch('/api/v1/webhooks/whatsapp', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });
          }

          toast.success(`Mensaje entrante de ${channel} recibido exitosamente`);
          await new Promise(r => setTimeout(r, 600));
          await this.loadConversations();
          return true;
        } catch (err) {
          toast.error('Error al simular mensaje entrante');
          return false;
        }
      }
    });

    const selectEl = document.getElementById('sim-channel-select');
    const senderInput = document.getElementById('sim-sender-id');
    if (selectEl && senderInput) {
      selectEl.addEventListener('change', (e) => {
        senderInput.value = e.target.value === 'INSTAGRAM' ? `ig_user_${Math.floor(1000 + Math.random() * 9000)}` : '34699887766';
      });
    }
  }

  escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
