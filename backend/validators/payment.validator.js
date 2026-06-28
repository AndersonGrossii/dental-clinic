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
    required: true,
    type: 'number',
    min: 0.01,
    custom: (value) => {
      if (typeof value !== 'number' || value <= 0) {
        return 'El monto debe ser un número mayor a 0.';
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
