// ============================================
// Middleware de Protección por Feature Flag
// ============================================
import clinicConfigService from '../services/clinic-config.service.js';
import { als } from '../database/pool.js';

/**
 * Middleware de orden superior que bloquea peticiones si el módulo solicitado
 * está desactivado para la clínica activa del usuario.
 * @param {string} featureKey - Clave oficial de la feature (e.g. 'crm', 'omnichannel_messaging')
 */
export function requireFeature(featureKey) {
  return async (req, res, next) => {
    try {
      const store = als.getStore();
      const clinicId = req.user?.clinicId || store?.clinicId;

      if (!clinicId) {
        return res.status(401).json({
          success: false,
          code: 'UNAUTHORIZED_CLINIC',
          message: 'No se pudo determinar el contexto de clínica para evaluar la disponibilidad del módulo.',
        });
      }

      const isEnabled = await clinicConfigService.isFeatureEnabled(clinicId, featureKey);

      if (!isEnabled) {
        return res.status(403).json({
          success: false,
          code: 'FEATURE_DISABLED',
          message: `El módulo '${featureKey}' está desactivado para esta clínica.`,
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
