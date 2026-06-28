// ============================================
// Validaciones de Pacientes
// ============================================

/**
 * Reglas de validación para creación de paciente.
 * @type {Array<object>}
 */
export const createPatientRules = [
  {
    field: 'first_name',
    label: 'Nombre',
    required: true,
    type: 'string',
    minLength: 2,
    maxLength: 100,
  },
  {
    field: 'last_name',
    label: 'Apellido',
    required: true,
    type: 'string',
    minLength: 2,
    maxLength: 100,
  },
  {
    field: 'dni',
    label: 'DNI',
    required: false,
    type: 'string',
    maxLength: 20,
  },
  {
    field: 'passport',
    label: 'Pasaporte',
    required: false,
    type: 'string',
    maxLength: 30,
  },
  {
    field: 'birth_date',
    label: 'Fecha de nacimiento',
    required: false,
    type: 'string',
    pattern: /^\d{4}-\d{2}-\d{2}$/,
    patternMsg: 'La fecha de nacimiento debe tener el formato AAAA-MM-DD.',
  },
  {
    field: 'gender',
    label: 'Género',
    required: false,
    type: 'string',
    enum: ['masculino', 'femenino', 'otro'],
  },
  {
    field: 'address',
    label: 'Dirección',
    required: false,
    type: 'string',
  },
  {
    field: 'city',
    label: 'Ciudad',
    required: false,
    type: 'string',
    maxLength: 100,
  },
  {
    field: 'state',
    label: 'Estado/Provincia',
    required: false,
    type: 'string',
    maxLength: 100,
  },
  {
    field: 'postal_code',
    label: 'Código postal',
    required: false,
    type: 'string',
    maxLength: 20,
  },
  {
    field: 'phone',
    label: 'Teléfono',
    required: false,
    type: 'string',
    maxLength: 20,
  },
  {
    field: 'mobile',
    label: 'Celular',
    required: false,
    type: 'string',
    maxLength: 20,
  },
  {
    field: 'email',
    label: 'Correo electrónico',
    required: false,
    type: 'email',
  },
  {
    field: 'emergency_contact_name',
    label: 'Nombre del contacto de emergencia',
    required: false,
    type: 'string',
    maxLength: 200,
  },
  {
    field: 'emergency_contact_phone',
    label: 'Teléfono del contacto de emergencia',
    required: false,
    type: 'string',
    maxLength: 20,
  },
  {
    field: 'emergency_contact_relationship',
    label: 'Relación del contacto de emergencia',
    required: false,
    type: 'string',
    maxLength: 50,
  },
  {
    field: 'allergies',
    label: 'Alergias',
    required: false,
    type: 'string',
  },
  {
    field: 'medical_conditions',
    label: 'Condiciones médicas',
    required: false,
    type: 'string',
  },
  {
    field: 'current_medications',
    label: 'Medicamentos actuales',
    required: false,
    type: 'string',
  },
  {
    field: 'insurance_provider',
    label: 'Proveedor de seguro',
    required: false,
    type: 'string',
    maxLength: 100,
  },
  {
    field: 'insurance_number',
    label: 'Número de seguro',
    required: false,
    type: 'string',
    maxLength: 50,
  },
  {
    field: 'occupation',
    label: 'Ocupación',
    required: false,
    type: 'string',
    maxLength: 100,
  },
  {
    field: 'notes',
    label: 'Notas',
    required: false,
    type: 'string',
  },
];

/**
 * Reglas de validación para actualización de paciente.
 * Mismas reglas que creación pero ningún campo es obligatorio.
 * @type {Array<object>}
 */
export const updatePatientRules = createPatientRules.map(rule => ({
  ...rule,
  required: false,
}));
