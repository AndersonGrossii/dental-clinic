// ============================================
// Repositorio de Leads del CRM
// ============================================
import { BaseRepository } from './base.repository.js';
import { query } from '../database/pool.js';

export class CrmLeadRepository extends BaseRepository {
  constructor() {
    super('crm_leads');
  }

  /**
   * Obtiene un lead por ID con todos los detalles relacionados.
   */
  async findByIdWithDetails(id, clinicId = null) {
    const activeClinicId = clinicId || this.getClinicId();
    let sql = `
      SELECT 
        l.*,
        mc.phone AS contact_phone,
        mc.name AS contact_name,
        mc.email AS contact_email,
        mc.avatar_url AS contact_avatar_url,
        mc.channel_preference AS contact_channel_preference,
        mc.patient_id AS contact_patient_id,
        p.first_name AS patient_first_name,
        p.last_name AS patient_last_name,
        p.custom_id AS patient_custom_id,
        u.first_name AS assigned_user_first_name,
        u.last_name AS assigned_user_last_name,
        src.name AS source_name,
        (SELECT COUNT(*)::int FROM crm_opportunities WHERE lead_id = l.id AND deleted_at IS NULL) AS opportunities_count,
        (SELECT COUNT(*)::int FROM crm_notes WHERE lead_id = l.id AND deleted_at IS NULL) AS notes_count,
        (SELECT COUNT(*)::int FROM tasks WHERE lead_id = l.id AND deleted_at IS NULL AND status != 'COMPLETED') AS pending_tasks_count
      FROM crm_leads l
      JOIN messaging_contacts mc ON mc.id = l.contact_id
      LEFT JOIN crm_lead_sources src ON src.code = l.source
      LEFT JOIN patients p ON p.id = l.patient_id
      LEFT JOIN users u ON u.id = l.assigned_user_id
      WHERE l.id = $1 AND l.deleted_at IS NULL
    `;
    const params = [id];

    if (activeClinicId) {
      sql += ` AND l.clinic_id = $2`;
      params.push(activeClinicId);
    }

    const res = await query(sql, params);
    return res.rows[0] || null;
  }

  /**
   * Lista leads con filtros avanzados, búsqueda y paginación.
   */
  async findAllWithDetails({
    clinicId = null,
    status = null,
    source = null,
    search = '',
    assignedUserId = null,
    dateFrom = null,
    dateTo = null,
    limit = 20,
    offset = 0,
    sortBy = 'l.created_at',
    sortOrder = 'DESC',
  } = {}) {
    const activeClinicId = clinicId || this.getClinicId();
    const whereConditions = ['l.deleted_at IS NULL'];
    const params = [];
    let paramIndex = 1;

    if (activeClinicId) {
      whereConditions.push(`l.clinic_id = $${paramIndex++}`);
      params.push(activeClinicId);
    }

    if (status) {
      whereConditions.push(`l.status = $${paramIndex++}`);
      params.push(status);
    }

    if (source) {
      whereConditions.push(`l.source = $${paramIndex++}`);
      params.push(source);
    }

    if (assignedUserId) {
      whereConditions.push(`l.assigned_user_id = $${paramIndex++}`);
      params.push(assignedUserId);
    }

    if (dateFrom) {
      whereConditions.push(`l.created_at >= $${paramIndex++}::timestamp`);
      params.push(`${dateFrom} 00:00:00`);
    }

    if (dateTo) {
      whereConditions.push(`l.created_at <= $${paramIndex++}::timestamp`);
      params.push(`${dateTo} 23:59:59`);
    }

    if (search && search.trim()) {
      const cleanSearch = `%${search.trim()}%`;
      whereConditions.push(`(
        mc.name ILIKE $${paramIndex} OR 
        mc.phone ILIKE $${paramIndex} OR 
        mc.email ILIKE $${paramIndex} OR 
        l.interest ILIKE $${paramIndex} OR
        p.first_name ILIKE $${paramIndex} OR
        p.last_name ILIKE $${paramIndex} OR
        p.custom_id ILIKE $${paramIndex}
      )`);
      params.push(cleanSearch);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Consulta de conteo total
    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM crm_leads l
      JOIN messaging_contacts mc ON mc.id = l.contact_id
      LEFT JOIN patients p ON p.id = l.patient_id
      ${whereClause}
    `;
    const countRes = await query(countSql, params);
    const total = countRes.rows[0]?.total || 0;

    // Consulta de filas
    const allowedSortColumns = ['l.created_at', 'l.status', 'l.source', 'mc.name', 'l.updated_at'];
    const safeSortBy = allowedSortColumns.includes(sortBy) ? sortBy : 'l.created_at';
    const safeOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const rowsSql = `
      SELECT 
        l.*,
        mc.phone AS contact_phone,
        mc.name AS contact_name,
        mc.email AS contact_email,
        mc.avatar_url AS contact_avatar_url,
        mc.patient_id AS contact_patient_id,
        p.first_name AS patient_first_name,
        p.last_name AS patient_last_name,
        p.custom_id AS patient_custom_id,
        u.first_name AS assigned_user_first_name,
        u.last_name AS assigned_user_last_name,
        src.name AS source_name,
        (SELECT COUNT(*)::int FROM crm_opportunities WHERE lead_id = l.id AND deleted_at IS NULL) AS opportunities_count,
        (SELECT COUNT(*)::int FROM crm_notes WHERE lead_id = l.id AND deleted_at IS NULL) AS notes_count,
        (SELECT COUNT(*)::int FROM tasks WHERE lead_id = l.id AND deleted_at IS NULL AND status != 'COMPLETED') AS pending_tasks_count
      FROM crm_leads l
      JOIN messaging_contacts mc ON mc.id = l.contact_id
      LEFT JOIN crm_lead_sources src ON src.code = l.source
      LEFT JOIN patients p ON p.id = l.patient_id
      LEFT JOIN users u ON u.id = l.assigned_user_id
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
   * Crea un nuevo lead en el sistema.
   */
  async createLead({
    clinicId,
    contactId,
    patientId = null,
    source = 'manual',
    status = 'new',
    interest = null,
    assignedUserId = null,
    notes = null,
  }) {
    const activeClinicId = clinicId || this.getClinicId();
    const sql = `
      INSERT INTO crm_leads (
        clinic_id, contact_id, patient_id, source, status, interest, assigned_user_id, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    const res = await query(sql, [
      activeClinicId,
      contactId,
      patientId,
      source,
      status,
      interest,
      assignedUserId,
      notes,
    ]);
    return res.rows[0];
  }

  /**
   * Actualiza el estado de un lead con timestamps de conversión o pérdida.
   */
  async updateStatus(id, status, { lossReason = null, clinicId = null } = {}) {
    const activeClinicId = clinicId || this.getClinicId();
    let convertedAt = null;
    let lostAt = null;

    if (status === 'converted') convertedAt = new Date();
    if (status === 'lost') lostAt = new Date();

    let sql = `
      UPDATE crm_leads
      SET 
        status = $1::varchar,
        loss_reason = CASE WHEN $1::varchar = 'lost' THEN COALESCE($2, loss_reason) ELSE NULL END,
        converted_at = CASE WHEN $1::varchar = 'converted' THEN NOW() ELSE converted_at END,
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
   * Busca el lead activo más reciente vinculado a un contacto.
   */
  async findActiveByContactId(contactId, clinicId = null) {
    const activeClinicId = clinicId || this.getClinicId();
    let sql = `
      SELECT * FROM crm_leads
      WHERE contact_id = $1 AND deleted_at IS NULL
    `;
    const params = [contactId];

    if (activeClinicId) {
      sql += ` AND clinic_id = $2`;
      params.push(activeClinicId);
    }

    sql += ` ORDER BY created_at DESC LIMIT 1`;
    const res = await query(sql, params);
    return res.rows[0] || null;
  }

  /**
   * Obtiene métricas agregadas del embudo de leads para el dashboard.
   */
  async getKPIs(clinicId = null) {
    const activeClinicId = clinicId || this.getClinicId();
    let sql = `
      SELECT 
        COUNT(*)::int AS total_leads,
        COUNT(CASE WHEN status = 'new' THEN 1 END)::int AS new_leads,
        COUNT(CASE WHEN status = 'contacted' THEN 1 END)::int AS contacted_leads,
        COUNT(CASE WHEN status = 'qualified' THEN 1 END)::int AS qualified_leads,
        COUNT(CASE WHEN status = 'appointment_scheduled' THEN 1 END)::int AS appointment_scheduled_leads,
        COUNT(CASE WHEN status = 'converted' THEN 1 END)::int AS converted_leads,
        COUNT(CASE WHEN status = 'lost' THEN 1 END)::int AS lost_leads
      FROM crm_leads
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

export default new CrmLeadRepository();
