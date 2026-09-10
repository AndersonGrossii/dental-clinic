// ============================================
// Servicio Frontend de Descarga de PDFs
// ============================================
import state from '../scripts/state.js';
import toast from '../components/toast/toast.js';

class PDFDownloadService {
  constructor() {
    this.baseUrl = '/api/v1/pdf';
  }

  /**
   * Descarga un archivo PDF binario mediante fetch autenticado.
   * @param {string} endpoint - Sub-ruta de la API (ej: /invoices/1)
   * @param {string} fallbackFilename - Nombre por defecto para guardar el archivo
   */
  async download(endpoint, fallbackFilename = 'documento.pdf') {
    const token = state.get('token');
    const activeClinicId = state.get('activeClinicId');

    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (activeClinicId) {
      headers['X-Clinic-Id'] = activeClinicId;
    }

    try {
      toast.info('Generando documento PDF...');
      const separator = endpoint.includes('?') ? '&' : '?';
      const url = `${this.baseUrl}${endpoint}${separator}download=true`;

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
          // Si no es JSON, conservar mensaje general
        }
        throw new Error(errMsg);
      }

      // Extraer nombre del encabezado Content-Disposition si está disponible
      let filename = fallbackFilename;
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

      // Limpiar URL de memoria
      setTimeout(() => {
        window.URL.revokeObjectURL(blobUrl);
      }, 2000);

      toast.success(`Descarga completada: ${filename}`);
      return true;
    } catch (err) {
      console.error('Error al descargar PDF:', err);
      toast.error(err.message || 'No se pudo descargar el PDF.');
      return false;
    }
  }

  /**
   * Abre el PDF en una pestaña nueva del navegador para visualización previa.
   */
  async openInNewTab(endpoint) {
    const token = state.get('token');
    const activeClinicId = state.get('activeClinicId');

    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (activeClinicId) {
      headers['X-Clinic-Id'] = activeClinicId;
    }

    try {
      const url = `${this.baseUrl}${endpoint}`;
      const response = await fetch(url, { method: 'GET', headers });
      if (!response.ok) throw new Error('Error al generar vista previa');

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
      return true;
    } catch (err) {
      toast.error(err.message || 'No se pudo previsualizar el PDF.');
      return false;
    }
  }

  // Métodos específicos
  async downloadInvoice(invoiceId, invoiceNumber = '') {
    const safeNum = invoiceNumber ? `_${invoiceNumber}` : '';
    return this.download(`/invoices/${invoiceId}`, `Factura${safeNum}.pdf`);
  }

  async downloadReceipt(receiptId, receiptNumber = '') {
    const safeNum = receiptNumber ? `_${receiptNumber}` : '';
    return this.download(`/receipts/${receiptId}`, `Recibo${safeNum}.pdf`);
  }

  async downloadQuotation(quotationId, quoteNumber = '') {
    const safeNum = quoteNumber ? `_${quoteNumber}` : '';
    return this.download(`/quotations/${quotationId}`, `Presupuesto${safeNum}.pdf`);
  }

  async downloadPrescription(prescriptionId, prescNumber = '') {
    const safeNum = prescNumber ? `_${prescNumber}` : '';
    return this.download(`/prescriptions/${prescriptionId}`, `Receta${safeNum}.pdf`);
  }
}

const pdfService = new PDFDownloadService();
export default pdfService;
