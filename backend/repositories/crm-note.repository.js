// ============================================
// Repositorio de Notas Comerciales del CRM
// ============================================
import { BaseRepository } from './base.repository.js';
import { query } from '../database/pool.js';

export class CrmNoteRepository extends BaseRepository {
  constructor() {
    super('crm_notes');
  }

  /**
   * Crea una nota comercial de CRM.
   */
  async createNote({
    clinicId,
    contactId,
    leadId = null,
    opportunityId = null,
    authorId,
    note,
  }) {
    const activeClinicId = clinicId || this.getClinicId();
    const sql = `
      INSERT INTO crm_notes (
        clinic_id, contact_id, lead_id, opportunity_id, author_id, note
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const res = await query(sql, [
      activeClinicId,
      contactId,
      leadId,
      opportunityId,
      authorId,
      note,
    ]);
    return res.rows[0];
  }

  /**
   * Lista las notas vinculadas a un lead.
   */
  async findByLeadId(leadId, clinicId = null) {
    const activeClinicId = clinicId || this.getClinicId();
    let sql = `
      SELECT 
        n.*,
        u.first_name AS author_first_name,
        u.last_name AS author_last_name
      FROM crm_notes n
      JOIN users u ON u.id = n.author_id
      WHERE n.lead_id = $1 AND n.deleted_at IS NULL
    `;
    const params = [leadId];

    if (activeClinicId) {
      sql += ` AND n.clinic_id = $2`;
      params.push(activeClinicId);
    }

    sql += ` ORDER BY n.created_at DESC`;
    const res = await query(sql, params);
    return res.rows;
  }

  /**
   * Lista todas las notas asociadas a un contacto.
   */
  async findByContactId(contactId, clinicId = null) {
    const activeClinicId = clinicId || this.getClinicId();
    let sql = `
      SELECT 
        n.*,
        u.first_name AS author_first_name,
        u.last_name AS author_last_name
      FROM crm_notes n
      JOIN users u ON u.id = n.author_id
      WHERE n.contact_id = $1 AND n.deleted_at IS NULL
    `;
    const params = [contactId];

    if (activeClinicId) {
      sql += ` AND n.clinic_id = $2`;
      params.push(activeClinicId);
    }

    sql += ` ORDER BY n.created_at DESC`;
    const res = await query(sql, params);
    return res.rows;
  }
}

export default new CrmNoteRepository();
