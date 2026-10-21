// ============================================
// Vista de Gestión de Recibos de Pago (REC)
// ============================================
import invoiceService from '../../services/invoice.service.js';
import paymentService from '../../services/payment.service.js';
import toast from '../../components/toast/toast.js';
import Modal from '../../components/modal/modal.js';
import state from '../../scripts/state.js';
import { formatDate, formatCurrency } from '../../utils/helpers.js';
import { getInvoiceStatusInfo, formatPaymentMethods } from '../../utils/formatters.js';
import pdfService from '../../services/pdf.service.js';

export class Receipts {
  constructor(container) {
    this.container = container;
    this.receiptsList = [];
    this.currentPage = 1;
    this.totalPages = 1;
    this.totalItems = 0;
    this.limit = 15;
    this.searchQuery = '';
    this.searchTimeout = null;
    this.abortController = null;
  }

  destroy() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
      this.searchTimeout = null;
    }
  }

  async render() {
    await this.loadReceipts();
  }

  async loadReceipts() {
    try {
      const params = {
        document_type: 'recibo',
        page: this.currentPage,
        limit: this.limit,
      };
      if (this.searchQuery) {
        params.search = this.searchQuery;
      }

      const response = await invoiceService.getAll(params, { returnFullResponse: true });
      const rawList = response?.data || response?.invoices || (Array.isArray(response) ? response : []);
      this.receiptsList = rawList.filter(r => r.document_type === 'recibo' || (r.invoice_number && r.invoice_number.startsWith('REC')));

      const pag = response?.pagination;
      this.totalItems = pag?.totalItems ?? pag?.total ?? this.receiptsList.length;
      this.totalPages = pag?.totalPages ?? Math.max(1, Math.ceil(this.totalItems / this.limit));
      this.currentPage = pag?.currentPage ?? pag?.page ?? this.currentPage;

      if (this.currentPage > this.totalPages && this.totalPages > 0) {
        this.currentPage = this.totalPages;
        return this.loadReceipts();
      }

      this.renderView();
    } catch (err) {
      console.error('Error al cargar recibos de pago:', err);
      toast.error('Error al cargar recibos de pago');
    }
  }

  renderPaginationButtons(totalPages, currentPage, prefix = 'receipt') {
    if (totalPages <= 1) {
      return `<button type="button" class="pagination-btn ${prefix}-page-btn active" data-page="1">1</button>`;
    }

    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) pages.push(i);
      }

      if (currentPage < totalPages - 2) pages.push('...');
      if (!pages.includes(totalPages)) pages.push(totalPages);
    }

    return pages.map(p => {
      if (p === '...') {
        return `<span style="display: flex; align-items: center; justify-content: center; min-width: 24px; color: var(--text-secondary);">&hellip;</span>`;
      }
      const isActive = p === currentPage;
      return `<button type="button" class="pagination-btn ${prefix}-page-btn ${isActive ? 'active' : ''}" data-page="${p}" ${isActive ? 'aria-current="page"' : ''}>${p}</button>`;
    }).join('');
  }

  renderView() {
    let rows = this.receiptsList.map(rec => {
      const statusInfo = getInvoiceStatusInfo(rec.status);
      return `
        <tr class="clickable-table-row receipt-main-row" data-id="${rec.id}">
          <td><strong style="color: var(--primary-700);"># ${rec.invoice_number}</strong></td>
          <td>${rec.patient_name || 'N/A'}</td>
          <td><strong>${formatCurrency(rec.total)}</strong></td>
          <td style="color: var(--success-600);">${formatCurrency(rec.amount_paid)}</td>
          <td style="color: var(--danger-600);"><strong>${formatCurrency(rec.balance)}</strong></td>
          <td><span class="badge ${statusInfo.class}">${statusInfo.label}</span></td>
          <td>${formatDate(rec.created_at)}</td>
          <td style="text-align: right;">
            <button type="button" class="btn btn-sm btn-outline toggle-receipt-actions-btn" data-id="${rec.id}">
              Acciones ▾
            </button>
          </td>
        </tr>
        <tr class="receipt-actions-bar-row" id="receipt-actions-${rec.id}" style="display: none; background: var(--gray-50);">
          <td colspan="8" style="padding: 12px 16px; border-bottom: 2px solid var(--primary-400);">
            <div style="display: flex; gap: var(--space-3); align-items: center; justify-content: space-between; flex-wrap: wrap;">
              <div style="font-size: 13px; font-weight: 600; color: var(--text-primary);">
                🧾 Opciones para Recibo #${rec.invoice_number}:
              </div>
              <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                <button class="btn btn-sm btn-outline download-pdf-receipt-btn" data-id="${rec.id}" data-number="${rec.invoice_number}" style="border-color: var(--primary-600); color: var(--primary-700); font-weight: 600;">📥 Descargar PDF</button>
                <button class="btn btn-sm btn-outline print-receipt-btn" data-id="${rec.id}">🖨️ Ver / Imprimir Recibo</button>
                ${rec.receipt_id ? `
                  <button class="btn btn-sm btn-info view-linked-invoice-btn" data-id="${rec.receipt_id}">📄 Factura Vinc. #${rec.receipt_id}</button>
                ` : `
                  <button class="btn btn-sm btn-primary generate-invoice-from-receipt-btn" data-id="${rec.id}">📄 Generar Factura Oficial</button>
                `}
                ${parseFloat(rec.balance || 0) > 0 ? `<button class="btn btn-sm btn-success pay-receipt-btn" data-id="${rec.id}">💳 Registrar Pago Restante</button>` : ''}
                <button class="btn btn-sm btn-danger delete-receipt-btn" data-id="${rec.id}">✕ Anular Recibo</button>
              </div>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    if (this.receiptsList.length === 0) {
      rows = `<tr><td colspan="8" style="text-align: center; color: var(--text-secondary); padding: var(--space-6);">No hay recibos de pago registrados${this.searchQuery ? ' que coincidan con la búsqueda' : ''}.</td></tr>`;
    }

    const startItem = this.totalItems === 0 ? 0 : (this.currentPage - 1) * this.limit + 1;
    const endItem = Math.min(this.currentPage * this.limit, this.totalItems);
    const paginationInfoText = this.totalItems === 0
      ? '0 recibos registrados'
      : `Mostrando <strong>${startItem}-${endItem}</strong> de <strong>${this.totalItems}</strong> recibos (Página <strong>${this.currentPage}</strong> de <strong>${this.totalPages}</strong>)`;

    this.container.innerHTML = `
      <div class="page-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-6);">
        <div>
          <h1 class="page-title">Recibos de Pago</h1>
          <p style="color: var(--text-secondary);">Comprobantes de pago registrados para tratamientos</p>
        </div>
      </div>

      <!-- Filtros y Búsqueda -->
      <div class="card" style="margin-bottom: var(--space-4); padding: var(--space-4);">
        <div style="display: flex; gap: var(--space-3); align-items: center; flex-wrap: wrap;">
          <div style="flex: 1; min-width: 240px;">
            <input 
              type="text" 
              id="receipt-search-input" 
              class="form-input" 
              placeholder="Buscar por no. recibo o paciente..." 
              value="${this.searchQuery || ''}" 
              style="width: 100%;"
            />
          </div>
          <div style="display: flex; gap: var(--space-2); align-items: center;">
            <label for="receipt-per-page-select" style="font-size: var(--text-sm); color: var(--text-secondary); white-space: nowrap;">Por página:</label>
            <select id="receipt-per-page-select" class="form-select" style="width: 80px;">
              <option value="10" ${this.limit === 10 ? 'selected' : ''}>10</option>
              <option value="15" ${this.limit === 15 ? 'selected' : ''}>15</option>
              <option value="25" ${this.limit === 25 ? 'selected' : ''}>25</option>
              <option value="50" ${this.limit === 50 ? 'selected' : ''}>50</option>
            </select>
            ${this.searchQuery ? `<button id="clear-receipt-filters-btn" class="btn btn-outline btn-sm" style="white-space: nowrap;">Limpiar filtro</button>` : ''}
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-body table-container">
          <table>
            <thead>
              <tr>
                <th>No. Recibo</th>
                <th>Paciente</th>
                <th>Monto Total</th>
                <th>Monto Pagado</th>
                <th>Saldo</th>
                <th>Estado</th>
                <th>Fecha Emisión</th>
                <th style="text-align: right;">Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>

        <!-- Barra de Paginación -->
        <div class="pagination">
          <div class="pagination-info">
            ${paginationInfoText}
          </div>
          <div class="pagination-controls">
            <button 
              type="button" 
              id="receipt-prev-btn" 
              class="btn btn-sm btn-outline pagination-btn" 
              ${this.currentPage <= 1 ? 'disabled' : ''}
              title="Página anterior"
            >&laquo; Anterior</button>
            <div id="receipt-pages-container" style="display: flex; gap: 4px; align-items: center;">
              ${this.renderPaginationButtons(this.totalPages, this.currentPage, 'receipt')}
            </div>
            <button 
              type="button" 
              id="receipt-next-btn" 
              class="btn btn-sm btn-outline pagination-btn" 
              ${this.currentPage >= this.totalPages ? 'disabled' : ''}
              title="Página siguiente"
            >Siguiente &raquo;</button>
          </div>
        </div>
      </div>
    `;
  }

  mount() {
    this.destroy();
    this.abortController = new AbortController();

    this.container.addEventListener('click', async (e) => {
      const prevBtn = e.target.closest('#receipt-prev-btn');
      if (prevBtn && !prevBtn.disabled) {
        if (this.currentPage > 1) {
          this.currentPage--;
          await this.loadReceipts();
          this.mount();
        }
        return;
      }

      const nextBtn = e.target.closest('#receipt-next-btn');
      if (nextBtn && !nextBtn.disabled) {
        if (this.currentPage < this.totalPages) {
          this.currentPage++;
          await this.loadReceipts();
          this.mount();
        }
        return;
      }

      const pageBtn = e.target.closest('.receipt-page-btn');
      if (pageBtn && !pageBtn.disabled) {
        const page = parseInt(pageBtn.getAttribute('data-page'), 10);
        if (!isNaN(page) && page !== this.currentPage) {
          this.currentPage = page;
          await this.loadReceipts();
          this.mount();
        }
        return;
      }

      const clearFiltersBtn = e.target.closest('#clear-receipt-filters-btn');
      if (clearFiltersBtn) {
        this.searchQuery = '';
        this.currentPage = 1;
        await this.loadReceipts();
        this.mount();
        return;
      }

      const toggleBtn = e.target.closest('.toggle-receipt-actions-btn');
      if (toggleBtn) {
        const id = toggleBtn.getAttribute('data-id');
        const actionsRow = this.container.querySelector(`#receipt-actions-${id}`);
        if (actionsRow) {
          const isVisible = actionsRow.style.display !== 'none';
          actionsRow.style.display = isVisible ? 'none' : 'table-row';
        }
        return;
      }

      const dlPdfBtn = e.target.closest('.download-pdf-receipt-btn');
      if (dlPdfBtn) {
        const id = dlPdfBtn.getAttribute('data-id');
        const num = dlPdfBtn.getAttribute('data-number');
        pdfService.downloadReceipt(id, num);
        return;
      }

      const printBtn = e.target.closest('.print-receipt-btn');
      if (printBtn) {
        this.printReceipt(printBtn.getAttribute('data-id'));
        return;
      }

      const payBtn = e.target.closest('.pay-receipt-btn');
      if (payBtn) {
        this.showRegisterPaymentModal(payBtn.getAttribute('data-id'));
        return;
      }

      const genInvBtn = e.target.closest('.generate-invoice-from-receipt-btn');
      if (genInvBtn) {
        this.showCreateInvoiceFromReceiptModal(genInvBtn.getAttribute('data-id'));
        return;
      }

      const viewInvBtn = e.target.closest('.view-linked-invoice-btn');
      if (viewInvBtn) {
        const invId = viewInvBtn.getAttribute('data-id');
        import('../invoices/invoices.js').then(({ Invoices }) => {
          new Invoices(this.container).printInvoice(invId);
        });
        return;
      }

      const deleteBtn = e.target.closest('.delete-receipt-btn');
      if (deleteBtn) {
        this.confirmDeleteReceipt(deleteBtn.getAttribute('data-id'));
        return;
      }

      const mainRow = e.target.closest('.receipt-main-row');
      if (mainRow) {
        const id = mainRow.getAttribute('data-id');
        const actionsRow = this.container.querySelector(`#receipt-actions-${id}`);
        if (actionsRow) {
          const isVisible = actionsRow.style.display !== 'none';
          this.container.querySelectorAll('.receipt-actions-bar-row').forEach(row => row.style.display = 'none');
          if (!isVisible) {
            actionsRow.style.display = 'table-row';
          }
        }
        return;
      }
    }, { signal: this.abortController.signal });

    this.container.addEventListener('change', async (e) => {
      const perPageSelect = e.target.closest('#receipt-per-page-select');
      if (perPageSelect) {
        this.limit = parseInt(perPageSelect.value, 10) || 15;
        this.currentPage = 1;
        await this.loadReceipts();
        this.mount();
      }
    }, { signal: this.abortController.signal });

    this.container.addEventListener('input', (e) => {
      const searchInput = e.target.closest('#receipt-search-input');
      if (searchInput) {
        if (this.searchTimeout) clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(async () => {
          this.searchQuery = searchInput.value.trim();
          this.currentPage = 1;
          await this.loadReceipts();
          this.mount();
          const refreshedInput = this.container.querySelector('#receipt-search-input');
          if (refreshedInput) {
            refreshedInput.focus();
            const len = refreshedInput.value.length;
            refreshedInput.setSelectionRange(len, len);
          }
        }, 300);
      }
    }, { signal: this.abortController.signal });
  }

  async printReceipt(id) {
    try {
      const rec = await invoiceService.getById(id);
      if (!rec) return;
      const clinic = state.get('clinicInfo') || {};
      const logoUrl = clinic?.logo_url || '/assets/videsDentalLogo.jpg';
      const primaryColor = clinic?.primary_color || '#0f86ec';

      const subtotalVal = parseFloat(rec.subtotal || 0);
      const discountVal = parseFloat(rec.discount_amount || 0);
      let pctVal = parseFloat(rec.discount_percentage || 0);
      if (pctVal <= 0 && subtotalVal > 0 && discountVal > 0) {
        pctVal = (discountVal / subtotalVal) * 100;
      }
      const pctStr = (pctVal % 1 === 0 ? pctVal.toFixed(0) : pctVal.toFixed(2)) + '%';

      const quoteNum = rec.quotation_number || rec.quotation?.quote_number || '';
      const quoteTotal = rec.quotation_total !== null && rec.quotation_total !== undefined ? parseFloat(rec.quotation_total) : (rec.quotation?.total ? parseFloat(rec.quotation.total) : null);
      const quotePaid = rec.quotation_amount_paid !== null && rec.quotation_amount_paid !== undefined ? parseFloat(rec.quotation_amount_paid) : (rec.quotation?.amount_paid ? parseFloat(rec.quotation.amount_paid) : null);
      const quoteRemaining = rec.quotation_remaining_balance !== null && rec.quotation_remaining_balance !== undefined ? parseFloat(rec.quotation_remaining_balance) : (rec.quotation?.remaining_balance !== undefined ? parseFloat(rec.quotation.remaining_balance) : null);
      const hasQuotation = quoteRemaining !== null && !isNaN(quoteRemaining);

      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
        <html>
        <head>
          <title>Recibo de Pago # ${rec.invoice_number}</title>
          <style>
            @page { margin: 20mm 15mm; }
            body { font-family: 'Segoe UI', Arial, sans-serif; padding: 0; margin: 0; color: #333; font-size: 13px; }
            .header { display: flex; align-items: center; gap: 20px; border-bottom: 2px solid ${primaryColor}; padding-bottom: 16px; margin-bottom: 20px; }
            .header-info { flex: 1; }
            .header-info h2 { margin: 0 0 4px 0; font-size: 18px; color: ${primaryColor}; }
            .header-info p { margin: 2px 0; color: #555; font-size: 12px; }
            .title-section { text-align: right; margin-bottom: 16px; }
            .title-section h1 { font-size: 22px; color: #111; margin: 0; letter-spacing: 2px; text-transform: uppercase; }
            .title-section p { color: ${primaryColor}; font-size: 14px; margin: 4px 0 0 0; font-weight: 600; }
            .details { display: flex; justify-content: space-between; margin: 16px 0; padding: 12px 14px; background: #f8f9fa; border-radius: 6px; }
            .details div { font-size: 13px; }
            .details strong { color: #111; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th { background-color: ${primaryColor}; color: white; padding: 10px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
            td { padding: 10px; border: 1px solid #ddd; font-size: 13px; }
            .totals { text-align: right; margin-top: 24px; padding: 16px; background: #f8f9fa; border-radius: 6px; }
            .totals p { margin: 4px 0; font-size: 14px; }
            .totals h2 { margin: 8px 0 0 0; font-size: 18px; }
            .totals hr { border: none; border-top: 1px solid #ddd; margin: 8px 0; }
            .footer { margin-top: 30px; display: flex; justify-content: space-between; align-items: end; }
            .footer-info { font-size: 11px; color: #999; text-align: right; }
            .print-btn { display: block; margin: 20px auto; padding: 10px 30px; background: ${primaryColor}; color: white; border: none; border-radius: 6px; font-size: 14px; cursor: pointer; }
            .print-btn:hover { filter: brightness(0.88); }
            @media print { .print-btn { display: none !important; } body { padding: 0; } }
          </style>
        </head>
        <body>
          <div style="display: flex; justify-content: center; gap: 12px; margin: 20px auto;" class="no-print">
            <button class="print-btn" id="print-btn" style="margin: 0;">🖨️ Imprimir</button>
            <button class="print-btn download-btn" id="download-pdf-btn" style="margin: 0; background: #16a34a;">📥 Descargar PDF Oficial</button>
          </div>

          <div class="header">
            <img src="${logoUrl}" alt="Logo" style="height: 60px; width: auto; object-fit: contain;" id="print-logo" />
            <div class="header-info">
              <h2>${clinic.name || 'Clínica Dental'}</h2>
              <p>${clinic.address || ''}${clinic.city ? ', ' + clinic.city : ''}</p>
              <p>${clinic.phone ? 'Tel: ' + clinic.phone : ''}${clinic.email ? ' | ' + clinic.email : ''}${clinic.tax_id ? ' | NIF: ' + clinic.tax_id : ''}</p>
            </div>
          </div>

          <div class="title-section">
            <h1>Recibo de Pago</h1>
            <p>${rec.invoice_number}</p>
          </div>

          <div class="details">
            <div>
              <strong>Paciente:</strong> ${rec.patient_name || 'N/A'}<br>
              <strong>DNI:</strong> ${rec.patient_dni || 'N/A'}
              ${quoteNum ? `<br><strong>Presupuesto Asociado:</strong> #${quoteNum}` : ''}
            </div>
            <div style="text-align: right;">
              <strong>Fecha de Emisión:</strong> ${formatDate(rec.created_at)}<br>
              <strong>Especialista:</strong> Dr/a. ${rec.doctor_name || 'N/A'}
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Descripción del Servicio / Concepto</th>
                <th style="text-align: right;">Precio Unitario</th>
                <th style="text-align: center;">Cant.</th>
                <th style="text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${(rec.items || []).map(item => {
                let displayDesc = item.clean_description || item.description;
                const itemTot = parseFloat(item.total || 0);
                const origTot = parseFloat(item.original_total || 0);
                const isPartial = origTot > itemTot + 0.01;

                return `
                  <tr>
                    <td>
                      <div><strong>${displayDesc}</strong> ${isPartial ? `<span style="font-size: 11px; margin-left: 6px; padding: 2px 6px; background: #fef3c7; color: #92400e; border: 1px solid #fde68a; border-radius: 4px; font-weight: 600;">Abono Parcial</span>` : ''}</div>
                      ${isPartial ? `<div style="font-size: 11px; color: #64748b; margin-top: 2px;">Precio Tratamiento: ${formatCurrency(origTot)} &bull; Importe abonado en este recibo: ${formatCurrency(itemTot)}</div>` : ''}
                    </td>
                    <td style="text-align: right;">${formatCurrency(item.unit_price)}</td>
                    <td style="text-align: center;">${item.quantity}</td>
                    <td style="text-align: right;"><strong>${formatCurrency(item.total)}</strong></td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <div class="totals">
            ${hasQuotation ? `
              <div style="background: ${quoteRemaining > 0 ? '#fffbeb' : '#f0fdf4'}; border: 1.5px solid ${quoteRemaining > 0 ? '#f59e0b' : '#16a34a'}; border-radius: 6px; padding: 12px 14px; text-align: right; margin-bottom: 14px;">
                <p style="margin: 2px 0; font-size: 13px; color: #475569;">
                  Total Tratamiento / Presupuesto ${quoteNum ? `(#${quoteNum})` : ''}: <strong>${formatCurrency(quoteTotal)}</strong>
                </p>
                <p style="margin: 2px 0; font-size: 13px; color: #475569;">
                  Total Abonado al Presupuesto: <strong>${formatCurrency(quotePaid)}</strong>
                </p>
                <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid ${quoteRemaining > 0 ? '#fde68a' : '#bbf7d0'}; font-size: 16px; font-weight: 700; color: ${quoteRemaining > 0 ? '#b45309' : '#15803d'};">
                  ${quoteRemaining > 0 
                    ? `⚠️ Saldo pendiente que debe el paciente a la clínica: ${formatCurrency(quoteRemaining)}` 
                    : `✅ Presupuesto completado y totalmente abonado (0,00 €)`}
                </div>
              </div>
            ` : ''}

            <p><strong>Subtotal Recibo:</strong> ${formatCurrency(subtotalVal)}</p>
            ${discountVal > 0 ? `<p style="color: #dc2626;"><strong>Descuento (${pctStr}):</strong> -${formatCurrency(discountVal)}</p>` : ''}
            <p>Monto Abonado en este Recibo: <strong>${formatCurrency(rec.amount_paid)}</strong></p>
            <p>Método de Pago: ${formatPaymentMethods(rec)}</p>
            <hr/>
            ${hasQuotation && quoteRemaining > 0 ? `
              <h2 style="color: #b45309; margin: 8px 0 4px 0;">A FALTA DE ABONAR DEL TRATAMIENTO: ${formatCurrency(quoteRemaining)}</h2>
              <p style="color: #64748b; font-size: 13px; margin: 2px 0;">Importe abonado en este Recibo: <strong>${formatCurrency(rec.total)}</strong> (de un total de <strong>${formatCurrency(quoteTotal)}</strong>)</p>
            ` : `
              <p>A falta de abonar de este recibo: <strong>${formatCurrency(rec.balance)}</strong></p>
              <h2 style="color: ${primaryColor};">TOTAL RECIBO: ${formatCurrency(rec.total)}</h2>
            `}
          </div>

          <div class="footer">
            <div></div>
            <div class="footer-info">
              Documento generado por Sistema de Gestión Clínica<br>
              ${new Date().toLocaleDateString()}
            </div>
          </div>
        </body>
        </html>
      `);
      printWindow.document.close();
      const printBtn = printWindow.document.querySelector('#print-btn');
      if (printBtn) printBtn.addEventListener('click', () => printWindow.print());
      const dlBtn = printWindow.document.querySelector('#download-pdf-btn');
      if (dlBtn) dlBtn.addEventListener('click', () => pdfService.downloadReceipt(id, rec.invoice_number));
      const logo = printWindow.document.querySelector('#print-logo');
      if (logo) logo.addEventListener('error', () => { logo.style.display = 'none'; });
    } catch {
      toast.error('Error al generar vista de impresión de recibo');
    }
  }

  async showRegisterPaymentModal(id) {
    try {
      const rec = await invoiceService.getById(id);
      if (!rec) return;

      const methods = await paymentService.getPaymentMethods();

      const methodOpts = methods.map(m => `<option value="${m.id}">${m.label}</option>`).join('');

      const content = `
        <form id="register-payment-form">
          <p><strong>Recibo:</strong> #${rec.invoice_number}</p>
          <p><strong>Saldo Pendiente:</strong> ${formatCurrency(rec.balance)}</p>

          <div class="form-group" style="margin-top: 16px;">
            <label class="form-label">Método de Pago</label>
            <select name="payment_method_id" class="form-select" required>
              ${methodOpts}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Monto a Pagar</label>
            <input type="number" step="0.01" name="amount" class="form-input" value="${rec.balance}" max="${rec.balance}" min="0.01" required />
          </div>

          <div class="form-group">
            <label class="form-label">No. Referencia (opcional)</label>
            <input type="text" name="reference_number" class="form-input" placeholder="Ej: TRANS-12345" />
          </div>

          <div class="form-group">
            <label class="form-label">Notas (opcional)</label>
            <textarea name="notes" class="form-input" rows="2"></textarea>
          </div>
        </form>
      `;

      Modal.show({
        title: 'Registrar Pago Restante',
        content,
        footer: `
          <button class="btn btn-outline" onclick="Modal.close()">Cancelar</button>
          <button class="btn btn-success" id="submit-payment-btn">Guardar Pago</button>
        `,
      });

      document.getElementById('submit-payment-btn')?.addEventListener('click', async () => {
        const form = document.getElementById('register-payment-form');
        if (!form) return;
        const formData = new FormData(form);
        const data = {
          invoice_id: rec.id,
          payment_method_id: parseInt(formData.get('payment_method_id'), 10),
          amount: parseFloat(formData.get('amount')),
          reference_number: formData.get('reference_number') || null,
          notes: formData.get('notes') || null,
        };

        try {
          await paymentService.create(data);
          toast.success('Pago registrado correctamente');
          Modal.close();
          await this.render();
          this.mount();
        } catch (err) {
          toast.error(err.message || 'Error al registrar pago');
        }
      });
    } catch (err) {
      toast.error('Error al preparar registro de pago');
    }
  }

  async showCreateInvoiceFromReceiptModal(receiptId) {
    let rec = null;
    try {
      rec = await invoiceService.getById(receiptId);
    } catch (err) {
      toast.error('Error al cargar datos del recibo');
      return;
    }
    if (!rec) return;

    const totalPaid = parseFloat(rec.amount_paid || rec.total || 0);

    const initialItems = (rec.items || []).map(i => ({
      description: i.clean_description || i.description || 'Tratamiento Odontológico',
      quantity: parseInt(i.quantity || 1, 10),
      unit_price: parseFloat(i.unit_price || i.total || 0),
      total: parseFloat(i.total || 0)
    }));

    if (initialItems.length === 0) {
      initialItems.push({
        description: `Cobro según Recibo #${rec.invoice_number}`,
        quantity: 1,
        unit_price: totalPaid,
        total: totalPaid
      });
    }

    const renderItemRows = (itemsList) => {
      return itemsList.map((item, idx) => `
        <tr class="inv-item-row" data-index="${idx}">
          <td style="padding: 6px 8px;">
            <input type="text" class="form-input inv-item-desc" value="${(item.description || '').replace(/"/g, '&quot;')}" style="font-size: 13px; width: 100%;" required />
          </td>
          <td style="padding: 6px 8px; width: 70px; text-align: center;">
            <input type="number" min="1" step="1" class="form-input inv-item-qty" value="${item.quantity}" style="font-size: 13px; text-align: center;" required />
          </td>
          <td style="padding: 6px 8px; width: 120px; text-align: right;">
            <input type="number" min="0" step="0.01" class="form-input inv-item-price" value="${item.unit_price}" style="font-size: 13px; text-align: right;" required />
          </td>
          <td style="padding: 6px 8px; width: 120px; text-align: right; font-weight: 600;">
            <span class="inv-item-total-span">${formatCurrency(item.total)}</span>
          </td>
          <td style="padding: 6px 8px; width: 40px; text-align: center;">
            <button type="button" class="btn btn-sm btn-ghost remove-inv-item-btn" style="color: var(--danger-600); padding: 2px 6px;">✕</button>
          </td>
        </tr>
      `).join('');
    };

    Modal.show({
      title: `📄 Generar Factura Oficial — desde Recibo #${rec.invoice_number}`,
      content: `
        <form id="create-invoice-from-receipt-form">
          <div style="background: var(--primary-50); border: 1px solid var(--primary-200); padding: 12px 16px; border-radius: var(--radius-md); margin-bottom: var(--space-4); font-size: 13px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <span>👤 Paciente: <strong>${rec.patient_name || 'N/A'}</strong></span>
              <span>🧾 Recibo Originario: <strong>#${rec.invoice_number}</strong></span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span>👨‍⚕️ Especialista: <strong>Dr/a. ${rec.doctor_name || 'Sin asignar'}</strong></span>
              <span>💰 Monto Cobrado en Recibo: <strong style="color: var(--success-700); font-size: 14px;">${formatCurrency(totalPaid)}</strong></span>
            </div>
          </div>

          <div class="form-group" style="margin-bottom: var(--space-3);">
            <label class="form-label" style="font-weight: 600;">Fecha de Emisión de la Factura</label>
            <input type="date" name="invoice_date" class="form-input" value="${new Date().toISOString().split('T')[0]}" required />
          </div>

          <div class="form-group" style="margin-bottom: var(--space-4);">
            <label class="form-label" style="font-weight: 600;">Conceptos / Desglose de la Factura Oficial (Personalizable)</label>
            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 8px;">
              Puede personalizar la descripción, cantidades y precios unitarios que aparecerán en la factura oficial.
            </div>
            <div class="table-container" style="border: 1px solid var(--border-color); border-radius: var(--radius-md); overflow: hidden; margin-bottom: 8px;">
              <table style="margin: 0; width: 100%;">
                <thead>
                  <tr style="background: var(--gray-100);">
                    <th>Descripción / Concepto</th>
                    <th style="text-align: center; width: 70px;">Cant.</th>
                    <th style="text-align: right; width: 120px;">Precio Unit.</th>
                    <th style="text-align: right; width: 120px;">Total</th>
                    <th style="width: 40px;"></th>
                  </tr>
                </thead>
                <tbody id="inv-custom-items-tbody">
                  ${renderItemRows(initialItems)}
                </tbody>
              </table>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center;">
              <button type="button" id="add-inv-custom-item-btn" class="btn btn-sm btn-outline">
                ➕ Agregar Nuevo Concepto
              </button>
              <div style="font-size: 14px; font-weight: 600; color: var(--text-primary);">
                Total Factura: <span id="custom-inv-total-span" style="color: var(--primary-700); font-size: 16px; font-weight: 700;">${formatCurrency(totalPaid)}</span>
              </div>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Notas Adicionales / Referencia</label>
            <input type="text" name="notes" class="form-input" placeholder="Ej: Factura correspondiente a recibo ${rec.invoice_number}" value="Factura oficial vinculada al Recibo #${rec.invoice_number}" />
          </div>
        </form>
      `,
      confirmText: '📄 Emitir Factura Oficial',
      cancelText: 'Cancelar',
      onConfirm: async () => {
        const form = document.getElementById('create-invoice-from-receipt-form');
        if (!form) return false;

        const formData = new FormData(form);
        const invoiceDate = formData.get('invoice_date');
        const notes = formData.get('notes');

        const items = [];
        document.querySelectorAll('#inv-custom-items-tbody .inv-item-row').forEach(row => {
          const desc = row.querySelector('.inv-item-desc')?.value?.trim();
          const qty = parseInt(row.querySelector('.inv-item-qty')?.value || 1, 10);
          const price = parseFloat(row.querySelector('.inv-item-price')?.value || 0);
          if (desc && price >= 0) {
            items.push({
              description: desc,
              quantity: qty,
              unit_price: price,
              total: qty * price
            });
          }
        });

        if (items.length === 0) {
          toast.error('Debe incluir al menos un concepto en la factura.');
          return false;
        }

        try {
          const created = await invoiceService.createFromReceipt(receiptId, {
            items,
            notes,
            invoice_date: invoiceDate
          });
          const invObj = created?.data || created;
          toast.success(`¡Factura oficial #${invObj.invoice_number} creada exitosamente!`);

          const { Invoices } = await import('../invoices/invoices.js');
          const invoicesPage = new Invoices(this.container);
          await invoicesPage.printInvoice(invObj.id);

          await this.render();
          this.mount();
          return true;
        } catch (err) {
          toast.error(err.message || 'Error al emitir la factura');
          return false;
        }
      }
    });

    const overlay = document.querySelector('.modal-overlay');
    if (!overlay) return;

    const updateTotals = () => {
      let grandTotal = 0;
      overlay.querySelectorAll('#inv-custom-items-tbody .inv-item-row').forEach(row => {
        const qty = parseFloat(row.querySelector('.inv-item-qty')?.value || 0);
        const price = parseFloat(row.querySelector('.inv-item-price')?.value || 0);
        const total = qty * price;
        const totalSpan = row.querySelector('.inv-item-total-span');
        if (totalSpan) totalSpan.textContent = formatCurrency(total);
        grandTotal += total;
      });
      const grandTotalSpan = overlay.querySelector('#custom-inv-total-span');
      if (grandTotalSpan) grandTotalSpan.textContent = formatCurrency(grandTotal);
    };

    overlay.addEventListener('input', (e) => {
      if (e.target.matches('.inv-item-qty, .inv-item-price')) {
        updateTotals();
      }
    });

    overlay.addEventListener('click', (e) => {
      const addBtn = e.target.closest('#add-inv-custom-item-btn');
      if (addBtn) {
        const tbody = overlay.querySelector('#inv-custom-items-tbody');
        if (tbody) {
          const newIdx = tbody.children.length;
          const newRow = document.createElement('tr');
          newRow.className = 'inv-item-row';
          newRow.setAttribute('data-index', newIdx);
          newRow.innerHTML = `
            <td style="padding: 6px 8px;">
              <input type="text" class="form-input inv-item-desc" placeholder="Descripción del concepto" style="font-size: 13px; width: 100%;" required />
            </td>
            <td style="padding: 6px 8px; width: 70px; text-align: center;">
              <input type="number" min="1" step="1" class="form-input inv-item-qty" value="1" style="font-size: 13px; text-align: center;" required />
            </td>
            <td style="padding: 6px 8px; width: 120px; text-align: right;">
              <input type="number" min="0" step="0.01" class="form-input inv-item-price" value="0.00" style="font-size: 13px; text-align: right;" required />
            </td>
            <td style="padding: 6px 8px; width: 120px; text-align: right; font-weight: 600;">
              <span class="inv-item-total-span">€0.00</span>
            </td>
            <td style="padding: 6px 8px; width: 40px; text-align: center;">
              <button type="button" class="btn btn-sm btn-ghost remove-inv-item-btn" style="color: var(--danger-600); padding: 2px 6px;">✕</button>
            </td>
          `;
          tbody.appendChild(newRow);
        }
        return;
      }

      const removeBtn = e.target.closest('.remove-inv-item-btn');
      if (removeBtn) {
        const row = removeBtn.closest('.inv-item-row');
        if (row) {
          row.remove();
          updateTotals();
        }
      }
    });
  }

  async confirmDeleteReceipt(id) {
    if (!confirm('¿Está seguro de anular este recibo de pago? Esto revertirá los tratamientos pagados a su estado pendiente y liberará el número de comprobante.')) {
      return;
    }

    try {
      const payments = await paymentService.getByInvoice(id);
      if (payments && payments.length > 0) {
        for (const pay of payments) {
          await paymentService.remove(pay.id);
        }
      } else {
        await invoiceService.remove(id);
      }

      toast.success('Recibo de pago anulado correctamente');
      await this.render();
      this.mount();
    } catch (err) {
      toast.error(err.message || 'Error al anular recibo');
    }
  }
}
