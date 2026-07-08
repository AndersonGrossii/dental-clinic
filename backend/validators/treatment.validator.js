// ============================================
// Validador de Tratamientos — Reglas de validación
// ============================================

/**
 * Reglas de validación para crear un tratamiento.
 * @type {Array<object>}
 */
export const createTreatmentRules = [
  {
    field: 'name',
    label: 'Nombre del tratamiento',
    required: true,
    type: 'string',
    minLength: 2,
    maxLength: 200,
  },
  {
    field: 'category_id',
    label: 'Categoría',
    required: false,
    type: 'number',
  },
  {
    field: 'code',
    label: 'Código',
    required: false,
    type: 'string',
    maxLength: 20,
  },
  {
    field: 'description',
    label: 'Descripción',
    required: false,
    type: 'string',
    maxLength: 2000,
  },
  {
    field: 'default_price',
    label: 'Precio por defecto',
    required: true,
    type: 'number',
    min: 0,
  },
  {
    field: 'duration_minutes',
    label: 'Duración (minutos)',
    required: false,
    type: 'number',
    min: 5,
    max: 480,
  },
];

/**
 * Reglas de validación para actualizar un tratamiento.
 * @type {Array<object>}
 */
export const updateTreatmentRules = [
  {
    field: 'name',
    label: 'Nombre del tratamiento',
    required: false,
    type: 'string',
    minLength: 2,
    maxLength: 200,
  },
  {
    field: 'category_id',
    label: 'Categoría',
    required: false,
    type: 'number',
  },
  {
    field: 'code',
    label: 'Código',
    required: false,
    type: 'string',
    maxLength: 20,
  },
  {
    field: 'description',
    label: 'Descripción',
    required: false,
    type: 'string',
    maxLength: 2000,
  },
  {
    field: 'default_price',
    label: 'Precio por defecto',
    required: false,
    type: 'number',
    min: 0,
  },
  {
    field: 'duration_minutes',
    label: 'Duración (minutos)',
    required: false,
    type: 'number',
    min: 5,
    max: 480,
  },
  {
    field: 'is_active',
    label: 'Estado activo',
    required: false,
  },
];

/**
 * Reglas de validación para crear una categoría de tratamiento.
 * @type {Array<object>}
 */
export const createCategoryRules = [
  {
    field: 'name',
    label: 'Nombre de la categoría',
    required: true,
    type: 'string',
    minLength: 2,
    maxLength: 100,
  },
  {
    field: 'description',
    label: 'Descripción',
    required: false,
    type: 'string',
    maxLength: 255,
  },
  {
    field: 'color',
    label: 'Color',
    required: false,
    type: 'string',
    pattern: /^#[0-9a-fA-F]{6}$/,
    patternMsg: 'El color debe tener formato hexadecimal (#RRGGBB).',
  },
  {
    field: 'icon',
    label: 'Ícono',
    required: false,
    type: 'string',
    maxLength: 50,
  },
  {
    field: 'sort_order',
    label: 'Orden',
    required: false,
    type: 'number',
    min: 0,
  },
];

/**
 * Reglas de validación para actualizar una categoría de tratamiento.
 * @type {Array<object>}
 */
export const updateCategoryRules = [
  {
    field: 'name',
    label: 'Nombre de la categoría',
    required: false,
    type: 'string',
    minLength: 2,
    maxLength: 100,
  },
  {
    field: 'description',
    label: 'Descripción',
    required: false,
    type: 'string',
    maxLength: 255,
  },
  {
    field: 'color',
    label: 'Color',
    required: false,
    type: 'string',
    pattern: /^#[0-9a-fA-F]{6}$/,
    patternMsg: 'El color debe tener formato hexadecimal (#RRGGBB).',
  },
  {
    field: 'icon',
    label: 'Ícono',
    required: false,
    type: 'string',
    maxLength: 50,
  },
  {
    field: 'sort_order',
    label: 'Orden',
    required: false,
    type: 'number',
    min: 0,
  },
  {
    field: 'is_active',
    label: 'Estado activo',
    required: false,
  },
];

/**
 * Reglas de validación para registrar un tratamiento a un paciente.
 * @type {Array<object>}
 */
export const createPatientTreatmentRules = [
  {
    field: 'patient_id',
    label: 'Paciente',
    required: true,
    type: 'number',
  },
  {
    field: 'treatment_id',
    label: 'Tratamiento',
    required: true,
    type: 'number',
  },
  {
    field: 'doctor_id',
    label: 'Doctor',
    required: false,
    type: 'number',
  },
  {
    field: 'appointment_id',
    label: 'Cita',
    required: false,
    type: 'number',
  },
  {
    field: 'tooth_number',
    label: 'Número de diente',
    required: false,
    type: 'number',
    min: 1,
    max: 32,
  },
  {
    field: 'price',
    label: 'Precio',
    required: true,
    type: 'number',
    min: 0,
  },
  {
    field: 'status',
    label: 'Estado',
    required: false,
    type: 'string',
    enum: ['pendiente', 'en_progreso', 'completado', 'cancelado'],
  },
  {
    field: 'notes',
    label: 'Notas',
    required: false,
    type: 'string',
    maxLength: 1000,
  },
  {
    field: 'start_date',
    label: 'Fecha de inicio',
    required: false,
    type: 'string',
    pattern: /^\d{4}-\d{2}-\d{2}$/,
    patternMsg: 'La fecha debe tener formato YYYY-MM-DD.',
  },
  {
    field: 'end_date',
    label: 'Fecha de fin',
    required: false,
    type: 'string',
    pattern: /^\d{4}-\d{2}-\d{2}$/,
    patternMsg: 'La fecha debe tener formato YYYY-MM-DD.',
  },
  {
    field: 'tax_rate',
    label: 'Tasa de impuesto (%)',
    required: false,
    type: 'number',
    min: 0,
    max: 100,
  },
];

/**
 * Reglas de validación para actualizar un tratamiento de paciente.
 * @type {Array<object>}
 */
export const updatePatientTreatmentRules = [
  {
    field: 'tooth_number',
    label: 'Número de diente',
    required: false,
    type: 'number',
    min: 1,
    max: 32,
  },
  {
    field: 'price',
    label: 'Precio',
    required: false,
    type: 'number',
    min: 0,
  },
  {
    field: 'status',
    label: 'Estado',
    required: false,
    type: 'string',
    enum: ['pendiente', 'en_progreso', 'completado', 'cancelado'],
  },
  {
    field: 'notes',
    label: 'Notas',
    required: false,
    type: 'string',
    maxLength: 1000,
  },
  {
    field: 'start_date',
    label: 'Fecha de inicio',
    required: false,
    type: 'string',
    pattern: /^\d{4}-\d{2}-\d{2}$/,
    patternMsg: 'La fecha debe tener formato YYYY-MM-DD.',
  },
  {
    field: 'end_date',
    label: 'Fecha de fin',
    required: false,
    type: 'string',
    pattern: /^\d{4}-\d{2}-\d{2}$/,
    patternMsg: 'La fecha debe tener formato YYYY-MM-DD.',
  },
];
