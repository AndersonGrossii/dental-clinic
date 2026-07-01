// ============================================
// Componente Sidebar — Diseño Profesional
// ============================================
import state from '../../scripts/state.js';
import auth from '../../services/auth.service.js';

// SVG icons (Lucide-style) for a crisp, professional look
const icons = {
  dashboard: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>`,
  patients: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  appointments: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/></svg>`,
  doctors: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 20a6 6 0 0 0-12 0"/><circle cx="12" cy="10" r="4"/><circle cx="12" cy="12" r="10"/></svg>`,
  treatments: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a5 5 0 0 1 5 5c0 2-1 3.5-3 5l-2 2-2-2c-2-1.5-3-3-3-5a5 5 0 0 1 5-5z"/><path d="M12 14v8"/><path d="M9 18h6"/></svg>`,
  quotations: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
  invoices: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
  payments: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`,
  reports: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
  settings: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  logout: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
  collapse: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="11 17 6 12 11 7"/><polyline points="18 17 13 12 18 7"/></svg>`,
  expand: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg>`,
};

export class Sidebar {
  constructor(container) {
    this.container = container;
    this.unsubscribe = null;
  }

  render() {
    const user = state.get('user');
    const role = user?.role_name || '';
    const isCollapsed = state.get('sidebarCollapsed') || false;
    const theme = state.get('theme');
    const mobileOpen = state.get('mobileSidebarOpen') || false;

    const menuItems = [
      { path: '#/', label: 'Dashboard', icon: icons.dashboard, roles: ['propietario', 'recepcionista', 'doctor'] },
      { path: '#/patients', label: 'Pacientes', icon: icons.patients, roles: ['propietario', 'recepcionista', 'doctor'] },
      { path: '#/appointments', label: 'Citas', icon: icons.appointments, roles: ['propietario', 'recepcionista', 'doctor'] },
      { path: '#/doctors', label: 'Doctores', icon: icons.doctors, roles: ['propietario', 'direccion', 'recepcionista'] },
      { path: '#/treatments', label: 'Tratamientos', icon: icons.treatments, roles: ['propietario', 'direccion', 'recepcionista', 'doctor'] },
      { path: '#/quotations', label: 'Presupuestos', icon: icons.quotations, roles: ['propietario', 'direccion', 'recepcionista'] },
      { path: '#/invoices', label: 'Facturación', icon: icons.invoices, roles: ['propietario', 'direccion', 'recepcionista'] },
      { path: '#/payments', label: 'Pagos', icon: icons.payments, roles: ['propietario', 'direccion', 'recepcionista'] },
      { path: '#/reports', label: 'Reportes', icon: icons.reports, roles: ['propietario', 'direccion'] },
      { path: '#/settings', label: 'Configuración', icon: icons.settings, roles: ['propietario', 'direccion'] },
    ];

    const activeHash = window.location.hash || '#/';
    
    const linksHtml = menuItems
      .filter(item => item.roles.includes(role.toLowerCase()))
      .map(item => {
        const isActive = activeHash === item.path || (item.path !== '#/' && activeHash.startsWith(item.path + '/'));
        const exactMatch = item.path === '#/' && activeHash === '#/';
        const active = isActive || exactMatch;
        return `
          <a href="${item.path}" class="sb-link ${active ? 'sb-link--active' : ''}" title="${item.label}">
            <span class="sb-link__icon">${item.icon}</span>
            <span class="sb-link__label">${item.label}</span>
          </a>
        `;
      })
      .join('');

    const clinicInfo = state.get('clinicInfo');
    const clinicName = clinicInfo?.name || 'Vides Dental';

    const initials = (user?.first_name?.[0] || 'U').toUpperCase() + (user?.last_name?.[0] || '').toUpperCase();

    const isMobile = window.innerWidth < 768;
    const showSidebar = isMobile ? mobileOpen : true;
    const sidebarHidden = isMobile ? !mobileOpen : isCollapsed;

    this.container.innerHTML = `
      <aside class="sb ${showSidebar && isMobile ? 'sb--mobile-open' : ''} ${sidebarHidden && !isMobile ? 'sb--hidden' : ''}">
        <!-- Header -->
        <div class="sb__header">
          <div class="sb__brand">
            <div class="sb__logo">
              <img src="/assets/videsDentalLogo.jpg" alt="Vides Dental" style="width: 36px; height: 36px; object-fit: contain; border-radius: var(--radius-md);" onerror="this.outerHTML='<svg xmlns=&quot;http://www.w3.org/2000/svg&quot; width=&quot;22&quot; height=&quot;22&quot; viewBox=&quot;0 0 24 24&quot; fill=&quot;none&quot; stroke=&quot;white&quot; stroke-width=&quot;2&quot;><path d=&quot;M12 2C8 2 6 5 6 8c0 3 2 5 4 7l2 2 2-2c2-2 4-4 4-7 0-3-2-6-6-6z&quot;/></svg>';" />
            </div>
            <span class="sb__brand-name">${clinicName}</span>
          </div>
          <button id="sb-close-mobile" class="sb__collapse-btn" title="Cerrar menú" style="display: ${isMobile ? 'flex' : 'none'};">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          <button id="sb-collapse-btn" class="sb__collapse-btn" title="${isCollapsed ? 'Expandir menú' : 'Ocultar menú'}" style="display: ${isMobile ? 'none' : 'flex'};">
            ${isCollapsed ? icons.expand : icons.collapse}
          </button>
        </div>

        <!-- Navigation -->
        <nav class="sb__nav">
          <div class="sb__nav-group">
            <span class="sb__nav-title">Menú Principal</span>
            ${linksHtml}
          </div>
        </nav>

        <!-- Theme Toggle -->
        <div class="sb-theme-toggle">
          <button id="sb-theme-toggle" class="sb-link" title="Cambiar tema" style="border: none; width: 100%; font-family: inherit; font-size: inherit;">
            <span class="sb-link__icon">${theme === 'dark' ? '☀️' : '🌙'}</span>
            <span class="sb-link__label">${theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}</span>
          </button>
        </div>

        <!-- Footer / User -->
        <div class="sb__footer">
          <div class="sb__user">
            <div class="sb__avatar">${initials}</div>
            <div class="sb__user-info">
              <span class="sb__user-name">${user?.first_name || ''} ${user?.last_name || ''}</span>
              <span class="sb__user-role">${role.charAt(0).toUpperCase() + role.slice(1)}</span>
            </div>
          </div>
          <button id="sidebar-logout" class="sb__logout-btn" title="Cerrar Sesión">
            ${icons.logout}
            <span class="sb__logout-label">Salir</span>
          </button>
        </div>
      </aside>

      <!-- Mobile overlay backdrop -->
      <div id="sb-mobile-overlay" class="sb-mobile-overlay ${mobileOpen && isMobile ? 'sb-mobile-overlay--visible' : ''}"></div>

      <!-- Floating toggle button when sidebar is hidden (desktop only) -->
      <button id="sb-expand-float" class="sb__expand-float ${!isMobile && isCollapsed ? 'sb__expand-float--visible' : ''}" title="Mostrar menú">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg>
      </button>
    `;
  }

  bindEvents() {
    // Mobile sidebar close button
    const closeMobileBtn = this.container.querySelector('#sb-close-mobile');
    if (closeMobileBtn) {
      closeMobileBtn.addEventListener('click', () => {
        state.set('mobileSidebarOpen', false);
      });
    }

    // Mobile overlay click to close
    const overlay = this.container.querySelector('#sb-mobile-overlay');
    if (overlay) {
      overlay.addEventListener('click', () => {
        state.set('mobileSidebarOpen', false);
      });
    }

    // Close mobile sidebar when clicking a nav link
    const navLinks = this.container.querySelectorAll('.sb-link');
    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        if (window.innerWidth < 768) {
          state.set('mobileSidebarOpen', false);
        }
      });
    });

    // Logout
    const logoutBtn = this.container.querySelector('#sidebar-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => auth.logout());
    }

    // Collapse / expand (desktop only)
    const collapseBtn = this.container.querySelector('#sb-collapse-btn');
    if (collapseBtn) {
      collapseBtn.addEventListener('click', () => {
        state.set('sidebarCollapsed', true);
        localStorage.setItem('sidebarCollapsed', 'true');
      });
    }

    // Floating expand button (desktop only)
    const expandFloat = this.container.querySelector('#sb-expand-float');
    if (expandFloat) {
      expandFloat.addEventListener('click', () => {
        state.set('sidebarCollapsed', false);
        localStorage.setItem('sidebarCollapsed', 'false');
      });
    }

    // Theme toggle
    const themeBtn = this.container.querySelector('#sb-theme-toggle');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const currentTheme = state.get('theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        state.set('theme', newTheme);
        localStorage.setItem('theme', newTheme);
        if (newTheme === 'dark') {
          document.body.setAttribute('data-theme', 'dark');
        } else {
          document.body.removeAttribute('data-theme');
        }
      });
    }
  }

  static toggleMobile() {
    const current = state.get('mobileSidebarOpen') || false;
    state.set('mobileSidebarOpen', !current);
  }

  mount() {
    this.render();
    this.bindEvents();

    this._onHashChange = () => { this.render(); this.bindEvents(); };
    window.addEventListener('hashchange', this._onHashChange);

    this._onResize = () => { this.render(); this.bindEvents(); };
    window.addEventListener('resize', this._onResize);

    this.unsubscribe = state.subscribe('sidebarCollapsed', () => {
      this.render();
      this.bindEvents();
    });
    this.unsubscribeMobile = state.subscribe('mobileSidebarOpen', () => {
      this.render();
      this.bindEvents();
    });
    this.unsubscribeClinic = state.subscribe('clinicInfo', () => {
      this.render();
      this.bindEvents();
    });
  }

  destroy() {
    if (this.unsubscribe) this.unsubscribe();
    if (this.unsubscribeMobile) this.unsubscribeMobile();
    if (this.unsubscribeClinic) this.unsubscribeClinic();
    if (this._onHashChange) window.removeEventListener('hashchange', this._onHashChange);
    if (this._onResize) window.removeEventListener('resize', this._onResize);
  }
}
