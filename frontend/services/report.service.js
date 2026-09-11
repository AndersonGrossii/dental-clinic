// ============================================
// Servicio de Reportes
// ============================================
import api from './api.service.js';
import state from '../scripts/state.js';
import toast from '../components/toast/toast.js';

class ReportService {
  async getDashboard() {
    return await api.get('/reports/dashboard');
  }

  async getRevenue(startDate, endDate) {
    return await api.get('/reports/revenue', { start_date: startDate, end_date: endDate });
  }

  async getAppointments(startDate, endDate) {
    return await api.get('/reports/appointments', { start_date: startDate, end_date: endDate });
  }

  async getPatients(startDate, endDate) {
    return await api.get('/reports/patients', { start_date: startDate, end_date: endDate });
  }

  async getTreatments(startDate, endDate) {
    return await api.get('/reports/treatments', { start_date: startDate, end_date: endDate });
  }

  async getInvoiceReceiptSummary(startDate, endDate) {
    return await api.get('/reports/invoices-receipts-summary', { start_date: startDate, end_date: endDate });
  }

  /**
   * Descarga el reporte en formato PDF de alta definición mediante fetch autenticado.
   */
  async exportPdf(type, startDate, endDate) {
    const token = state.get('token') || localStorage.getItem('token');
    const activeClinicId = state.get('activeClinicId');

    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (activeClinicId) {
      headers['X-Clinic-Id'] = activeClinicId;
    }

    try {
      toast.info('Generando reporte en PDF...');
      const queryParams = new URLSearchParams();
      if (startDate) queryParams.set('start_date', startDate);
      if (endDate) queryParams.set('end_date', endDate);

      const url = `/api/v1/reports/export/pdf/${type}?${queryParams.toString()}`;

      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        let errMsg = 'Error al generar el archivo PDF';
        try {
          const errJson = await response.json();
          if (errJson.message) errMsg = errJson.message;
        } catch {
          // Mantener mensaje genérico
        }
        throw new Error(errMsg);
      }

      let filename = `Reporte_${type}_${startDate || ''}_${endDate || ''}.pdf`;
      const disposition = response.headers.get('Content-Disposition');
      if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename="?([^";]+)"?/);
        if (match && match[1]) {
          filename = match[1].trim();
        }
      }

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();

      setTimeout(() => {
        window.URL.revokeObjectURL(blobUrl);
      }, 2000);

      toast.success(`Descarga completada: ${filename}`);
      return true;
    } catch (err) {
      console.error('Error al exportar PDF:', err);
      toast.error(err.message || 'No se pudo descargar el reporte PDF.');
      return false;
    }
  }

  async exportCsv(type, startDate, endDate) {
    // Redirigir a generación de PDF de alta calidad según preferencia del usuario
    return this.exportPdf(type, startDate, endDate);
  }
}

const reportService = new ReportService();
export default reportService;
