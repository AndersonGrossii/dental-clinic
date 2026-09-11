// ============================================
// Controlador de Generación y Descarga de PDFs
// ============================================
import pdfService from '../services/pdf.service.js';

/**
 * Envía el buffer PDF como respuesta HTTP con las cabeceras binarias adecuadas.
 */
const sendPdfResponse = (res, req, { buffer, filename }) => {
  const isAttachment = req.query.download === 'true' || req.query.disposition === 'attachment';
  const disposition = isAttachment ? 'attachment' : 'inline';

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${disposition}; filename="${filename}"`);
  res.setHeader('Content-Length', buffer.length);
  return res.send(buffer);
};

/**
 * GET /api/v1/pdf/invoices/:id
 * Genera y descarga el PDF de una factura oficial o recibo.
 */
export const getInvoicePDF = async (req, res, next) => {
  try {
    const result = await pdfService.generateInvoicePDF(req.params.id);
    return sendPdfResponse(res, req, result);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/pdf/receipts/:id
 * Genera y descarga el PDF de un recibo de pago provisional.
 */
export const getReceiptPDF = async (req, res, next) => {
  try {
    const result = await pdfService.generateReceiptPDF(req.params.id);
    return sendPdfResponse(res, req, result);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/pdf/quotations/:id
 * Genera y descarga el PDF de un presupuesto odontológico.
 */
export const getQuotationPDF = async (req, res, next) => {
  try {
    const result = await pdfService.generateQuotationPDF(req.params.id);
    return sendPdfResponse(res, req, result);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/pdf/prescriptions/:id
 * Genera y descarga el PDF de una receta médica oficial.
 */
export const getPrescriptionPDF = async (req, res, next) => {
  try {
    const result = await pdfService.generatePrescriptionPDF(req.params.id);
    return sendPdfResponse(res, req, result);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/pdf/reports/:type
 * Genera y descarga el PDF de un reporte consolidado.
 */
export const getReportPDF = async (req, res, next) => {
  try {
    const { type } = req.params;
    const { start_date, end_date } = req.query;
    const result = await pdfService.generateReportPDF(type, start_date, end_date);
    return sendPdfResponse(res, req, result);
  } catch (error) {
    next(error);
  }
};
