// ============================================
// Repositorio de Actividades de CRM (Audit Timeline)
// ============================================
import { BaseRepository } from './base.repository.js';
import { query } from '../database/pool.js';

export class CrmActivityRepository extends BaseRepository {
  constructor() {
    super('crm_activities');
  }

  /**
   * Registra una actividad en la línea de tiempo del CRM.
   */
  async logActivity({
    clinicId,
    contactId = null,
    leadId = null,
    opportunityId = null,
    userId = null,
    activityType,
    title,
    description = null,
    actorType = 'human',
    metadata = null,
  }) {
    const activeClinicId = clinicId || this.getClinicId();
    const sql = `
      INSERT INTO crm_activities (
        clinic_id, contact_id, lead_id, opportunity_id, user_id, activity_type, title, description, actor_type, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;
    const res = await query(sql, [
      activeClinicId,
      contactId,
      leadId,
      opportunityId,
      userId,
      activityType,
      title,
      description,
      actorType,
      metadata ? JSON.stringify(metadata) : null,
    ]);
    return res.rows[0];
  }

  /**
   * Obtiene la línea de tiempo de actividades de un lead.
   */
  async findByLeadId(leadId, clinicId = null) {
    const activeClinicId = clinicId || this.getClinicId();
    let sql = `
      SELECT 
        a.*,
        u.first_name AS user_first_name,
        u.last_name AS user_last_name
      FROM crm_activities a
      LEFT JOIN users u ON u.id = a.user_id
      WHERE a.lead_id = $1
    `;
    const params = [leadId];

    if (activeClinicId) {
      sql += ` AND a.clinic_id = $2`;
      params.push(activeClinicId);
    }

    sql += ` ORDER BY a.created_at DESC`;
    const res = await query(sql, params);
    return res.rows;
  }

  /**
   * Obtiene la línea de tiempo de actividades de un contacto.
   */
  async findByContactId(contactId, clinicId = null) {
    const activeClinicId = clinicId || this.getClinicId();
    let sql = `
      SELECT 
        a.*,
        u.first_name AS user_first_name,
        u.last_name AS user_last_name
      FROM crm_activities a
      LEFT JOIN users u ON u.id = a.user_id
      WHERE a.contact_id = $1
    `;
    const params = [contactId];

    if (activeClinicId) {
      sql += ` AND a.clinic_id = $2`;
      params.push(activeClinicId);
    }

    sql += ` ORDER BY a.created_at DESC`;
    const res = await query(sql, params);
    return res.rows;
  }

  /**
   * Obtiene las actividades recientes de la clínica para el dashboard.
   */
  async findRecent(limit = 15, clinicId = null) {
    const activeClinicId = clinicId || this.getClinicId();
    let sql = `
      SELECT 
        a.*,
        u.first_name AS user_first_name,
        u.last_name AS user_last_name,
        mc.name AS contact_name,
        mc.phone AS contact_phone
      FROM crm_activities a
      LEFT JOIN users u ON u.id = a.user_id
      LEFT JOIN messaging_contacts mc ON mc.id = a.contact_id
    `;
    const params = [];

    if (activeClinicId) {
      sql += ` WHERE a.clinic_id = $1`;
      params.push(activeClinicId);
    }

    sql += ` ORDER BY a.created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const res = await query(sql, params);
    return res.rows;
  }
}

export default new CrmActivityRepository();
