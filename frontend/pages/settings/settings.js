// ============================================
// Vista de Configuración del Sistema
// ============================================
import settingsService from '../../services/settings.service.js';
import toast from '../../components/toast/toast.js';
import state from '../../scripts/state.js';
import { formatDateTime } from '../../utils/helpers.js';

export class Settings {
  constructor(container) {
    this.container = container;
    this.clinicInfo = null;
    this.auditLogs = [];
  }

  async render() {
    try {
      this.clinicInfo = await settingsService.getClinicInfo();
      const logsResponse = await settingsService.getAuditLogs({ limit: 10 });
      this.auditLogs = logsResponse.logs || [];
      this.renderView();
    } catch (err) {
      toast.error('Error al cargar configuraciones');
    }
  }

  renderView() {
    const info = this.clinicInfo || {};
    
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

    this.container.innerHTML = `
      <div class="page-header" style="margin-bottom: var(--space-6);">
        <h1 class="page-title">Configuración</h1>
        <p style="color: var(--text-secondary);">Ajustes de la clínica y registro de auditoría de seguridad</p>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-6);">
        <!-- Datos de la Clínica -->
        <div class="card" style="padding: var(--space-6);">
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
            <div class="form-group" style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3);">
              <div>
                <label class="form-label">Teléfono</label>
                <input type="text" name="phone" class="form-input" value="${info.phone || ''}" />
              </div>
              <div>
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
            <div class="form-group" style="margin-top: var(--space-3); display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3);">
              <div>
                <label class="form-label">Ciudad</label>
                <input type="text" name="city" class="form-input" value="${info.city || ''}" />
              </div>
              <div>
                <label class="form-label">Estado / Provincia</label>
                <input type="text" name="state" class="form-input" value="${info.state || ''}" />
              </div>
            </div>
            <div class="form-group" style="margin-top: var(--space-3); display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3);">
              <div>
                <label class="form-label">País</label>
                <input type="text" name="country" class="form-input" value="${info.country || 'México'}" />
              </div>
              <div>
                <label class="form-label">Código Postal</label>
                <input type="text" name="postal_code" class="form-input" value="${info.postal_code || ''}" />
              </div>
            </div>

            <h4 style="margin: var(--space-4) 0 var(--space-2); color: var(--primary-700); font-size: var(--text-xs); text-transform: uppercase;">Configuración</h4>
            <div class="form-group" style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3);">
              <div>
                <label class="form-label">Moneda</label>
                <select name="currency" class="form-select">
                  <option value="MXN" ${info.currency === 'MXN' ? 'selected' : ''}>MXN - Peso Mexicano</option>
                  <option value="USD" ${info.currency === 'USD' ? 'selected' : ''}>USD - Dólar</option>
                  <option value="EUR" ${info.currency === 'EUR' ? 'selected' : ''}>EUR - Euro</option>
                </select>
              </div>
              <div>
                <label class="form-label">Tasa de Impuesto (%)</label>
                <input type="number" name="tax_rate" class="form-input" value="${info.tax_rate ?? 16}" step="0.01" min="0" max="100" />
              </div>
            </div>
            <div class="form-group" style="margin-top: var(--space-3); display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3);">
              <div>
                <label class="form-label">Hora de Apertura</label>
                <input type="time" name="opening_time" class="form-input" value="${info.opening_time || '08:00'}" />
              </div>
              <div>
                <label class="form-label">Hora de Cierre</label>
                <input type="time" name="closing_time" class="form-input" value="${info.closing_time || '20:00'}" />
              </div>
            </div>
            <div class="form-group" style="margin-top: var(--space-3);">
              <label class="form-label">Zona Horaria</label>
              <select name="timezone" class="form-select">
                <option value="America/Mexico_City" ${(info.timezone || 'America/Mexico_City') === 'America/Mexico_City' ? 'selected' : ''}>America/Mexico_City (UTC-6)</option>
                <option value="America/Monterrey" ${info.timezone === 'America/Monterrey' ? 'selected' : ''}>America/Monterrey (UTC-6)</option>
                <option value="America/Guadalajara" ${info.timezone === 'America/Guadalajara' ? 'selected' : ''}>America/Guadalajara (UTC-6)</option>
                <option value="America/Cancun" ${info.timezone === 'America/Cancun' ? 'selected' : ''}>America/Cancun (UTC-5)</option>
                <option value="America/Tijuana" ${info.timezone === 'America/Tijuana' ? 'selected' : ''}>America/Tijuana (UTC-8)</option>
                <option value="America/Chihuahua" ${info.timezone === 'America/Chihuahua' ? 'selected' : ''}>America/Chihuahua (UTC-7)</option>
                <option value="America/Hermosillo" ${info.timezone === 'America/Hermosillo' ? 'selected' : ''}>America/Hermosillo (UTC-7)</option>
                <option value="Europe/Madrid" ${info.timezone === 'Europe/Madrid' ? 'selected' : ''}>Europe/Madrid (UTC+1)</option>
              </select>
            </div>

            <button type="submit" class="btn btn-primary" style="margin-top: var(--space-6); width: 100%;">
              Guardar Cambios
            </button>
          </form>
        </div>

        <!-- Registro de Auditoría -->
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
      </div>
    `;
  }

  mount() {
    const form = this.container.querySelector('#clinic-info-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        try {
          const updated = await settingsService.updateClinicInfo(data);
          state.set('clinicInfo', updated);
          toast.success('Información de la clínica actualizada con éxito');
          await this.render();
          this.mount();
        } catch (err) {
          toast.error(err.message || 'Error al actualizar información');
        }
      });
    }
  }
}
