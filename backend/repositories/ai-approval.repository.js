// ============================================
// Repositorio de la Cola de Supervisión Humana de IA (Human-in-the-Loop)
// Permite aprobar, editar o descartar mensajes automáticos antes de enviarlos.
// ============================================
import { query } from '../database/pool.js';

class AIApprovalRepository {
  /**
   * Lista mensajes en cola de supervisión para una clínica.
   */
  async findByClinic(clinicId, status = 'PENDING_APPROVAL') {
    let sql = `
      SELECT a.*, 
             p.first_name AS patient_first_name, p.last_name AS patient_last_name, p.custom_id AS patient_custom_id,
             l.interest AS lead_interest,
             q.quote_number, q.total AS quotation_total,
             u.first_name AS reviewer_first_name, u.last_name AS reviewer_last_name
      FROM ai_message_approvals a
      LEFT JOIN patients p ON a.patient_id = p.id
      LEFT JOIN crm_leads l ON a.lead_id = l.id
      LEFT JOIN quotations q ON a.quotation_id = q.id
      LEFT JOIN users u ON a.reviewed_by_user_id = u.id
      WHERE a.clinic_id = $1
    `;
    const params = [clinicId];

    if (status && status !== 'ALL') {
      sql += ` AND a.status = $2`;
      params.push(status);
    }

    sql += ` ORDER BY a.created_at DESC`;

    const res = await query(sql, params);
    return res.rows;
  }

  /**
   * Obtiene un registro por ID con aislamiento de clínica.
   */
  async findById(id, clinicId) {
    const res = await query(
      `SELECT a.*, 
              p.first_name AS patient_first_name, p.last_name AS patient_last_name,
              q.quote_number
       FROM ai_message_approvals a
       LEFT JOIN patients p ON a.patient_id = p.id
       LEFT JOIN quotations q ON a.quotation_id = q.id
       WHERE a.id = $1 AND a.clinic_id = $2`,
      [id, clinicId]
    );
    return res.rows[0] || null;
  }

  /**
   * Crea una propuesta de mensaje pendiente de revisión humana.
   */
  async create({
    clinicId,
    leadId = null,
    patientId = null,
    quotationId = null,
    channel = 'WHATSAPP',
    recipientPhone,
    recipientName = null,
    actionType,
    suggestedMessage,
  }) {
    const res = await query(
      `INSERT INTO ai_message_approvals (
         clinic_id, lead_id, patient_id, quotation_id, channel,
         recipient_phone, recipient_name, action_type, suggested_message, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PENDING_APPROVAL')
       RETURNING *`,
      [
        clinicId,
        leadId,
        patientId,
        quotationId,
        channel,
        recipientPhone,
        recipientName,
        actionType,
        suggestedMessage,
      ]
    );
    return res.rows[0];
  }

  /**
   * Actualiza el estado (APPROVED, DISCARDED, SENT) y el usuario revisor.
   */
  async updateStatus(id, clinicId, status, reviewedByUserId = null) {
    const res = await query(
      `UPDATE ai_message_approvals
       SET status = $1,
           reviewed_by_user_id = $2,
           reviewed_at = NOW(),
           updated_at = NOW()
       WHERE id = $3 AND clinic_id = $4
       RETURNING *`,
      [status, reviewedByUserId, id, clinicId]
    );
    return res.rows[0] || null;
  }

  /**
   * Modifica el texto de la propuesta antes de enviarlo.
   */
  async updateSuggestedMessage(id, clinicId, newMessage, reviewedByUserId = null) {
    const res = await query(
      `UPDATE ai_message_approvals
       SET suggested_message = $1,
           reviewed_by_user_id = COALESCE($2, reviewed_by_user_id),
           updated_at = NOW()
       WHERE id = $3 AND clinic_id = $4
       RETURNING *`,
      [newMessage, reviewedByUserId, id, clinicId]
    );
    return res.rows[0] || null;
  }
}

export default new AIApprovalRepository();
