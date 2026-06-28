// ============================================
// Componente Navbar
// ============================================
import state from '../../scripts/state.js';
import searchService from '../../services/search.service.js';
import toast from '../toast/toast.js';
import { Sidebar } from '../sidebar/sidebar.js';

export class Navbar {
  constructor(container) {
    this.container = container;
  }

  render() {
    const theme = state.get('theme');
    const sidebarCollapsed = state.get('sidebarCollapsed');
    const logoDisplay = sidebarCollapsed ? 'block' : 'none';
    const isMobile = window.innerWidth < 768;
    
    this.container.innerHTML = `
      <header class="navbar">
        <div class="navbar-left" style="display: flex; align-items: center; gap: var(--space-3);">
          <div id="navbar-hamburger" class="navbar-hamburger" title="Menú" style="display: ${isMobile ? 'flex' : 'none'};">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </div>
          <img src="/assets/videsDentalLogo.jpg" alt="Vides Dental" id="navbar-logo"
            style="height: 40px; width: auto; object-fit: contain; display: ${isMobile ? 'none' : logoDisplay}; cursor: pointer;"
            onerror="this.style.display='none';" />
          <h2 id="navbar-page-title" class="navbar-title" style="margin: 0; font-size: ${isMobile ? 'var(--text-base)' : 'var(--text-lg)'};">Vides Dental</h2>
        </div>

        <div class="navbar-right">
        </div>
      </header>
    `;
  }

  mount() {
    this.render();

    // Re-render when sidebar collapse state or mobile sidebar changes
    this._unsubscribeSidebar = state.subscribe('sidebarCollapsed', () => this.render());
    this._unsubscribeMobile = state.subscribe('mobileSidebarOpen', () => this.render());

    // Mobile hamburger toggle
    const hamburger = this.container.querySelector('#navbar-hamburger');
    if (hamburger) {
      hamburger.addEventListener('click', (e) => {
        e.stopPropagation();
        Sidebar.toggleMobile();
      });
    }

    // Toggle Sidebar (desktop collapse button — legacy)
    const toggleBtn = this.container.querySelector('#sidebar-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        const isCollapsed = state.get('sidebarCollapsed');
        state.set('sidebarCollapsed', !isCollapsed);
        localStorage.setItem('sidebarCollapsed', !isCollapsed);
      });
    }

    // Buscador Global
    const searchInput = this.container.querySelector('#navbar-search-input');
    if (searchInput) {
      searchInput.addEventListener('keypress', async (e) => {
        if (e.key === 'Enter') {
          const q = searchInput.value.trim();
          if (q) {
            try {
              const results = await searchService.globalSearch(q);
              console.log('Resultados de búsqueda:', results);
              toast.info(`Búsqueda completa: ${results.patients?.length || 0} pacientes encontrados.`);
            } catch (err) {
              toast.error('Error al realizar búsqueda global');
            }
          }
        }
      });
    }
  }
}
