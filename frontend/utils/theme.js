// ============================================
// Utilidad de Theming Dinámico Multi-Clínica
// ============================================

const DEFAULT_PRIMARY = '#0f86ec';

/**
 * Convierte un color HEX (#RRGGBB) a valores RGB.
 */
function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return null;
  const num = parseInt(clean, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

/**
 * Mezcla dos colores RGB según un factor (0 a 1).
 */
function mixRgb(rgb1, rgb2, factor) {
  return {
    r: Math.round(rgb1.r + (rgb2.r - rgb1.r) * factor),
    g: Math.round(rgb1.g + (rgb2.g - rgb1.g) * factor),
    b: Math.round(rgb1.b + (rgb2.b - rgb1.b) * factor),
  };
}

/**
 * Convierte RGB a HEX string.
 */
function rgbToHex({ r, g, b }) {
  const clamp = (v) => Math.max(0, Math.min(255, v));
  return '#' + [clamp(r), clamp(g), clamp(b)]
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Valida si un color es un formato hexadecimal seguro.
 */
export function isValidHexColor(hex) {
  return typeof hex === 'string' && /^#[0-9A-Fa-f]{6}$/.test(hex.trim());
}

/**
 * Genera la escala de diseño completa (--primary-50 a --primary-900)
 * a partir de un color base y la inyecta en el documento (:root).
 * @param {string} hexColor - Color en formato #RRGGBB
 */
export function applyClinicTheme(hexColor) {
  const target = isValidHexColor(hexColor) ? hexColor.trim() : DEFAULT_PRIMARY;
  const baseRgb = hexToRgb(target) || hexToRgb(DEFAULT_PRIMARY);
  const white = { r: 255, g: 255, b: 255 };
  const black = { r: 0, g: 0, b: 0 };

  // Paleta interpolada
  const palette = {
    '--primary-50': rgbToHex(mixRgb(baseRgb, white, 0.92)),
    '--primary-100': rgbToHex(mixRgb(baseRgb, white, 0.82)),
    '--primary-200': rgbToHex(mixRgb(baseRgb, white, 0.65)),
    '--primary-300': rgbToHex(mixRgb(baseRgb, white, 0.45)),
    '--primary-400': rgbToHex(mixRgb(baseRgb, white, 0.20)),
    '--primary-500': target,
    '--primary-600': rgbToHex(mixRgb(baseRgb, black, 0.15)),
    '--primary-700': rgbToHex(mixRgb(baseRgb, black, 0.30)),
    '--primary-800': rgbToHex(mixRgb(baseRgb, black, 0.45)),
    '--primary-900': rgbToHex(mixRgb(baseRgb, black, 0.60)),
  };

  const root = document.documentElement;
  for (const [token, value] of Object.entries(palette)) {
    root.style.setProperty(token, value);
  }
}
