// ============================================
// Componente de Ventanas Modales
// ============================================

class Modal {
  /**
   * Cierra cualquier modal abierto.
   */
  static closeAll() {
    const modals = document.querySelectorAll('.modal-overlay');
    modals.forEach(m => m.remove());
  }

  /**
   * Muestra un modal dinámico.
   */
  static show({
    title,
    content,
    size = 'lg', // sm, md, lg, xl
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    onConfirm = null,
    onCancel = null,
  }) {
    // 1. Verificar y cerrar cualquier modal existente
    this.closeAll();

    // 2. Crear el overlay y el contenedor
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay animate-fade-in';
    
    overlay.innerHTML = `
      <div class="modal modal-${size} animate-scale-in">
        <div class="modal-header">
          <h3 class="modal-title">${title}</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          ${typeof content === 'string' ? content : ''}
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline modal-btn-cancel">${cancelText}</button>
          <button class="btn btn-primary modal-btn-confirm">${confirmText}</button>
        </div>
      </div>
    `;

    // Si pasaron un nodo HTML en vez de string
    if (content instanceof HTMLElement) {
      overlay.querySelector('.modal-body').appendChild(content);
    }

    document.body.appendChild(overlay);

    const close = () => {
      overlay.style.animation = 'fadeOut 0.2s ease-out forwards';
      overlay.querySelector('.modal').style.animation = 'fadeOut 0.2s ease-out forwards';
      overlay.addEventListener('animationend', () => overlay.remove());
    };

    // Eventos
    overlay.querySelector('.modal-close').addEventListener('click', close);
    
    overlay.querySelector('.modal-btn-cancel').addEventListener('click', () => {
      if (onCancel) onCancel();
      close();
    });

    overlay.querySelector('.modal-btn-confirm').addEventListener('click', async (e) => {
      if (onConfirm) {
        const btn = e.target;
        btn.disabled = true;
        const bodyContent = overlay.querySelector('.modal-body');
        // Ejecutar callback (que puede ser asíncrono)
        const shouldClose = await onConfirm(bodyContent);
        btn.disabled = false;
        if (shouldClose !== false) close();
      } else {
        close();
      }
    });

    // Cerrar haciendo clic fuera
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
  }

  /**
   * Cuadro de confirmación rápido (Confirm Dialog).
   */
  static confirm(title, message, onConfirm) {
    this.show({
      title,
      content: `<p>${message}</p>`,
      confirmText: 'Aceptar',
      cancelText: 'Cancelar',
      size: 'sm',
      onConfirm,
    });
  }
}

export default Modal;
