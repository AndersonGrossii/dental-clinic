// ============================================
// Repositorio de Clínicas
// ============================================
import { BaseRepository } from './base.repository.js';
import { query } from '../database/pool.js';

class ClinicRepository extends BaseRepository {
  constructor() {
    super('clinics');
  }

  /**
   * Obtiene todas las clínicas a las que tiene acceso el usuario.
   * @param {number} userId 
   * @param {string} roleName 
   */
  async getClinicsForUser(userId, roleName) {
    if (roleName === 'propietario') {
      const result = await query('SELECT id, name, code FROM clinics WHERE is_active = TRUE ORDER BY name ASC');
      return result.rows;
    }
    // Para otros roles, solo su propia clínica (u.clinic_id)
    const result = await query(
      `SELECT c.id, c.name, c.code 
       FROM clinics c 
       INNER JOIN users u ON u.clinic_id = c.id 
       WHERE u.id = $1 AND c.is_active = TRUE`, 
      [userId]
    );
    return result.rows;
  }
}

export default new ClinicRepository();
