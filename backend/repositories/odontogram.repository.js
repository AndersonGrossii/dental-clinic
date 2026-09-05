// ============================================
// Repositorio de Odontograma Clínico
// ============================================
import { BaseRepository } from './base.repository.js';
import { query } from '../database/pool.js';

export class OdontogramRepository extends BaseRepository {
  constructor() {
    super('odontogram_entries');
  }

  /**
   * Obtiene todas las anotaciones del odontograma de un paciente.
   */
  async getByPatient(patientId, clinicId = null) {
    const targetClinicId = clinicId || this.getClinicId();
    const params = [patientId];
    let sql = `
      SELECT o.*,
             u.first_name AS author_first_name,
             u.last_name AS author_last_name
      FROM odontogram_entries o
      LEFT JOIN users u ON o.created_by_user_id = u.id
      WHERE o.patient_id = $1 AND o.deleted_at IS NULL
    `;

    if (targetClinicId) {
      sql += ` AND o.clinic_id = $2`;
      params.push(targetClinicId);
    }

    sql += ` ORDER BY o.tooth_number ASC, o.created_at ASC`;

    const result = await query(sql, params);
    return result.rows;
  }

  /**
   * Obtiene una entrada por ID con metadatos.
   */
  async getEntryById(id, clinicId = null) {
    const targetClinicId = clinicId || this.getClinicId();
    const params = [id];
    let sql = `
      SELECT o.*,
             u.first_name AS author_first_name,
             u.last_name AS author_last_name
      FROM odontogram_entries o
      LEFT JOIN users u ON o.created_by_user_id = u.id
      WHERE o.id = $1 AND o.deleted_at IS NULL
    `;

    if (targetClinicId) {
      sql += ` AND o.clinic_id = $2`;
      params.push(targetClinicId);
    }

    const result = await query(sql, params);
    return result.rows[0] || null;
  }
}

export default new OdontogramRepository();
