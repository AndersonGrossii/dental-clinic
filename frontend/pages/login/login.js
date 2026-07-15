// ============================================
// Vista de Login
// ============================================
import auth from '../../services/auth.service.js';
import settingsService from '../../services/settings.service.js';
import toast from '../../components/toast/toast.js';

export class Login {
  constructor(container) {
    this.container = container;
  }

  async render() {
    let clinicName = 'Clinica Dental';
    try {
      const clinic = await settingsService.getClinicInfo();
      if (clinic?.name) clinicName = clinic.name;
    } catch {
      // usar valor por defecto
    }
    this.container.innerHTML = `
      <div class="login-page animate-fade-in" style="display: flex; justify-content: center; align-items: center; min-height: 80vh; background: linear-gradient(135deg, var(--primary-50) 0%, #f0f7ff 100%);">
        <div class="card" style="width: 100%; max-width: 420px; padding: var(--space-10) var(--space-8); box-shadow: 0 20px 60px rgba(15, 134, 236, 0.12); border: 1px solid var(--color-border-light); border-radius: var(--radius-xl);">
          <div style="text-align: center; margin-bottom: var(--space-8);">
            <img src="/assets/videsDentalLogo.jpg" alt="Vides Dental" id="login-logo" style="height: 90px; width: auto; object-fit: contain; display: block; margin: 0 auto;" />
            <h2 id="login-fallback-title" style="display:none; margin-top: var(--space-2); color: var(--primary-700); font-size: var(--text-2xl); font-weight: var(--font-bold); letter-spacing: -0.02em;">Vides Dental</h2>
            <p style="color: var(--color-text-secondary); font-size: var(--text-sm); margin-top: var(--space-3);">Sistema de Gestión Dental</p>
          </div>

          <form id="login-form">
            <div class="form-group">
              <label class="form-label" for="login-email">Correo Electrónico</label>
              <input type="email" id="login-email" class="form-input" placeholder="admin@dentalclinic.com" required />
            </div>

            <div class="form-group" style="margin-top: var(--space-4);">
              <label class="form-label" for="login-password">Contraseña</label>
              <input type="password" id="login-password" class="form-input" placeholder="••••••••" required />
            </div>

            <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: var(--space-6);">
              Iniciar Sesión
            </button>
          </form>
        </div>
      </div>
    `;
  }

  mount() {
    const logo = this.container.querySelector('#login-logo');
    if (logo) {
      logo.addEventListener('error', () => {
        logo.style.display = 'none';
        const title = this.container.querySelector('#login-fallback-title');
        if (title) title.style.display = 'block';
      });
    }
    const form = this.container.querySelector('#login-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = form.querySelector('#login-email').value.trim();
        const password = form.querySelector('#login-password').value;

        try {
          const user = await auth.login(email, password);
          toast.success(`Bienvenido/a, ${user.first_name}!`);
          window.location.hash = '#/';
        } catch (err) {
          toast.error(err.message || 'Error al iniciar sesión. Verifique sus credenciales.');
        }
      });
    }
  }
}
