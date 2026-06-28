// ============================================
// Validadores de Cotización
// ============================================

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function validateItems(value) {
  if (!Array.isArray(value)) {
    return 'Items debe ser un arreglo.';
  }
  if (value.length === 0) {
    return 'Debe incluir al menos un item.';
  }
  for (let i = 0; i < value.length; i++) {
    const item = value[i];
    if (!item.description || typeof item.description !== 'string' || item.description.trim() === '') {
      return `El item ${i + 1} debe tener una descripción válida.`;
    }
    if (typeof item.quantity !== 'number' || item.quantity <= 0 || !Number.isInteger(item.quantity)) {
      return `El item ${i + 1} debe tener una cantidad válida mayor a 0.`;
    }
    if (typeof item.unit_price !== 'number' || item.unit_price < 0) {
      return `El item ${i + 1} debe tener un precio unitario válido.`;
    }
    if (item.discount !== undefined && (typeof item.discount !== 'number' || item.discount < 0 || item.discount > 100)) {
      return `El item ${i + 1} debe tener un descuento entre 0 y 100.`;
    }
  }
  return null;
}

/**
 * Reglas de validación para crear una cotización.
 * @type {Array<object>}
 */
export const createQuotationRules = [
  { field: 'patient_id', label: 'Paciente', required: true, type: 'number' },
  { field: 'doctor_id', label: 'Doctor', required: false, type: 'number' },
  {
    field: 'quotation_date',
    label: 'Fecha de cotización',
    required: false,
    type: 'string',
    pattern: DATE_PATTERN,
    patternMsg: 'La fecha de cotización debe tener formato AAAA-MM-DD.',
  },
  {
    field: 'valid_until',
    label: 'Válida hasta',
    required: false,
    type: 'string',
    pattern: DATE_PATTERN,
    patternMsg: 'La fecha de validez debe tener formato AAAA-MM-DD.',
  },
  {
    field: 'notes',
    label: 'Notas',
    required: false,
    type: 'string',
    maxLength: 1000,
  },
  {
    field: 'tax_rate',
    label: 'Impuesto (%)',
    required: false,
    type: 'number',
    min: 0,
    max: 100,
  },
  {
    field: 'discount_percentage',
    label: 'Descuento general (%)',
    required: false,
    type: 'number',
    min: 0,
    max: 100,
  },
  {
    field: 'discount_amount',
    label: 'Descuento general ($)',
    required: false,
    type: 'number',
    min: 0,
  },
  {
    field: 'items',
    label: 'Items',
    required: true,
    custom: validateItems,
  },
];

/**
 * Reglas de validación para actualizar una cotización.
 * @type {Array<object>}
 */
export const updateQuotationRules = [
  { field: 'patient_id', label: 'Paciente', required: false, type: 'number' },
  { field: 'doctor_id', label: 'Doctor', required: false, type: 'number' },
  {
    field: 'quotation_date',
    label: 'Fecha de cotización',
    required: false,
    type: 'string',
    pattern: DATE_PATTERN,
    patternMsg: 'La fecha de cotización debe tener formato AAAA-MM-DD.',
  },
  {
    field: 'valid_until',
    label: 'Válida hasta',
    required: false,
    type: 'string',
    pattern: DATE_PATTERN,
    patternMsg: 'La fecha de validez debe tener formato AAAA-MM-DD.',
  },
  {
    field: 'notes',
    label: 'Notas',
    required: false,
    type: 'string',
    maxLength: 1000,
  },
  {
    field: 'tax_rate',
    label: 'Impuesto (%)',
    required: false,
    type: 'number',
    min: 0,
    max: 100,
  },
  {
    field: 'discount_percentage',
    label: 'Descuento general (%)',
    required: false,
    type: 'number',
    min: 0,
    max: 100,
  },
  {
    field: 'discount_amount',
    label: 'Descuento general ($)',
    required: false,
    type: 'number',
    min: 0,
  },
  {
    field: 'items',
    label: 'Items',
    required: false,
    custom: validateItems,
  },
];

/**
 * Reglas de validación para cambiar el estado de una cotización.
 * @type {Array<object>}
 */
export const changeStatusRules = [
  {
    field: 'status',
    label: 'Estado',
    required: true,
    type: 'string',
    enum: ['borrador', 'enviada', 'aceptada', 'rechazada', 'expirada'],
  },
];
