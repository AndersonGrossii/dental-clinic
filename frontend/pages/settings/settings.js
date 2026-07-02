// ============================================
// Vista de Configuración del Sistema
// ============================================
import settingsService from '../../services/settings.service.js';
import userService from '../../services/user.service.js';
import authService from '../../services/auth.service.js';
import toast from '../../components/toast/toast.js';
import state from '../../scripts/state.js';
import Modal from '../../components/modal/modal.js';
import { formatDateTime } from '../../utils/helpers.js';

export class Settings {
  constructor(container) {
    this.container = container;
    this.clinicInfo = null;
    this.auditLogs = [];
    this.usersList = [];
    this.activeTab = 'clinic';
    this.isManager = false;
  }

  async render() {
    const userRole = state.get('user')?.role_name;
    this.isManager = userRole === 'propietario' || userRole === 'direccion';

    if (!this.isManager && this.activeTab !== 'account') {
      this.activeTab = 'account';
    }

    try {
      this.clinicInfo = await settingsService.getClinicInfo();
      const logsResponse = await settingsService.getAuditLogs({ limit: 15 });
      this.auditLogs = logsResponse.logs || [];
      
      if (this.isManager) {
        const usersResponse = await userService.getAll({ limit: 100 });
        this.usersList = usersResponse || [];
      } else {
        this.usersList = [];
      }

      this.renderView();
    } catch (err) {
      toast.error('Error al cargar configuraciones');
    }
  }

  renderView() {
    // 1. Render tab headers
    const tabsHtml = `
      <div class="settings-tabs" style="display: flex; gap: var(--space-2); margin-bottom: var(--space-6); border-bottom: 2px solid var(--color-border-light); padding-bottom: 8px; flex-wrap: wrap;">
        ${this.isManager ? `
          <button class="btn btn-sm ${this.activeTab === 'clinic' ? 'btn-primary' : 'btn-ghost'} tab-btn" data-tab="clinic">Datos de la Clínica</button>
          <button class="btn btn-sm ${this.activeTab === 'users' ? 'btn-primary' : 'btn-ghost'} tab-btn" data-tab="users">Gestión de Usuarios</button>
          <button class="btn btn-sm ${this.activeTab === 'logs' ? 'btn-primary' : 'btn-ghost'} tab-btn" data-tab="logs">Registro de Auditoría</button>
        ` : ''}
        <button class="btn btn-sm ${this.activeTab === 'account' ? 'btn-primary' : 'btn-ghost'} tab-btn" data-tab="account">Mi Cuenta y Preferencias</button>
      </div>
    `;

    // 2. Render active tab content
    let contentHtml = '';

    if (this.activeTab === 'clinic') {
      contentHtml = this.renderClinicTab();
    } else if (this.activeTab === 'users') {
      contentHtml = this.renderUsersTab();
    } else if (this.activeTab === 'logs') {
      contentHtml = this.renderLogsTab();
    } else if (this.activeTab === 'account') {
      contentHtml = this.renderAccountTab();
    }

    this.container.innerHTML = `
      <div class="page-header" style="margin-bottom: var(--space-6);">
        <h1 class="page-title">Configuración</h1>
        <p style="color: var(--text-secondary);">Ajustes de la clínica, gestión de usuarios y preferencias visuales</p>
      </div>

      ${tabsHtml}
      <div id="settings-tab-content">
        ${contentHtml}
      </div>
    `;
  }

  renderClinicTab() {
    const info = this.clinicInfo || {};
    return `
      <div class="card" style="max-width: 800px; padding: var(--space-6);">
        <div class="card-header" style="margin-bottom: var(--space-4); border-bottom: 2px solid var(--gray-100); padding-bottom: 8px;">
          <h3>Datos de la Clínica</h3>
        </div>
        <form id="clinic-info-form">
          <h4 style="margin: var(--space-4) 0 var(--space-2); color: var(--primary-700); font-size: var(--text-xs); text-transform: uppercase;">Identificación</h4>
          <div class="form-group">
            <label class="form-label">Nombre Comercial</label>
            <input type="text" name="name" class="form-input" value="${info.name || ''}" required />
          </div>
          <div class="form-group" style="margin-top: var(--space-3);">
            <label class="form-label">Razón Social</label>
            <input type="text" name="legal_name" class="form-input" value="${info.legal_name || ''}" />
          </div>
          <div class="form-group" style="margin-top: var(--space-3);">
            <label class="form-label">RFC / Tax ID</label>
            <input type="text" name="tax_id" class="form-input" value="${info.tax_id || ''}" />
          </div>

          <h4 style="margin: var(--space-4) 0 var(--space-2); color: var(--primary-700); font-size: var(--text-xs); text-transform: uppercase;">Contacto</h4>
          <div class="form-row-responsive">
            <div class="form-group">
              <label class="form-label">Teléfono</label>
              <input type="text" name="phone" class="form-input" value="${info.phone || ''}" />
            </div>
            <div class="form-group">
              <label class="form-label">Email</label>
              <input type="email" name="email" class="form-input" value="${info.email || ''}" />
            </div>
          </div>
          <div class="form-group" style="margin-top: var(--space-3);">
            <label class="form-label">Sitio Web</label>
            <input type="url" name="website" class="form-input" value="${info.website || ''}" placeholder="https://" />
          </div>

          <h4 style="margin: var(--space-4) 0 var(--space-2); color: var(--primary-700); font-size: var(--text-xs); text-transform: uppercase;">Dirección</h4>
          <div class="form-group">
            <label class="form-label">Dirección</label>
            <input type="text" name="address" class="form-input" value="${info.address || ''}" />
          </div>
          <div class="form-row-responsive">
            <div class="form-group">
              <label class="form-label">Ciudad</label>
              <input type="text" name="city" class="form-input" value="${info.city || ''}" />
            </div>
            <div class="form-group">
              <label class="form-label">Estado / Provincia</label>
              <input type="text" name="state" class="form-input" value="${info.state || ''}" />
            </div>
          </div>
          <div class="form-row-responsive">
            <div class="form-group">
              <label class="form-label">País</label>
              <input type="text" name="country" class="form-input" value="${info.country || 'México'}" />
            </div>
            <div class="form-group">
              <label class="form-label">Código Postal</label>
              <input type="text" name="postal_code" class="form-input" value="${info.postal_code || ''}" />
            </div>
          </div>

          <h4 style="margin: var(--space-4) 0 var(--space-2); color: var(--primary-700); font-size: var(--text-xs); text-transform: uppercase;">Configuración</h4>
          <div class="form-row-responsive">
            <div class="form-group">
              <label class="form-label">Moneda</label>
              <select name="currency" class="form-select">
                <option value="MXN" ${info.currency === 'MXN' ? 'selected' : ''}>MXN - Peso Mexicano</option>
                <option value="USD" ${info.currency === 'USD' ? 'selected' : ''}>USD - Dólar</option>
                <option value="EUR" ${info.currency === 'EUR' ? 'selected' : ''}>EUR - Euro</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Tasa de Impuesto (%)</label>
              <input type="number" name="tax_rate" class="form-input" value="${info.tax_rate ?? 16}" step="0.01" min="0" max="100" />
            </div>
          </div>
          <div class="form-row-responsive">
            <div class="form-group">
              <label class="form-label">Hora de Apertura</label>
              <input type="time" name="opening_time" class="form-input" value="${info.opening_time || '08:00'}" />
            </div>
            <div class="form-group">
              <label class="form-label">Hora de Cierre</label>
              <input type="time" name="closing_time" class="form-input" value="${info.closing_time || '20:00'}" />
            </div>
          </div>

          <button type="submit" class="btn btn-primary" style="margin-top: var(--space-6); width: 100%;">
            Guardar Cambios
          </button>
        </form>
      </div>
    `;
  }

  renderLogsTab() {
    let logRows = this.auditLogs.map(log => `
      <tr>
        <td>${formatDateTime(log.created_at)}</td>
        <td><strong>${log.action}</strong></td>
        <td>${log.table_name || 'N/A'}</td>
        <td>${log.ip_address || 'Local'}</td>
      </tr>
    `).join('');

    if (this.auditLogs.length === 0) {
      logRows = `<tr><td colspan="4" style="text-align: center; color: var(--text-secondary);">No hay registros de auditoría.</td></tr>`;
    }

    return `
      <div class="card" style="padding: var(--space-6);">
        <div class="card-header" style="margin-bottom: var(--space-4); border-bottom: 2px solid var(--gray-100); padding-bottom: 8px;">
          <h3>Registro de Auditoría (Últimas Acciones)</h3>
        </div>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Fecha/Hora</th>
                <th>Acción</th>
                <th>Módulo</th>
                <th>IP Origen</th>
              </tr>
            </thead>
            <tbody>
              ${logRows}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  renderAccountTab() {
    const isDark = state.get('theme') === 'dark';
    return `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: var(--space-6); max-width: 900px;">
        <div class="card" style="padding: var(--space-6); height: fit-content;">
          <div class="card-header" style="margin-bottom: var(--space-4); border-bottom: 2px solid var(--gray-100); padding-bottom: 8px;">
            <h3>Preferencias Visuales</h3>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: var(--space-4);">
            <div>
              <strong style="display: block;">Modo Oscuro</strong>
              <span style="color: var(--text-secondary); font-size: var(--text-xs);">Cambiar apariencia de la interfaz</span>
            </div>
            <button id="dark-mode-toggle" class="btn ${isDark ? 'btn-primary' : 'btn-outline'}">
              ${isDark ? '☀️ Claro' : '🌙 Oscuro'}
            </button>
          </div>
        </div>

        <div class="card" style="padding: var(--space-6);">
          <div class="card-header" style="margin-bottom: var(--space-4); border-bottom: 2px solid var(--gray-100); padding-bottom: 8px;">
            <h3>Cambiar Contraseña</h3>
          </div>
          <form id="change-password-form" style="margin-top: var(--space-3);">
            <div class="form-group">
              <label class="form-label">Contraseña Actual</label>
              <input type="password" name="currentPassword" class="form-input" required />
            </div>
            <div class="form-group" style="margin-top: var(--space-3);">
              <label class="form-label">Nueva Contraseña</label>
              <input type="password" name="newPassword" class="form-input" required />
            </div>
            <div class="form-group" style="margin-top: var(--space-3);">
              <label class="form-label">Confirmar Nueva Contraseña</label>
              <input type="password" name="confirmPassword" class="form-input" required />
            </div>
            <button type="submit" class="btn btn-primary" style="margin-top: var(--space-4); width: 100%;">
              Actualizar Contraseña
            </button>
          </form>
        </div>
      </div>
    `;
  }

  renderUsersTab() {
    const userRole = state.get('user')?.role_name;

    let rows = this.usersList.map(u => {
      const isTargetOwner = u.role_name === 'propietario';
      const isCurrentDireccion = userRole === 'direccion';
      const disableActions = isTargetOwner && isCurrentDireccion;

      return `
        <tr style="${u.is_active === false ? 'opacity: 0.6;' : ''}">
          <td><strong>${u.first_name} ${u.last_name}</strong></td>
          <td>${u.email}</td>
          <td>${u.phone || '—'}</td>
          <td><span class="badge badge-info">${u.role_name || u.role_id}</span></td>
          <td>
            <span class="badge ${u.is_active !== false ? 'badge-success' : 'badge-danger'}">
              ${u.is_active !== false ? 'Activo' : 'Inactivo'}
            </span>
          </td>
          <td>
            <div style="display: flex; gap: var(--space-2);">
              <button class="btn btn-sm btn-secondary settings-edit-user-btn" data-id="${u.id}" ${disableActions ? 'disabled title="No tienes permisos para modificar este usuario"' : ''}>Editar</button>
              <button class="btn btn-sm btn-outline settings-pwd-user-btn" data-id="${u.id}" ${disableActions ? 'disabled title="No tienes permisos para modificar este usuario"' : ''}>Contraseña</button>
              <button class="btn btn-sm ${u.is_active !== false ? 'btn-outline' : 'btn-success'} settings-status-user-btn" data-id="${u.id}" data-active="${u.is_active !== false}" ${disableActions ? 'disabled title="No tienes permisos para modificar este usuario"' : ''}>
                ${u.is_active !== false ? 'Desactivar' : 'Activar'}
              </button>
              ${u.role_name !== 'propietario' ? `<button class="btn btn-sm btn-danger settings-delete-user-btn" data-id="${u.id}">✕</button>` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    if (this.usersList.length === 0) {
      rows = `<tr><td colspan="6" style="text-align: center; color: var(--text-secondary);">No hay usuarios registrados.</td></tr>`;
    }

    return `
      <div class="card" style="padding: var(--space-6);">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4); border-bottom: 2px solid var(--gray-100); padding-bottom: 8px;">
          <h3>Gestión de Usuarios</h3>
          <button id="settings-add-user-btn" class="btn btn-primary btn-sm">+ Nuevo Usuario</button>
        </div>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Correo</th>
                <th>Teléfono</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  mount() {
    // Listen for tab switching
    const tabContainer = this.container.querySelector('.settings-tabs');
    if (tabContainer) {
      tabContainer.addEventListener('click', (e) => {
        const tabBtn = e.target.closest('.tab-btn');
        if (tabBtn) {
          this.activeTab = tabBtn.getAttribute('data-tab');
          this.renderView();
          this.mount();
        }
      });
    }

    // Clinic Tab submit handler
    const clinicForm = this.container.querySelector('#clinic-info-form');
    if (clinicForm) {
      clinicForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(clinicForm);
        const data = Object.fromEntries(formData.entries());
        try {
          const updated = await settingsService.updateClinicInfo(data);
          state.set('clinicInfo', updated);
          toast.success('Información de la clínica actualizada con éxito');
          await this.render();
        } catch (err) {
          toast.error(err.message || 'Error al actualizar información');
        }
      });
    }

    // Account Preferences Tab handlers
    const toggleBtn = this.container.querySelector('#dark-mode-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        const currentTheme = state.get('theme') || 'light';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        localStorage.setItem('theme', newTheme);
        if (newTheme === 'dark') {
          document.body.setAttribute('data-theme', 'dark');
        } else {
          document.body.removeAttribute('data-theme');
        }
        state.set('theme', newTheme);
        this.renderView();
        this.mount();
      });
    }

    const changePwdForm = this.container.querySelector('#change-password-form');
    if (changePwdForm) {
      changePwdForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(changePwdForm);
        const data = Object.fromEntries(formData.entries());

        if (data.newPassword !== data.confirmPassword) {
          toast.error('La confirmación de la contraseña no coincide.');
          return;
        }

        try {
          await authService.changePassword(data.currentPassword, data.newPassword);
          toast.success('Contraseña cambiada exitosamente.');
          changePwdForm.reset();
        } catch (err) {
          toast.error(err.message || 'Error al cambiar contraseña.');
        }
      });
    }

    // User Management Tab handlers
    const addUserBtn = this.container.querySelector('#settings-add-user-btn');
    if (addUserBtn) {
      addUserBtn.addEventListener('click', () => this.showUserModal());
    }

    const contentArea = this.container.querySelector('#settings-tab-content');
    if (contentArea) {
      contentArea.addEventListener('click', async (e) => {
        if (e.target.classList.contains('settings-edit-user-btn')) {
          this.showUserModal(e.target.getAttribute('data-id'));
        }
        if (e.target.classList.contains('settings-pwd-user-btn')) {
          this.showResetPasswordModal(e.target.getAttribute('data-id'));
        }
        if (e.target.classList.contains('settings-status-user-btn')) {
          const id = e.target.getAttribute('data-id');
          try {
            await userService.toggleStatus(id);
            toast.success('Estado de usuario modificado con éxito');
            await this.render();
          } catch (err) {
            toast.error(err.message || 'Error al cambiar estado de usuario');
          }
        }
        if (e.target.classList.contains('settings-delete-user-btn')) {
          const id = e.target.getAttribute('data-id');
          this.showDeleteUserConfirm(id);
        }
      });
    }
  }

  showUserModal(userId = null) {
    const isEdit = !!userId;
    const userObj = isEdit ? this.usersList.find(u => u.id == userId) : {};

    const content = `
      <form id="settings-user-form">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3);">
          <div class="form-group">
            <label class="form-label">Nombre</label>
            <input type="text" name="first_name" class="form-input" value="${userObj.first_name || ''}" required />
          </div>
          <div class="form-group">
            <label class="form-label">Apellido</label>
            <input type="text" name="last_name" class="form-input" value="${userObj.last_name || ''}" required />
          </div>
        </div>
        <div class="form-group" style="margin-top: var(--space-3);">
          <label class="form-label">Correo electrónico</label>
          <input type="email" name="email" class="form-input" value="${userObj.email || ''}" required />
        </div>
        ${!isEdit ? `
        <div class="form-group" style="margin-top: var(--space-3);">
          <label class="form-label">Contraseña</label>
          <input type="password" name="password" class="form-input" required />
        </div>
        ` : ''}
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); margin-top: var(--space-3);">
          <div class="form-group">
            <label class="form-label">Teléfono</label>
            <input type="text" name="phone" class="form-input" value="${userObj.phone || ''}" />
          </div>
          <div class="form-group">
            <label class="form-label">Rol</label>
            <select name="role_id" class="form-select" required ${isEdit && userObj.role_name === 'propietario' ? 'disabled' : ''}>
              <option value="">Seleccione Rol</option>
              <option value="1" ${userObj.role_id == 1 ? 'selected' : ''}>Propietario</option>
              <option value="2" ${userObj.role_id == 2 ? 'selected' : ''}>Dirección</option>
              <option value="3" ${userObj.role_id == 3 ? 'selected' : ''}>Recepcionista</option>
              <option value="4" ${userObj.role_id == 4 ? 'selected' : ''}>Doctor</option>
            </select>
          </div>
        </div>
      </form>
    `;

    Modal.show({
      title: isEdit ? 'Editar Usuario' : 'Crear Nuevo Usuario',
      content: content,
      confirmText: isEdit ? 'Guardar Cambios' : 'Crear',
      onConfirm: async (modalBody) => {
        const form = modalBody.querySelector('#settings-user-form');
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        if (data.role_id) data.role_id = Number(data.role_id);

        try {
          if (isEdit) {
            if (userObj.role_name === 'propietario') delete data.role_id;
            await userService.update(userId, data);
            toast.success('Usuario actualizado con éxito');
          } else {
            await userService.create(data);
            toast.success('Usuario creado con éxito');
          }
          await this.render();
          return true;
        } catch (err) {
          toast.error(err.message || 'Error al procesar usuario');
          return false;
        }
      }
    });
  }

  showResetPasswordModal(userId) {
    const userObj = this.usersList.find(u => u.id == userId);
    if (!userObj) return;

    const content = `
      <form id="settings-reset-pwd-form">
        <div class="form-group">
          <label class="form-label">Nueva Contraseña para ${userObj.first_name} ${userObj.last_name}</label>
          <input type="password" name="newPassword" class="form-input" required />
        </div>
      </form>
    `;

    Modal.show({
      title: 'Restablecer Contraseña',
      content: content,
      confirmText: 'Restablecer',
      onConfirm: async (modalBody) => {
        const form = modalBody.querySelector('#settings-reset-pwd-form');
        const password = form.querySelector('[name="newPassword"]').value;
        try {
          await userService.resetPassword(userId, password);
          toast.success('Contraseña restablecida con éxito');
          return true;
        } catch (err) {
          toast.error(err.message || 'Error al restablecer contraseña');
          return false;
        }
      }
    });
  }

  showDeleteUserConfirm(userId) {
    const userObj = this.usersList.find(u => u.id == userId);
    if (!userObj) return;

    Modal.show({
      title: 'Confirmar Eliminación',
      content: `<p>¿Está seguro de que desea eliminar permanentemente al usuario <strong>${userObj.first_name} ${userObj.last_name}</strong>?</p>`,
      confirmText: 'Eliminar',
      confirmClass: 'btn-danger',
      onConfirm: async () => {
        try {
          await userService.remove(userId);
          toast.success('Usuario eliminado exitosamente');
          await this.render();
          return true;
        } catch (err) {
          toast.error(err.message || 'Error al eliminar usuario');
          return false;
        }
      }
    });
  }
}
