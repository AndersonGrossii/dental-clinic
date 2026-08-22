// ============================================
// Validadores de Pago
// ============================================

/**
 * Reglas de validación para registrar un pago.
 * @type {Array<object>}
 */
export const createPaymentRules = [
  {
    field: 'invoice_id',
    label: 'Factura',
    required: true,
    type: 'number',
  },
  {
    field: 'amount',
    label: 'Monto',
    type: 'number',
    min: 0,
    custom: (value) => {
      if (typeof value !== 'number' || value < 0) {
        return 'El monto debe ser un número mayor o igual a 0.';
      }
      return null;
    },
  },
  {
    field: 'credit_used',
    label: 'Saldo a favor',
    type: 'number',
    min: 0,
    custom: (value) => {
      if (typeof value !== 'number' || value < 0) {
        return 'El saldo a favor a usar debe ser un número mayor o igual a 0.';
      }
      return null;
    },
  },
  {
    field: 'payment_method_id',
    label: 'Método de pago',
    required: true,
    type: 'number',
  },
  {
    field: 'payment_date',
    label: 'Fecha de pago',
    type: 'string',
  },
  {
    field: 'reference',
    label: 'Referencia',
    type: 'string',
    maxLength: 255,
  },
  {
    field: 'notes',
    label: 'Notas',
    type: 'string',
    maxLength: 500,
  },
];

/**
 * Reglas de validación para procesar el pago de tratamientos.
 */
export const processTreatmentPaymentRules = [
  {
    field: 'patient_id',
    label: 'Paciente',
    required: true,
    type: 'number',
  },
  {
    field: 'treatment_ids',
    label: 'Tratamientos',
    required: true,
    custom: (value) => {
      if (!Array.isArray(value) || value.length === 0) {
        return 'Debe seleccionar al menos un tratamiento.';
      }
      return null;
    },
  },
  {
    field: 'payment_method_id',
    label: 'Método de pago',
    required: true,
    type: 'number',
  },
  {
    field: 'credit_used',
    label: 'Saldo a favor',
    type: 'number',
    min: 0,
    custom: (value) => {
      if (typeof value !== 'number' || value < 0) {
        return 'El saldo a favor a usar debe ser un número mayor o igual a 0.';
      }
      return null;
    },
  },
];
