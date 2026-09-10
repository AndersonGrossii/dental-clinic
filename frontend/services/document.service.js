// ============================================
// Servicio de Documentos y Radiografías (Frontend)
// ============================================
import api from './api.service.js';

class DocumentService {
  /**
   * Obtiene las imágenes y radiografías de un paciente
   * @param {number|string} patientId
   * @param {object} params - { category, tooth_number }
   */
  async getImages(patientId, params = {}) {
    return await api.get(`/patients/${patientId}/images`, params);
  }

  /**
   * Sube una nueva imagen o radiografía (FormData con campo 'image')
   * @param {number|string} patientId
   * @param {FormData} formData
   */
  async uploadImage(patientId, formData) {
    return await api.post(`/patients/${patientId}/images`, formData);
  }

  /**
   * Elimina una imagen (soft delete)
   * @param {number|string} patientId
   * @param {number|string} imageId
   */
  async deleteImage(patientId, imageId) {
    return await api.delete(`/patients/${patientId}/images/${imageId}`);
  }

  /**
   * Obtiene los documentos clínicos del paciente
   * @param {number|string} patientId
   * @param {object} params - { category, page, limit }
   */
  async getDocuments(patientId, params = {}) {
    const res = await api.get(`/patients/${patientId}/documents`, params, { returnFullResponse: true });
    return {
      rows: res?.data || [],
      total: res?.pagination?.total || (res?.data ? res.data.length : 0),
      pagination: res?.pagination || null,
    };
  }

  /**
   * Sube un nuevo documento clínico (FormData con campo 'document')
   * @param {number|string} patientId
   * @param {FormData} formData
   */
  async uploadDocument(patientId, formData) {
    return await api.post(`/patients/${patientId}/documents`, formData);
  }

  /**
   * Elimina un documento clínico (soft delete)
   * @param {number|string} patientId
   * @param {number|string} docId
   */
  async deleteDocument(patientId, docId) {
    return await api.delete(`/patients/${patientId}/documents/${docId}`);
  }
}

const documentService = new DocumentService();
export default documentService;
