// ============================================
// Componente de Notificaciones Toast
// ============================================

class ToastManager {
  constructor() {
    this.container = null;
  }

  init() {
    this.container = document.getElementById('toast-container');
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'toast-container';
      this.container.className = 'toast-container';
      document.body.appendChild(this.container);
    }
  }

  show(message, type = 'info') {
    if (!this.container) this.init();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type} animate-slide-up`;

    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';
    if (type === 'warning') icon = '⚠️';

    toast.innerHTML = `
      <span class="toast-icon">${icon}</span>
      <span class="toast-message">${message}</span>
      <button class="toast-close">&times;</button>
    `;

    this.container.appendChild(toast);

    // Evento de cierre manual
    toast.querySelector('.toast-close').addEventListener('click', () => {
      toast.remove();
    });

    // Auto-eliminar
    setTimeout(() => {
      toast.style.animation = 'fadeOut 0.3s ease-out forwards';
      toast.addEventListener('animationend', () => toast.remove());
    }, 4000);
  }

  success(msg) { this.show(msg, 'success'); }
  error(msg) { this.show(msg, 'error'); }
  warning(msg) { this.show(msg, 'warning'); }
  info(msg) { this.show(msg, 'info'); }
}

const toast = new ToastManager();
export default toast;
