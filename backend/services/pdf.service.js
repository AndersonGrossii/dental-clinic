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
import appointmentRepository from '../repositories/appointment.repository.js';
import doctorRepository from '../repositories/doctor.repository.js';
import reportService from './report.service.js';
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
   * Elimina emojis, pictogramas y caracteres gráficos no estándar
   * que PDFKit / fuentes estándar Type 1 (Helvetica) no pueden codificar ni renderizar.
   */
  stripEmojis(text) {
    if (text === null || text === undefined) return '';
    return String(text)
      .replace(/\p{Extended_Pictographic}/gu, '')
      .replace(/[\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F1E6}-\u{1F1FF}]/gu, '')
      .replace(/[↳➔➜➞►▶]/g, '-')
      .replace(/[✓✔]/g, '')
      .replace(/[⚠️]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
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
      .text(this.stripEmojis(clinic.name) || 'Clínica Dental', clinicX, 20, { width: clinicWidth });

    doc
      .fillColor(COLORS.textSecondary)
      .font('Helvetica')
      .fontSize(8)
      .text(this.stripEmojis(clinic.legal_name ? `${clinic.legal_name}${clinic.tax_id ? ' · CIF: ' + clinic.tax_id : ''}` : (clinic.tax_id ? `CIF/NIF: ${clinic.tax_id}` : '')), clinicX, 36, { width: clinicWidth })
      .text(this.stripEmojis(`${clinic.address || ''}${clinic.city ? ', ' + clinic.city : ''}${clinic.postal_code ? ' (' + clinic.postal_code + ')' : ''}`), clinicX, 47, { width: clinicWidth })
      .text(this.stripEmojis(`${clinic.phone ? 'Tel: ' + clinic.phone : ''}${clinic.email ? ' · ' + clinic.email : ''}`), clinicX, 58, { width: clinicWidth });

    doc
      .fillColor(COLORS.text)
      .font('Helvetica-Bold')
      .fontSize(14)
      .text(this.stripEmojis(docTitle).toUpperCase(), rightColX, 20, { width: 200, align: 'right' });

    doc
      .fillColor(COLORS.primaryDark)
      .font('Helvetica-Bold')
      .fontSize(12)
      .text(this.stripEmojis(docNumber), rightColX, 37, { width: 200, align: 'right' });

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
        .text(this.stripEmojis(badgeText).toUpperCase(), badgeX, badgeY + 4, { width: badgeWidth, align: 'center' });
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
   * Dibuja el encabezado exclusivo para reportes y balances (evita solapamientos tipográficos).
   */
  drawReportHeader(doc, clinic, { title, docNumber = 'INFORME OFICIAL', periodText = null, badgeColor = COLORS.primary }) {
    const pageWidth = doc.page.width;
    const margin = 40;

    // Barra superior decorativa corporativa
    doc.rect(0, 0, pageWidth, 6).fill(COLORS.primary);

    // Intentar ubicar y dibujar el logo de la clínica
    const logoPath = this.resolveClinicLogoPath(clinic);
    let logoLoaded = false;
    if (logoPath) {
      try {
        doc.image(logoPath, margin, 14, { fit: [95, 46] });
        logoLoaded = true;
      } catch {}
    }

    // Bloque Izquierdo: Datos de la clínica
    const clinicX = logoLoaded ? margin + 105 : margin;
    const rightColWidth = 240;
    const rightColX = pageWidth - margin - rightColWidth;
    const clinicWidth = rightColX - clinicX - 15;

    doc
      .fillColor(COLORS.primary)
      .font('Helvetica-Bold')
      .fontSize(11)
      .text(this.stripEmojis(clinic.name) || 'Clínica Dental', clinicX, 14, { width: clinicWidth });

    const details = [];
    if (clinic.legal_name || clinic.tax_id) {
      details.push(this.stripEmojis(`${clinic.legal_name || ''}${clinic.tax_id ? ' · CIF: ' + clinic.tax_id : ''}`));
    }
    const fullAddress = this.stripEmojis(`${clinic.address || ''}${clinic.city ? ', ' + clinic.city : ''}${clinic.postal_code ? ' (' + clinic.postal_code + ')' : ''}`).trim();
    if (fullAddress) details.push(fullAddress);
    const fullContact = this.stripEmojis(`${clinic.phone ? 'Tel: ' + clinic.phone : ''}${clinic.email ? ' · ' + clinic.email : ''}`).trim();
    if (fullContact) details.push(fullContact);

    doc
      .fillColor(COLORS.textSecondary)
      .font('Helvetica')
      .fontSize(7)
      .text(details.join('\n'), clinicX, 27, { width: clinicWidth, lineGap: 1.5 });
    const clinicBottomY = doc.y;

    // Bloque Derecho: Título del reporte sin colisión
    doc
      .fillColor(COLORS.text)
      .font('Helvetica-Bold')
      .fontSize(11)
      .text(this.stripEmojis(title).toUpperCase(), rightColX, 14, { width: rightColWidth, align: 'right' });

    doc
      .fillColor(COLORS.textSecondary)
      .font('Helvetica')
      .fontSize(7.5)
      .text(this.stripEmojis(docNumber).toUpperCase(), rightColX, 28, { width: rightColWidth, align: 'right' });

    if (periodText) {
      const badgeWidth = 200;
      const badgeHeight = 15;
      const badgeX = pageWidth - margin - badgeWidth;
      const badgeY = 41;
      doc
        .roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 3)
        .fill(badgeColor);
      doc
        .fillColor(COLORS.white)
        .font('Helvetica-Bold')
        .fontSize(7.5)
        .text(this.stripEmojis(periodText).toUpperCase(), badgeX, badgeY + 3.5, { width: badgeWidth, align: 'center', lineBreak: false });
    }

    // Línea separadora
    const dividerY = Math.max(clinicBottomY + 4, 66);
    doc
      .strokeColor(COLORS.border)
      .lineWidth(0.75)
      .moveTo(margin, dividerY)
      .lineTo(pageWidth - margin, dividerY)
      .stroke();

    doc.x = margin;
    doc.y = dividerY + 8;
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
      .text(this.stripEmojis(patient.name) || 'Paciente No Especificado', margin + 10, yPos + 22, { width: boxWidth - 20 });

    doc
      .fillColor(COLORS.textSecondary)
      .font('Helvetica')
      .fontSize(8)
      .text(`DNI / NIF: ${patient.dni || '—'}`, margin + 10, yPos + 35)
      .text(`Tel: ${patient.phone || '—'}  |  Email: ${patient.email || '—'}`, margin + 10, yPos + 46, { width: boxWidth - 20 })
      .text(patient.address ? this.stripEmojis(`Dir: ${patient.address}`) : '', margin + 10, yPos + 57, { width: boxWidth - 20 });

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
      .text(doctor.name ? `Dr/a. ${this.stripEmojis(doctor.name)}` : 'Clínica Dental Especializada', rightX + 10, yPos + 22, { width: boxWidth - 20 });

    const docSub = doctor.specialty ? this.stripEmojis(`${doctor.specialty}${doctor.license ? ' (Col. ' + doctor.license + ')' : ''}`) : 'Odontología Integral';
    doc
      .fillColor(COLORS.textSecondary)
      .font('Helvetica')
      .fontSize(8)
      .text(docSub, rightX + 10, yPos + 35, { width: boxWidth - 20 })
      .text(`Fecha de Emisión: ${this.formatDate(docDate)}`, rightX + 10, yPos + 46);

    if (dueDate) {
      doc.text(`Fecha de Vto: ${this.formatDate(dueDate)}`, rightX + 10, yPos + 57);
    } else if (extraLabels.length > 0) {
      doc.text(this.stripEmojis(extraLabels[0]), rightX + 10, yPos + 57);
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
    const footerY = pageHeight - 28;

    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      const oldBottomMargin = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;

      // Línea divisoria de pie
      doc
        .strokeColor(COLORS.border)
        .lineWidth(0.5)
        .moveTo(margin, footerY - 6)
        .lineTo(pageWidth - margin, footerY - 6)
        .stroke();

      const defaultNotice = this.stripEmojis(legalNotice || `${clinic.name || 'Clínica Dental'} · Documento oficial emitido conforme a la legislación sanitaria y fiscal vigente.`);
      doc
        .fillColor(COLORS.textMuted)
        .font('Helvetica')
        .fontSize(7)
        .text(defaultNotice, margin, footerY, { width: pageWidth - margin * 2 - 70, lineBreak: false });

      doc
        .fillColor(COLORS.textSecondary)
        .font('Helvetica-Bold')
        .fontSize(7.5)
        .text(`Página ${i + 1} de ${range.count}`, pageWidth - margin - 70, footerY, { width: 70, align: 'right', lineBreak: false });

      doc.page.margins.bottom = oldBottomMargin;
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
        desc: this.stripEmojis(item.clean_description || item.description || item.treatment_name || 'Tratamiento Odontológico'),
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
        .text(this.stripEmojis(invoice.notes), margin, doc.y + 1, { width: 350 });
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
        const isPackHeader = Boolean(item.is_pack_header);
        const isPackItem = Boolean(item.is_pack_item);

        let desc = this.stripEmojis(item.description || item.treatment_name || 'Tratamiento Odontológico');
        let priceStr = this.formatCurrency(item.unit_price, clinic.currency);
        let totalStr = this.formatCurrency(item.total, clinic.currency);

        if (isPackHeader) {
          const rawPackName = this.stripEmojis(item.pack_name || item.description || 'PACK PROMOCIONAL');
          const cleanPackName = rawPackName.replace(/\(Pack Promocional\)/gi, '').trim();
          desc = `${cleanPackName} (Pack Promocional)`;
          priceStr = this.formatCurrency(item.pack_fixed_price !== null && item.pack_fixed_price !== undefined ? item.pack_fixed_price : item.unit_price, clinic.currency);
          totalStr = this.formatCurrency(item.total, clinic.currency);
        } else if (isPackItem) {
          const rawItemName = this.stripEmojis(item.description || item.treatment_name || 'Tratamiento').replace(/^[-–—]\s*/, '').replace(/\(Incluido en pack\)/gi, '').trim();
          desc = `   - ${rawItemName} (Incluido en pack)`;
          priceStr = 'Incluido';
          totalStr = this.formatCurrency(0, clinic.currency);
        }

        return {
          tooth: item.tooth_number ? String(item.tooth_number) : '—',
          desc,
          qty: String(item.quantity || 1),
          price: priceStr,
          discount: isPackItem ? '—' : discStr,
          total: totalStr,
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

    const margin = 40;
    doc.x = margin;
    await doc.table(tableData, {
      x: margin,
      columnsSize: [45, 235, 40, 85, 45, 65],
      prepareHeader: () => {
        doc.x = margin;
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COLORS.white);
      },
      prepareRow: (row, indexColumn, indexRow, rectRow) => {
        doc.x = margin;
        const rawItem = items[indexRow];
        if (rawItem && rawItem.is_pack_header) {
          doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#0369a1');
        } else if (rawItem && rawItem.is_pack_item) {
          doc.font('Helvetica-Oblique').fontSize(8).fillColor('#475569');
        } else {
          doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.text);
        }
      },
      padding: [5, 4],
      headerBackgroundColor: COLORS.primary,
    });

    // 4. Totales y resumen
    doc.x = margin;
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
      .text(this.stripEmojis(presc.patient_name) || 'Paciente', rightX + 10, yPos + 22, { width: boxWidth - 20 });

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
        .text(`ALERGIAS: ${this.stripEmojis(allergies).toUpperCase()}`, rightX + 10, yPos + 62, { width: boxWidth - 20 });
    } else {
      doc
        .fillColor(COLORS.success)
        .font('Helvetica')
        .fontSize(7.5)
        .text(`Sin alergias conocidas registradas`, rightX + 10, yPos + 62);
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
        med: this.stripEmojis(item.medication_name || 'Medicamento'),
        dosage: this.stripEmojis(item.dosage || '—'),
        freq: this.stripEmojis(item.frequency || '—'),
        duration: this.stripEmojis(item.duration || '—'),
        instructions: this.stripEmojis(item.instructions || 'Según indicación del facultativo'),
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
        .text('INDICACIONES Y RECOMENDACIONES GENERALES:', margin + 10, notesBoxY + 8);

      doc
        .fillColor('#78350f')
        .font('Helvetica')
        .fontSize(8)
        .text(this.stripEmojis(presc.notes), margin + 10, notesBoxY + 22, { width: pageWidth - margin * 2 - 20 });

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

  /**
   * Genera el PDF del Resumen de Facturas y Recibos con diseño ejecutivo y separación de tablas.
   */
  async generateInvoiceReceiptSummaryPDF({ startDate, endDate }) {
    const store = als.getStore();
    const clinicId = store?.clinicId || 1;
    const clinic = await this.getClinicInfo(clinicId);

    const data = await reportService.getInvoiceReceiptSummaryReport(startDate, endDate);
    const invoices = data.invoices || [];
    const receipts = data.receipts || [];
    const totals = data.totals || {
      invoices: { total: 0, count: 0 },
      receipts: { total: 0, count: 0 },
      byPaymentMethod: [],
    };

    const grandTotal = (totals.invoices?.total || 0) + (totals.receipts?.total || 0);
    const totalDocs = (totals.invoices?.count || 0) + (totals.receipts?.count || 0);

    const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
    const bufferPromise = this.streamToBuffer(doc);

    // 1. Encabezado institucional elegante y espacioso (sin colisiones)
    const fromLabel = startDate ? this.formatDate(startDate) : 'Inicio';
    const toLabel = endDate ? this.formatDate(endDate) : 'Presente';
    const periodLabel = `Período: ${fromLabel} — ${toLabel}`;
    this.drawReportHeader(doc, clinic, {
      title: 'Resumen Facturas y Recibos',
      docNumber: 'CONTROL DE FACTURACIÓN Y COBROS',
      periodText: periodLabel,
      badgeColor: COLORS.primary,
    });

    // 2. Tarjetas KPI ejecutivas de resumen
    const margin = 40;
    const pageWidth = doc.page.width;
    const boxWidth = pageWidth - margin * 2;
    const cardY = doc.y + 4;
    const cardWidth = (boxWidth - 20) / 3;
    const cardHeight = 52;

    // Card 1: Total Facturas
    doc.roundedRect(margin, cardY, cardWidth, cardHeight, 4).fillAndStroke('#f0f9ff', '#bae6fd');
    doc.fillColor('#0369a1').font('Helvetica-Bold').fontSize(8).text('TOTAL FACTURAS', margin + 10, cardY + 8);
    doc.fillColor('#0c4a6e').font('Helvetica-Bold').fontSize(12).text(this.formatCurrency(totals.invoices?.total || 0, clinic.currency), margin + 10, cardY + 20);
    doc.fillColor('#0284c7').font('Helvetica').fontSize(7.5).text(`${totals.invoices?.count || 0} factura(s) emitida(s)`, margin + 10, cardY + 36);

    // Card 2: Total Recibos
    const c2X = margin + cardWidth + 10;
    doc.roundedRect(c2X, cardY, cardWidth, cardHeight, 4).fillAndStroke('#f0fdf4', '#bbf7d0');
    doc.fillColor('#15803d').font('Helvetica-Bold').fontSize(8).text('TOTAL RECIBOS', c2X + 10, cardY + 8);
    doc.fillColor('#14532d').font('Helvetica-Bold').fontSize(12).text(this.formatCurrency(totals.receipts?.total || 0, clinic.currency), c2X + 10, cardY + 20);
    doc.fillColor('#16a34a').font('Helvetica').fontSize(7.5).text(`${totals.receipts?.count || 0} recibo(s) emitido(s)`, c2X + 10, cardY + 36);

    // Card 3: Total Consolidado
    const c3X = c2X + cardWidth + 10;
    doc.roundedRect(c3X, cardY, cardWidth, cardHeight, 4).fillAndStroke('#f8fafc', '#cbd5e1');
    doc.fillColor('#475569').font('Helvetica-Bold').fontSize(8).text('TOTAL RECAUDADO', c3X + 10, cardY + 8);
    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(12).text(this.formatCurrency(grandTotal, clinic.currency), c3X + 10, cardY + 20);
    doc.fillColor('#64748b').font('Helvetica').fontSize(7.5).text(`${totalDocs} documento(s) consolidado(s)`, c3X + 10, cardY + 36);

    // 3. Desglose por métodos de pago
    const pBreakdownY = cardY + cardHeight + 8;
    doc.roundedRect(margin, pBreakdownY, boxWidth, 32, 4).fillAndStroke('#f8fafc', '#e2e8f0');

    doc.fillColor('#475569').font('Helvetica-Bold').fontSize(7.5).text('DESGLOSE DE INGRESOS POR MÉTODO DE PAGO:', margin + 10, pBreakdownY + 6);

    const pMethods = totals.byPaymentMethod || [];
    let pMethodsText = 'Sin cobros registrados en este período.';
    if (pMethods.length > 0) {
      pMethodsText = pMethods.map(pm => `${pm.method}: ${this.formatCurrency(pm.total, clinic.currency)}`).join('   •   ');
    }
    doc.fillColor('#1e293b').font('Helvetica').fontSize(8).text(pMethodsText, margin + 10, pBreakdownY + 17, { width: boxWidth - 20 });

    doc.x = margin;
    doc.y = pBreakdownY + 40;

    // 4. Tabla de Facturas Oficiales
    if (doc.y > 600) {
      doc.addPage();
      doc.x = margin;
      doc.y = 40;
    }
    const facturasHeaderY = doc.y;
    doc.roundedRect(margin, facturasHeaderY, boxWidth, 20, 3).fill('#0284c7');
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8.5).text(`1. FACTURAS OFICIALES EMITIDAS (${invoices.length} REGISTROS)`, margin + 8, facturasHeaderY + 5);
    doc.fillColor('#e0f2fe').font('Helvetica-Bold').fontSize(8).text(`Subtotal: ${this.formatCurrency(totals.invoices?.total || 0, clinic.currency)}`, margin + boxWidth - 160, facturasHeaderY + 5, { width: 150, align: 'right' });

    doc.x = margin;
    doc.y = facturasHeaderY + 24;

    const facturasTableData = {
      headers: [
        { label: 'Fecha', property: 'date', width: 65, align: 'center', headerColor: '#0284c7', headerOpacity: 1 },
        { label: 'Nº Factura', property: 'number', width: 80, align: 'center', headerColor: '#0284c7', headerOpacity: 1 },
        { label: 'Cliente / Paciente', property: 'customer', width: 150, align: 'left', headerColor: '#0284c7', headerOpacity: 1 },
        { label: 'DNI / NIE / CIF', property: 'dni', width: 80, align: 'center', headerColor: '#0284c7', headerOpacity: 1 },
        { label: 'Método de Pago', property: 'method', width: 75, align: 'center', headerColor: '#0284c7', headerOpacity: 1 },
        { label: 'Importe', property: 'amount', width: 65, align: 'right', headerColor: '#0284c7', headerOpacity: 1 },
      ],
      datas: invoices.length > 0
        ? invoices.map(inv => ({
            date: this.formatDate(inv.date || inv.raw_date),
            number: inv.invoice_number || `FAC-${inv.id}`,
            customer: inv.customer_name || 'Sin nombre',
            dni: inv.patient_identification || 'No registrado',
            method: inv.payment_method || '—',
            amount: this.formatCurrency(inv.amount, clinic.currency),
          }))
        : [{
            date: '—',
            number: '—',
            customer: 'No se encontraron facturas en el período seleccionado.',
            dni: '—',
            method: '—',
            amount: '—',
          }],
    };

    if (invoices.length > 0) {
      facturasTableData.datas.push({
        date: '',
        number: '',
        customer: `TOTAL FACTURAS (${invoices.length} docs)`,
        dni: '',
        method: '',
        amount: this.formatCurrency(totals.invoices?.total || 0, clinic.currency),
      });
    }

    await doc.table(facturasTableData, {
      x: margin,
      columnsSize: [65, 80, 150, 80, 75, 65],
      prepareHeader: () => {
        doc.x = margin;
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#ffffff');
      },
      prepareRow: (row, indexColumn, indexRow, rectRow) => {
        doc.x = margin;
        const isTotalRow = indexRow === facturasTableData.datas.length - 1 && invoices.length > 0;
        if (isTotalRow) {
          doc.font('Helvetica-Bold').fontSize(8).fillColor('#0369a1');
        } else {
          doc.font('Helvetica').fontSize(8).fillColor('#1e293b');
        }
      },
      padding: [4, 4],
      headerBackgroundColor: '#0369a1',
    });

    // 5. Tabla de Recibos de Cobro
    doc.x = margin;
    doc.y += 16;
    if (doc.y > 580) {
      doc.addPage();
      doc.x = margin;
      doc.y = 40;
    }

    const recibosHeaderY = doc.y;
    doc.roundedRect(margin, recibosHeaderY, boxWidth, 20, 3).fill('#16a34a');
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8.5).text(`2. RECIBOS DE PAGO EMITIDOS (${receipts.length} REGISTROS)`, margin + 8, recibosHeaderY + 5);
    doc.fillColor('#dcfce7').font('Helvetica-Bold').fontSize(8).text(`Subtotal: ${this.formatCurrency(totals.receipts?.total || 0, clinic.currency)}`, margin + boxWidth - 160, recibosHeaderY + 5, { width: 150, align: 'right' });

    doc.x = margin;
    doc.y = recibosHeaderY + 24;

    const recibosTableData = {
      headers: [
        { label: 'Fecha', property: 'date', width: 65, align: 'center', headerColor: '#16a34a', headerOpacity: 1 },
        { label: 'Nº Recibo', property: 'number', width: 80, align: 'center', headerColor: '#16a34a', headerOpacity: 1 },
        { label: 'Cliente / Paciente', property: 'customer', width: 150, align: 'left', headerColor: '#16a34a', headerOpacity: 1 },
        { label: 'DNI / NIE / CIF', property: 'dni', width: 80, align: 'center', headerColor: '#16a34a', headerOpacity: 1 },
        { label: 'Método de Pago', property: 'method', width: 75, align: 'center', headerColor: '#16a34a', headerOpacity: 1 },
        { label: 'Importe', property: 'amount', width: 65, align: 'right', headerColor: '#16a34a', headerOpacity: 1 },
      ],
      datas: receipts.length > 0
        ? receipts.map(rec => ({
            date: this.formatDate(rec.date || rec.raw_date),
            number: rec.receipt_number || `REC-${rec.id}`,
            customer: rec.customer_name || 'Sin nombre',
            dni: rec.patient_identification || 'No registrado',
            method: rec.payment_method || '—',
            amount: this.formatCurrency(rec.amount, clinic.currency),
          }))
        : [{
            date: '—',
            number: '—',
            customer: 'No se encontraron recibos en el período seleccionado.',
            dni: '—',
            method: '—',
            amount: '—',
          }],
    };

    if (receipts.length > 0) {
      recibosTableData.datas.push({
        date: '',
        number: '',
        customer: `TOTAL RECIBOS (${receipts.length} docs)`,
        dni: '',
        method: '',
        amount: this.formatCurrency(totals.receipts?.total || 0, clinic.currency),
      });
    }

    await doc.table(recibosTableData, {
      x: margin,
      columnsSize: [65, 80, 150, 80, 75, 65],
      prepareHeader: () => {
        doc.x = margin;
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#ffffff');
      },
      prepareRow: (row, indexColumn, indexRow, rectRow) => {
        doc.x = margin;
        const isTotalRow = indexRow === recibosTableData.datas.length - 1 && receipts.length > 0;
        if (isTotalRow) {
          doc.font('Helvetica-Bold').fontSize(8).fillColor('#15803d');
        } else {
          doc.font('Helvetica').fontSize(8).fillColor('#1e293b');
        }
      },
      padding: [4, 4],
      headerBackgroundColor: '#15803d',
    });

    doc.x = margin;

    // 6. Pie de página y numeración
    const legalNotice = `${clinic.name || 'Clínica Dental'} · Informe oficial de control de facturación y cobros conforme a la legislación fiscal vigente.`;
    this.drawFooterAndPages(doc, clinic, legalNotice);

    doc.end();
    const buffer = await bufferPromise;
    const safeFrom = (startDate || 'inicio').replace(/[^a-zA-Z0-9-_]/g, '_');
    const safeTo = (endDate || 'fin').replace(/[^a-zA-Z0-9-_]/g, '_');
    const filename = `Resumen_Facturas_Recibos_${safeFrom}_${safeTo}.pdf`;

    return { buffer, filename, documentNumber: 'INF-FAC-REC' };
  }

  /**
   * Genera el PDF del Reporte de Ingresos Financieros.
   */
  async generateRevenueReportPDF({ startDate, endDate }) {
    const store = als.getStore();
    const clinicId = store?.clinicId || 1;
    const clinic = await this.getClinicInfo(clinicId);

    const data = await reportService.getRevenueReport(startDate, endDate);

    const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
    const bufferPromise = this.streamToBuffer(doc);

    const fromLabel = startDate ? this.formatDate(startDate) : 'Inicio';
    const toLabel = endDate ? this.formatDate(endDate) : 'Presente';
    this.drawReportHeader(doc, clinic, {
      title: 'Reporte de Ingresos',
      docNumber: 'INFORME FINANCIERO',
      periodText: `Período: ${fromLabel} — ${toLabel}`,
      badgeColor: COLORS.primary,
    });

    const margin = 40;
    const boxWidth = doc.page.width - margin * 2;

    // Card Total Ingresos
    doc.roundedRect(margin, doc.y + 4, boxWidth, 52, 4).fillAndStroke('#f0fdf4', '#86efac');
    doc.fillColor('#166534').font('Helvetica-Bold').fontSize(9).text('TOTAL DE INGRESOS RECAUDADOS EN EL PERÍODO', margin + 14, doc.y + 12);
    doc.fillColor('#14532d').font('Helvetica-Bold').fontSize(16).text(this.formatCurrency(data.total || 0, clinic.currency), margin + 14, doc.y + 26);

    doc.x = margin;
    doc.y += 66;

    // Tabla Ingresos por Método de Pago
    const methodTableData = {
      headers: [
        { label: 'Método de Pago', property: 'method', width: 260 },
        { label: 'Importe Total', property: 'total', width: 255, align: 'right' },
      ],
      datas: (data.byMethod || []).map(m => ({
        method: m.method,
        total: this.formatCurrency(m.total, clinic.currency),
      })),
    };

    if (methodTableData.datas.length === 0) {
      methodTableData.datas.push({ method: 'Sin cobros registrados', total: '0,00 €' });
    }

    doc.fillColor(COLORS.primaryDark).font('Helvetica-Bold').fontSize(9.5).text('1. INGRESOS POR MÉTODO DE PAGO', margin, doc.y);
    doc.x = margin;
    doc.y += 4;
    await doc.table(methodTableData, {
      x: margin,
      columnsSize: [260, 255],
      prepareHeader: () => {
        doc.x = margin;
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#ffffff');
      },
      prepareRow: () => {
        doc.x = margin;
        doc.font('Helvetica').fontSize(8).fillColor('#1e293b');
      },
      padding: [4, 4],
      headerBackgroundColor: '#0284c7',
    });

    // Tabla Ingresos por Médico
    doc.x = margin;
    doc.y += 14;
    if (doc.y > 620) {
      doc.addPage();
      doc.x = margin;
      doc.y = 40;
    }

    const doctorTableData = {
      headers: [
        { label: 'Profesional / Odontólogo', property: 'doctor', width: 260 },
        { label: 'Importe Generado', property: 'total', width: 255, align: 'right' },
      ],
      datas: (data.byDoctor || []).map(d => ({
        doctor: d.doctor,
        total: this.formatCurrency(d.total, clinic.currency),
      })),
    };

    if (doctorTableData.datas.length === 0) {
      doctorTableData.datas.push({ doctor: 'Sin actividad médica registrada', total: '0,00 €' });
    }

    doc.fillColor(COLORS.primaryDark).font('Helvetica-Bold').fontSize(9.5).text('2. INGRESOS POR MÉDICO / ODONTÓLOGO', margin, doc.y);
    doc.x = margin;
    doc.y += 4;
    await doc.table(doctorTableData, {
      x: margin,
      columnsSize: [260, 255],
      prepareHeader: () => {
        doc.x = margin;
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#ffffff');
      },
      prepareRow: () => {
        doc.x = margin;
        doc.font('Helvetica').fontSize(8).fillColor('#1e293b');
      },
      padding: [4, 4],
      headerBackgroundColor: '#0f766e',
    });

    doc.x = margin;
    this.drawFooterAndPages(doc, clinic, `${clinic.name} · Reporte Financiero de Ingresos.`);
    doc.end();
    const buffer = await bufferPromise;
    const filename = `Reporte_Ingresos_${(startDate || 'inicio').replace(/[^a-zA-Z0-9-_]/g, '_')}_${(endDate || 'fin').replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf`;
    return { buffer, filename, documentNumber: 'INF-ING' };
  }

  /**
   * Genera el PDF del Reporte Operativo de Citas.
   */
  async generateAppointmentsReportPDF({ startDate, endDate }) {
    const store = als.getStore();
    const clinicId = store?.clinicId || 1;
    const clinic = await this.getClinicInfo(clinicId);

    const data = await reportService.getAppointmentReport(startDate, endDate);

    const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
    const bufferPromise = this.streamToBuffer(doc);

    const fromLabel = startDate ? this.formatDate(startDate) : 'Inicio';
    const toLabel = endDate ? this.formatDate(endDate) : 'Presente';
    this.drawReportHeader(doc, clinic, {
      title: 'Reporte de Citas',
      docNumber: 'INFORME OPERATIVO',
      periodText: `Período: ${fromLabel} — ${toLabel}`,
      badgeColor: '#4f46e5',
    });

    const margin = 40;
    const boxWidth = doc.page.width - margin * 2;

    // Card Total Citas
    doc.roundedRect(margin, doc.y + 4, boxWidth, 52, 4).fillAndStroke('#eef2ff', '#c7d2fe');
    doc.fillColor('#3730a3').font('Helvetica-Bold').fontSize(9).text('TOTAL DE CITAS REGISTRADAS EN EL PERÍODO', margin + 14, doc.y + 12);
    doc.fillColor('#312e81').font('Helvetica-Bold').fontSize(16).text(`${data.total || 0} Citas Agendadas`, margin + 14, doc.y + 26);

    doc.x = margin;
    doc.y += 66;

    // Tabla de Citas por Estado
    const statusTableData = {
      headers: [
        { label: 'Estado de la Cita', property: 'status', width: 260 },
        { label: 'Cantidad de Citas', property: 'count', width: 255, align: 'right' },
      ],
      datas: (data.byStatus || []).map(s => ({
        status: s.status,
        count: `${s.count} citas`,
      })),
    };

    doc.fillColor('#4338ca').font('Helvetica-Bold').fontSize(9.5).text('1. DISTRIBUCIÓN POR ESTADO', margin, doc.y);
    doc.x = margin;
    doc.y += 4;
    await doc.table(statusTableData, {
      x: margin,
      columnsSize: [260, 255],
      prepareHeader: () => {
        doc.x = margin;
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#ffffff');
      },
      prepareRow: () => {
        doc.x = margin;
        doc.font('Helvetica').fontSize(8).fillColor('#1e293b');
      },
      padding: [4, 4],
      headerBackgroundColor: '#4f46e5',
    });

    // Tabla de Citas por Médico
    doc.x = margin;
    doc.y += 14;
    if (doc.y > 620) {
      doc.addPage();
      doc.x = margin;
      doc.y = 40;
    }

    const docTableData = {
      headers: [
        { label: 'Profesional Asignado', property: 'doctor', width: 260 },
        { label: 'Citas Asignadas', property: 'count', width: 255, align: 'right' },
      ],
      datas: (data.byDoctor || []).map(d => ({
        doctor: d.doctor,
        count: `${d.count} citas`,
      })),
    };

    doc.fillColor('#4338ca').font('Helvetica-Bold').fontSize(9.5).text('2. CITAS POR PROFESIONAL', margin, doc.y);
    doc.x = margin;
    doc.y += 4;
    await doc.table(docTableData, {
      x: margin,
      columnsSize: [260, 255],
      prepareHeader: () => {
        doc.x = margin;
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#ffffff');
      },
      prepareRow: () => {
        doc.x = margin;
        doc.font('Helvetica').fontSize(8).fillColor('#1e293b');
      },
      padding: [4, 4],
      headerBackgroundColor: '#6366f1',
    });

    doc.x = margin;
    this.drawFooterAndPages(doc, clinic, `${clinic.name} · Reporte Operativo de Citas.`);
    doc.end();
    const buffer = await bufferPromise;
    const filename = `Reporte_Citas_${(startDate || 'inicio').replace(/[^a-zA-Z0-9-_]/g, '_')}_${(endDate || 'fin').replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf`;
    return { buffer, filename, documentNumber: 'INF-CIT' };
  }

  /**
   * Genera el PDF del Reporte Clínico de Tratamientos.
   */
  async generateTreatmentsReportPDF({ startDate, endDate }) {
    const store = als.getStore();
    const clinicId = store?.clinicId || 1;
    const clinic = await this.getClinicInfo(clinicId);

    const data = await reportService.getTreatmentReport(startDate, endDate);

    const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
    const bufferPromise = this.streamToBuffer(doc);

    const fromLabel = startDate ? this.formatDate(startDate) : 'Inicio';
    const toLabel = endDate ? this.formatDate(endDate) : 'Presente';
    this.drawReportHeader(doc, clinic, {
      title: 'Reporte de Tratamientos',
      docNumber: 'INFORME CLÍNICO',
      periodText: `Período: ${fromLabel} — ${toLabel}`,
      badgeColor: '#0284c7',
    });

    const margin = 40;
    doc.x = margin;
    doc.y += 6;

    const treatTableData = {
      headers: [
        { label: '#', property: 'rank', width: 35, align: 'center' },
        { label: 'Servicio / Tratamiento Odontológico', property: 'name', width: 280 },
        { label: 'Frecuencia', property: 'count', width: 90, align: 'center' },
        { label: 'Ingresos Totales', property: 'total', width: 110, align: 'right' },
      ],
      datas: (data.popular || []).map((t, idx) => ({
        rank: `# ${idx + 1}`,
        name: t.treatment,
        count: `${t.count} veces`,
        total: this.formatCurrency(t.total || 0, clinic.currency),
      })),
    };

    if (treatTableData.datas.length === 0) {
      treatTableData.datas.push({
        rank: '—',
        name: 'No hay tratamientos registrados en el rango.',
        count: '—',
        total: '—',
      });
    }

    doc.fillColor('#0369a1').font('Helvetica-Bold').fontSize(9.5).text('RANKING DE TRATAMIENTOS MÁS REALIZADOS', margin, doc.y);
    doc.x = margin;
    doc.y += 4;
    await doc.table(treatTableData, {
      x: margin,
      columnsSize: [35, 280, 90, 110],
      prepareHeader: () => {
        doc.x = margin;
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#ffffff');
      },
      prepareRow: () => {
        doc.x = margin;
        doc.font('Helvetica').fontSize(8).fillColor('#1e293b');
      },
      padding: [4, 4],
      headerBackgroundColor: '#0284c7',
    });

    doc.x = margin;
    this.drawFooterAndPages(doc, clinic, `${clinic.name} · Reporte Clínico de Tratamientos.`);
    doc.end();
    const buffer = await bufferPromise;
    const filename = `Reporte_Tratamientos_${(startDate || 'inicio').replace(/[^a-zA-Z0-9-_]/g, '_')}_${(endDate || 'fin').replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf`;
    return { buffer, filename, documentNumber: 'INF-TRAT' };
  }

  /**
   * Helper para obtener el rango horario de una cita con duración por defecto segura.
   */
  _getAppointmentRange(a, defaultDuration = 30) {
    const s = a.start_time ? String(a.start_time).substring(0, 5) : '';
    let e = a.end_time ? String(a.end_time).substring(0, 5) : '';
    if (!e || e <= s) {
      if (!s) return { s: '09:00', e: '09:30' };
      const [sh, sm] = s.split(':').map(Number);
      const totalMins = (sh || 0) * 60 + (sm || 0) + (Number(defaultDuration) || 30);
      const eh = String(Math.floor(totalMins / 60)).padStart(2, '0');
      const em = String(totalMins % 60).padStart(2, '0');
      e = `${eh}:${em}`;
    }
    return { s, e };
  }

  /**
   * Helper para extraer ID personalizado de paciente.
   */
  getPatientCustomId(a) {
    return a.custom_id || a.customId || a.patient_custom_id || (a.patient_id ? `PAC-${String(a.patient_id).padStart(5, '0')}` : '—');
  }

  /**
   * Helper para extraer nombre completo del paciente.
   */
  getPatientName(a) {
    if (a.patient_name) return a.patient_name;
    if (a.patient_first_name) return `${a.patient_first_name} ${a.patient_last_name || ''}`.trim();
    if (a.guest_name) return a.guest_name;
    return 'Sin paciente';
  }

  /**
   * Helper para extraer teléfono del paciente.
   */
  getPatientPhone(a) {
    return a.patient_phone || a.phone || a.guest_phone || 'Sin teléfono';
  }

  /**
   * Genera el documento PDF oficial de la Agenda Médica (Diaria o Semanal)
   * respetando los intervalos de tiempo seleccionados (15, 30 o 60 min)
   * y mostrando todas las citas simultáneas por doctor.
   */
  async generateAgendaPDF({ date, slotDuration = 30, doctorId = null, mode = 'daily' } = {}) {
    const store = als.getStore();
    const clinicId = store?.clinicId || 1;
    const clinic = await this.getClinicInfo(clinicId);

    const validDuration = [15, 30, 60].includes(Number(slotDuration)) ? Number(slotDuration) : 30;
    const printDate = date ? String(date).slice(0, 10) : new Date().toISOString().slice(0, 10);

    const formatTimeSlot = (timeStr) => {
      if (!timeStr) return '';
      return String(timeStr).substring(0, 5);
    };

    if (mode === 'weekly') {
      return this._generateWeeklyAgendaPDF({ clinic, printDate, validDuration, doctorId });
    }

    // ============================================
    // MODO DIARIO (Agenda del Día)
    // ============================================
    const appointmentsResult = await appointmentRepository.findAllWithDetails({
      limit: 9999,
      sortBy: 'a.start_time',
      sortOrder: 'ASC',
      filters: {
        date_from: printDate,
        date_to: printDate,
        doctor_id: doctorId || undefined,
        exclude_cancelled: true,
      },
    });
    const appointments = appointmentsResult.rows || [];

    const doctorsResult = await doctorRepository.findAllWithUsers({ limit: 500 });
    const allDoctors = doctorsResult.rows || [];
    const activeDoctors = allDoctors.filter(d => d.is_active);

    // Obtener horarios e indisponibilidades de los doctores
    const [unavailResults, scheduleResults] = await Promise.all([
      Promise.all(activeDoctors.map(d =>
        doctorRepository.getUnavailability(d.id, printDate, printDate).catch(() => [])
      )),
      Promise.all(activeDoctors.map(d =>
        doctorRepository.getSchedule(d.id).catch(() => [])
      )),
    ]);

    // Agrupar citas por doctor
    const apptsByDoctor = {};
    appointments.forEach(a => {
      const docKey = a.doctor_id || (a.doctor_name ? `name_${a.doctor_name}` : 'unassigned');
      if (!apptsByDoctor[docKey]) apptsByDoctor[docKey] = [];
      apptsByDoctor[docKey].push(a);
    });

    const dow = new Date(printDate + 'T12:00:00').getDay();
    const doctorsToShow = [];

    activeDoctors.forEach((d, idx) => {
      if (doctorId && Number(d.id) !== Number(doctorId)) return;

      const unavail = unavailResults[idx] || [];
      const schedules = scheduleResults[idx] || [];

      const isUnavailable = unavail.some(rec => {
        const start = String(rec.start_date).slice(0, 10);
        const end = String(rec.end_date).slice(0, 10);
        return printDate >= start && printDate <= end;
      });

      const daySched = schedules.find(s => s.day_of_week === dow && s.is_active);
      const worksToday = !isUnavailable && !!daySched;
      const docAppts = apptsByDoctor[d.id] || [];

      if (worksToday || docAppts.length > 0 || (doctorId && Number(d.id) === Number(doctorId))) {
        doctorsToShow.push({
          id: d.id,
          name: `${d.first_name || ''} ${d.last_name || ''}`.trim() || 'Doctor',
          specialty: d.specialty || 'Odontología General',
          appointments: docAppts.sort((a, b) => (a.start_time || '').localeCompare(b.start_time || '')),
        });
      }
    });

    // Incluir cualquier cita asignada a doctores fuera de activeDoctors
    const matchedDoctorIds = new Set(doctorsToShow.map(d => d.id));
    Object.keys(apptsByDoctor).forEach(key => {
      const docAppts = apptsByDoctor[key];
      if (docAppts.length > 0 && !matchedDoctorIds.has(docAppts[0].doctor_id)) {
        if (!doctorId || Number(docAppts[0].doctor_id) === Number(doctorId)) {
          doctorsToShow.push({
            id: docAppts[0].doctor_id || 0,
            name: docAppts[0].doctor_name || 'Doctor',
            specialty: docAppts[0].doctor_specialty || '',
            appointments: docAppts.sort((a, b) => (a.start_time || '').localeCompare(b.start_time || '')),
          });
        }
      }
    });

    // Calcular franja de horarios (mínimo 09:00 - 20:00 o ampliado según citas)
    let minHourMinutes = 540; // 09:00
    let maxHourMinutes = 1200; // 20:00
    appointments.forEach(a => {
      if (a.start_time) {
        const [h, m] = a.start_time.substring(0, 5).split(':').map(Number);
        const mins = (h || 0) * 60 + (m || 0);
        if (mins < minHourMinutes) minHourMinutes = mins;
      }
      if (a.end_time) {
        const [h, m] = a.end_time.substring(0, 5).split(':').map(Number);
        const mins = (h || 0) * 60 + (m || 0);
        if (mins > maxHourMinutes) maxHourMinutes = Math.min(mins, 1440);
      }
    });

    // Alinear al intervalo seleccionado
    minHourMinutes = Math.floor(minHourMinutes / validDuration) * validDuration;
    maxHourMinutes = Math.ceil(maxHourMinutes / validDuration) * validDuration;

    const slots = [];
    for (let m = minHourMinutes; m < maxHourMinutes; m += validDuration) {
      const hStr = String(Math.floor(m / 60)).padStart(2, '0');
      const mStr = String(m % 60).padStart(2, '0');
      const nextM = m + validDuration;
      const nextHStr = String(Math.floor(nextM / 60)).padStart(2, '0');
      const nextMStr = String(nextM % 60).padStart(2, '0');
      slots.push({
        label: `${hStr}:${mStr}`,
        startMin: m,
        endMin: nextM,
        nextLabel: `${nextHStr}:${nextMStr}`,
      });
    }

    // Formatear etiqueta de fecha en español
    const dateObj = new Date(printDate + 'T12:00:00');
    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const dateLabel = `${dayNames[dateObj.getDay()]}, ${dateObj.getDate()} de ${monthNames[dateObj.getMonth()]} de ${dateObj.getFullYear()}`;

    const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
    const bufferPromise = this.streamToBuffer(doc);
    const margin = 40;
    const pageWidth = doc.page.width;
    const contentWidth = pageWidth - margin * 2;

    if (doctorsToShow.length === 0) {
      this.drawHeader(doc, clinic, 'Agenda del Día', dateLabel, 'AGENDA', COLORS.primary);
      doc.y += 30;
      doc.fillColor(COLORS.textSecondary).font('Helvetica').fontSize(11).text('No hay citas ni doctores activos programados para esta fecha.', margin, doc.y, { align: 'center', width: contentWidth });
    }

    doctorsToShow.forEach((doctor, docIdx) => {
      if (docIdx > 0) {
        doc.addPage();
      }

      this.drawHeader(doc, clinic, 'Agenda del Día', dateLabel, 'AGENDA', COLORS.primary);

      // Tarjeta de información del Doctor y Resumen de la Jornada
      const cardY = doc.y + 4;
      const cardHeight = 44;
      doc.roundedRect(margin, cardY, contentWidth, cardHeight, 4).fillAndStroke(COLORS.bgLight, COLORS.border);

      doc.fillColor(COLORS.primaryDark).font('Helvetica-Bold').fontSize(11)
        .text(`Dr/a. ${this.stripEmojis(doctor.name)}`, margin + 12, cardY + 8);

      doc.fillColor(COLORS.textSecondary).font('Helvetica').fontSize(8.5)
        .text(`Especialidad: ${this.stripEmojis(doctor.specialty)} · Intervalo: ${validDuration} min`, margin + 12, cardY + 24);

      doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(9)
        .text(`Citas Programadas: ${doctor.appointments.length}`, margin, cardY + 16, { width: contentWidth - 14, align: 'right' });

      doc.y = cardY + cardHeight + 12;

      // Encabezado visual de la lista
      doc.fillColor(COLORS.primaryDark).font('Helvetica-Bold').fontSize(8.5)
        .text('PROGRAMACIÓN HORARIA DETALLADA', margin, doc.y);
      doc.y += 4;
      doc.strokeColor(COLORS.primary).lineWidth(1).moveTo(margin, doc.y).lineTo(pageWidth - margin, doc.y).stroke();
      doc.y += 8;

      // Renderizar cada fila horaria
      slots.forEach(slot => {
        // Asignar todas las citas que ocupen este bloque horario (iniciadas en o cruzando por este slot)
        const matches = doctor.appointments.filter(a => {
          const { s, e } = this._getAppointmentRange(a, validDuration);
          return s < slot.nextLabel && e > slot.label;
        });

        // Salto de página preventivo si nos acercamos al pie
        const estimatedHeight = matches.length > 0 ? matches.length * 28 + 12 : 18;
        if (doc.y + estimatedHeight > doc.page.height - 45) {
          doc.addPage();
          doc.y = 36;
          doc.fillColor(COLORS.textSecondary).font('Helvetica-Bold').fontSize(8)
            .text(`Dr/a. ${this.stripEmojis(doctor.name)} — Agenda del Día (Continuación) · ${dateLabel}`, margin, doc.y);
          doc.y += 14;
          doc.strokeColor(COLORS.border).lineWidth(0.5).moveTo(margin, doc.y).lineTo(pageWidth - margin, doc.y).stroke();
          doc.y += 8;
        }

        const rowStartY = doc.y;

        if (matches.length === 0) {
          // Bloque sin citas: estilo limpio, sutil y ordenado
          doc.roundedRect(margin, rowStartY, 42, 13, 2.5).fill('#f8fafc');
          doc.fillColor('#94a3b8').font('Helvetica-Bold').fontSize(7.5)
            .text(slot.label, margin, rowStartY + 2.5, { width: 42, align: 'center' });

          doc.fillColor('#94a3b8').font('Helvetica').fontSize(8)
            .text(' -   ....   (Disponible)', margin + 48, rowStartY + 2.5, { width: contentWidth - 48 });

          doc.y = rowStartY + 16;
          doc.strokeColor('#f1f5f9').lineWidth(0.4)
            .moveTo(margin, doc.y)
            .lineTo(pageWidth - margin, doc.y)
            .stroke();
          doc.y += 2;
        } else {
          // Bloque con una o más citas (iniciando en o cruzando por este bloque)
          const cardX = margin + 48;
          const cardWidth = contentWidth - 48;

          matches.forEach((m, mIdx) => {
            const { s } = this._getAppointmentRange(m, validDuration);
            const isContinuation = s < slot.label;

            const idStr = this.stripEmojis(this.getPatientCustomId(m));
            const patName = this.stripEmojis(this.getPatientName(m));
            const phoneStr = this.stripEmojis(this.getPatientPhone(m));
            const timeRange = `Horario Cita (${formatTimeSlot(m.start_time)} - ${formatTimeSlot(m.end_time)})`;
            const statusText = m.status_name ? m.status_name.charAt(0).toUpperCase() + m.status_name.slice(1) : '';

            const extraParts = [];
            if (isContinuation) {
              extraParts.push(`(En curso · Inició ${formatTimeSlot(m.start_time)})`);
            }
            if (m.treatment_name || m.reason) {
              extraParts.push(`Tratamiento: ${this.stripEmojis(m.treatment_name || m.reason)}`);
            }
            if (m.gabinete) {
              extraParts.push(`Gabinete: ${this.stripEmojis(m.gabinete)}`);
            }
            const extraDetails = extraParts.join(' · ');

            const cardHeight = extraDetails ? 26 : 18;

            // Salto de página individual si la tarjeta se sale del límite
            if (doc.y + cardHeight > doc.page.height - 40) {
              doc.addPage();
              doc.y = 36;
              doc.fillColor(COLORS.textSecondary).font('Helvetica-Bold').fontSize(8)
                .text(`Dr/a. ${this.stripEmojis(doctor.name)} — Agenda del Día (Continuación) · ${dateLabel}`, margin, doc.y);
              doc.y += 14;
              doc.strokeColor(COLORS.border).lineWidth(0.5).moveTo(margin, doc.y).lineTo(pageWidth - margin, doc.y).stroke();
              doc.y += 8;
            }

            const itemY = doc.y;

            // Badge de horario (solo en el primer ítem del slot)
            if (mIdx === 0) {
              doc.roundedRect(margin, itemY, 42, 15, 3).fillAndStroke('#eff6ff', '#bfdbfe');
              doc.fillColor('#1d4ed8').font('Helvetica-Bold').fontSize(8)
                .text(slot.label, margin, itemY + 3.5, { width: 42, align: 'center' });
            } else {
              doc.fillColor('#94a3b8').font('Helvetica-Bold').fontSize(9)
                .text('·', margin, itemY + 2, { width: 42, align: 'center' });
            }

            // Tarjeta visual elegante de la cita
            const bgCard = isContinuation ? '#fefce8' : '#f8fafc';
            const borderCard = isContinuation ? '#fef08a' : '#e2e8f0';
            doc.roundedRect(cardX, itemY, cardWidth, cardHeight, 3).fillAndStroke(bgCard, borderCard);

            // Barra lateral indicadora de estado
            const accentColor = isContinuation
              ? '#f59e0b'
              : (m.status_name === 'confirmada' ? '#10b981' : (m.status_name === 'en_consulta' ? '#2563eb' : '#0284c7'));
            doc.roundedRect(cardX, itemY, 3.5, cardHeight, 1.5).fill(accentColor);

            // Texto Línea 1 (Información principal de la cita)
            const textX = cardX + 8;
            const textY = itemY + 3.5;

            doc.fillColor('#0284c7').font('Helvetica-Bold').fontSize(8)
              .text(`ID [${idStr}]`, textX, textY, { continued: true });
            doc.fillColor('#94a3b8').font('Helvetica').fontSize(8)
              .text('  -  ', { continued: true });
            doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(8.5)
              .text(patName, { continued: true });
            doc.fillColor('#94a3b8').font('Helvetica').fontSize(8)
              .text('  -  ', { continued: true });
            doc.fillColor('#475569').font('Helvetica').fontSize(8)
              .text(phoneStr ? `Tel: ${phoneStr}` : 'Sin tel.', { continued: true });
            doc.fillColor('#94a3b8').font('Helvetica').fontSize(8)
              .text('  -  ', { continued: true });
            doc.fillColor(isContinuation ? '#b45309' : '#0369a1').font('Helvetica-Bold').fontSize(8)
              .text(timeRange, { continued: statusText ? true : false });
            if (statusText) {
              doc.fillColor(accentColor).font('Helvetica').fontSize(7.5)
                .text(`  [${statusText}]`);
            }

            // Texto Línea 2 (Tratamiento, Gabinete, Nota de continuación)
            if (extraDetails) {
              doc.fillColor(isContinuation ? '#92400e' : '#64748b').font('Helvetica-Oblique').fontSize(7.2)
                .text(extraDetails, textX, itemY + 14, { width: cardWidth - 14, lineBreak: false });
            }

            doc.y = itemY + cardHeight + 3;
          });

          // Línea divisoria al final del bloque
          doc.y += 1;
          doc.strokeColor('#e2e8f0').lineWidth(0.4)
            .moveTo(margin, doc.y)
            .lineTo(pageWidth - margin, doc.y)
            .stroke();
          doc.y += 3;
        }
      });
    });

    this.drawFooterAndPages(doc, clinic, `${clinic.name} · Agenda Operativa del Día.`);
    doc.end();

    const buffer = await bufferPromise;
    const filename = `Agenda_Dia_${printDate}.pdf`;
    return { buffer, filename, documentNumber: 'AGE-DIA' };
  }

  /**
   * Genera el documento PDF oficial de la Agenda Semanal en formato Horizontal.
   */
  async _generateWeeklyAgendaPDF({ clinic, printDate, validDuration, doctorId }) {
    const baseDate = new Date(printDate + 'T12:00:00');
    const dayOfWeek = baseDate.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(baseDate);
    monday.setDate(baseDate.getDate() + diffToMonday);

    const saturday = new Date(monday);
    saturday.setDate(monday.getDate() + 5);

    const startDateStr = monday.toISOString().slice(0, 10);
    const endDateStr = saturday.toISOString().slice(0, 10);

    const appointmentsResult = await appointmentRepository.findAllWithDetails({
      limit: 9999,
      sortBy: 'a.start_time',
      sortOrder: 'ASC',
      filters: {
        date_from: startDateStr,
        date_to: endDateStr,
        doctor_id: doctorId || undefined,
        exclude_cancelled: true,
      },
    });
    const appointments = appointmentsResult.rows || [];

    const doctorsResult = await doctorRepository.findAllWithUsers({ limit: 500 });
    const allDoctors = doctorsResult.rows || [];
    const activeDoctors = allDoctors.filter(d => d.is_active);

    const apptsByDoctor = {};
    appointments.forEach(a => {
      const docKey = a.doctor_id || 0;
      if (!apptsByDoctor[docKey]) apptsByDoctor[docKey] = [];
      apptsByDoctor[docKey].push(a);
    });

    const doctorsToShow = activeDoctors.filter(d => {
      if (doctorId && Number(d.id) !== Number(doctorId)) return false;
      return (apptsByDoctor[d.id] || []).length > 0 || (doctorId && Number(d.id) === Number(doctorId));
    });

    if (doctorsToShow.length === 0 && activeDoctors.length > 0 && !doctorId) {
      doctorsToShow.push(activeDoctors[0]);
    }

    const weekDays = [];
    const dayNamesShort = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    for (let i = 0; i < 6; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      weekDays.push({
        dateStr: d.toISOString().slice(0, 10),
        label: `${dayNamesShort[i]} ${d.getDate()}/${d.getMonth() + 1}`,
      });
    }

    const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape', bufferPages: true });
    const bufferPromise = this.streamToBuffer(doc);
    const margin = 30;
    const pageWidth = doc.page.width;
    const contentWidth = pageWidth - margin * 2;

    const slots = [];
    for (let m = 540; m < 1200; m += validDuration) {
      const hStr = String(Math.floor(m / 60)).padStart(2, '0');
      const mStr = String(m % 60).padStart(2, '0');
      const nextM = m + validDuration;
      const nextHStr = String(Math.floor(nextM / 60)).padStart(2, '0');
      const nextMStr = String(nextM % 60).padStart(2, '0');
      slots.push({
        label: `${hStr}:${mStr}`,
        startMin: m,
        endMin: nextM,
        nextLabel: `${nextHStr}:${nextMStr}`,
      });
    }

    const weekTitle = `Semana: ${startDateStr} al ${endDateStr}`;

    doctorsToShow.forEach((doctor, dIdx) => {
      if (dIdx > 0) doc.addPage();

      this.drawHeader(doc, clinic, 'Agenda Semanal', weekTitle, 'SEMANAL', COLORS.primary);

      const docAppts = apptsByDoctor[doctor.id] || [];
      const apptsByDate = {};
      docAppts.forEach(a => {
        const dStr = String(a.appointment_date).slice(0, 10);
        if (!apptsByDate[dStr]) apptsByDate[dStr] = [];
        apptsByDate[dStr].push(a);
      });

      // Encabezado de la tabla semanal
      const timeColWidth = 45;
      const dayColWidth = (contentWidth - timeColWidth) / 6;

      const theadY = doc.y + 4;
      doc.rect(margin, theadY, contentWidth, 20).fill(COLORS.primary);

      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8.5)
        .text('Hora', margin + 4, theadY + 5, { width: timeColWidth - 8, align: 'center' });

      weekDays.forEach((wd, wIdx) => {
        doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8.5)
          .text(wd.label, margin + timeColWidth + wIdx * dayColWidth, theadY + 5, {
            width: dayColWidth,
            align: 'center',
          });
      });

      doc.y = theadY + 22;

      slots.forEach(slot => {
        if (doc.y > doc.page.height - 40) {
          doc.addPage();
          doc.y = 35;
        }

        const rowY = doc.y;
        doc.fillColor(COLORS.primaryDark).font('Helvetica-Bold').fontSize(7.5)
          .text(slot.label, margin, rowY + 3, { width: timeColWidth, align: 'center' });

        let maxHeightInRow = 14;

        weekDays.forEach((wd, wIdx) => {
          const dayList = apptsByDate[wd.dateStr] || [];
          const matches = dayList.filter(a => {
            const { s, e } = this._getAppointmentRange(a, validDuration);
            return s < slot.nextLabel && e > slot.label;
          });

          const colX = margin + timeColWidth + wIdx * dayColWidth + 2;
          const colW = dayColWidth - 4;

          if (matches.length > 0) {
            let currentItemY = rowY + 2;
            matches.forEach(m => {
              const id = this.stripEmojis(this.getPatientCustomId(m));
              const name = this.stripEmojis(this.getPatientName(m));
              const time = `${(m.start_time || '').substring(0, 5)}-${(m.end_time || '').substring(0, 5)}`;
              const { s } = this._getAppointmentRange(m, validDuration);
              const isContinuation = s < slot.label;
              const text = `[${id}] ${name} (${time})${isContinuation ? ' *' : ''}`;

              doc.fillColor(isContinuation ? '#b45309' : COLORS.text)
                .font(isContinuation ? 'Helvetica-Oblique' : 'Helvetica')
                .fontSize(6.5)
                .text(text, colX, currentItemY, { width: colW });
              currentItemY += 9;
            });
            const cellHeight = matches.length * 9 + 4;
            if (cellHeight > maxHeightInRow) maxHeightInRow = cellHeight;
          } else {
            doc.fillColor(COLORS.textMuted).font('Helvetica').fontSize(6.5)
              .text('—', colX, rowY + 3, { width: colW, align: 'center' });
          }
        });

        doc.y = rowY + maxHeightInRow;
        doc.strokeColor(COLORS.border).lineWidth(0.4)
          .moveTo(margin, doc.y)
          .lineTo(pageWidth - margin, doc.y)
          .stroke();
        doc.y += 2;
      });
    });

    this.drawFooterAndPages(doc, clinic, `${clinic.name} · Agenda Semanal Consolidada.`);
    doc.end();

    const buffer = await bufferPromise;
    const filename = `Agenda_Semanal_${startDateStr}_${endDateStr}.pdf`;
    return { buffer, filename, documentNumber: 'AGE-SEM' };
  }

  /**
   * Router maestro para generación de PDF de cualquier tipo de reporte.
   */
  async generateReportPDF(type, startDate, endDate) {
    if (type === 'facturas_recibos') {
      return this.generateInvoiceReceiptSummaryPDF({ startDate, endDate });
    } else if (type === 'ingresos') {
      return this.generateRevenueReportPDF({ startDate, endDate });
    } else if (type === 'citas') {
      return this.generateAppointmentsReportPDF({ startDate, endDate });
    } else if (type === 'tratamientos') {
      return this.generateTreatmentsReportPDF({ startDate, endDate });
    } else {
      return this.generateInvoiceReceiptSummaryPDF({ startDate, endDate });
    }
  }
}

export default new PDFService();
