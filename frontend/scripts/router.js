// ============================================
// Enrutador SPA basado en Hash
// ============================================

class Router {
  constructor() {
    this.routes = [];
    this.currentView = null;
    this.container = null;

    // Escuchar cambios de hash
    window.addEventListener('hashchange', () => this.resolve());
  }

  /**
   * Inicializa el contenedor del contenido dinámico de la página.
   */
  init(containerElement) {
    this.container = containerElement;
    this.resolve();
  }

  /**
   * Registra una ruta y su clase controladora de vista.
   * @param {string} path - Ruta en formato hash (ej: '#/patients' o '#/patients/:id')
   * @param {class} pageClass - Clase de la página a instanciar
   */
  addRoute(path, pageClass) {
    // Reemplazar parámetros de ruta con una expresión regular
    const paramNames = [];
    const regexPath = path
      .replace(/([:*])(\w+)/g, (_full, _type, name) => {
        paramNames.push(name);
        return '([^/]+)';
      })
      .replace(/\//g, '\\/');

    this.routes.push({
      path,
      regex: new RegExp(`^${regexPath}$`),
      paramNames,
      pageClass,
    });
  }

  /**
   * Navega a un hash específico.
   */
  navigate(hash) {
    window.location.hash = hash;
  }

  /**
   * Resuelve el hash actual contra las rutas registradas y renderiza la vista.
   */
  async resolve() {
    const hash = window.location.hash || '#/';
    
    // Buscar ruta coincidente
    let match = null;
    let params = {};

    for (const route of this.routes) {
      const result = hash.match(route.regex);
      if (result) {
        match = route;
        // Mapear parámetros a sus nombres (ej: id)
        route.paramNames.forEach((name, index) => {
          params[name] = decodeURIComponent(result[index + 1]);
        });
        break;
      }
    }

    if (!match) {
      // Intentar redirigir al home o mostrar 404
      if (this.container) {
        this.container.innerHTML = `
          <div class="empty-state">
            <span class="empty-state-icon">🔍</span>
            <h3>Página no encontrada</h3>
            <p>La dirección que busca no existe en el sistema.</p>
            <a href="#/" class="btn btn-primary">Volver al Dashboard</a>
          </div>
        `;
      }
      return;
    }

    // Limpiar vista anterior
    if (this.currentView && typeof this.currentView.destroy === 'function') {
      this.currentView.destroy();
    }

    // Instanciar y renderizar la nueva página
    try {
      this.currentView = new match.pageClass(this.container, params);
      
      // Mostrar spinner inline si es necesario, o dejar que la página maneje su carga
      this.container.innerHTML = '<div class="loading-spinner"></div>';
      
      await this.currentView.render();
      
      if (typeof this.currentView.mount === 'function') {
        this.currentView.mount();
      }
    } catch (err) {
      console.error('Error al resolver la vista:', err);
      this.container.innerHTML = `
        <div class="empty-state">
          <span class="empty-state-icon">⚠️</span>
          <h3>Error al cargar la página</h3>
          <p>Ocurrió un problema inesperado: ${err.message}</p>
          <button onclick="window.location.reload()" class="btn btn-outline">Reintentar</button>
        </div>
      `;
    }
  }
}

const router = new Router();
export default router;
