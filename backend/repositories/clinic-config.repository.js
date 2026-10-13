// ============================================
// Repositorio de Configuración Multi-Clínica
// ============================================
import { query } from '../database/pool.js';
import { VALID_FEATURES, getDefaultFeatures } from '../config/features.js';

class ClinicConfigRepository {
  /**
   * Obtiene todas las features configuradas para una clínica como mapa clave -> boolean.
   * Si alguna clave del catálogo no está en base de datos, aplica el valor por defecto.
   * @param {number} clinicId
   * @returns {Promise<Record<string, boolean>>}
   */
  async getFeaturesByClinic(clinicId) {
    const result = await query(
      `SELECT feature_key, is_enabled 
       FROM clinic_features 
       WHERE clinic_id = $1`,
      [clinicId]
    );

    const features = { ...getDefaultFeatures() };
    for (const row of result.rows) {
      features[row.feature_key] = row.is_enabled;
    }
    return features;
  }

  /**
   * Verifica si una feature específica está habilitada para una clínica.
   * @param {number} clinicId 
   * @param {string} featureKey 
   * @returns {Promise<boolean>}
   */
  async isFeatureEnabled(clinicId, featureKey) {
    const result = await query(
      `SELECT is_enabled 
       FROM clinic_features 
       WHERE clinic_id = $1 AND feature_key = $2`,
      [clinicId, featureKey]
    );

    if (result.rows.length > 0) {
      return Boolean(result.rows[0].is_enabled);
    }

    // Si no está registrado en DB, consultar el catálogo por defecto
    const defaults = getDefaultFeatures();
    return defaults[featureKey] !== undefined ? defaults[featureKey] : false;
  }

  /**
   * Habilita o deshabilita una feature para una clínica.
   * @param {number} clinicId 
   * @param {string} featureKey 
   * @param {boolean} isEnabled 
   */
  async setFeatureEnabled(clinicId, featureKey, isEnabled) {
    const result = await query(
      `INSERT INTO clinic_features (clinic_id, feature_key, is_enabled, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT ON CONSTRAINT uq_clinic_feature
       DO UPDATE SET is_enabled = EXCLUDED.is_enabled, updated_at = NOW()
       RETURNING *`,
      [clinicId, featureKey, isEnabled]
    );
    return result.rows[0];
  }

  /**
   * Obtiene los gabinetes / salas de tratamiento configurados para una clínica.
   * @param {number} clinicId 
   * @param {object} options 
   * @param {boolean} options.onlyActive 
   * @returns {Promise<Array>}
   */
  async getCabinetsByClinic(clinicId, { onlyActive = true } = {}) {
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
   * Obtiene la identidad visual e institucional de la clínica.
   * @param {number} clinicId 
   * @returns {Promise<object>}
   */
  async getClinicIdentity(clinicId) {
    const result = await query(
      `SELECT 
         c.id AS clinic_id,
         c.name AS clinic_name,
         c.code AS clinic_code,
         c.is_active AS clinic_is_active,
         COALESCE(ci.name, c.name) AS name,
         COALESCE(ci.legal_name, c.name) AS legal_name,
         ci.tax_id,
         COALESCE(ci.address, c.address) AS address,
         ci.city,
         ci.state,
         ci.country,
         ci.postal_code,
         COALESCE(ci.phone, c.phone) AS phone,
         COALESCE(ci.email, c.email) AS email,
         ci.website,
         ci.logo_url,
         COALESCE(ci.primary_color, '#0f86ec') AS primary_color,
         COALESCE(ci.currency, 'EUR') AS currency,
         COALESCE(ci.tax_rate, 0) AS tax_rate,
         ci.opening_time,
         ci.closing_time,
         ci.timezone
       FROM clinics c
       LEFT JOIN clinic_information ci ON ci.clinic_id = c.id
       WHERE c.id = $1`,
      [clinicId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }
}

export default new ClinicConfigRepository();
