// ============================================
// Validadores de Factura
// ============================================

/**
 * Reglas de validación para crear una factura.
 * @type {Array<object>}
 */
export const createInvoiceRules = [
  {
    field: 'patient_id',
    label: 'Paciente',
    required: true,
    type: 'number',
  },
  {
    field: 'doctor_id',
    label: 'Doctor',
    type: 'number',
  },
  {
    field: 'invoice_date',
    label: 'Fecha de factura',
    type: 'string',
  },
  {
    field: 'due_date',
    label: 'Fecha de vencimiento',
    type: 'string',
  },
  {
    field: 'notes',
    label: 'Notas',
    type: 'string',
    maxLength: 1000,
  },
  {
    field: 'items',
    label: 'Items',
    required: true,
    custom: (value) => {
      if (!Array.isArray(value)) {
        return 'Items debe ser un arreglo.';
      }
      if (value.length === 0) {
        return 'Debe incluir al menos un item.';
      }
      for (let i = 0; i < value.length; i++) {
        const item = value[i];
        if (!item.description || typeof item.description !== 'string') {
          return `El item ${i + 1} debe tener una descripción válida.`;
        }
        if (!item.quantity || typeof item.quantity !== 'number' || item.quantity <= 0) {
          return `El item ${i + 1} debe tener una cantidad válida mayor a 0.`;
        }
        if (!item.unit_price || typeof item.unit_price !== 'number' || item.unit_price < 0) {
          return `El item ${i + 1} debe tener un precio unitario válido.`;
        }
      }
      return null;
    },
  },
];

/**
 * Reglas de validación para actualizar una factura.
 * @type {Array<object>}
 */
export const updateInvoiceRules = [
  {
    field: 'patient_id',
    label: 'Paciente',
    type: 'number',
  },
  {
    field: 'doctor_id',
    label: 'Doctor',
    type: 'number',
  },
  {
    field: 'due_date',
    label: 'Fecha de vencimiento',
    type: 'string',
  },
  {
    field: 'notes',
    label: 'Notas',
    type: 'string',
    maxLength: 1000,
  },
];

/**
 * Reglas de validación para crear una factura desde cotización.
 * No requiere body — el ID viene por params.
 * @type {Array<object>}
 */
export const fromQuotationRules = [];
