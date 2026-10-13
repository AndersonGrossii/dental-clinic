// ============================================
// Servicio de Configuración Multi-Clínica
// ============================================
import clinicConfigRepository from '../repositories/clinic-config.repository.js';
import { isValidFeatureKey } from '../config/features.js';
import { AppError } from '../utils/errors.js';

class ClinicConfigService {
  /**
   * Obtiene la configuración consolidada completa para la clínica activa.
   * Incluye identidad visual, catálogo de features activas y lista de gabinetes.
   * @param {number} clinicId 
   * @returns {Promise<object>}
   */
  async getActiveConfig(clinicId) {
    if (!clinicId) {
      throw new AppError('Identificador de clínica requerido para resolver la configuración.', 400);
    }

    const [identity, features, cabinets] = await Promise.all([
      clinicConfigRepository.getClinicIdentity(clinicId),
      clinicConfigRepository.getFeaturesByClinic(clinicId),
      clinicConfigRepository.getCabinetsByClinic(clinicId, { onlyActive: true }),
    ]);

    if (!identity) {
      throw new AppError('Clínica no encontrada o inactiva.', 404);
    }

    return {
      identity,
      features,
      cabinets,
    };
  }

  /**
   * Verifica si una feature específica está activa para una clínica.
   * @param {number} clinicId 
   * @param {string} featureKey 
   * @returns {Promise<boolean>}
   */
  async isFeatureEnabled(clinicId, featureKey) {
    if (!clinicId) return false;
    return await clinicConfigRepository.isFeatureEnabled(clinicId, featureKey);
  }

  /**
   * Actualiza el estado de las features para una clínica.
   * @param {number} clinicId 
   * @param {Record<string, boolean>} featuresMap 
   */
  async updateFeatures(clinicId, featuresMap) {
    for (const [key, enabled] of Object.entries(featuresMap)) {
      if (!isValidFeatureKey(key)) {
        throw new AppError(`Clave de feature no permitida: "${key}".`, 400);
      }
      await clinicConfigRepository.setFeatureEnabled(clinicId, key, Boolean(enabled));
    }
    return await clinicConfigRepository.getFeaturesByClinic(clinicId);
  }
}

export default new ClinicConfigService();
