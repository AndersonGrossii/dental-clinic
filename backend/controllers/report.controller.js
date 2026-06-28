// ============================================
// Controlador de Reportes
// ============================================
import reportService from '../services/report.service.js';
import csvService from '../services/csv.service.js';
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

export const exportCsv = async (req, res, next) => {
  try {
    const { type } = req.params;
    const { start_date, end_date } = req.query;
    
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
