// ============================================
// Servicio API Central — Comunicación Fetch
// ============================================
import state from '../scripts/state.js';

class ApiService {
  constructor() {
    this.baseUrl = '/api/v1';
  }

  /**
   * Ejecuta una petición HTTP a la API.
   * Agrega headers, maneja el JWT token y refresca la sesión si expira.
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    
    // Headers por defecto
    const headers = {
      ...options.headers,
    };

    // Agregar token de autorización
    const token = state.get('token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Agregar clínica activa
    const activeClinicId = state.get('activeClinicId');
    if (activeClinicId) {
      headers['X-Clinic-Id'] = activeClinicId;
    }

    // Configurar body
    let body = options.body;
    if (body && !(body instanceof FormData) && typeof body === 'object') {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(body);
    }

    const fetchOptions = {
      ...options,
      headers,
      body,
    };

    try {
      const response = await fetch(url, fetchOptions);

      // Si el token expiró (401), intentar refrescar
      if (response.status === 401 && endpoint !== '/auth/login' && endpoint !== '/auth/refresh') {
        const refreshed = await this.tryRefreshToken();
        if (refreshed) {
          // Reintentar la petición original con el nuevo token
          return this.request(endpoint, options);
        } else {
          // Cerrar sesión y forzar redirección a login
          state.clearAuth();
          window.location.hash = '#/login';
          throw new Error('Sesión expirada. Inicie sesión nuevamente.');
        }
      }

      // Procesar respuestas vacías (204 No Content)
      if (response.status === 204) {
        return null;
      }

      const responseData = await response.json();

      if (!response.ok) {
        const error = new Error(responseData.message || 'Error inesperado en el servidor');
        if (responseData.errors?.length > 0) {
          error.details = responseData.errors;
          error.message += ': ' + responseData.errors.map(e => e.message).join('; ');
        }
        throw error;
      }

      if (options.returnFullResponse) {
        return responseData;
      }
      return responseData.data; // Retornar solo el objeto "data" de la API estandarizada
    } catch (error) {
      console.error(`Error en petición API [${options.method || 'GET'}] ${endpoint}:`, error.message);
      throw error;
    }
  }

  /**
   * Intenta refrescar el token de acceso.
   * @returns {Promise<boolean>}
   */
  async tryRefreshToken() {
    const refreshToken = state.get('refreshToken');
    if (!refreshToken) return false;

    try {
      const res = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: refreshToken }),
      });

      if (!res.ok) return false;

      const data = await res.json();
      if (data.success && data.data.accessToken) {
        // Actualizar el token en el estado
        state.setAuth(state.get('user'), data.data.accessToken, refreshToken);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  // Métodos abreviados convenientes
  async get(endpoint, params = null, options = {}) {
    let url = endpoint;
    if (params) {
      const queryStr = Object.entries(params)
        .filter(([_, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&');
      if (queryStr) url += `?${queryStr}`;
    }
    return this.request(url, { method: 'GET', ...options });
  }

  async post(endpoint, data) {
    return this.request(endpoint, { method: 'POST', body: data });
  }

  async put(endpoint, data) {
    return this.request(endpoint, { method: 'PUT', body: data });
  }

  async patch(endpoint, data) {
    return this.request(endpoint, { method: 'PATCH', body: data });
  }

  async delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }
}

const api = new ApiService();
export default api;
