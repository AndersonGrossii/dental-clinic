// ============================================
// Repositorio de Oportunidades Comerciales del CRM
// ============================================
import { BaseRepository } from './base.repository.js';
import { query } from '../database/pool.js';

export class CrmOpportunityRepository extends BaseRepository {
  constructor() {
    super('crm_opportunities');
  }

  /**
   * Obtiene una oportunidad por ID con detalles.
   */
  async findByIdWithDetails(id, clinicId = null) {
    const activeClinicId = clinicId || this.getClinicId();
    let sql = `
      SELECT 
        o.*,
        mc.phone AS contact_phone,
        mc.name AS contact_name,
        mc.email AS contact_email,
        l.source AS lead_source,
        l.status AS lead_status,
        p.first_name AS patient_first_name,
        p.last_name AS patient_last_name,
        p.custom_id AS patient_custom_id,
        u.first_name AS assigned_user_first_name,
        u.last_name AS assigned_user_last_name,
        (SELECT COUNT(*)::int FROM crm_notes WHERE opportunity_id = o.id AND deleted_at IS NULL) AS notes_count
      FROM crm_opportunities o
      JOIN messaging_contacts mc ON mc.id = o.contact_id
      LEFT JOIN crm_leads l ON l.id = o.lead_id
      LEFT JOIN patients p ON p.id = o.patient_id
      LEFT JOIN users u ON u.id = o.assigned_user_id
      WHERE o.id = $1 AND o.deleted_at IS NULL
    `;
    const params = [id];

    if (activeClinicId) {
      sql += ` AND o.clinic_id = $2`;
      params.push(activeClinicId);
    }

    const res = await query(sql, params);
    return res.rows[0] || null;
  }

  /**
   * Lista oportunidades con filtros y paginación.
   */
  async findAllWithDetails({
    clinicId = null,
    status = null,
    leadId = null,
    contactId = null,
    patientId = null,
    search = '',
    limit = 20,
    offset = 0,
    sortBy = 'o.created_at',
    sortOrder = 'DESC',
  } = {}) {
    const activeClinicId = clinicId || this.getClinicId();
    const whereConditions = ['o.deleted_at IS NULL'];
    const params = [];
    let paramIndex = 1;

    if (activeClinicId) {
      whereConditions.push(`o.clinic_id = $${paramIndex++}`);
      params.push(activeClinicId);
    }

    if (status) {
      whereConditions.push(`o.status = $${paramIndex++}`);
      params.push(status);
    }

    if (leadId) {
      whereConditions.push(`o.lead_id = $${paramIndex++}`);
      params.push(leadId);
    }

    if (contactId) {
      whereConditions.push(`o.contact_id = $${paramIndex++}`);
      params.push(contactId);
    }

    if (patientId) {
      whereConditions.push(`o.patient_id = $${paramIndex++}`);
      params.push(patientId);
    }

    if (search && search.trim()) {
      const cleanSearch = `%${search.trim()}%`;
      whereConditions.push(`(
        o.name ILIKE $${paramIndex} OR 
        o.service_interest ILIKE $${paramIndex} OR 
        mc.name ILIKE $${paramIndex} OR 
        mc.phone ILIKE $${paramIndex}
      )`);
      params.push(cleanSearch);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM crm_opportunities o
      JOIN messaging_contacts mc ON mc.id = o.contact_id
      ${whereClause}
    `;
    const countRes = await query(countSql, params);
    const total = countRes.rows[0]?.total || 0;

    const allowedSortColumns = ['o.created_at', 'o.status', 'o.estimated_value', 'o.name'];
    const safeSortBy = allowedSortColumns.includes(sortBy) ? sortBy : 'o.created_at';
    const safeOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const rowsSql = `
      SELECT 
        o.*,
        mc.phone AS contact_phone,
        mc.name AS contact_name,
        mc.email AS contact_email,
        l.source AS lead_source,
        p.first_name AS patient_first_name,
        p.last_name AS patient_last_name,
        u.first_name AS assigned_user_first_name,
        u.last_name AS assigned_user_last_name
      FROM crm_opportunities o
      JOIN messaging_contacts mc ON mc.id = o.contact_id
      LEFT JOIN crm_leads l ON l.id = o.lead_id
      LEFT JOIN patients p ON p.id = o.patient_id
      LEFT JOIN users u ON u.id = o.assigned_user_id
      ${whereClause}
      ORDER BY ${safeSortBy} ${safeOrder}
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `;
    params.push(limit, offset);

    const rowsRes = await query(rowsSql, params);

    return {
      rows: rowsRes.rows,
      total,
      limit,
      offset,
    };
  }

  /**
   * Crea una nueva oportunidad.
   */
  async createOpportunity({
    clinicId,
    contactId,
    leadId = null,
    patientId = null,
    name,
    serviceInterest = null,
    status = 'open',
    estimatedValue = 0.00,
    assignedUserId = null,
  }) {
    const activeClinicId = clinicId || this.getClinicId();
    const sql = `
      INSERT INTO crm_opportunities (
        clinic_id, contact_id, lead_id, patient_id, name, service_interest, status, estimated_value, assigned_user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    const res = await query(sql, [
      activeClinicId,
      contactId,
      leadId,
      patientId,
      name,
      serviceInterest,
      status,
      estimatedValue,
      assignedUserId,
    ]);
    return res.rows[0];
  }

  /**
   * Actualiza el estado de una oportunidad.
   */
  async updateStatus(id, status, { lossReason = null, clinicId = null } = {}) {
    const activeClinicId = clinicId || this.getClinicId();
    let sql = `
      UPDATE crm_opportunities
      SET 
        status = $1::varchar,
        loss_reason = CASE WHEN $1::varchar = 'lost' THEN COALESCE($2, loss_reason) ELSE NULL END,
        won_at = CASE WHEN $1::varchar = 'won' THEN NOW() ELSE won_at END,
        lost_at = CASE WHEN $1::varchar = 'lost' THEN NOW() ELSE lost_at END,
        updated_at = NOW()
      WHERE id = $3 AND deleted_at IS NULL
    `;
    const params = [status, lossReason, id];

    if (activeClinicId) {
      sql += ` AND clinic_id = $4`;
      params.push(activeClinicId);
    }

    sql += ` RETURNING *`;
    const res = await query(sql, params);
    return res.rows[0] || null;
  }

  /**
   * Retorna métricas del pipeline de oportunidades.
   */
  async getKPIs(clinicId = null) {
    const activeClinicId = clinicId || this.getClinicId();
    let sql = `
      SELECT 
        COUNT(*)::int AS total_opportunities,
        COUNT(CASE WHEN status = 'open' THEN 1 END)::int AS open_count,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END)::int AS in_progress_count,
        COUNT(CASE WHEN status = 'won' THEN 1 END)::int AS won_count,
        COUNT(CASE WHEN status = 'lost' THEN 1 END)::int AS lost_count,
        COALESCE(SUM(CASE WHEN status IN ('open', 'in_progress') THEN estimated_value ELSE 0 END), 0)::numeric(12, 2) AS open_pipeline_value,
        COALESCE(SUM(CASE WHEN status = 'won' THEN estimated_value ELSE 0 END), 0)::numeric(12, 2) AS won_value
      FROM crm_opportunities
      WHERE deleted_at IS NULL
    `;
    const params = [];

    if (activeClinicId) {
      sql += ` AND clinic_id = $1`;
      params.push(activeClinicId);
    }

    const res = await query(sql, params);
    return res.rows[0];
  }
}

export default new CrmOpportunityRepository();
