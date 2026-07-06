// ============================================
// DTOs de Pacientes
// ============================================

/**
 * Transforma una fila de la base de datos a un DTO completo de paciente.
 * Incluye todos los campos del paciente y sus conteos de historial.
 * @param {object} row - Fila de la base de datos
 * @returns {object} DTO del paciente
 */
export const toPatientDTO = (row) => {
  if (!row) return null;

  return {
    id: row.id,
    customId: row.custom_id,
    firstName: row.first_name,
    lastName: row.last_name,
    fullName: `${row.first_name} ${row.last_name}`,
    dni: row.dni,
    passport: row.passport,
    birthDate: row.birth_date,
    gender: row.gender,
    address: row.address,
    city: row.city,
    state: row.state,
    postalCode: row.postal_code,
    phone: row.phone,
    mobile: row.mobile,
    email: row.email,
    emergencyContact: {
      name: row.emergency_contact_name,
      phone: row.emergency_contact_phone,
      relationship: row.emergency_contact_relationship,
    },
    medical: {
      allergies: row.allergies,
      conditions: row.medical_conditions,
      medications: row.current_medications,
    },
    insurance: {
      provider: row.insurance_provider,
      number: row.insurance_number,
    },
    occupation: row.occupation,
    notes: row.notes,
    photoUrl: row.photo_url,
    isActive: row.is_active,
    createdBy: row.created_by_name
      ? { name: `${row.created_by_name} ${row.created_by_lastname}` }
      : null,
    stats: {
      medicalHistoryCount: row.medical_history_count || 0,
      dentalHistoryCount: row.dental_history_count || 0,
      appointmentCount: row.appointment_count || 0,
      imageCount: row.image_count || 0,
    },
    financial: {
      totalDebit: parseFloat(row.total_debit) || 0,
      totalCredit: parseFloat(row.total_credit) || 0,
      balance: parseFloat(row.balance) || 0,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,

    // flat snake_case aliases for frontend
    custom_id: row.custom_id,
    first_name: row.first_name,
    last_name: row.last_name,
    full_name: `${row.first_name} ${row.last_name}`,
    birth_date: row.birth_date,
    postal_code: row.postal_code,
    emergency_contact_name: row.emergency_contact_name,
    emergency_contact_phone: row.emergency_contact_phone,
    emergency_contact_relationship: row.emergency_contact_relationship,
    allergies: row.allergies,
    medical_conditions: row.medical_conditions,
    current_medications: row.current_medications,
    insurance_provider: row.insurance_provider,
    insurance_number: row.insurance_number,
    photo_url: row.photo_url,
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
    total_debit: parseFloat(row.total_debit) || 0,
    total_credit: parseFloat(row.total_credit) || 0,
    balance: parseFloat(row.balance) || 0,
  };
};

/**
 * Transforma una fila de la base de datos a un DTO resumido de paciente (para listas).
 * @param {object} row - Fila de la base de datos
 * @returns {object} DTO resumido
 */
export const toPatientListDTO = (row) => {
  if (!row) return null;

  return {
    id: row.id,
    customId: row.custom_id,
    firstName: row.first_name,
    lastName: row.last_name,
    fullName: `${row.first_name} ${row.last_name}`,
    dni: row.dni,
    phone: row.phone,
    mobile: row.mobile,
    email: row.email,
    birthDate: row.birth_date,
    gender: row.gender,
    isActive: row.is_active,
    photoUrl: row.photo_url,
    insuranceProvider: row.insurance_provider,
    createdAt: row.created_at,

    // flat snake_case aliases for frontend
    custom_id: row.custom_id,
    first_name: row.first_name,
    last_name: row.last_name,
    full_name: `${row.first_name} ${row.last_name}`,
    birth_date: row.birth_date,
    is_active: row.is_active,
    photo_url: row.photo_url,
    insurance_provider: row.insurance_provider,
    created_at: row.created_at,
    total_debit: parseFloat(row.total_debit) || 0,
    total_credit: parseFloat(row.total_credit) || 0,
    balance: parseFloat(row.balance) || 0,
  };
};
