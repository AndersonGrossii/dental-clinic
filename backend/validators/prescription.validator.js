export const createPrescriptionRules = [
  {
    field: 'patient_id',
    label: 'Paciente',
    required: true,
    type: 'number',
  },
  {
    field: 'doctor_id',
    label: 'Doctor',
    required: true,
    type: 'number',
  },
  {
    field: 'items',
    label: 'Medicamentos',
    required: true,
    type: 'array',
  },
  {
    field: 'notes',
    label: 'Notas',
    type: 'string',
    maxLength: 2000,
  },
  {
    field: 'issued_date',
    label: 'Fecha de emisión',
    type: 'string',
  },
  {
    field: 'valid_until',
    label: 'Válido hasta',
    type: 'string',
  },
];
