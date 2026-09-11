// ============================================
// Vista de Reportes Estadísticos (Solo Propietario)
// ============================================
import reportService from '../../services/report.service.js';
import state from '../../scripts/state.js';
import toast from '../../components/toast/toast.js';
import { formatCurrency, formatDate } from '../../utils/helpers.js';

export class Reports {
  constructor(container) {
    this.container = container;
    this.activeReport = 'ingresos';
    this.reportData = null;
  }

  async render() {
    const userRole = state.get('user')?.role_name;
    if (userRole !== 'propietario' && userRole !== 'direccion') {
      toast.error('Acceso denegado: Solo propietarios y directores pueden ver los reportes.');
      window.location.hash = '#/dashboard';
      return;
    }

    try {
      await this.loadChartJs();
      this.renderLayout();
    } catch (err) {
      toast.error('Error al iniciar el módulo de reportes');
    }
  }

  async loadChartJs() {
    if (window.Chart) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('No se pudo cargar Chart.js'));
      document.head.appendChild(script);
    });
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
              <option value="facturas_recibos">Resumen de Facturas y Recibos</option>
            </select>
          </div>
          <button id="generate-report-btn" class="btn btn-primary">Generar Reporte</button>
          <button id="export-pdf-btn" class="btn btn-primary" style="display: none; background-color: #0369a1; border-color: #0284c7;">📄 Descargar PDF</button>
          <button id="print-report-btn" class="btn btn-outline" style="display: none;">🖨️ Imprimir</button>
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
    const exportPdfBtn = this.container.querySelector('#export-pdf-btn');

    if (generateBtn) {
      generateBtn.addEventListener('click', () => this.generateReport());
    }

    if (exportPdfBtn) {
      exportPdfBtn.addEventListener('click', () => this.exportPdf());
    }

    const printBtn = this.container.querySelector('#print-report-btn');
    if (printBtn) {
      printBtn.addEventListener('click', () => this.printReport());
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
        
        let methodRows = (data.byMethod || []).map(m => `
          <tr>
            <td><strong>${m.method}</strong></td>
            <td><strong>${formatCurrency(m.total)}</strong></td>
          </tr>
        `).join('');

        let docRows = (data.byDoctor || []).map(d => `
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

            <div class="card" style="display: flex; flex-direction: column;">
              <div class="card-header"><h3>Ingresos por Método de Pago</h3></div>
              <div style="padding: var(--space-4); display: flex; justify-content: center; align-items: center; border-bottom: 1px solid var(--color-border);">
                <canvas id="revenue-method-chart" style="max-height: 220px; max-width: 220px;"></canvas>
              </div>
              <div class="card-body table-container">
                <table>
                  <thead><tr><th>Método</th><th>Monto</th></tr></thead>
                  <tbody>${methodRows}</tbody>
                </table>
              </div>
            </div>

            <div class="card" style="display: flex; flex-direction: column;">
              <div class="card-header"><h3>Ingresos por Médico</h3></div>
              <div style="padding: var(--space-4); border-bottom: 1px solid var(--color-border);">
                <canvas id="revenue-doctor-chart" style="max-height: 220px;"></canvas>
              </div>
              <div class="card-body table-container">
                <table>
                  <thead><tr><th>Médico</th><th>Monto</th></tr></thead>
                  <tbody>${docRows}</tbody>
                </table>
              </div>
            </div>
          </div>
        `;

        try { this.initRevenueCharts(data); } catch (e) { console.warn('Error en revenue charts:', e); }

      } else if (type === 'citas') {
        const data = await reportService.getAppointments(from, to);
        this.reportData = data;

        let statusRows = (data.byStatus || []).map(s => `
          <tr>
            <td><strong><span style="color: ${s.color};">●</span> ${s.status}</strong></td>
            <td><strong>${s.count} citas</strong></td>
          </tr>
        `).join('');

        let docRows = (data.byDoctor || []).map(d => `
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

            <div class="card" style="display: flex; flex-direction: column;">
              <div class="card-header"><h3>Citas por Estado</h3></div>
              <div style="padding: var(--space-4); display: flex; justify-content: center; align-items: center; border-bottom: 1px solid var(--color-border);">
                <canvas id="appointments-status-chart" style="max-height: 220px; max-width: 220px;"></canvas>
              </div>
              <div class="card-body table-container">
                <table>
                  <thead><tr><th>Estado</th><th>Cantidad</th></tr></thead>
                  <tbody>${statusRows}</tbody>
                </table>
              </div>
            </div>

            <div class="card" style="display: flex; flex-direction: column;">
              <div class="card-header"><h3>Citas por Médico</h3></div>
              <div style="padding: var(--space-4); border-bottom: 1px solid var(--color-border);">
                <canvas id="appointments-doctor-chart" style="max-height: 220px;"></canvas>
              </div>
              <div class="card-body table-container">
                <table>
                  <thead><tr><th>Médico</th><th>Cantidad</th></tr></thead>
                  <tbody>${docRows}</tbody>
                </table>
              </div>
            </div>
          </div>
        `;

        try { this.initAppointmentCharts(data); } catch (e) { console.warn('Error en appointment charts:', e); }

      } else if (type === 'tratamientos') {
        const data = await reportService.getTreatments(from, to);
        this.reportData = data;

        let rows = data.popular.map((t, idx) => `
          <tr>
            <td><strong># ${idx + 1}</strong></td>
            <td><strong>${t.treatment}</strong></td>
            <td>${t.count} veces</td>
          </tr>
        `).join('');

        if (!data.popular || data.popular.length === 0) {
          rows = `<tr><td colspan="3" style="text-align: center; color: var(--text-secondary);">No hay tratamientos registrados en el rango.</td></tr>`;
        }

        resultsContainer.innerHTML = `
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-6);">
            <div class="card" style="grid-column: span 2;">
              <div class="card-header"><h3>Popularidad de Tratamientos</h3></div>
              <div style="padding: var(--space-4); border-bottom: 1px solid var(--color-border);">
                <canvas id="treatments-popularity-chart" style="max-height: 260px;"></canvas>
              </div>
            </div>

            <div class="card" style="grid-column: span 2;">
              <div class="card-header"><h3>Tratamientos más Solicitados</h3></div>
              <div class="card-body table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Ranking</th>
                      <th>Servicio / Tratamiento</th>
                      <th>Frecuencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${rows}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        `;

        try { this.initTreatmentCharts(data); } catch (e) { console.warn('Error en treatment charts:', e); }
      } else if (type === 'facturas_recibos') {
        const data = await reportService.getInvoiceReceiptSummary(from, to);
        this.reportData = data;
        this.renderInvoiceReceiptSummary(resultsContainer, data);
      }

      const exportPdfBtn = this.container.querySelector('#export-pdf-btn');
      if (exportPdfBtn) exportPdfBtn.style.display = 'inline-block';
      const printBtn = this.container.querySelector('#print-report-btn');
      if (printBtn) printBtn.style.display = 'inline-block';
    } catch (err) {
      toast.error('Error al generar el reporte.');
      resultsContainer.innerHTML = `<p style="color: var(--danger-600);">Error: ${err.message}</p>`;
    }
  }

  initRevenueCharts(data) {
    const methodCtx = document.getElementById('revenue-method-chart')?.getContext('2d');
    if (methodCtx) {
      new Chart(methodCtx, {
        type: 'doughnut',
        data: {
          labels: data.byMethod.map(m => m.method),
          datasets: [{
            data: data.byMethod.map(m => Number(m.total)),
            backgroundColor: ['#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#64748b']
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'bottom' }
          }
        }
      });
    }

    const docCtx = document.getElementById('revenue-doctor-chart')?.getContext('2d');
    if (docCtx) {
      new Chart(docCtx, {
        type: 'bar',
        data: {
          labels: data.byDoctor.map(d => d.doctor),
          datasets: [{
            label: 'Ingresos ($)',
            data: data.byDoctor.map(d => Number(d.total)),
            backgroundColor: '#0f766e'
          }]
        },
        options: {
          responsive: true,
          scales: {
            y: { beginAtZero: true }
          },
          plugins: {
            legend: { display: false }
          }
        }
      });
    }
  }

  initAppointmentCharts(data) {
    const statusCtx = document.getElementById('appointments-status-chart')?.getContext('2d');
    if (statusCtx) {
      new Chart(statusCtx, {
        type: 'doughnut',
        data: {
          labels: data.byStatus.map(s => s.status),
          datasets: [{
            data: data.byStatus.map(s => Number(s.count)),
            backgroundColor: data.byStatus.map(s => s.color || '#64748b')
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'bottom' }
          }
        }
      });
    }

    const docCtx = document.getElementById('appointments-doctor-chart')?.getContext('2d');
    if (docCtx) {
      new Chart(docCtx, {
        type: 'bar',
        data: {
          labels: data.byDoctor.map(d => d.doctor),
          datasets: [{
            label: 'Citas',
            data: data.byDoctor.map(d => Number(d.count)),
            backgroundColor: '#4f46e5'
          }]
        },
        options: {
          responsive: true,
          scales: {
            y: { beginAtZero: true, ticks: { stepSize: 1 } }
          },
          plugins: {
            legend: { display: false }
          }
        }
      });
    }
  }

  initTreatmentCharts(data) {
    const treatCtx = document.getElementById('treatments-popularity-chart')?.getContext('2d');
    if (treatCtx) {
      new Chart(treatCtx, {
        type: 'bar',
        data: {
          labels: data.popular.map(t => t.treatment),
          datasets: [
            {
              label: 'Frecuencia (veces)',
              data: data.popular.map(t => Number(t.count)),
              backgroundColor: '#3b82f6'
            }
          ]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { display: false }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: { stepSize: 1 }
            }
          }
        }
      });
    }
  }

  renderInvoiceReceiptSummary(resultsContainer, data) {
    const invoices = data.invoices || [];
    const receipts = data.receipts || [];
    const totals = data.totals || { invoices: { total: 0, count: 0 }, receipts: { total: 0, count: 0 }, byPaymentMethod: [] };

    const paymentMethodsHtml = (totals.byPaymentMethod || []).length > 0
      ? totals.byPaymentMethod.map(pm => `
          <div style="background: var(--gray-50); border: 1px solid var(--color-border); border-radius: var(--radius-md, 6px); padding: var(--space-3); min-width: 160px; flex: 1;">
            <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">${pm.method}</div>
            <div style="font-size: 18px; font-weight: 700; color: var(--text-primary); margin-top: 4px;">${formatCurrency(pm.total)}</div>
          </div>
        `).join('')
      : `<div style="color: var(--text-secondary); font-size: 13px; font-style: italic; padding: var(--space-2);">No hay cobros registrados en este período.</div>`;

    const invoiceRows = invoices.length > 0
      ? invoices.map(inv => `
          <tr>
            <td>${formatDate(inv.date || inv.raw_date)}</td>
            <td><strong class="badge badge-info" style="font-family: monospace; font-size: 13px;"># ${inv.invoice_number}</strong></td>
            <td><strong>${inv.customer_name}</strong></td>
            <td><span class="${inv.patient_identification === 'No registrado' ? 'badge badge-neutral' : ''}" style="${inv.patient_identification === 'No registrado' ? 'font-style: italic;' : 'font-weight: 600;'}">${inv.patient_identification}</span></td>
            <td><strong style="color: var(--primary-700);">${formatCurrency(inv.amount)}</strong></td>
            <td><span class="badge badge-neutral" style="font-size: 12px;">${inv.payment_method}</span></td>
          </tr>
        `).join('')
      : `<tr><td colspan="6" style="text-align: center; color: var(--text-secondary); padding: var(--space-6);">No se encontraron facturas en el rango de fechas seleccionado.</td></tr>`;

    const receiptRows = receipts.length > 0
      ? receipts.map(rec => `
          <tr>
            <td>${formatDate(rec.date || rec.raw_date)}</td>
            <td><strong class="badge badge-success" style="font-family: monospace; font-size: 13px; background-color: var(--success-100); color: var(--success-800); border: 1px solid var(--success-300);"># ${rec.receipt_number}</strong></td>
            <td><strong>${rec.customer_name}</strong></td>
            <td><span class="${rec.patient_identification === 'No registrado' ? 'badge badge-neutral' : ''}" style="${rec.patient_identification === 'No registrado' ? 'font-style: italic;' : 'font-weight: 600;'}">${rec.patient_identification}</span></td>
            <td><strong style="color: var(--success-700);">${formatCurrency(rec.amount)}</strong></td>
            <td><span class="badge badge-neutral" style="font-size: 12px;">${rec.payment_method}</span></td>
          </tr>
        `).join('')
      : `<tr><td colspan="6" style="text-align: center; color: var(--text-secondary); padding: var(--space-6);">No se encontraron recibos en el rango de fechas seleccionado.</td></tr>`;

    resultsContainer.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: var(--space-6);">
        <!-- Totals Cards -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4);">
          <div class="card" style="background-color: var(--primary-50); border-left: 6px solid var(--primary-500); padding: var(--space-6);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div>
                <h3 style="margin: 0; color: var(--primary-900); font-size: 16px;">Total Facturas</h3>
                <span style="font-size: 32px; font-weight: 700; color: var(--primary-800); display: block; margin-top: 4px;">
                  ${formatCurrency(totals.invoices?.total || 0)}
                </span>
                <span style="font-size: 13px; color: var(--primary-700); margin-top: 4px; display: inline-block;">
                  ${totals.invoices?.count || 0} factura(s) emitida(s)
                </span>
              </div>
              <span style="font-size: 32px;">📄</span>
            </div>
          </div>

          <div class="card" style="background-color: var(--success-50); border-left: 6px solid var(--success-500); padding: var(--space-6);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div>
                <h3 style="margin: 0; color: var(--success-900); font-size: 16px;">Total Recibos</h3>
                <span style="font-size: 32px; font-weight: 700; color: var(--success-800); display: block; margin-top: 4px;">
                  ${formatCurrency(totals.receipts?.total || 0)}
                </span>
                <span style="font-size: 13px; color: var(--success-700); margin-top: 4px; display: inline-block;">
                  ${totals.receipts?.count || 0} recibo(s) emitido(s)
                </span>
              </div>
              <span style="font-size: 32px;">🧾</span>
            </div>
          </div>

          <div class="card" style="grid-column: span 2; padding: var(--space-5);">
            <div style="margin-bottom: var(--space-3);">
              <h3 style="margin: 0; font-size: 15px; color: var(--text-primary); font-weight: 600;">💳 Desglose por Método de Pago</h3>
            </div>
            <div style="display: flex; gap: var(--space-3); flex-wrap: wrap;">
              ${paymentMethodsHtml}
            </div>
          </div>
        </div>

        <!-- Section / Tabs Header -->
        <div>
          <div style="display: flex; gap: var(--space-2); border-bottom: 2px solid var(--color-border); margin-bottom: var(--space-4);">
            <button type="button" id="tab-btn-facturas" class="btn btn-primary" style="border-bottom-left-radius: 0; border-bottom-right-radius: 0; padding: var(--space-2) var(--space-4); font-weight: 600;">
              📄 Facturas (${invoices.length})
            </button>
            <button type="button" id="tab-btn-recibos" class="btn btn-outline" style="border-bottom-left-radius: 0; border-bottom-right-radius: 0; padding: var(--space-2) var(--space-4); font-weight: 600; border-bottom: none;">
              🧾 Recibos (${receipts.length})
            </button>
          </div>

          <!-- Section Facturas -->
          <div id="section-facturas" class="card">
            <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
              <h3>Detalle de Facturas Emitidas</h3>
              <span class="badge badge-info">${invoices.length} registro(s)</span>
            </div>
            <div class="card-body table-container">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Número de Factura</th>
                    <th>Nombre del Cliente</th>
                    <th>DNI / NIE / Pasaporte</th>
                    <th>Importe</th>
                    <th>Método de Pago</th>
                  </tr>
                </thead>
                <tbody>
                  ${invoiceRows}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Section Recibos -->
          <div id="section-recibos" class="card" style="display: none;">
            <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
              <h3>Detalle de Recibos de Pago</h3>
              <span class="badge badge-success">${receipts.length} registro(s)</span>
            </div>
            <div class="card-body table-container">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Número de Recibo</th>
                    <th>Nombre del Cliente</th>
                    <th>DNI / NIE / Pasaporte</th>
                    <th>Importe</th>
                    <th>Método de Pago</th>
                  </tr>
                </thead>
                <tbody>
                  ${receiptRows}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;

    // Bind tab events
    const tabFacturas = resultsContainer.querySelector('#tab-btn-facturas');
    const tabRecibos = resultsContainer.querySelector('#tab-btn-recibos');
    const secFacturas = resultsContainer.querySelector('#section-facturas');
    const secRecibos = resultsContainer.querySelector('#section-recibos');

    if (tabFacturas && tabRecibos && secFacturas && secRecibos) {
      tabFacturas.addEventListener('click', () => {
        tabFacturas.className = 'btn btn-primary';
        tabRecibos.className = 'btn btn-outline';
        secFacturas.style.display = 'block';
        secRecibos.style.display = 'none';
      });

      tabRecibos.addEventListener('click', () => {
        tabRecibos.className = 'btn btn-primary';
        tabFacturas.className = 'btn btn-outline';
        secFacturas.style.display = 'none';
        secRecibos.style.display = 'block';
      });
    }
  }

  printReport() {
    const typeLabels = {
      ingresos: 'Reporte Financiero (Ingresos)',
      citas: 'Reporte Operativo (Citas)',
      tratamientos: 'Reporte Clínico (Tratamientos)',
      facturas_recibos: 'Resumen de Facturas y Recibos',
    };
    const from = this.container.querySelector('#report-date-from').value;
    const to = this.container.querySelector('#report-date-to').value;
    const typeLabel = typeLabels[this.activeReport] || 'Reporte';
    const title = `${typeLabel} — ${from} al ${to}`;

    const contentEl = this.container.querySelector('#report-results-container');
    const cloneEl = contentEl.cloneNode(true);
    
    // Ensure both sections are visible in printable document
    const secFacturas = cloneEl.querySelector('#section-facturas');
    const secRecibos = cloneEl.querySelector('#section-recibos');
    if (secFacturas) secFacturas.style.display = 'block';
    if (secRecibos) secRecibos.style.display = 'block';

    const printContent = cloneEl.innerHTML.replace(/<canvas[^>]*>.*?<\/canvas>/g, '');

    const w = window.open('', '_blank');
    w.document.write(`
      <html><head><title>${title}</title>
      <style>
        body { font-family: sans-serif; padding: 40px; color: #333; }
        h1 { font-size: 22px; margin-bottom: 4px; }
        .subtitle { color: #666; margin-bottom: 24px; }
        .card { border: 1px solid #ddd; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; margin: 8px 0; }
        th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
        th { background: #f5f5f5; }
        .card-header h3 { margin: 0 0 8px 0; }
        .empty-state { text-align: center; padding: 40px; color: #999; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; }
      </style></head><body>
        <h1>Clinica Vides Dental</h1>
        <div class="subtitle">${title}</div>
        ${printContent}
        <p style="text-align:center;color:#999;margin-top:40px;font-size:12px;">Generado el ${new Date().toLocaleString()}</p>
      </body></html>
    `);
    w.document.close();
    w.print();
  }

  exportPdf() {
    const from = this.container.querySelector('#report-date-from').value;
    const to = this.container.querySelector('#report-date-to').value;
    reportService.exportPdf(this.activeReport, from, to);
  }

  exportCsv() {
    this.exportPdf();
  }
}
