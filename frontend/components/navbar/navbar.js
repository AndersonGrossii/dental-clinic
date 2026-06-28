// ============================================
// Componente Navbar
// ============================================
import state from '../../scripts/state.js';
import searchService from '../../services/search.service.js';
import toast from '../toast/toast.js';

export class Navbar {
  constructor(container) {
    this.container = container;
  }

  render() {
    const theme = state.get('theme');
    const sidebarCollapsed = state.get('sidebarCollapsed');
    const logoDisplay = sidebarCollapsed ? 'block' : 'none';
    
    this.container.innerHTML = `
      <header class="navbar">
        <div class="navbar-left" style="display: flex; align-items: center; gap: var(--space-3);">
          <img src="/assets/videsDentalLogo.jpg" alt="Vides Dental" id="navbar-logo"
            style="height: 40px; width: auto; object-fit: contain; display: ${logoDisplay}; cursor: pointer;"
            onerror="this.style.display='none';" />
          <h2 id="navbar-page-title" class="navbar-title" style="margin: 0;">Vides Dental</h2>
        </div>

        <div class="navbar-right">
        </div>
      </header>
    `;
  }

  mount() {
    this.render();

    // Re-render when sidebar collapse state changes
    this._unsubscribeSidebar = state.subscribe('sidebarCollapsed', () => this.render());

    // Toggle Sidebar
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
              // Podríamos abrir un modal con resultados o redirigir a una página de resultados
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
