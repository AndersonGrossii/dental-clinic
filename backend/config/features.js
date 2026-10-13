// ============================================
// Catálogo Central de Feature Flags
// ============================================

/**
 * Catálogo inmutable de claves de features válidas en el sistema.
 * Evita la introducción de claves arbitrarias o no aprobadas.
 */
export const VALID_FEATURES = Object.freeze({
  CRM: 'crm',
  MESSAGING: 'omnichannel_messaging',
  AI_AUTOMATIONS: 'ai_automations',
  CABINETS: 'cabinets',
  PROMOTIONAL_PACKS: 'promotional_packs',
  CALENDAR_PRODUCTIVITY: 'calendar_productivity',
  REPORTS: 'reports',
  PRESCRIPTIONS: 'prescriptions',
});

/**
 * Lista de claves de features permitidas.
 */
export const FEATURE_KEYS = Object.freeze(Object.values(VALID_FEATURES));

/**
 * Valida si una clave de feature pertenece al catálogo oficial.
 * @param {string} key 
 * @returns {boolean}
 */
export function isValidFeatureKey(key) {
  return typeof key === 'string' && FEATURE_KEYS.includes(key);
}

/**
 * Retorna las features por defecto para una nueva clínica.
 */
export function getDefaultFeatures() {
  return {
    [VALID_FEATURES.CRM]: true,
    [VALID_FEATURES.MESSAGING]: false,
    [VALID_FEATURES.AI_AUTOMATIONS]: false,
    [VALID_FEATURES.CABINETS]: true,
    [VALID_FEATURES.PROMOTIONAL_PACKS]: true,
    [VALID_FEATURES.CALENDAR_PRODUCTIVITY]: true,
    [VALID_FEATURES.REPORTS]: true,
    [VALID_FEATURES.PRESCRIPTIONS]: true,
  };
}
