// ============================================
// Repositorio de Saldo a Favor del Paciente
// ============================================
import { query, scopeClinic } from '../database/pool.js';
import { BaseRepository } from './base.repository.js';

/**
 * Repositorio para el libro de movimientos de "saldo a favor" del paciente.
 * Un crédito aumenta el saldo disponible; un débito lo consume.
 */
class PatientCreditRepository extends BaseRepository {
  constructor() {
    super('patient_credits');
  }

  /**
   * Inserta un movimiento de crédito o débito.
   * @param {object} data
   * @returns {Promise<object|null>}
   */
  async insert(data) {
    const clinicId = this.getClinicId() || data.clinic_id || 1;
    const params = [
      data.patient_id,
      clinicId,
      data.type,
      data.amount,
      data.source || 'overpayment',
      data.invoice_id || null,
      data.payment_id || null,
      data.reference || null,
      data.notes || null,
      data.created_by || null
    ];
    const result = await query(
      `INSERT INTO patient_credits
         (patient_id, clinic_id, type, amount, source, invoice_id, payment_id, reference, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      params
    );
    return result.rows[0] || null;
  }

  /**
   * Soft-delete de un movimiento (usado al anular un pago).
   * @param {string|number} id
   * @returns {Promise<object|null>}
   */
  async softDelete(id) {
    const conditions = ['deleted_at IS NULL'];
    const params = [];
    scopeClinic(conditions, params);
    conditions.push(`id = $${params.length + 1}`);
    params.push(id);
    const result = await query(
      `UPDATE patient_credits
       SET deleted_at = NOW()
       WHERE ${conditions.join(' AND ')}
       RETURNING *`,
      params
    );
    return result.rows[0] || null;
  }

  /**
   * Elimina (soft) todos los movimientos asociados a un pago.
   * @param {string|number} paymentId
   * @returns {Promise<number>}
   */
  async softDeleteByPayment(paymentId) {
    const conditions = ['deleted_at IS NULL'];
    const params = [];
    scopeClinic(conditions, params);
    conditions.push(`payment_id = $${params.length + 1}`);
    params.push(paymentId);
    const result = await query(
      `UPDATE patient_credits
       SET deleted_at = NOW()
       WHERE ${conditions.join(' AND ')}`,
      params
    );
    return result.rowCount || 0;
  }

  /**
   * Saldo disponible del paciente (suma créditos menos débitos).
   * @param {string|number} patientId
   * @returns {Promise<number>}
   */
  async getBalance(patientId) {
    const conditions = ['pc.deleted_at IS NULL'];
    const params = [];
    scopeClinic(conditions, params, 'pc');
    conditions.push(`pc.patient_id = $${params.length + 1}`);
    params.push(patientId);
    const result = await query(
      `SELECT COALESCE(
         SUM(CASE WHEN pc.type = 'credit' THEN pc.amount ELSE 0 END)
         - SUM(CASE WHEN pc.type = 'debit' THEN pc.amount ELSE 0 END), 0) AS balance
       FROM patient_credits pc
       WHERE ${conditions.join(' AND ')}`,
      params
    );
    return Math.max(0, parseFloat(result.rows[0].balance || 0));
  }

  /**
   * Padrón de movimientos del paciente.
   * @param {string|number} patientId
   * @returns {Promise<Array>}
   */
  async getMovements(patientId) {
    const conditions = ['pc.deleted_at IS NULL'];
    const params = [];
    scopeClinic(conditions, params, 'pc');
    conditions.push(`pc.patient_id = $${params.length + 1}`);
    params.push(patientId);
    const result = await query(
      `SELECT pc.id, pc.type, pc.amount, pc.source, pc.reference, pc.notes,
              pc.invoice_id, pc.payment_id, pc.created_at,
              i.invoice_number,
              pay.reference_number AS payment_reference,
              pm.name AS payment_method_name,
              u.first_name AS created_by_name
       FROM patient_credits pc
       LEFT JOIN invoices i ON pc.invoice_id = i.id
       LEFT JOIN payments pay ON pc.payment_id = pay.id
       LEFT JOIN payment_methods pm ON pay.payment_method_id = pm.id
       LEFT JOIN users u ON pc.created_by = u.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY pc.created_at DESC`,
      params
    );
    return result.rows;
  }
}

export default new PatientCreditRepository();