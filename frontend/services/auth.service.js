// ============================================
// Servicio de Autenticación Frontend
// ============================================
import api from './api.service.js';
import state from '../scripts/state.js';

class AuthService {
  /**
   * Inicia sesión con credenciales.
   */
  async login(email, password) {
    const data = await api.post('/auth/login', { email, password });
    if (data && data.accessToken) {
      state.setAuth(data.user, data.accessToken, data.refreshToken);
      return data.user;
    }
    throw new Error('Credenciales inválidas');
  }

  /**
   * Cierra la sesión activa.
   */
  async logout() {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      console.warn('Error al hacer logout en backend:', err.message);
    } finally {
      state.clearAuth();
      window.location.hash = '#/login';
    }
  }

  /**
   * Cambia la contraseña del usuario logueado.
   */
  async changePassword(currentPassword, newPassword) {
    return await api.put('/auth/change-password', { currentPassword, newPassword });
  }

  /**
   * Envía solicitud de restauración de contraseña.
   */
  async forgotPassword(email) {
    return await api.post('/auth/forgot-password', { email });
  }

  /**
   * Verifica si hay una sesión activa cargada.
   */
  isAuthenticated() {
    return !!state.get('token');
  }
}

const auth = new AuthService();
export default auth;
