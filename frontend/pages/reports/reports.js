// ============================================
// Vista de Reportes Estadísticos (Solo Propietario)
// ============================================
import reportService from '../../services/report.service.js';
import toast from '../../components/toast/toast.js';
import { formatCurrency } from '../../utils/helpers.js';

export class Reports {
  constructor(container) {
    this.container = container;
    this.activeReport = 'ingresos';
    this.reportData = null;
  }

  async render() {
    this.renderLayout();
  }

  renderLayout() {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const todayStr = today.toISOString().split('T')[0];

    this.container.innerHTML = `
      <div class="page-header" style="margin-bottom: var(--space-6);">
        <h1 class="page-title">Módulo de Reportes</h1>
        <p style="color: var(--text-secondary);">Análisis financiero y métricas operativas de la clínica</p>
      </div>

      <div class="card" style="padding: var(--space-4); margin-bottom: var(--space-6);">
        <div style="display: flex; gap: var(--space-4); align-items: flex-end; flex-wrap: wrap;">
          <div class="form-group">
            <label class="form-label">Fecha Desde</label>
            <input type="date" id="report-date-from" class="form-input" value="${startOfMonth}" />
          </div>
          <div class="form-group">
            <label class="form-label">Fecha Hasta</label>
            <input type="date" id="report-date-to" class="form-input" value="${todayStr}" />
          </div>
          <div class="form-group">
            <label class="form-label">Tipo de Reporte</label>
            <select id="report-type" class="form-select">
              <option value="ingresos">Reporte Financiero (Ingresos)</option>
              <option value="citas">Reporte Operativo (Citas)</option>
              <option value="tratamientos">Reporte Clínico (Tratamientos)</option>
            </select>
          </div>
          <button id="generate-report-btn" class="btn btn-primary">Generar Reporte</button>
          <button id="export-csv-btn" class="btn btn-outline" style="display: none;">Exportar CSV</button>
        </div>
      </div>

      <div id="report-results-container">
        <div class="empty-state">
          <span class="empty-state-icon">📊</span>
          <h3>Seleccione filtros y genere un reporte</h3>
          <p>Los resultados del reporte seleccionado se renderizarán en esta área.</p>
        </div>
      </div>
    `;
  }

  mount() {
    const generateBtn = this.container.querySelector('#generate-report-btn');
    const exportBtn = this.container.querySelector('#export-csv-btn');

    if (generateBtn) {
      generateBtn.addEventListener('click', () => this.generateReport());
    }

    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportCsv());
    }
  }

  async generateReport() {
    const from = this.container.querySelector('#report-date-from').value;
    const to = this.container.querySelector('#report-date-to').value;
    const type = this.container.querySelector('#report-type').value;

    this.activeReport = type;

    const resultsContainer = this.container.querySelector('#report-results-container');
    resultsContainer.innerHTML = '<div class="loading-spinner"></div>';

    try {
      if (type === 'ingresos') {
        const data = await reportService.getRevenue(from, to);
        this.reportData = data;
        
        let methodRows = data.byMethod.map(m => `
          <tr>
            <td><strong>${m.method}</strong></td>
            <td><strong>${formatCurrency(m.total)}</strong></td>
          </tr>
        `).join('');

        let docRows = data.byDoctor.map(d => `
          <tr>
            <td><strong>${d.doctor}</strong></td>
            <td><strong>${formatCurrency(d.total)}</strong></td>
          </tr>
        `).join('');

        resultsContainer.innerHTML = `
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-6);">
            <div class="card" style="grid-column: span 2; background-color: var(--success-50); border-left: 6px solid var(--success-500); padding: var(--space-6);">
              <h2 style="margin: 0; color: var(--success-900);">Total de Ingresos Recaudados</h2>
              <span style="font-size: 36px; font-weight: 700; color: var(--success-800);">${formatCurrency(data.total)}</span>
            </div>

            <div class="card">
              <div class="card-header"><h3>Ingresos por Método de Pago</h3></div>
              <div class="card-body table-container">
                <table>
                  <thead><tr><th>Método</th><th>Monto</th></tr></thead>
                  <tbody>${methodRows}</tbody>
                </table>
              </div>
            </div>

            <div class="card">
              <div class="card-header"><h3>Ingresos por Médico</h3></div>
              <div class="card-body table-container">
                <table>
                  <thead><tr><th>Médico</th><th>Monto</th></tr></thead>
                  <tbody>${docRows}</tbody>
                </table>
              </div>
            </div>
          </div>
        `;
      } else if (type === 'citas') {
        const data = await reportService.getAppointments(from, to);
        this.reportData = data;

        let statusRows = data.byStatus.map(s => `
          <tr>
            <td><strong><span style="color: ${s.color};">●</span> ${s.status}</strong></td>
            <td><strong>${s.count} citas</strong></td>
          </tr>
        `).join('');

        let docRows = data.byDoctor.map(d => `
          <tr>
            <td><strong>${d.doctor}</strong></td>
            <td><strong>${d.count} citas</strong></td>
          </tr>
        `).join('');

        resultsContainer.innerHTML = `
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-6);">
            <div class="card" style="grid-column: span 2; background-color: var(--primary-50); border-left: 6px solid var(--primary-500); padding: var(--space-6);">
              <h2 style="margin: 0; color: var(--primary-900);">Total de Citas Agendadas</h2>
              <span style="font-size: 36px; font-weight: 700; color: var(--primary-800);">${data.total} citas</span>
            </div>

            <div class="card">
              <div class="card-header"><h3>Citas por Estado</h3></div>
              <div class="card-body table-container">
                <table>
                  <thead><tr><th>Estado</th><th>Cantidad</th></tr></thead>
                  <tbody>${statusRows}</tbody>
                </table>
              </div>
            </div>

            <div class="card">
              <div class="card-header"><h3>Citas por Médico</h3></div>
              <div class="card-body table-container">
                <table>
                  <thead><tr><th>Médico</th><th>Cantidad</th></tr></thead>
                  <tbody>${docRows}</tbody>
                </table>
              </div>
            </div>
          </div>
        `;
      } else if (type === 'tratamientos') {
        const data = await reportService.getTreatments(from, to);
        this.reportData = data;

        let rows = data.popular.map((t, idx) => `
          <tr>
            <td><strong># ${idx + 1}</strong></td>
            <td><strong>${t.treatment}</strong></td>
            <td>${t.count} veces</td>
            <td style="color: var(--success-600); font-weight: 600;">${formatCurrency(t.total)}</td>
          </tr>
        `).join('');

        if (data.popular.length === 0) {
          rows = `<tr><td colspan="4" style="text-align: center; color: var(--text-secondary);">No hay tratamientos registrados en el rango.</td></tr>`;
        }

        resultsContainer.innerHTML = `
          <div class="card">
            <div class="card-header"><h3>Tratamientos más Solicitados</h3></div>
            <div class="card-body table-container">
              <table>
                <thead>
                  <tr>
                    <th>Ranking</th>
                    <th>Servicio / Tratamiento</th>
                    <th>Frecuencia</th>
                    <th>Ingresos Producidos</th>
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

      // Mostrar botón de exportar
      this.container.querySelector('#export-csv-btn').style.display = 'inline-block';
    } catch (err) {
      toast.error('Error al generar el reporte.');
      resultsContainer.innerHTML = `<p style="color: var(--danger-600);">Error: ${err.message}</p>`;
    }
  }

  exportCsv() {
    const from = this.container.querySelector('#report-date-from').value;
    const to = this.container.querySelector('#report-date-to').value;
    reportService.exportCsv(this.activeReport, from, to);
  }
}
