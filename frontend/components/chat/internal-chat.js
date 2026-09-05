// ============================================
// Widget Flotante de Chat Interno del Personal
// ============================================
import internalChatService from '../../services/internal-chat.service.js';
import state from '../../scripts/state.js';
import { formatTime } from '../../utils/helpers.js';

class InternalChatWidget {
  constructor() {
    this.container = null;
    this.isOpen = false;
    this.activeTab = 'general'; // 'general' | 'directs'
    this.activeDirectUser = null; // null o { id, first_name, last_name, role_name }
    this.staffList = [];
    this.messages = [];
    this.unreadCounts = { general: 0, directs: {}, total: 0 };
    this.currentUser = null;
    this.pollInterval = null;
    this.sseListener = null;
  }

  /**
   * Inicializa el widget montándolo en el DOM global.
   */
  async init() {
    // No mostrar chat en pantalla de login
    if (window.location.hash === '#/login') {
      this.destroy();
      return;
    }

    this.currentUser = state.get('user');
    if (!this.currentUser) {
      const token = state.get('token');
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          this.currentUser = {
            id: payload.id,
            email: payload.email,
            first_name: payload.firstName || payload.email.split('@')[0],
            last_name: payload.lastName || '',
            role_name: payload.roleName,
            doctor_id: payload.doctorId || null,
            clinic_id: payload.clinicId,
          };
          state.set('user', this.currentUser);
        } catch {
          return;
        }
      } else {
        return;
      }
    }

    // Suscribirse a cambios del usuario si aún no está suscrito
    if (!this.userSubscribed) {
      this.userSubscribed = true;
      state.subscribe('user', (newUser) => {
        if (newUser && (!this.currentUser || this.currentUser.id !== newUser.id)) {
          this.currentUser = newUser;
          if (window.location.hash !== '#/login') {
            this.loadInitialData().then(() => this.render());
          }
        }
      });
    }

    this.container = document.getElementById('internal-chat-container');
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'internal-chat-container';
      document.body.appendChild(this.container);
    }

    await this.loadInitialData();
    this.render();
    this.setupRealtimeListeners();

    // Sondeo de respaldo cada 20 segundos
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.pollInterval = setInterval(() => this.fetchUnreadCounts(), 20000);
  }

  /**
   * Destruye o limpia el widget al cerrar sesión.
   */
  destroy() {
    if (this.pollInterval) clearInterval(this.pollInterval);
    if (this.sseListener) window.removeEventListener('dental:internal_chat_received', this.sseListener);
    if (this.container) this.container.innerHTML = '';
    this.isOpen = false;
  }

  async loadInitialData() {
    try {
      const [staffRes, unreadRes] = await Promise.all([
        internalChatService.getStaff().catch(() => ({ data: [] })),
        internalChatService.getUnreadCounts().catch(() => ({ data: { general: 0, directs: {}, total: 0 } })),
      ]);

      const allStaff = staffRes?.data || staffRes || [];
      this.staffList = allStaff.filter(s => s.id !== this.currentUser?.id);
      this.unreadCounts = unreadRes?.data || unreadRes || { general: 0, directs: {}, total: 0 };
    } catch (err) {
      console.error('Error cargando datos de chat interno:', err);
    }
  }

  async fetchUnreadCounts() {
    try {
      const res = await internalChatService.getUnreadCounts();
      this.unreadCounts = res?.data || res || { general: 0, directs: {}, total: 0 };
      this.updateLauncherBadge();
    } catch (err) {
      // Ignorar fallo silencioso en sondeo
    }
  }

  setupRealtimeListeners() {
    if (this.sseListener) window.removeEventListener('dental:internal_chat_received', this.sseListener);

    this.sseListener = async (e) => {
      const { channel, message } = e.detail || {};
      if (!message) return;

      const isCurrentGeneral = this.isOpen && !this.activeDirectUser && this.activeTab === 'general';
      const isCurrentDirect = this.isOpen && this.activeDirectUser && (
        (message.sender_id === this.activeDirectUser.id && message.recipient_id === this.currentUser?.id) ||
        (message.sender_id === this.currentUser?.id && message.recipient_id === this.activeDirectUser.id)
      );

      if (channel === 'general' && isCurrentGeneral) {
        if (!this.messages.some(m => m.id === message.id)) {
          this.messages.push(message);
          this.renderMessagesOnly();
          this.scrollToBottom();
        }
        internalChatService.markAsRead({ channel: 'general' });
      } else if (channel === 'direct' && isCurrentDirect) {
        if (!this.messages.some(m => m.id === message.id)) {
          this.messages.push(message);
          this.renderMessagesOnly();
          this.scrollToBottom();
        }
        if (message.sender_id === this.activeDirectUser.id) {
          internalChatService.markAsRead({ channel: 'direct', sender_id: this.activeDirectUser.id });
        }
      } else {
        // Mensaje en segundo plano o ventana minimizada: actualizar contadores
        await this.fetchUnreadCounts();
      }
    };

    window.addEventListener('dental:internal_chat_received', this.sseListener);
  }

  updateLauncherBadge() {
    const launcher = this.container?.querySelector('.ic-launcher-btn');
    if (!launcher) return;

    let badge = launcher.querySelector('.ic-badge');
    const total = this.unreadCounts?.total || 0;

    if (total > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'ic-badge';
        launcher.appendChild(badge);
      }
      badge.textContent = total > 99 ? '99+' : total;
    } else if (badge) {
      badge.remove();
    }
  }

  async loadCurrentMessages() {
    try {
      if (this.activeDirectUser) {
        const res = await internalChatService.getDirectMessages(this.activeDirectUser.id);
        this.messages = res?.data || res || [];
        await internalChatService.markAsRead({ channel: 'direct', sender_id: this.activeDirectUser.id });
      } else {
        const res = await internalChatService.getGeneralMessages();
        this.messages = res?.data || res || [];
        await internalChatService.markAsRead({ channel: 'general' });
      }
      await this.fetchUnreadCounts();
    } catch (err) {
      console.error('Error cargando mensajes de chat:', err);
      this.messages = [];
    }
  }

  render() {
    if (!this.container) return;

    if (!this.isOpen) {
      const total = this.unreadCounts?.total || 0;
      this.container.innerHTML = `
        <div class="internal-chat-widget">
          <button class="ic-launcher-btn" id="ic-toggle-btn" title="Abrir Chat Interno">
            <span class="ic-launcher-icon">💬</span>
            <span>Chat Interno</span>
            ${total > 0 ? `<span class="ic-badge">${total > 99 ? '99+' : total}</span>` : ''}
          </button>
        </div>
      `;
      this.bindLauncherEvents();
      return;
    }

    // Ventana abierta
    let titleText = '💬 Chat Interno de Clínica';
    let backBtnHtml = '';
    if (this.activeDirectUser) {
      titleText = `👤 ${this.escapeHtml(this.activeDirectUser.first_name)} ${this.escapeHtml(this.activeDirectUser.last_name)}`;
      backBtnHtml = `<button class="ic-btn-icon" id="ic-back-btn" title="Volver a la lista">‹</button>`;
    }

    const generalUnread = this.unreadCounts?.general || 0;
    const directTotalUnread = Object.values(this.unreadCounts?.directs || {}).reduce((a, b) => a + b, 0);

    this.container.innerHTML = `
      <div class="internal-chat-widget">
        <div class="ic-window">
          <!-- Header -->
          <div class="ic-header">
            <div class="ic-header-left">
              ${backBtnHtml}
              <div class="ic-header-title">${titleText}</div>
            </div>
            <div class="ic-header-actions">
              <button class="ic-btn-icon" id="ic-minimize-btn" title="Minimizar">_</button>
              <button class="ic-btn-icon" id="ic-close-btn" title="Cerrar">✕</button>
            </div>
          </div>

          <!-- Pestañas de Canales (Solo si no está dentro de una conversación directa) -->
          ${!this.activeDirectUser ? `
            <div class="ic-channel-tabs">
              <button class="ic-tab-btn ${this.activeTab === 'general' ? 'active' : ''}" data-ic-tab="general">
                <span>📢 Canal General</span>
                ${generalUnread > 0 ? `<span class="ic-badge">${generalUnread}</span>` : ''}
              </button>
              <button class="ic-tab-btn ${this.activeTab === 'directs' ? 'active' : ''}" data-ic-tab="directs">
                <span>👥 Directos</span>
                ${directTotalUnread > 0 ? `<span class="ic-badge">${directTotalUnread}</span>` : ''}
              </button>
            </div>
          ` : ''}

          <!-- Aviso de Efimeridad (48h) -->
          <div class="ic-retention-notice">
            <span>⏳</span>
            <span>Mensajes efímeros: se borran a medianoche</span>
          </div>

          <!-- Contenido Principal -->
          ${this.renderBodyContent()}

          <!-- Footer de Entrada (Visible en Canal General o Chat Directo) -->
          ${(this.activeDirectUser || this.activeTab === 'general') ? `
            <form class="ic-footer" id="ic-send-form">
              <input type="text" class="ic-input" id="ic-msg-input" placeholder="Escribe un mensaje..." autocomplete="off" maxlength="1000" />
              <button type="submit" class="ic-send-btn" id="ic-send-btn" title="Enviar mensaje">➤</button>
            </form>
          ` : ''}
        </div>
      </div>
    `;

    this.bindWindowEvents();
    this.scrollToBottom();
  }

  renderBodyContent() {
    if (!this.activeDirectUser && this.activeTab === 'directs') {
      // Listado de compañeros
      return `
        <div class="ic-contacts-list">
          ${this.staffList.length === 0 ? `
            <div class="ic-empty-state">No hay otros empleados registrados en la clínica.</div>
          ` : this.staffList.map(staff => {
            const initials = (staff.first_name?.[0] || 'U') + (staff.last_name?.[0] || '');
            const unread = this.unreadCounts?.directs?.[staff.id] || 0;
            return `
              <div class="ic-contact-item" data-staff-id="${staff.id}">
                <div class="ic-contact-info">
                  <div class="ic-avatar">${initials.toUpperCase()}</div>
                  <div class="ic-contact-meta">
                    <span class="ic-contact-name">${this.escapeHtml(staff.first_name)} ${this.escapeHtml(staff.last_name)}</span>
                    <span class="ic-contact-role">${this.escapeHtml(staff.role_name || 'Personal')}</span>
                  </div>
                </div>
                ${unread > 0 ? `<span class="ic-badge">${unread}</span>` : ''}
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    // Flujo de mensajes
    return `
      <div class="ic-messages-body" id="ic-messages-container">
        ${this.messages.length === 0 ? `
          <div class="ic-empty-state">
            <span>👋 No hay mensajes recientes. ¡Inicia la conversación!</span>
          </div>
        ` : this.messages.map(msg => {
          const isMine = msg.sender_id === this.currentUser?.id;
          const senderName = isMine ? 'Tú' : `${msg.sender_first_name} ${msg.sender_last_name || ''}`;
          const roleLabel = msg.sender_role ? ` (${msg.sender_role})` : '';
          const time = msg.created_at ? formatTime(new Date(msg.created_at).toTimeString().substring(0, 5)) : '';

          return `
            <div class="ic-message-row ${isMine ? 'mine' : 'theirs'}">
              ${!isMine && !this.activeDirectUser ? `
                <div class="ic-sender-header">${this.escapeHtml(senderName)}${roleLabel}</div>
              ` : ''}
              <div class="ic-bubble">${this.escapeHtml(msg.message)}</div>
              <div class="ic-msg-footer">
                <span>${time}</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  renderMessagesOnly() {
    const container = document.getElementById('ic-messages-container');
    if (!container) {
      this.render();
      return;
    }
    container.innerHTML = this.messages.length === 0 ? `
      <div class="ic-empty-state">
        <span>👋 No hay mensajes recientes. ¡Inicia la conversación!</span>
      </div>
    ` : this.messages.map(msg => {
      const isMine = msg.sender_id === this.currentUser?.id;
      const senderName = isMine ? 'Tú' : `${msg.sender_first_name} ${msg.sender_last_name || ''}`;
      const roleLabel = msg.sender_role ? ` (${msg.sender_role})` : '';
      const time = msg.created_at ? formatTime(new Date(msg.created_at).toTimeString().substring(0, 5)) : '';

      return `
        <div class="ic-message-row ${isMine ? 'mine' : 'theirs'}">
          ${!isMine && !this.activeDirectUser ? `
            <div class="ic-sender-header">${this.escapeHtml(senderName)}${roleLabel}</div>
          ` : ''}
          <div class="ic-bubble">${this.escapeHtml(msg.message)}</div>
          <div class="ic-msg-footer">
            <span>${time}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  scrollToBottom() {
    setTimeout(() => {
      const container = document.getElementById('ic-messages-container');
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }, 40);
  }

  bindLauncherEvents() {
    const toggleBtn = this.container?.querySelector('#ic-toggle-btn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', async () => {
        this.isOpen = true;
        await this.loadCurrentMessages();
        this.render();
      });
    }
  }

  bindWindowEvents() {
    // Minimizar / Cerrar
    const minBtn = this.container?.querySelector('#ic-minimize-btn');
    const closeBtn = this.container?.querySelector('#ic-close-btn');
    const backBtn = this.container?.querySelector('#ic-back-btn');

    if (minBtn) minBtn.addEventListener('click', () => { this.isOpen = false; this.render(); });
    if (closeBtn) closeBtn.addEventListener('click', () => { this.isOpen = false; this.render(); });

    if (backBtn) {
      backBtn.addEventListener('click', async () => {
        this.activeDirectUser = null;
        this.activeTab = 'directs';
        this.render();
      });
    }

    // Cambio de Pestañas
    const tabBtns = this.container?.querySelectorAll('[data-ic-tab]');
    tabBtns?.forEach(btn => {
      btn.addEventListener('click', async () => {
        const tab = btn.dataset.icTab;
        if (this.activeTab === tab) return;
        this.activeTab = tab;
        if (tab === 'general') {
          await this.loadCurrentMessages();
        }
        this.render();
      });
    });

    // Clic en contacto directo
    const contactItems = this.container?.querySelectorAll('[data-staff-id]');
    contactItems?.forEach(item => {
      item.addEventListener('click', async () => {
        const staffId = parseInt(item.dataset.staffId, 10);
        const staff = this.staffList.find(s => s.id === staffId);
        if (!staff) return;

        this.activeDirectUser = staff;
        await this.loadCurrentMessages();
        this.render();
      });
    });

    // Envío de mensaje
    const sendForm = this.container?.querySelector('#ic-send-form');
    const input = this.container?.querySelector('#ic-msg-input');

    if (sendForm && input) {
      sendForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text) return;

        input.value = '';
        input.focus();

        const payload = {
          recipient_id: this.activeDirectUser ? this.activeDirectUser.id : null,
          message: text,
        };

        try {
          const res = await internalChatService.sendMessage(payload);
          const newMsg = res?.data || res;
          if (newMsg && !this.messages.some(m => m.id === newMsg.id)) {
            this.messages.push(newMsg);
            this.renderMessagesOnly();
            this.scrollToBottom();
          }
        } catch (err) {
          console.error('Error enviando mensaje:', err);
        }
      });
    }
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

export default new InternalChatWidget();
