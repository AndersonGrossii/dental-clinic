// ============================================
// Controlador de Reportes
// ============================================
import reportService from '../services/report.service.js';
import csvService from '../services/csv.service.js';
import pdfService from '../services/pdf.service.js';
import { ApiResponse } from '../utils/response.js';

export const getRevenueReport = async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;
    const report = await reportService.getRevenueReport(start_date, end_date);
    return ApiResponse.success(res, report, 'Reporte de ingresos obtenido');
  } catch (error) {
    next(error);
  }
};

export const getAppointmentReport = async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;
    const report = await reportService.getAppointmentReport(start_date, end_date);
    return ApiResponse.success(res, report, 'Reporte de citas obtenido');
  } catch (error) {
    next(error);
  }
};

export const getPatientReport = async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;
    const report = await reportService.getPatientReport(start_date, end_date);
    return ApiResponse.success(res, report, 'Reporte de pacientes obtenido');
  } catch (error) {
    next(error);
  }
};

export const getTreatmentReport = async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;
    const report = await reportService.getTreatmentReport(start_date, end_date);
    return ApiResponse.success(res, report, 'Reporte de tratamientos obtenido');
  } catch (error) {
    next(error);
  }
};

export const getDashboardStats = async (req, res, next) => {
  try {
    const { roleName, id } = req.user;
    const stats = await reportService.getDashboardStats(roleName, id);
    return ApiResponse.success(res, stats, 'Estadísticas del dashboard obtenidas');
  } catch (error) {
    next(error);
  }
};

export const getInvoiceReceiptSummaryReport = async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;
    const report = await reportService.getInvoiceReceiptSummaryReport(start_date, end_date);
    return ApiResponse.success(res, report, 'Resumen de facturas y recibos obtenido exitosamente');
  } catch (error) {
    next(error);
  }
};

/**
 * Exporta el reporte seleccionado en formato PDF de alta definición y diseño ejecutivo.
 */
export const exportPdf = async (req, res, next) => {
  try {
    const { type } = req.params;
    const { start_date, end_date } = req.query;

    const result = await pdfService.generateReportPDF(type, start_date, end_date);
    const isAttachment = req.query.inline !== 'true';
    const disposition = isAttachment ? 'attachment' : 'inline';

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `${disposition}; filename="${result.filename}"`);
    res.setHeader('Content-Length', result.buffer.length);
    return res.send(result.buffer);
  } catch (error) {
    next(error);
  }
};

export const exportCsv = async (req, res, next) => {
  try {
    const { type } = req.params;
    const { start_date, end_date, format } = req.query;

    // Si el usuario prefiere PDF o no se especifica explícitamente format=csv para facturas y recibos
    if (format === 'pdf' || (!format && type === 'facturas_recibos')) {
      return exportPdf(req, res, next);
    }
    
    let csvString = '';
    let filename = `reporte-${type}-${new Date().toISOString().split('T')[0]}.csv`;

    if (type === 'ingresos') {
      const data = await reportService.getRevenueReport(start_date, end_date);
      csvString = csvService.generateCsv(
        ['Fecha', 'Monto de Ingreso'],
        data.daily
      );
    } else if (type === 'citas') {
      const data = await reportService.getAppointmentReport(start_date, end_date);
      csvString = csvService.generateCsv(
        ['Doctor', 'Cantidad de Citas'],
        data.byDoctor
      );
    } else if (type === 'tratamientos') {
      const data = await reportService.getTreatmentReport(start_date, end_date);
      csvString = csvService.generateCsv(
        ['Tratamiento', 'Cantidad', 'Ingresos Totales'],
        data.popular.map(r => ({
          treatment: r.treatment,
          count: r.count,
          total: r.total
        }))
      );
    } else if (type === 'facturas_recibos') {
      const data = await reportService.getInvoiceReceiptSummaryReport(start_date, end_date);
      const rows = [
        ...data.invoices.map(inv => ({
          tipo: 'Factura',
          fecha: inv.date,
          numero: inv.invoice_number,
          cliente: inv.customer_name,
          identificacion: inv.patient_identification,
          importe: inv.amount.toFixed(2),
          metodo_pago: inv.payment_method,
        })),
        ...data.receipts.map(rec => ({
          tipo: 'Recibo',
          fecha: rec.date,
          numero: rec.receipt_number,
          cliente: rec.customer_name,
          identificacion: rec.patient_identification,
          importe: rec.amount.toFixed(2),
          metodo_pago: rec.payment_method,
        })),
      ];
      csvString = csvService.generateCsv(
        ['Tipo Documento', 'Fecha', 'Número Documento', 'Cliente', 'DNI / NIE / Pasaporte', 'Importe', 'Método de Pago'],
        rows
      );
    } else {
      return ApiResponse.error(res, 'Tipo de reporte inválido para exportación', 400);
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(csvString);
  } catch (error) {
    next(error);
  }
};
