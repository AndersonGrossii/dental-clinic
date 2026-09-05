// ============================================
// Componente Top Navbar — Navegación Superior
// ============================================
import state from '../../scripts/state.js';
import auth from '../../services/auth.service.js';
import clinicService from '../../services/clinic.service.js';

let clinicDropdown = null;

// SVG icons (Lucide-style)
const icons = {
  dashboard: `<svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16" /></svg>`,
  patients: `<svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  appointments: `<svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/></svg>`,
  cabinets: `<svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>`,
  doctors: `<svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 20a6 6 0 0 0-12 0"/><circle cx="12" cy="10" r="4"/><circle cx="12" cy="12" r="10"/></svg>`,
  treatments: `<svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a5 5 0 0 1 5 5c0 2-1 3.5-3 5l-2 2-2-2c-2-1.5-3-3-3-5a5 5 0 0 1 5-5z"/><path d="M12 14v8"/><path d="M9 18h6"/></svg>`,
  quotations: `<svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
  billing_group: `<svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>`,
  invoices: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
  receipts: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6"/><path d="M16 12h-6"/><path d="M14 16h-4"/></svg>`,
  payments: `<svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`,
  reports: `<svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
  settings: `<svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  messages: `<svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>`,
  automations: `<svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>`,
  logout: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
  personalCalendar: `<svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="m9 16 2 2 4-4"/></svg>`,
  chevronDown: `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`
};

export class Sidebar {
  constructor(container) {
    this.container = container;
    this.unsubscribe = null;
  }

  render() {
    const user = state.get('user');
    const role = (user?.role_name || '').toLowerCase();
    const theme = state.get('theme');
    const mobileOpen = state.get('mobileSidebarOpen') || false;
    const clinics = state.get('clinics') || [];
    const activeClinicId = state.get('activeClinicId');
    const clinicInfo = state.get('clinicInfo');
    const clinicName = clinicInfo?.name || 'Vides Dental';
    const features = state.get('features') || {};

    const menuItems = [
      { path: '#/', label: 'Dashboard', icon: icons.dashboard, roles: ['propietario', 'direccion', 'recepcionista', 'doctor', 'higienista'] },
      { path: '#/patients', label: 'Pacientes', icon: icons.patients, roles: ['propietario', 'direccion', 'recepcionista', 'doctor', 'higienista'] },
      { path: '#/appointments', label: 'Citas', icon: icons.appointments, roles: ['propietario', 'direccion', 'recepcionista', 'doctor', 'higienista'] },
      { path: '#/personal-calendar', label: 'Agenda Personal', icon: icons.personalCalendar, roles: ['propietario', 'direccion', 'recepcionista', 'doctor', 'higienista'] },
      { path: '#/cabinets', label: 'Gabinetes', icon: icons.cabinets, roles: ['propietario', 'direccion', 'recepcionista', 'doctor', 'higienista'] },
      { path: '#/doctors', label: 'Doctores', icon: icons.doctors, roles: ['propietario', 'direccion', 'recepcionista'] },
      { path: '#/treatments', label: 'Tratamientos', icon: icons.treatments, roles: ['propietario', 'direccion', 'recepcionista', 'doctor'] },
      { path: '#/quotations', label: 'Presupuestos', icon: icons.quotations, roles: ['propietario', 'direccion', 'recepcionista'] },
      {
        isGroup: true,
        label: 'Facturación y Recibos',
        icon: icons.billing_group,
        roles: ['propietario', 'direccion', 'recepcionista'],
        items: [
          { path: '#/invoices', label: 'Facturación', desc: 'Facturas oficiales y electrónicas', icon: icons.invoices },
          { path: '#/receipts', label: 'Recibos', desc: 'Recibos de cobro y abonos', icon: icons.receipts }
        ]
      },
      { path: '#/payments', label: 'Pagos', icon: icons.payments, roles: ['propietario', 'direccion', 'recepcionista'] },
      { path: '#/messages', label: 'Mensajes', icon: icons.messages, roles: ['propietario', 'direccion', 'recepcionista', 'doctor'] },
      { path: '#/automations', label: 'Automatizaciones & IA', icon: icons.automations, roles: ['propietario', 'direccion', 'recepcionista', 'doctor'] },
      { path: '#/reports', label: 'Reportes', icon: icons.reports, roles: ['propietario', 'direccion'] },
      { path: '#/settings', label: 'Configuración', icon: icons.settings, roles: ['propietario', 'direccion', 'doctor'] },
    ];

    const activeHash = window.location.hash || '#/';

    // Render Top Navbar Items (Icons on left, tooltips & hover dropdown for Facturación y Recibos)
    const topNavHtml = menuItems
      .filter(item => item.roles.includes(role))
      .map(item => {
        if (item.isGroup) {
          const isGroupActive = activeHash.startsWith('#/invoices') || activeHash.startsWith('#/receipts');
          return `
            <div class="top-nav__item-wrap top-nav__dropdown-wrap">
              <div class="top-nav__btn ${isGroupActive ? 'top-nav__btn--active' : ''}" tabindex="0" role="button" aria-haspopup="true" aria-label="${item.label}">
                <span class="top-nav__icon">${item.icon}</span>
                <span class="top-nav__chevron">${icons.chevronDown}</span>
              </div>
              <div class="top-nav__dropdown-menu animate-scale-in">
                <div class="top-nav__dropdown-header">${item.label}</div>
                ${item.items.map(sub => {
                  const isSubActive = activeHash === sub.path || (sub.path !== '#/' && activeHash.startsWith(sub.path + '/'));
                  return `
                    <a href="${sub.path}" class="top-nav__sub-link ${isSubActive ? 'top-nav__sub-link--active' : ''}">
                      <span class="top-nav__sub-icon">${sub.icon}</span>
                      <div class="top-nav__sub-text">
                        <span class="top-nav__sub-title">${sub.label}</span>
                        <span class="top-nav__sub-desc">${sub.desc}</span>
                      </div>
                      ${isSubActive ? '<span class="top-nav__active-dot"></span>' : ''}
                    </a>
                  `;
                }).join('')}
              </div>
            </div>
          `;
        }

        const isActive = activeHash === item.path || (item.path !== '#/' && activeHash.startsWith(item.path + '/'));
        const exactMatch = item.path === '#/' && activeHash === '#/';
        const active = isActive || exactMatch;

        return `
          <div class="top-nav__item-wrap">
            <a href="${item.path}" class="top-nav__btn ${active ? 'top-nav__btn--active' : ''}" aria-label="${item.label}">
              <span class="top-nav__icon">${item.icon}</span>
            </a>
            <span class="top-nav__tooltip">${item.label}</span>
          </div>
        `;
      })
      .join('');

    // Mobile Drawer Links
    const mobileLinksHtml = menuItems
      .filter(item => item.roles.includes(role))
      .map(item => {
        if (item.isGroup) {
          const isGroupActive = activeHash.startsWith('#/invoices') || activeHash.startsWith('#/receipts');
          return `
            <div class="sb-mobile-group">
              <div class="sb-mobile-group-title">
                <span class="sb-link__icon">${item.icon}</span>
                <span>${item.label}</span>
              </div>
              <div class="sb-mobile-group-items">
                ${item.items.map(sub => {
                  const isSubActive = activeHash === sub.path || (sub.path !== '#/' && activeHash.startsWith(sub.path + '/'));
                  return `
                    <a href="${sub.path}" class="sb-link sb-link--sub ${isSubActive ? 'sb-link--active' : ''}">
                      <span class="sb-link__icon">${sub.icon}</span>
                      <span class="sb-link__label">${sub.label}</span>
                    </a>
                  `;
                }).join('')}
              </div>
            </div>
          `;
        }

        const isActive = activeHash === item.path || (item.path !== '#/' && activeHash.startsWith(item.path + '/'));
        const exactMatch = item.path === '#/' && activeHash === '#/';
        const active = isActive || exactMatch;
        return `
          <a href="${item.path}" class="sb-link ${active ? 'sb-link--active' : ''}">
            <span class="sb-link__icon">${item.icon}</span>
            <span class="sb-link__label">${item.label}</span>
          </a>
        `;
      })
      .join('');

    const initials = (user?.first_name?.[0] || 'U').toUpperCase() + (user?.last_name?.[0] || '').toUpperCase();

    this.container.innerHTML = `
      <!-- TOP NAVBAR -->
      <header class="top-navbar">
        <div class="top-nav__left">
          <!-- Logo & Brand -->
          <a href="#/" class="top-nav__brand">
            <img src="/assets/videsDentalLogo.jpg" alt="Vides Dental" class="top-nav__logo" onerror="this.style.display='none';" />
            <span class="top-nav__brand-title">${clinicName}</span>
          </a>

          ${role === 'propietario' ? `
            <div class="top-nav__clinic-switcher" id="clinic-switcher-btn" title="Cambiar de Clínica">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="top-nav__clinic-icon"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              <span class="top-nav__clinic-label" id="clinic-switcher-label">${clinics.find(c => c.id === parseInt(activeClinicId))?.name || 'Sede'}</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
          ` : ''}

          <div class="top-nav__divider"></div>

          <!-- Desktop Icon Navigation Bar -->
          <nav class="top-nav__icons-bar">
            ${topNavHtml}
          </nav>
        </div>

        <div class="top-nav__right">
          <!-- Theme Toggle -->
          <button id="topnav-theme-toggle" class="top-nav__action-btn" title="Cambiar Tema (${theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'})">
            <span style="font-size: 16px;">${theme === 'dark' ? '☀️' : '🌙'}</span>
          </button>

          <!-- User Info Badge -->
          <div class="top-nav__user-badge">
            <div class="top-nav__user-avatar">${initials}</div>
            <div class="top-nav__user-details">
              <span class="top-nav__user-name">${user?.first_name || 'Usuario'} ${user?.last_name || ''}</span>
              <span class="top-nav__user-role">${role.toUpperCase()}</span>
            </div>
          </div>

          <!-- Logout Button -->
          <button id="topnav-logout" class="top-nav__logout-btn" title="Cerrar Sesión">
            ${icons.logout}
            <span class="top-nav__logout-text">Salir</span>
          </button>

          <!-- Mobile Hamburger -->
          <button id="topnav-hamburger" class="top-nav__hamburger-btn" title="Abrir Menú">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
        </div>
      </header>

      <!-- MOBILE DRAWER OVERLAY -->
      <aside class="sb-mobile-drawer ${mobileOpen ? 'sb-mobile-drawer--open' : ''}">
        <div class="sb-mobile-drawer__header">
          <div class="sb__brand">
            <img src="/assets/videsDentalLogo.jpg" alt="Vides Dental" style="width: 32px; height: 32px; object-fit: contain; border-radius: var(--radius-md);" onerror="this.style.display='none';" />
            <span class="sb__brand-name">${clinicName}</span>
          </div>
          <button id="sb-mobile-close" class="sb__collapse-btn" title="Cerrar Menú">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <nav class="sb-mobile-drawer__nav">
          ${mobileLinksHtml}
        </nav>

        <div class="sb-mobile-drawer__footer">
          <div class="sb__user">
            <div class="sb__avatar">${initials}</div>
            <div class="sb__user-info">
              <span class="sb__user-name">${user?.first_name || ''} ${user?.last_name || ''}</span>
              <span class="sb__user-role">${role.toUpperCase()}</span>
            </div>
          </div>
          <button id="sb-mobile-logout" class="sb__logout-btn" title="Cerrar Sesión">
            ${icons.logout}
            <span>Salir</span>
          </button>
        </div>
      </aside>

      <!-- Backdrop for mobile drawer -->
      <div id="sb-mobile-backdrop" class="sb-mobile-backdrop ${mobileOpen ? 'sb-mobile-backdrop--visible' : ''}"></div>
    `;
  }

  bindEvents() {
    // Theme toggle
    const themeBtn = this.container.querySelector('#topnav-theme-toggle');
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

    // Logout
    const logoutBtn = this.container.querySelector('#topnav-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => auth.logout());
    }

    const mobileLogoutBtn = this.container.querySelector('#sb-mobile-logout');
    if (mobileLogoutBtn) {
      mobileLogoutBtn.addEventListener('click', () => auth.logout());
    }

    // Mobile drawer toggle
    const hamburgerBtn = this.container.querySelector('#topnav-hamburger');
    if (hamburgerBtn) {
      hamburgerBtn.addEventListener('click', () => {
        state.set('mobileSidebarOpen', true);
      });
    }

    const closeMobileBtn = this.container.querySelector('#sb-mobile-close');
    if (closeMobileBtn) {
      closeMobileBtn.addEventListener('click', () => {
        state.set('mobileSidebarOpen', false);
      });
    }

    const backdrop = this.container.querySelector('#sb-mobile-backdrop');
    if (backdrop) {
      backdrop.addEventListener('click', () => {
        state.set('mobileSidebarOpen', false);
      });
    }

    // Close mobile drawer on link click
    const mobileLinks = this.container.querySelectorAll('.sb-mobile-drawer .sb-link, .top-nav__sub-link');
    mobileLinks.forEach(link => {
      link.addEventListener('click', () => {
        state.set('mobileSidebarOpen', false);
      });
    });

    // Clinic switcher (owner only)
    const switcherBtn = this.container.querySelector('#clinic-switcher-btn');
    if (switcherBtn) {
      switcherBtn.addEventListener('click', async (e) => {
        e.stopPropagation();

        if (clinicDropdown) {
          clinicDropdown.remove();
          clinicDropdown = null;
          return;
        }

        let clinics = state.get('clinics') || [];
        const activeClinicId = state.get('activeClinicId');

        clinicDropdown = document.createElement('div');
        clinicDropdown.className = 'top-nav__clinic-dropdown animate-scale-in';
        clinicDropdown.innerHTML = '<div class="top-nav__clinic-option" style="cursor:default;color:var(--color-text-tertiary);">Cargando clínicas…</div>';

        const rect = switcherBtn.getBoundingClientRect();
        clinicDropdown.style.position = 'fixed';
        clinicDropdown.style.left = rect.left + 'px';
        clinicDropdown.style.top = (rect.bottom + 6) + 'px';
        clinicDropdown.style.minWidth = Math.max(rect.width, 200) + 'px';
        clinicDropdown.style.zIndex = '1000';
        document.body.appendChild(clinicDropdown);

        if (clinics.length === 0) {
          await this.loadClinics();
          clinics = state.get('clinics') || [];
        }

        clinicDropdown.innerHTML = '';
        if (clinics.length === 0) {
          clinicDropdown.innerHTML = '<div class="top-nav__clinic-option" style="cursor:default;color:var(--color-text-tertiary);">Sin clínicas disponibles</div>';
        } else {
          clinics.forEach(c => {
            const opt = document.createElement('div');
            opt.className = `top-nav__clinic-option${c.id === parseInt(activeClinicId) ? ' top-nav__clinic-option--active' : ''}`;
            opt.dataset.clinicId = c.id;
            opt.innerHTML = `
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              <span>${c.name}</span>
              ${c.id === parseInt(activeClinicId) ? '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-left:auto;"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
            `;
            opt.addEventListener('click', () => {
              clinicDropdown.remove();
              clinicDropdown = null;
              state.set('activeClinicId', c.id);
              localStorage.setItem('activeClinicId', c.id);
              window.location.reload();
            });
            clinicDropdown.appendChild(opt);
          });
        }
      });
    }
  }

  static toggleMobile() {
    const current = state.get('mobileSidebarOpen') || false;
    state.set('mobileSidebarOpen', !current);
  }

  mount() {
    const savedClinicId = localStorage.getItem('activeClinicId');
    if (savedClinicId && !state.get('activeClinicId')) {
      state.set('activeClinicId', savedClinicId);
    }

    this.render();
    this.bindEvents();

    this._onHashChange = () => { this.render(); this.bindEvents(); };
    window.addEventListener('hashchange', this._onHashChange);

    this._onResize = () => { this.render(); this.bindEvents(); };
    window.addEventListener('resize', this._onResize);

    this.unsubscribeMobile = state.subscribe('mobileSidebarOpen', () => {
      this.render();
      this.bindEvents();
    });
    this.unsubscribeClinic = state.subscribe('clinicInfo', () => {
      this.render();
      this.bindEvents();
    });
    this.unsubscribeClinics = state.subscribe('clinics', () => {
      this.render();
      this.bindEvents();
    });

    const user = state.get('user');
    if (user?.role_name === 'propietario') {
      this.loadClinics();
    }

    this._onDocClick = (e) => {
      if (!clinicDropdown) return;
      const btn = this.container.querySelector('#clinic-switcher-btn');
      if (btn && !btn.contains(e.target) && !clinicDropdown.contains(e.target)) {
        clinicDropdown.remove();
        clinicDropdown = null;
      }
    };
    document.addEventListener('click', this._onDocClick);
  }

  async loadClinics() {
    if (this._clinicsPromise) return this._clinicsPromise;
    this._clinicsPromise = (async () => {
      try {
        const clinics = await clinicService.getAll();
        state.set('clinics', clinics);
        let activeClinicId = state.get('activeClinicId') || localStorage.getItem('activeClinicId');
        if (!activeClinicId && clinics.length > 0) {
          activeClinicId = String(clinics[0].id);
        }
        if (activeClinicId) {
          state.set('activeClinicId', activeClinicId);
          localStorage.setItem('activeClinicId', String(activeClinicId));
        }
      } catch (err) {
        console.error('Error al cargar clínicas:', err);
      } finally {
        this._clinicsPromise = null;
      }
    })();
    return this._clinicsPromise;
  }

  destroy() {
    if (this.unsubscribeMobile) this.unsubscribeMobile();
    if (this.unsubscribeClinic) this.unsubscribeClinic();
    if (this.unsubscribeClinics) this.unsubscribeClinics();
    if (this._onHashChange) window.removeEventListener('hashchange', this._onHashChange);
    if (this._onResize) window.removeEventListener('resize', this._onResize);
    if (this._onDocClick) document.removeEventListener('click', this._onDocClick);
    if (clinicDropdown) { clinicDropdown.remove(); clinicDropdown = null; }
  }
}
