// ============================================
// Repositorio de Gabinetes / Salas de Tratamiento
// ============================================
import { query, scopeClinic } from '../database/pool.js';
import { BaseRepository } from './base.repository.js';

class CabinetRepository extends BaseRepository {
  constructor() {
    super('clinic_cabinets');
  }

  /**
   * Obtiene todos los gabinetes de una clínica.
   * @param {number} clinicId 
   * @param {object} options 
   * @param {boolean} options.onlyActive 
   */
  async findByClinic(clinicId, { onlyActive = true } = {}) {
    const conditions = ['clinic_id = $1'];
    const params = [clinicId];

    if (onlyActive) {
      conditions.push('is_active = TRUE');
    }

    const result = await query(
      `SELECT id, clinic_id, name, code, is_active, created_at, updated_at
       FROM clinic_cabinets
       WHERE ${conditions.join(' AND ')}
       ORDER BY id ASC`,
      params
    );
    return result.rows;
  }

  /**
   * Busca un gabinete por nombre y clínica.
   * @param {string} name 
   * @param {number} clinicId 
   */
  async findByName(name, clinicId) {
    const result = await query(
      `SELECT id, clinic_id, name, code, is_active
       FROM clinic_cabinets
       WHERE clinic_id = $1 AND name ILIKE $2`,
      [clinicId, name]
    );
    return result.rows[0] || null;
  }

  /**
   * Cuenta citas futuras asignadas a este gabinete en la clínica.
   * @param {number} clinicId 
   * @param {string} cabinetName 
   * @returns {Promise<number>}
   */
  async countFutureAppointments(clinicId, cabinetName) {
    const result = await query(
      `SELECT COUNT(*) AS total
       FROM appointments a
       WHERE a.clinic_id = $1 
         AND a.gabinete ILIKE $2
         AND (a.appointment_date > CURRENT_DATE OR (a.appointment_date = CURRENT_DATE AND a.end_time > CURRENT_TIME))
         AND a.deleted_at IS NULL
         AND a.status_id NOT IN (
           SELECT id FROM appointment_status WHERE name IN ('cancelada', 'no_asistio')
         )`,
      [clinicId, cabinetName]
    );
    return parseInt(result.rows[0]?.total || '0', 10);
  }

  /**
   * Crea un nuevo gabinete.
   */
  async createCabinet({ clinicId, name, code, isActive = true }) {
    const result = await query(
      `INSERT INTO clinic_cabinets (clinic_id, name, code, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING *`,
      [clinicId, name.trim(), code ? code.trim() : null, Boolean(isActive)]
    );
    return result.rows[0];
  }

  /**
   * Actualiza el estado activo de un gabinete.
   */
  async setActiveStatus(id, clinicId, isActive) {
    const result = await query(
      `UPDATE clinic_cabinets
       SET is_active = $1, updated_at = NOW()
       WHERE id = $2 AND clinic_id = $3
       RETURNING *`,
      [Boolean(isActive), id, clinicId]
    );
    return result.rows[0] || null;
  }
}

export default new CabinetRepository();
