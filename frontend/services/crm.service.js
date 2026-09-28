// ============================================
// Servicio del Dominio CRM (Frontend API Client)
// ============================================
import api from './api.service.js';

class CrmService {
  /**
   * Obtiene las métricas y KPIs del embudo comercial del CRM.
   */
  async getDashboard() {
    const res = await api.get('/crm/dashboard');
    return res?.data || res;
  }

  /**
   * Obtiene la lista de leads con filtros y paginación.
   */
  async getLeads(params = {}) {
    const res = await api.get('/crm/leads', params, { returnFullResponse: true });
    if (res && res.pagination) {
      return {
        rows: res.data || [],
        total: res.pagination.total ?? (res.data ? res.data.length : 0),
        page: res.pagination.page || 1,
        limit: res.pagination.limit || 20,
      };
    }
    if (Array.isArray(res)) {
      return { rows: res, total: res.length };
    }
    if (res && Array.isArray(res.data)) {
      return { rows: res.data, total: res.pagination?.total ?? res.data.length };
    }
    return res || { rows: [], total: 0 };
  }

  /**
   * Obtiene el detalle consolidado de un lead por ID.
   */
  async getLeadById(id) {
    const res = await api.get(`/crm/leads/${id}`);
    return res?.data || res;
  }

  /**
   * Verifica si existe un paciente, contacto o lead activo con el teléfono o correo especificados.
   */
  async checkDuplicate(params = {}) {
    const res = await api.get('/crm/leads/check-duplicate', params);
    return res?.data || res;
  }

  /**
   * Crea un nuevo lead comercial.
   */
  async createLead(data) {
    const res = await api.post('/crm/leads', data);
    return res?.data || res;
  }

  /**
   * Actualiza el estado de un lead en el embudo.
   */
  async updateLeadStatus(id, status, lossReason = null) {
    const res = await api.patch(`/crm/leads/${id}/status`, {
      status,
      loss_reason: lossReason,
    });
    return res?.data || res;
  }

  /**
   * Convierte un lead en paciente clínico o lo vincula a uno existente.
   */
  async convertToPatient(id, data) {
    const res = await api.post(`/crm/leads/${id}/convert-to-patient`, data);
    return res?.data || res;
  }

  /**
   * Obtiene las oportunidades comerciales.
   */
  async getOpportunities(params = {}) {
    const res = await api.get('/crm/opportunities', params, { returnFullResponse: true });
    if (res && res.pagination) {
      return {
        rows: res.data || [],
        total: res.pagination.total ?? (res.data ? res.data.length : 0),
        page: res.pagination.page || 1,
        limit: res.pagination.limit || 20,
      };
    }
    if (Array.isArray(res)) {
      return { rows: res, total: res.length };
    }
    if (res && Array.isArray(res.data)) {
      return { rows: res.data, total: res.pagination?.total ?? res.data.length };
    }
    return res || { rows: [], total: 0 };
  }

  /**
   * Crea una nueva oportunidad comercial.
   */
  async createOpportunity(data) {
    const res = await api.post('/crm/opportunities', data);
    return res?.data || res;
  }

  /**
   * Actualiza el estado de una oportunidad comercial.
   */
  async updateOpportunityStatus(id, status, lossReason = null) {
    const res = await api.patch(`/crm/opportunities/${id}/status`, {
      status,
      loss_reason: lossReason,
    });
    return res?.data || res;
  }

  /**
   * Agrega una nota comercial de CRM.
   */
  async addNote(data) {
    const res = await api.post('/crm/notes', data);
    return res?.data || res;
  }

  /**
   * Obtiene el contexto CRM de un contacto de mensajería.
   */
  async getContactContext(contactId) {
    const res = await api.get(`/crm/contacts/${contactId}/context`);
    return res?.data || res;
  }
}

const crmService = new CrmService();
export default crmService;
