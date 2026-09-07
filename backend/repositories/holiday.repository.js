// ============================================
// Repositorio de Días Festivos y Bloqueos de Clínica
// ============================================
import { BaseRepository } from './base.repository.js';
import { query } from '../database/pool.js';

export class HolidayRepository extends BaseRepository {
  constructor() {
    super('clinic_holidays');
  }

  /**
   * Obtiene todos los festivos para una clínica en un rango de fechas.
   */
  async getHolidays(clinicId = null, dateFrom = null, dateTo = null) {
    const targetClinicId = clinicId || this.getClinicId();
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (targetClinicId) {
      conditions.push(`ch.clinic_id = $${paramIndex++}`);
      params.push(targetClinicId);
    }

    if (dateFrom) {
      conditions.push(`ch.holiday_date >= $${paramIndex++}`);
      params.push(dateFrom);
    }

    if (dateTo) {
      conditions.push(`ch.holiday_date <= $${paramIndex++}`);
      params.push(dateTo);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `
      SELECT ch.*, u.first_name AS creator_first_name, u.last_name AS creator_last_name
      FROM clinic_holidays ch
      LEFT JOIN users u ON ch.created_by = u.id
      ${whereClause}
      ORDER BY ch.holiday_date ASC
    `;

    const res = await query(sql, params);
    return res.rows;
  }

  /**
   * Obtiene un festivo específico por fecha exacta para una clínica.
   */
  async getHolidayByDate(clinicId, dateStr) {
    const targetClinicId = clinicId || this.getClinicId();
    const sql = `
      SELECT * FROM clinic_holidays
      WHERE clinic_id = $1 AND holiday_date = $2
      LIMIT 1
    `;
    const res = await query(sql, [targetClinicId, dateStr]);
    return res.rows[0] || null;
  }

  /**
   * Registra un nuevo festivo en la clínica.
   */
  async createHoliday({ clinicId, holidayDate, name, scope = 'LOCAL', description = null, isFullDay = true, createdBy = null }) {
    const targetClinicId = clinicId || this.getClinicId();
    const sql = `
      INSERT INTO clinic_holidays (clinic_id, holiday_date, name, scope, description, is_full_day, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (clinic_id, holiday_date) DO UPDATE
      SET name = EXCLUDED.name,
          scope = EXCLUDED.scope,
          description = EXCLUDED.description,
          is_full_day = EXCLUDED.is_full_day,
          updated_at = NOW()
      RETURNING *
    `;
    const res = await query(sql, [targetClinicId, holidayDate, name, scope, description, isFullDay, createdBy]);
    return res.rows[0];
  }

  /**
   * Elimina un festivo por su ID.
   */
  async deleteHoliday(id, clinicId = null) {
    const targetClinicId = clinicId || this.getClinicId();
    const conditions = ['id = $1'];
    const params = [id];

    if (targetClinicId) {
      conditions.push('clinic_id = $2');
      params.push(targetClinicId);
    }

    const sql = `DELETE FROM clinic_holidays WHERE ${conditions.join(' AND ')} RETURNING *`;
    const res = await query(sql, params);
    return res.rows[0] || null;
  }
}

export default new HolidayRepository();
