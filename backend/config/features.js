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
  ODONTOGRAM: 'odontogram',
  DENTAL_HISTORY: 'dental_history',
});

/**
 * Presets preconfigurados para especialidades clínicas.
 * Permite activar o desactivar conjuntos de herramientas con un único comando.
 */
export const CLINIC_PRESETS = Object.freeze({
  DENTAL: Object.freeze({
    [VALID_FEATURES.ODONTOGRAM]: true,
    [VALID_FEATURES.DENTAL_HISTORY]: true,
    [VALID_FEATURES.PRESCRIPTIONS]: true,
  }),
  NON_DENTAL: Object.freeze({
    [VALID_FEATURES.ODONTOGRAM]: false,
    [VALID_FEATURES.DENTAL_HISTORY]: false,
  }),
  AESTHETIC: Object.freeze({
    [VALID_FEATURES.ODONTOGRAM]: false,
    [VALID_FEATURES.DENTAL_HISTORY]: false,
    [VALID_FEATURES.PRESCRIPTIONS]: true,
  }),
});

/**
 * Resuelve las features correspondientes a un preset por nombre.
 * @param {string} presetName - 'dental' | 'non-dental' | 'aesthetic'
 * @returns {Record<string, boolean> | null}
 */
export function resolvePresetFeatures(presetName) {
  if (!presetName || typeof presetName !== 'string') return null;
  const normalized = presetName.trim().toUpperCase().replace(/[-_]/g, '_');
  return CLINIC_PRESETS[normalized] || null;
}

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
    [VALID_FEATURES.ODONTOGRAM]: true,
    [VALID_FEATURES.DENTAL_HISTORY]: true,
  };
}
