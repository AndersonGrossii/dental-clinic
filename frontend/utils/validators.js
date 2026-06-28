// ============================================
// Validadores de Formulario
// ============================================

export function isRequired(val) {
  return val !== undefined && val !== null && String(val).trim() !== '';
}

export function isEmail(val) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(val);
}

export function isPhone(val) {
  const phoneRegex = /^[+]*[(]{0,1}[0-9]{1,4}[)]{0,1}[-\s./0-9]*$/;
  return phoneRegex.test(val);
}

/**
 * Valida un objeto de datos contra un conjunto de reglas.
 * @param {object} data - Datos a validar
 * @param {object} rules - Reglas por campo (ej: { email: { required: true, email: true } })
 * @returns {{ isValid: boolean, errors: object }}
 */
export function validateForm(data, rules) {
  const errors = {};
  let isValid = true;

  for (const [field, rule] of Object.entries(rules)) {
    const value = data[field];

    if (rule.required && !isRequired(value)) {
      errors[field] = 'Este campo es obligatorio.';
      isValid = false;
      continue;
    }

    if (value !== undefined && value !== null && String(value).trim() !== '') {
      if (rule.email && !isEmail(value)) {
        errors[field] = 'Ingrese un correo electrónico válido.';
        isValid = false;
      }
      if (rule.phone && !isPhone(value)) {
        errors[field] = 'Ingrese un número telefónico válido.';
        isValid = false;
      }
      if (rule.minLength && String(value).length < rule.minLength) {
        errors[field] = `Debe tener al menos ${rule.minLength} caracteres.`;
        isValid = false;
      }
    }
  }

  return { isValid, errors };
}
