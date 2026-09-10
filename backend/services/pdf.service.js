// ============================================
// Servicio de Generación de PDFs Clínicos
// ============================================
import PDFDocument from 'pdfkit-table';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import invoiceRepository from '../repositories/invoice.repository.js';
import quotationRepository from '../repositories/quotation.repository.js';
import prescriptionRepository from '../repositories/prescription.repository.js';
import settingsRepository from '../repositories/settings.repository.js';
import { query, als } from '../database/pool.js';
import { AppError } from '../utils/errors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paleta de diseño clínico profesional
const COLORS = {
  primary: '#0f86ec',
  primaryDark: '#0b6cc4',
  text: '#1e293b',
  textSecondary: '#64748b',
  textMuted: '#94a3b8',
  border: '#cbd5e1',
  bgLight: '#f8fafc',
  bgCard: '#f1f5f9',
  success: '#16a34a',
  warning: '#f59e0b',
  danger: '#dc2626',
  white: '#ffffff',
};

class PDFService {
  /**
   * Obtiene la información de la clínica para encabezados de documentos.
   */
  async getClinicInfo(clinicId) {
    try {
      const info = await settingsRepository.getClinicInfo(clinicId);
      if (info) return info;

      if (clinicId) {
        const cRes = await query('SELECT * FROM clinics WHERE id = $1', [clinicId]);
        if (cRes.rows.length > 0) {
          const c = cRes.rows[0];
          return {
            name: c.name,
            legal_name: c.name,
            address: c.address,
            phone: c.phone,
            email: c.email,
            currency: 'EUR',
            tax_rate: 0,
          };
        }
      }
    } catch {
      // Fallback si la tabla no está disponible
    }

    return {
      name: 'Vides Dental',
      legal_name: 'Vides Dental S.L.',
      tax_id: 'B-12345678',
      address: 'Av. Reforma 1234, Col. Centro',
      city: 'Valencia',
      country: 'España',
      postal_code: '46001',
      phone: '+34 960 000 000',
      email: 'contacto@videsdental.com',
      website: 'www.videsdental.com',
      currency: 'EUR',
      tax_rate: 0,
    };
  }

  /**
   * Formatea valores monetarios según la divisa de la clínica.
   */
  formatCurrency(value, currency = 'EUR') {
    const num = parseFloat(value || 0);
    const formatted = num.toLocaleString('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    if (currency === 'MXN') return `$${formatted} MXN`;
    if (currency === 'USD') return `$${formatted} USD`;
    return `${formatted} €`;
  }

  /**
   * Formatea fechas a formato legible (DD/MM/YYYY).
   */
  formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return String(dateStr);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return String(dateStr);
    }
  }

  /**
   * Convierte un flujo de PDFKit en un Buffer en memoria.
   */
  async streamToBuffer(doc) {
    return new Promise((resolve, reject) => {
      const buffers = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));
    });
  }

  /**
   * Resuelve la ruta física del logotipo de la clínica en el sistema de archivos.
   * Soporta logotipos personalizados por clínica o el logotipo institucional oficial.
   */
  resolveClinicLogoPath(clinic = {}) {
    const candidates = [];

    // 1. Si la clínica tiene logo personalizado configurado en la base de datos
    if (clinic.logo_url) {
      const clean = String(clinic.logo_url).replace(/^\/?uploads\//, '');
      candidates.push(
        path.resolve(__dirname, '../uploads', clean),
        path.resolve(__dirname, '../../uploads', clean),
        path.resolve(clinic.logo_url)
      );
    }

    // 2. Logotipo institucional oficial de la clínica (en backend/assets o frontend/assets)
    candidates.push(
      path.resolve(__dirname, '../assets/videsDentalLogo.jpg'),
      path.resolve(__dirname, '../../backend/assets/videsDentalLogo.jpg'),
      path.resolve(__dirname, '../../frontend/assets/videsDentalLogo.jpg'),
      path.resolve(__dirname, '../uploads/logo.png'),
      path.resolve(__dirname, '../../uploads/logo.png')
    );

    for (const p of candidates) {
      if (p && typeof p === 'string' && fs.existsSync(p)) {
        return p;
      }
    }
    return null;
  }

  /**
   * Dibuja la barra de acento superior y el encabezado de la clínica con logo.
   */
  drawHeader(doc, clinic, docTitle, docNumber, badgeText = null, badgeColor = COLORS.primary) {
    const pageWidth = doc.page.width;
    const margin = 40;

    // Barra superior decorativa con color corporativo
    doc.rect(0, 0, pageWidth, 6).fill(COLORS.primary);

    // Intentar ubicar y dibujar el logo de la clínica
    const logoPath = this.resolveClinicLogoPath(clinic);
    let logoLoaded = false;
    if (logoPath) {
      try {
        doc.image(logoPath, margin, 18, { fit: [100, 48] });
        logoLoaded = true;
      } catch {
        // Fallback transparente si la imagen no se puede decodificar
      }
    }

    // Bloque derecho: Título del documento y Número
    const rightColX = pageWidth - margin - 200;
    const clinicX = logoLoaded ? margin + 110 : margin;
    const clinicWidth = rightColX - clinicX - 15;

    // Datos de la clínica
    doc
      .fillColor(COLORS.primary)
      .font('Helvetica-Bold')
      .fontSize(13)
      .text(clinic.name || 'Clínica Dental', clinicX, 20, { width: clinicWidth });

    doc
      .fillColor(COLORS.textSecondary)
      .font('Helvetica')
      .fontSize(8)
      .text(clinic.legal_name ? `${clinic.legal_name}${clinic.tax_id ? ' · CIF: ' + clinic.tax_id : ''}` : (clinic.tax_id ? `CIF/NIF: ${clinic.tax_id}` : ''), clinicX, 36, { width: clinicWidth })
      .text(`${clinic.address || ''}${clinic.city ? ', ' + clinic.city : ''}${clinic.postal_code ? ' (' + clinic.postal_code + ')' : ''}`, clinicX, 47, { width: clinicWidth })
      .text(`${clinic.phone ? 'Tel: ' + clinic.phone : ''}${clinic.email ? ' · ' + clinic.email : ''}`, clinicX, 58, { width: clinicWidth });

    doc
      .fillColor(COLORS.text)
      .font('Helvetica-Bold')
      .fontSize(14)
      .text(docTitle.toUpperCase(), rightColX, 20, { width: 200, align: 'right' });

    doc
      .fillColor(COLORS.primaryDark)
      .font('Helvetica-Bold')
      .fontSize(12)
      .text(docNumber, rightColX, 37, { width: 200, align: 'right' });

    if (badgeText) {
      const badgeWidth = 90;
      const badgeX = pageWidth - margin - badgeWidth;
      const badgeY = 54;
      doc
        .roundedRect(badgeX, badgeY, badgeWidth, 16, 3)
        .fill(badgeColor);
      doc
        .fillColor(COLORS.white)
        .font('Helvetica-Bold')
        .fontSize(8)
        .text(badgeText.toUpperCase(), badgeX, badgeY + 4, { width: badgeWidth, align: 'center' });
    }

    // Línea separadora elegante
    doc
      .strokeColor(COLORS.border)
      .lineWidth(0.75)
      .moveTo(margin, 82)
      .lineTo(pageWidth - margin, 82)
      .stroke();

    doc.y = 92;
  }

  /**
   * Dibuja los recuadros de datos de Paciente y Profesional/Documento.
   */
  drawPartyBoxes(doc, { patient, doctor, docDate, dueDate = null, extraLabels = [] }) {
    const margin = 40;
    const boxWidth = (doc.page.width - margin * 2 - 15) / 2;
    const boxHeight = 72;
    const yPos = doc.y;

    // Caja Paciente (Izquierda)
    doc
      .roundedRect(margin, yPos, boxWidth, boxHeight, 4)
      .fillAndStroke(COLORS.bgLight, COLORS.border);

    doc
      .fillColor(COLORS.primary)
      .font('Helvetica-Bold')
      .fontSize(8.5)
      .text('DATOS DEL PACIENTE', margin + 10, yPos + 8, { width: boxWidth - 20 });

    doc
      .fillColor(COLORS.text)
      .font('Helvetica-Bold')
      .fontSize(9.5)
      .text(patient.name || 'Paciente No Especificado', margin + 10, yPos + 22, { width: boxWidth - 20 });

    doc
      .fillColor(COLORS.textSecondary)
      .font('Helvetica')
      .fontSize(8)
      .text(`DNI / NIF: ${patient.dni || '—'}`, margin + 10, yPos + 35)
      .text(`Tel: ${patient.phone || '—'}  |  Email: ${patient.email || '—'}`, margin + 10, yPos + 46, { width: boxWidth - 20 })
      .text(patient.address ? `Dir: ${patient.address}` : '', margin + 10, yPos + 57, { width: boxWidth - 20 });

    // Caja Profesional / Documento (Derecha)
    const rightX = margin + boxWidth + 15;
    doc
      .roundedRect(rightX, yPos, boxWidth, boxHeight, 4)
      .fillAndStroke(COLORS.bgLight, COLORS.border);

    doc
      .fillColor(COLORS.primary)
      .font('Helvetica-Bold')
      .fontSize(8.5)
      .text('DATOS DE ATENCIÓN Y EMISIÓN', rightX + 10, yPos + 8, { width: boxWidth - 20 });

    doc
      .fillColor(COLORS.text)
      .font('Helvetica-Bold')
      .fontSize(9)
      .text(doctor.name ? `Dr/a. ${doctor.name}` : 'Clínica Dental Especializada', rightX + 10, yPos + 22, { width: boxWidth - 20 });

    const docSub = doctor.specialty ? `${doctor.specialty}${doctor.license ? ' (Col. ' + doctor.license + ')' : ''}` : 'Odontología Integral';
    doc
      .fillColor(COLORS.textSecondary)
      .font('Helvetica')
      .fontSize(8)
      .text(docSub, rightX + 10, yPos + 35, { width: boxWidth - 20 })
      .text(`Fecha de Emisión: ${this.formatDate(docDate)}`, rightX + 10, yPos + 46);

    if (dueDate) {
      doc.text(`Fecha de Vto: ${this.formatDate(dueDate)}`, rightX + 10, yPos + 57);
    } else if (extraLabels.length > 0) {
      doc.text(extraLabels[0], rightX + 10, yPos + 57);
    }

    doc.y = yPos + boxHeight + 14;
  }

  /**
   * Dibuja los números de página y el pie legal en todas las páginas bufferizadas.
   */
  drawFooterAndPages(doc, clinic, legalNotice = null) {
    const range = doc.bufferedPageRange();
    const margin = 40;
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const footerY = pageHeight - 35;

    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);

      // Línea divisoria de pie
      doc
        .strokeColor(COLORS.border)
        .lineWidth(0.5)
        .moveTo(margin, footerY - 8)
        .lineTo(pageWidth - margin, footerY - 8)
        .stroke();

      const defaultNotice = legalNotice || `${clinic.name || 'Clínica Dental'} · Documento oficial emitido conforme a la legislación sanitaria y fiscal vigente.`;
      doc
        .fillColor(COLORS.textMuted)
        .font('Helvetica')
        .fontSize(7)
        .text(defaultNotice, margin, footerY, { width: pageWidth - margin * 2 - 70 });

      doc
        .fillColor(COLORS.textSecondary)
        .font('Helvetica-Bold')
        .fontSize(7.5)
        .text(`Página ${i + 1} de ${range.count}`, pageWidth - margin - 70, footerY, { width: 70, align: 'right' });
    }
  }

  /**
   * Genera el PDF de una Factura Oficial (FAC-xxxx) o Recibo (REC-xxxx).
   */
  async generateInvoicePDF(invoiceId) {
    const invoice = await invoiceRepository.findByIdWithItems(invoiceId);
    if (!invoice) {
      throw new AppError('Factura no encontrada.', 404);
    }

    // Control multi-tenant estricto
    const store = als.getStore();
    if (store?.clinicId && invoice.clinic_id && Number(store.clinicId) !== Number(invoice.clinic_id)) {
      throw new AppError('Acceso denegado: el documento no pertenece a la clínica activa.', 403);
    }

    const clinic = await this.getClinicInfo(invoice.clinic_id);
    const isFactura = invoice.document_type === 'factura' || (!invoice.document_type && invoice.invoice_number?.startsWith('FAC'));
    const docTitle = isFactura ? 'Factura Oficial' : 'Recibo de Pago';

    // Determinar badge de estado
    const status = (invoice.status || 'pendiente').toLowerCase();
    let badgeText = 'Pendiente';
    let badgeColor = COLORS.warning;
    if (status === 'pagada') {
      badgeText = 'Pagada';
      badgeColor = COLORS.success;
    } else if (status === 'parcial') {
      badgeText = 'Abono Parcial';
      badgeColor = COLORS.primary;
    } else if (status === 'cancelada') {
      badgeText = 'Cancelada';
      badgeColor = COLORS.danger;
    }

    const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
    const bufferPromise = this.streamToBuffer(doc);

    // 1. Encabezado
    this.drawHeader(doc, clinic, docTitle, `# ${invoice.invoice_number}`, badgeText, badgeColor);

    // 2. Datos de Paciente y Médico
    this.drawPartyBoxes(doc, {
      patient: {
        name: invoice.patient_name || `${invoice.patient_first_name || ''} ${invoice.patient_last_name || ''}`.trim(),
        dni: invoice.patient_dni,
        phone: invoice.patient_phone,
        email: invoice.patient_email,
        address: invoice.patient_address,
      },
      doctor: {
        name: invoice.doctor_name || `${invoice.doctor_first_name || ''} ${invoice.doctor_last_name || ''}`.trim(),
        specialty: invoice.doctor_specialty,
        license: invoice.doctor_license,
      },
      docDate: invoice.created_at,
      dueDate: invoice.due_date,
      extraLabels: invoice.receipt_number ? [`Recibo Vinculado: #${invoice.receipt_number}`] : [],
    });

    // 3. Tabla de Conceptos / Tratamientos
    const items = invoice.items || [];
    const tableData = {
      headers: [
        { label: 'Concepto / Tratamiento', property: 'desc', width: 235 },
        { label: 'Pieza', property: 'tooth', width: 50, align: 'center' },
        { label: 'Cant.', property: 'qty', width: 45, align: 'center' },
        { label: 'Precio Unit.', property: 'unitPrice', width: 85, align: 'right' },
        { label: 'Total', property: 'subtotal', width: 100, align: 'right' },
      ],
      datas: items.map((item) => ({
        desc: item.clean_description || item.description || item.treatment_name || 'Tratamiento Odontológico',
        tooth: item.tooth_number ? String(item.tooth_number) : '—',
        qty: String(item.quantity || 1),
        unitPrice: this.formatCurrency(item.unit_price, clinic.currency),
        subtotal: this.formatCurrency(item.subtotal || item.total, clinic.currency),
      })),
    };

    if (tableData.datas.length === 0) {
      tableData.datas.push({
        desc: 'Servicios de Odontología General',
        tooth: '—',
        qty: '1',
        unitPrice: this.formatCurrency(invoice.total, clinic.currency),
        subtotal: this.formatCurrency(invoice.total, clinic.currency),
      });
    }

    await doc.table(tableData, {
      prepareHeader: () => doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COLORS.white),
      prepareRow: (row, indexColumn, indexRow, rectRow) => {
        doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.text);
      },
      padding: [5, 4],
      headerBackgroundColor: COLORS.primary,
    });

    // 4. Resumen de Totales y Liquidación
    const margin = 40;
    const pageWidth = doc.page.width;
    const summaryWidth = 220;
    const summaryX = pageWidth - margin - summaryWidth;
    let currY = doc.y + 10;

    // Verificar si hay espacio en la página o agregar nueva
    if (currY > 640) {
      doc.addPage();
      currY = 40;
    }

    doc
      .roundedRect(summaryX, currY, summaryWidth, 108, 4)
      .fillAndStroke(COLORS.bgCard, COLORS.border);

    const subtotal = parseFloat(invoice.subtotal || 0);
    const discount = parseFloat(invoice.discount_amount || 0);
    const taxRate = parseFloat(invoice.tax_rate || 0);
    const taxAmount = parseFloat(invoice.tax_amount || 0);
    const total = parseFloat(invoice.total || 0);
    const amountPaid = parseFloat(invoice.amount_paid || 0);
    const balance = Math.max(0, parseFloat((total - amountPaid).toFixed(2)));

    let rowY = currY + 8;
    const printLine = (label, val, bold = false, color = COLORS.text, fontSize = 8.5) => {
      doc
        .fillColor(color)
        .font(bold ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(fontSize)
        .text(label, summaryX + 12, rowY, { width: 110 })
        .text(val, summaryX + 120, rowY, { width: 88, align: 'right' });
      rowY += 13;
    };

    printLine('Subtotal Bruto:', this.formatCurrency(subtotal, clinic.currency));
    if (discount > 0) {
      printLine('Descuento:', `-${this.formatCurrency(discount, clinic.currency)}`, false, COLORS.danger);
    }
    if (taxRate > 0) {
      printLine(`IVA (${taxRate}%):`, this.formatCurrency(taxAmount, clinic.currency));
    }
    rowY += 2;
    doc.strokeColor(COLORS.border).lineWidth(0.5).moveTo(summaryX + 10, rowY).lineTo(summaryX + summaryWidth - 10, rowY).stroke();
    rowY += 4;
    printLine('TOTAL FACTURA:', this.formatCurrency(total, clinic.currency), true, COLORS.primaryDark, 10);
    printLine('Importe Abonado:', this.formatCurrency(amountPaid, clinic.currency), false, COLORS.success);
    printLine('Saldo Pendiente:', this.formatCurrency(balance, clinic.currency), true, balance > 0 ? COLORS.danger : COLORS.textSecondary);

    // 5. Historial de Pagos si existen
    const payments = invoice.payments || [];
    if (payments.length > 0) {
      doc.y = Math.max(currY + 118, doc.y + 10);
      if (doc.y > 680) doc.addPage();

      doc
        .fillColor(COLORS.primary)
        .font('Helvetica-Bold')
        .fontSize(9)
        .text('DESGLOSE DE PAGOS Y COBROS REGISTRADOS', margin, doc.y);
      doc.y += 4;

      const paymentsTable = {
        headers: [
          { label: 'Fecha de Cobro', property: 'date', width: 115 },
          { label: 'Método de Pago', property: 'method', width: 140 },
          { label: 'Referencia / Notas', property: 'ref', width: 160 },
          { label: 'Importe', property: 'amount', width: 100, align: 'right' },
        ],
        datas: payments.map((p) => ({
          date: this.formatDate(p.payment_date || p.created_at),
          method: p.payment_method_label || p.payment_method_name || 'Efectivo',
          ref: p.reference_number || p.notes || 'Pago recibido en clínica',
          amount: this.formatCurrency(p.amount, clinic.currency),
        })),
      };

      await doc.table(paymentsTable, {
        prepareHeader: () => doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.text),
        prepareRow: () => doc.font('Helvetica').fontSize(8).fillColor(COLORS.text),
        padding: [3, 4],
        headerBackgroundColor: COLORS.bgCard,
      });
    }

    // 6. Observaciones y Cláusula Fiscal
    if (invoice.notes) {
      if (doc.y > 700) doc.addPage();
      doc
        .fillColor(COLORS.textSecondary)
        .font('Helvetica-Bold')
        .fontSize(8)
        .text('Observaciones:', margin, doc.y + 6)
        .font('Helvetica')
        .text(invoice.notes, margin, doc.y + 1, { width: 350 });
    }

    // 7. Pie de página y numeración
    const fiscalText = `Régimen Fiscal: Servicios odontológicos y prótesis dentales exentos de IVA conforme al Art. 20.Uno.3º y 5º de la Ley 37/1992 del IVA (España) o normativa aplicable.`;
    this.drawFooterAndPages(doc, clinic, fiscalText);

    doc.end();
    const buffer = await bufferPromise;

    const safeNumber = (invoice.invoice_number || `DOC-${invoice.id}`).replace(/[^a-zA-Z0-9-_]/g, '_');
    const filename = `${isFactura ? 'Factura' : 'Recibo'}_${safeNumber}.pdf`;

    return { buffer, filename, documentNumber: invoice.invoice_number };
  }

  /**
   * Genera el PDF de un Recibo de Pago (REC-xxxx).
   */
  async generateReceiptPDF(receiptId) {
    return this.generateInvoicePDF(receiptId);
  }

  /**
   * Genera el PDF de un Presupuesto Odontológico / Cotización (COT-xxxx).
   */
  async generateQuotationPDF(quotationId) {
    const quote = await quotationRepository.findByIdWithItems(quotationId);
    if (!quote) {
      throw new AppError('Presupuesto no encontrado.', 404);
    }

    // Control multi-tenant estricto
    const store = als.getStore();
    if (store?.clinicId && quote.clinic_id && Number(store.clinicId) !== Number(quote.clinic_id)) {
      throw new AppError('Acceso denegado: el presupuesto no pertenece a la clínica activa.', 403);
    }

    const clinic = await this.getClinicInfo(quote.clinic_id);

    // Estado del presupuesto
    const status = (quote.status || 'pendiente').toLowerCase();
    let badgeText = 'Pendiente';
    let badgeColor = COLORS.warning;
    if (status === 'aceptada' || status === 'aceptado') {
      badgeText = 'Aceptado';
      badgeColor = COLORS.success;
    } else if (status === 'parcial') {
      badgeText = 'Aceptación Parcial';
      badgeColor = COLORS.primary;
    } else if (status === 'rechazada' || status === 'rechazado') {
      badgeText = 'Rechazado';
      badgeColor = COLORS.danger;
    }

    const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
    const bufferPromise = this.streamToBuffer(doc);

    // 1. Encabezado
    this.drawHeader(doc, clinic, 'Presupuesto Odontológico', `# ${quote.quote_number}`, badgeText, badgeColor);

    // 2. Paciente y Odontólogo
    this.drawPartyBoxes(doc, {
      patient: {
        name: quote.patient_name || 'Paciente',
        dni: quote.patient_dni,
        phone: quote.patient_phone,
        email: quote.patient_email,
        address: quote.patient_address,
      },
      doctor: {
        name: quote.doctor_name,
        specialty: quote.doctor_specialty || 'Odontología Integral',
        license: quote.doctor_license,
      },
      docDate: quote.quotation_date || quote.created_at,
      extraLabels: ['Validez de la oferta: 30 días'],
    });

    // 3. Tabla de Tratamientos Presupuestados
    const items = quote.items || [];
    const tableData = {
      headers: [
        { label: 'Pieza', property: 'tooth', width: 45, align: 'center' },
        { label: 'Tratamiento / Procedimiento Planificado', property: 'desc', width: 235 },
        { label: 'Cant.', property: 'qty', width: 40, align: 'center' },
        { label: 'Precio Base', property: 'price', width: 85, align: 'right' },
        { label: 'Dto.', property: 'discount', width: 45, align: 'center' },
        { label: 'Total', property: 'total', width: 65, align: 'right' },
      ],
      datas: items.map((item) => {
        const itemDisc = parseFloat(item.discount || 0);
        const discStr = itemDisc > 0 ? `${itemDisc}%` : '—';
        return {
          tooth: item.tooth_number ? String(item.tooth_number) : '—',
          desc: item.description || item.treatment_name || 'Tratamiento Odontológico',
          qty: String(item.quantity || 1),
          price: this.formatCurrency(item.unit_price, clinic.currency),
          discount: discStr,
          total: this.formatCurrency(item.total, clinic.currency),
        };
      }),
    };

    if (tableData.datas.length === 0) {
      tableData.datas.push({
        tooth: '—',
        desc: 'Plan de Tratamiento Integral',
        qty: '1',
        price: this.formatCurrency(quote.total, clinic.currency),
        discount: '—',
        total: this.formatCurrency(quote.total, clinic.currency),
      });
    }

    await doc.table(tableData, {
      prepareHeader: () => doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COLORS.white),
      prepareRow: () => doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.text),
      padding: [5, 4],
      headerBackgroundColor: COLORS.primary,
    });

    // 4. Totales y resumen
    const margin = 40;
    const pageWidth = doc.page.width;
    const summaryWidth = 220;
    const summaryX = pageWidth - margin - summaryWidth;
    let currY = doc.y + 10;

    if (currY > 640) {
      doc.addPage();
      currY = 40;
    }

    doc
      .roundedRect(summaryX, currY, summaryWidth, 90, 4)
      .fillAndStroke(COLORS.bgCard, COLORS.border);

    const subtotal = parseFloat(quote.subtotal || 0);
    const discount = parseFloat(quote.discount_amount || 0);
    const total = parseFloat(quote.total || 0);
    const amountPaid = parseFloat(quote.amount_paid || 0);
    const remaining = Math.max(0, parseFloat((total - amountPaid).toFixed(2)));

    let rowY = currY + 8;
    const printLine = (label, val, bold = false, color = COLORS.text, fontSize = 8.5) => {
      doc
        .fillColor(color)
        .font(bold ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(fontSize)
        .text(label, summaryX + 12, rowY, { width: 110 })
        .text(val, summaryX + 120, rowY, { width: 88, align: 'right' });
      rowY += 13;
    };

    printLine('Subtotal Presupuesto:', this.formatCurrency(subtotal, clinic.currency));
    if (discount > 0) {
      printLine('Descuento Total:', `-${this.formatCurrency(discount, clinic.currency)}`, false, COLORS.danger);
    }
    rowY += 2;
    doc.strokeColor(COLORS.border).lineWidth(0.5).moveTo(summaryX + 10, rowY).lineTo(summaryX + summaryWidth - 10, rowY).stroke();
    rowY += 4;
    printLine('TOTAL PROPUESTA:', this.formatCurrency(total, clinic.currency), true, COLORS.primaryDark, 10);
    if (amountPaid > 0) {
      printLine('Importe Abonado:', this.formatCurrency(amountPaid, clinic.currency), false, COLORS.success);
      printLine('Saldo Restante:', this.formatCurrency(remaining, clinic.currency), true, COLORS.danger);
    }

    // 5. Términos Clínicos y Recuadros de Firma
    let signY = Math.max(currY + 100, doc.y + 15);
    if (signY > 680) {
      doc.addPage();
      signY = 40;
    }

    // Términos
    doc
      .fillColor(COLORS.textSecondary)
      .font('Helvetica-Bold')
      .fontSize(7.5)
      .text('Condiciones del Presupuesto:', margin, signY)
      .font('Helvetica')
      .fontSize(7)
      .text(
        '1. La presente propuesta económica tiene una validez de 30 días naturales desde su emisión.\n' +
        '2. El plan de tratamiento puede experimentar adecuaciones clínicas justificadas según la respuesta biológica del paciente.\n' +
        '3. La firma del presente documento acredita la conformidad del paciente con las alternativas terapéuticas explicadas.',
        margin,
        signY + 11,
        { width: 330 }
      );

    // Firmas
    const signBoxWidth = 140;
    const signLeftX = margin + 180;
    const signRightX = pageWidth - margin - signBoxWidth;
    const signBoxY = signY + 50;

    doc
      .strokeColor(COLORS.border)
      .lineWidth(0.75)
      .moveTo(signLeftX, signBoxY)
      .lineTo(signLeftX + signBoxWidth, signBoxY)
      .stroke();
    doc
      .fillColor(COLORS.textSecondary)
      .font('Helvetica')
      .fontSize(7.5)
      .text('Conforme Paciente (Firma)', signLeftX, signBoxY + 4, { width: signBoxWidth, align: 'center' });

    doc
      .strokeColor(COLORS.border)
      .lineWidth(0.75)
      .moveTo(signRightX, signBoxY)
      .lineTo(signRightX + signBoxWidth, signBoxY)
      .stroke();
    doc
      .fillColor(COLORS.textSecondary)
      .font('Helvetica')
      .fontSize(7.5)
      .text('Odontólogo Responsable', signRightX, signBoxY + 4, { width: signBoxWidth, align: 'center' });

    // 6. Pie de página
    this.drawFooterAndPages(doc, clinic, `${clinic.name || 'Clínica Dental'} · Presupuesto clínico informativo sin valor de factura oficial.`);

    doc.end();
    const buffer = await bufferPromise;

    const safeNumber = (quote.quote_number || `COT-${quote.id}`).replace(/[^a-zA-Z0-9-_]/g, '_');
    const filename = `Presupuesto_${safeNumber}.pdf`;

    return { buffer, filename, documentNumber: quote.quote_number };
  }

  /**
   * Genera el PDF de una Prescripción Médica / Receta (PRC-xxxx).
   */
  async generatePrescriptionPDF(prescriptionId) {
    const presc = await prescriptionRepository.findByIdWithItems(prescriptionId);
    if (!presc) {
      throw new AppError('Prescripción médica no encontrada.', 404);
    }

    // Control multi-tenant estricto
    const store = als.getStore();
    if (store?.clinicId && presc.clinic_id && Number(store.clinicId) !== Number(presc.clinic_id)) {
      throw new AppError('Acceso denegado: la prescripción no pertenece a la clínica activa.', 403);
    }

    const clinic = await this.getClinicInfo(presc.clinic_id);

    const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
    const bufferPromise = this.streamToBuffer(doc);

    // 1. Encabezado
    this.drawHeader(
      doc,
      clinic,
      'Receta Médica Oficial',
      `# ${presc.prescription_number}`,
      'Prescripción',
      COLORS.primary
    );

    // 2. Cajas de Médico y Paciente con Alerta de Alergias
    const margin = 40;
    const pageWidth = doc.page.width;
    const boxWidth = (pageWidth - margin * 2 - 15) / 2;
    const boxHeight = 78;
    const yPos = doc.y;

    // Caja Doctor (Izquierda)
    doc
      .roundedRect(margin, yPos, boxWidth, boxHeight, 4)
      .fillAndStroke(COLORS.bgLight, COLORS.border);

    doc
      .fillColor(COLORS.primary)
      .font('Helvetica-Bold')
      .fontSize(8.5)
      .text('FACULTATIVO PRESCRIPTOR', margin + 10, yPos + 8, { width: boxWidth - 20 });

    doc
      .fillColor(COLORS.text)
      .font('Helvetica-Bold')
      .fontSize(9.5)
      .text(presc.doctor_name ? `Dr/a. ${presc.doctor_name}` : 'Odontólogo Colegiado', margin + 10, yPos + 22, { width: boxWidth - 20 });

    doc
      .fillColor(COLORS.textSecondary)
      .font('Helvetica')
      .fontSize(8)
      .text(`Especialidad: ${presc.doctor_specialty || 'Odontología General'}`, margin + 10, yPos + 36)
      .text(`No. de Colegiado: ${presc.doctor_license || 'Registro Oficial Clínico'}`, margin + 10, yPos + 48)
      .text(`Clínica: ${clinic.name || 'Vides Dental'}`, margin + 10, yPos + 60);

    // Caja Paciente y Alergias (Derecha)
    const rightX = margin + boxWidth + 15;
    doc
      .roundedRect(rightX, yPos, boxWidth, boxHeight, 4)
      .fillAndStroke(COLORS.bgLight, COLORS.border);

    doc
      .fillColor(COLORS.primary)
      .font('Helvetica-Bold')
      .fontSize(8.5)
      .text('DATOS DEL PACIENTE', rightX + 10, yPos + 8, { width: boxWidth - 20 });

    doc
      .fillColor(COLORS.text)
      .font('Helvetica-Bold')
      .fontSize(9.5)
      .text(presc.patient_name || 'Paciente', rightX + 10, yPos + 22, { width: boxWidth - 20 });

    doc
      .fillColor(COLORS.textSecondary)
      .font('Helvetica')
      .fontSize(8)
      .text(`DNI / Identificación: ${presc.patient_dni || '—'}`, rightX + 10, yPos + 36)
      .text(`Fecha Emisión: ${this.formatDate(presc.issued_date)}  |  Válida: ${this.formatDate(presc.valid_until)}`, rightX + 10, yPos + 48);

    // Alerta médica de alergias si existen
    const allergies = (presc.patient_allergies || '').trim();
    if (allergies) {
      doc
        .fillColor(COLORS.danger)
        .font('Helvetica-Bold')
        .fontSize(7.5)
        .text(`⚠️ ALERGIAS: ${allergies.toUpperCase()}`, rightX + 10, yPos + 62, { width: boxWidth - 20 });
    } else {
      doc
        .fillColor(COLORS.success)
        .font('Helvetica')
        .fontSize(7.5)
        .text(`✓ Sin alergias conocidas registradas`, rightX + 10, yPos + 62);
    }

    doc.y = yPos + boxHeight + 14;

    // 3. Tabla de Medicamentos Prescritos
    const items = presc.items || [];
    const tableData = {
      headers: [
        { label: '#', property: 'index', width: 25, align: 'center' },
        { label: 'Medicamento / Principio Activo', property: 'med', width: 145 },
        { label: 'Dosis', property: 'dosage', width: 65 },
        { label: 'Frecuencia', property: 'freq', width: 75 },
        { label: 'Duración', property: 'duration', width: 60 },
        { label: 'Posología e Instrucciones', property: 'instructions', width: 145 },
      ],
      datas: items.map((item, idx) => ({
        index: String(idx + 1),
        med: item.medication_name || 'Medicamento',
        dosage: item.dosage || '—',
        freq: item.frequency || '—',
        duration: item.duration || '—',
        instructions: item.instructions || 'Según indicación del facultativo',
      })),
    };

    if (tableData.datas.length === 0) {
      tableData.datas.push({
        index: '1',
        med: 'Sin medicamentos especificados',
        dosage: '—',
        freq: '—',
        duration: '—',
        instructions: 'Consulte con el odontólogo',
      });
    }

    await doc.table(tableData, {
      prepareHeader: () => doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.white),
      prepareRow: () => doc.font('Helvetica').fontSize(8).fillColor(COLORS.text),
      padding: [5, 4],
      headerBackgroundColor: COLORS.primary,
    });

    // 4. Indicaciones Generales / Recomendaciones Clínicas
    if (presc.notes) {
      doc.y += 10;
      if (doc.y > 660) doc.addPage();

      const notesBoxY = doc.y;
      doc
        .roundedRect(margin, notesBoxY, pageWidth - margin * 2, 50, 4)
        .fillAndStroke('#fef3c7', '#fde68a');

      doc
        .fillColor('#92400e')
        .font('Helvetica-Bold')
        .fontSize(8.5)
        .text('📋 INDICACIONES Y RECOMENDACIONES GENERALES:', margin + 10, notesBoxY + 8);

      doc
        .fillColor('#78350f')
        .font('Helvetica')
        .fontSize(8)
        .text(presc.notes, margin + 10, notesBoxY + 22, { width: pageWidth - margin * 2 - 20 });

      doc.y = notesBoxY + 60;
    }

    // 5. Espacio para Firma y Sello Oficial del Facultativo
    let sealY = doc.y + 20;
    if (sealY > 670) {
      doc.addPage();
      sealY = 50;
    }

    const sealBoxWidth = 200;
    const sealBoxHeight = 85;
    const sealX = pageWidth - margin - sealBoxWidth;

    doc
      .roundedRect(sealX, sealY, sealBoxWidth, sealBoxHeight, 4)
      .fillAndStroke(COLORS.bgLight, COLORS.border);

    doc
      .fillColor(COLORS.textMuted)
      .font('Helvetica')
      .fontSize(7.5)
      .text('Espacio reservado para firma y sello oficial', sealX, sealY + 6, { width: sealBoxWidth, align: 'center' });

    doc
      .strokeColor(COLORS.textSecondary)
      .lineWidth(0.75)
      .moveTo(sealX + 25, sealY + sealBoxHeight - 20)
      .lineTo(sealX + sealBoxWidth - 25, sealY + sealBoxHeight - 20)
      .stroke();

    doc
      .fillColor(COLORS.textSecondary)
      .font('Helvetica-Bold')
      .fontSize(7.5)
      .text(`Firma y Sello del Facultativo`, sealX, sealY + sealBoxHeight - 16, { width: sealBoxWidth, align: 'center' });

    // 6. Pie de página
    const disclaimer = `Receta médica oficial para dispensación en oficinas de farmacia autorizadas conforme al RD 1718/2010.`;
    this.drawFooterAndPages(doc, clinic, disclaimer);

    doc.end();
    const buffer = await bufferPromise;

    const safeNumber = (presc.prescription_number || `PRC-${presc.id}`).replace(/[^a-zA-Z0-9-_]/g, '_');
    const filename = `Receta_${safeNumber}.pdf`;

    return { buffer, filename, documentNumber: presc.prescription_number };
  }
}

export default new PDFService();
