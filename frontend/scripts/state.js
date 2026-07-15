// ============================================
// Store Central de Estado (Observer Pattern)
// ============================================

class Store {
  constructor() {
    this.state = {
      user: null,
      token: localStorage.getItem('token') || null,
      refreshToken: localStorage.getItem('refreshToken') || null,
      theme: localStorage.getItem('theme') || 'light',
      sidebarCollapsed: localStorage.getItem('sidebarCollapsed') === 'true',
      unreadNotificationsCount: 0,
      clinics: [],
      activeClinicId: localStorage.getItem('activeClinicId') || null,
    };
    this.subscribers = {};
  }

  /**
   * Obtiene un valor del estado.
   */
  get(key) {
    return this.state[key];
  }

  /**
   * Actualiza un valor del estado e informa a los suscriptores.
   */
  set(key, value) {
    this.state[key] = value;
    this.notify(key, value);
  }

  /**
   * Se suscribe a los cambios de una clave del estado.
   */
  subscribe(key, callback) {
    if (!this.subscribers[key]) {
      this.subscribers[key] = [];
    }
    this.subscribers[key].push(callback);
    
    // Ejecutar inmediatamente con el valor actual
    callback(this.state[key]);

    // Retornar función para desuscribirse
    return () => {
      this.subscribers[key] = this.subscribers[key].filter(cb => cb !== callback);
    };
  }

  /**
   * Notifica a todos los suscriptores de una clave.
   */
  notify(key, value) {
    if (this.subscribers[key]) {
      this.subscribers[key].forEach(callback => callback(value));
    }
  }

  /**
   * Limpia todo el estado de autenticación (Logout).
   */
  clearAuth() {
    this.set('user', null);
    this.set('token', null);
    this.set('refreshToken', null);
    this.set('activeClinicId', null);
    this.set('clinicInfo', null);
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('activeClinicId');
  }

  /**
   * Guarda las credenciales de sesión.
   * Restablece la clínica activa a la del usuario que inicia sesión.
   * - Propietario: conserva la clínica cacheada (para poder cambiar entre clínicas)
   * - Otros roles: siempre se fijan a su clinic_id
   */
  setAuth(user, token, refreshToken) {
    localStorage.setItem('token', token);
    localStorage.setItem('refreshToken', refreshToken);
    this.set('token', token);
    this.set('refreshToken', refreshToken);
    this.set('user', user);
    if (user?.clinic_id) {
      if (user.role_name === 'propietario') {
        if (!this.state.activeClinicId) {
          this.set('activeClinicId', user.clinic_id);
          localStorage.setItem('activeClinicId', String(user.clinic_id));
        }
      } else {
        this.set('activeClinicId', user.clinic_id);
        localStorage.setItem('activeClinicId', String(user.clinic_id));
      }
    }
  }
}

const state = new Store();
export default state;
