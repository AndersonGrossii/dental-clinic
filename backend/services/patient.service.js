// ============================================
// Servicio de Pacientes
// ============================================
import patientRepository from '../repositories/patient.repository.js';
import { toPatientDTO, toPatientListDTO } from '../dtos/patient.dto.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { als, query } from '../database/pool.js';

/**
 * Servicio encargado de la gestión de pacientes.
 */
class PatientService {
  /**
   * Obtiene todos los pacientes con paginación y filtros.
   * @param {object} options - Opciones de paginación y filtros
   * @returns {Promise<{ rows: Array, total: number }>}
   */
  async getAll(options) {
    const filters = {};

    if (options.filters?.isActive !== undefined) {
      filters.is_active = options.filters.isActive;
    }
    if (options.filters?.gender) {
      filters.gender = options.filters.gender;
    }
    if (options.filters?.insuranceProvider) {
      filters.insurance_provider = `%${options.filters.insuranceProvider}%`;
    }

    const { rows, total } = await patientRepository.findAll({
      limit: options.limit,
      offset: options.offset,
      sortBy: options.sortBy,
      sortOrder: options.sortOrder,
      filters,
    });

    return {
      rows: rows.map(toPatientListDTO),
      total,
    };
  }

  /**
   * Obtiene un paciente por su ID con perfil completo e historial.
   * @param {number} id - ID del paciente
   * @returns {Promise<object>}
   */
  async getById(id) {
    const patient = await patientRepository.findWithHistory(id);

    if (!patient) {
      throw new AppError('Paciente no encontrado.', 404);
    }

    return toPatientDTO(patient);
  }

  /**
   * Genera el siguiente ID personalizado de paciente ("año-número-código").
   * @returns {Promise<string>}
   */
  async generateNextCustomId() {
    const store = als.getStore();
    const clinicId = store ? store.clinicId : null;

    if (!clinicId) {
      throw new AppError('No se pudo determinar la clínica actual.', 500);
    }

    // Obtener código de la clínica
    const clinicRes = await query('SELECT code FROM clinics WHERE id = $1', [clinicId]);
    const clinicCode = clinicRes.rows[0]?.code || 'XUQ';

    const currentYear = new Date().getFullYear();
    const prefix = `${currentYear}-`;

    const result = await patientRepository.rawQuery(
      `SELECT custom_id FROM patients 
       WHERE custom_id LIKE $1 AND clinic_id = $2 AND deleted_at IS NULL
       ORDER BY custom_id DESC LIMIT 1`,
      [`${prefix}%-${clinicCode}`, clinicId]
    );

    let nextNum = 1;
    if (result.rows.length > 0) {
      const lastCustomId = result.rows[0].custom_id;
      const parts = lastCustomId.split('-');
      nextNum = parseInt(parts[1], 10) + 1;
    }
    
    const paddedNum = String(nextNum).padStart(4, '0');
    return `${currentYear}-${paddedNum}-${clinicCode}`;
  }

  /**
   * Crea un nuevo paciente.
   * @param {object} data - Datos del paciente
   * @param {number} createdBy - ID del usuario que crea el registro
   * @returns {Promise<object>}
   */
  async create(data, createdBy) {
    // Verificar DNI duplicado si se proporciona
    if (data.dni) {
      const existingByDni = await patientRepository.findByField('dni', data.dni);
      if (existingByDni) {
        throw new AppError('Ya existe un paciente con ese DNI.', 409);
      }
    }

    // Verificar email duplicado si se proporciona
    if (data.email) {
      const existingByEmail = await patientRepository.findByField('email', data.email);
      if (existingByEmail) {
        throw new AppError('Ya existe un paciente con ese correo electrónico.', 409);
      }
    }

    const nextCustomId = await this.generateNextCustomId();

    const patientData = {
      custom_id: nextCustomId,
      first_name: data.first_name,
      last_name: data.last_name,
      dni: data.dni || null,
      passport: data.passport || null,
      birth_date: data.birth_date || null,
      gender: data.gender || null,
      address: data.address || null,
      city: data.city || null,
      state: data.state || null,
      postal_code: data.postal_code || null,
      phone: data.phone || null,
      mobile: data.mobile || null,
      email: data.email || null,
      emergency_contact_name: data.emergency_contact_name || null,
      emergency_contact_phone: data.emergency_contact_phone || null,
      emergency_contact_relationship: data.emergency_contact_relationship || null,
      allergies: data.allergies || null,
      medical_conditions: data.medical_conditions || null,
      current_medications: data.current_medications || null,
      insurance_provider: data.insurance_provider || null,
      insurance_number: data.insurance_number || null,
      occupation: data.occupation || null,
      notes: data.notes || null,
      photo_url: data.photo_url || null,
      is_active: true,
      created_by: createdBy,
    };

    const newPatient = await patientRepository.create(patientData);

    logger.info(`Paciente creado: ${newPatient.first_name} ${newPatient.last_name} (ID: ${newPatient.id})`);

    return toPatientListDTO(newPatient);
  }

  /**
   * Actualiza un paciente existente.
   * @param {number} id - ID del paciente
   * @param {object} data - Datos a actualizar
   * @returns {Promise<object>}
   */
  async update(id, data) {
    const existingPatient = await patientRepository.findById(id);

    if (!existingPatient) {
      throw new AppError('Paciente no encontrado.', 404);
    }

    // Verificar DNI duplicado si se cambia
    if (data.dni && data.dni !== existingPatient.dni) {
      const existingByDni = await patientRepository.findByField('dni', data.dni);
      if (existingByDni) {
        throw new AppError('Ya existe un paciente con ese DNI.', 409);
      }
    }

    // Verificar email duplicado si se cambia
    if (data.email && data.email !== existingPatient.email) {
      const existingByEmail = await patientRepository.findByField('email', data.email);
      if (existingByEmail) {
        throw new AppError('Ya existe un paciente con ese correo electrónico.', 409);
      }
    }

    const updateData = {};

    if (data.first_name !== undefined) updateData.first_name = data.first_name;
    if (data.last_name !== undefined) updateData.last_name = data.last_name;
    if (data.dni !== undefined) updateData.dni = data.dni;
    if (data.passport !== undefined) updateData.passport = data.passport;
    if (data.birth_date !== undefined) updateData.birth_date = data.birth_date;
    if (data.gender !== undefined) updateData.gender = data.gender;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.city !== undefined) updateData.city = data.city;
    if (data.state !== undefined) updateData.state = data.state;
    if (data.postal_code !== undefined) updateData.postal_code = data.postal_code;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.mobile !== undefined) updateData.mobile = data.mobile;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.emergency_contact_name !== undefined) updateData.emergency_contact_name = data.emergency_contact_name;
    if (data.emergency_contact_phone !== undefined) updateData.emergency_contact_phone = data.emergency_contact_phone;
    if (data.emergency_contact_relationship !== undefined) updateData.emergency_contact_relationship = data.emergency_contact_relationship;
    if (data.allergies !== undefined) updateData.allergies = data.allergies;
    if (data.medical_conditions !== undefined) updateData.medical_conditions = data.medical_conditions;
    if (data.current_medications !== undefined) updateData.current_medications = data.current_medications;
    if (data.insurance_provider !== undefined) updateData.insurance_provider = data.insurance_provider;
    if (data.insurance_number !== undefined) updateData.insurance_number = data.insurance_number;
    if (data.occupation !== undefined) updateData.occupation = data.occupation;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.photo_url !== undefined) updateData.photo_url = data.photo_url;

    if (Object.keys(updateData).length === 0) {
      throw new AppError('No se proporcionaron datos para actualizar.', 400);
    }

    const updatedPatient = await patientRepository.update(id, updateData);

    if (!updatedPatient) {
      throw new AppError('No se pudo actualizar el paciente.', 500);
    }

    logger.info(`Paciente actualizado: ID ${id}`);

    return toPatientListDTO(updatedPatient);
  }

  /**
   * Elimina un paciente de forma lógica (soft delete).
   * @param {number} id - ID del paciente
   * @returns {Promise<void>}
   */
  async delete(id) {
    const patient = await patientRepository.findById(id);

    if (!patient) {
      throw new AppError('Paciente no encontrado.', 404);
    }

    const deleted = await patientRepository.softDelete(id);

    if (!deleted) {
      throw new AppError('No se pudo eliminar el paciente.', 500);
    }

    logger.info(`Paciente eliminado (soft): ID ${id}`);
  }

  /**
   * Busca pacientes por término de búsqueda.
   * @param {string} term - Término de búsqueda
   * @param {object} options - { limit, offset }
   * @returns {Promise<{ rows: Array, total: number }>}
   */
  async search(term, options) {
    if (!term || term.trim().length < 2) {
      throw new AppError('El término de búsqueda debe tener al menos 2 caracteres.', 400);
    }

    const { rows, total } = await patientRepository.search(term.trim(), options);

    return {
      rows: rows.map(toPatientListDTO),
      total,
    };
  }

  /**
   * Obtiene el historial completo de un paciente (médico y dental).
   * @param {number} patientId - ID del paciente
   * @returns {Promise<object>}
   */
  async getHistory(patientId) {
    const patient = await patientRepository.findById(patientId);

    if (!patient) {
      throw new AppError('Paciente no encontrado.', 404);
    }

    const [medicalHistory, dentalHistory] = await Promise.all([
      patientRepository.getMedicalHistory(patientId),
      patientRepository.getDentalHistory(patientId),
    ]);

    return {
      patientId,
      patientName: `${patient.first_name} ${patient.last_name}`,
      medicalHistory,
      dentalHistory,
    };
  }

  /**
   * Obtiene las citas de un paciente.
   * @param {number} patientId
   * @param {object} options - { limit, offset }
   * @returns {Promise<{ rows: Array, total: number }>}
   */
  async getAppointments(patientId, options) {
    const patient = await patientRepository.findById(patientId);

    if (!patient) {
      throw new AppError('Paciente no encontrado.', 404);
    }

    return patientRepository.getAppointments(patientId, options);
  }

  /**
   * Obtiene los tratamientos de un paciente.
   * @param {number} patientId
   * @param {object} options - { limit, offset }
   * @returns {Promise<{ rows: Array, total: number }>}
   */
  async getTreatments(patientId, options) {
    const patient = await patientRepository.findById(patientId);

    if (!patient) {
      throw new AppError('Paciente no encontrado.', 404);
    }

    return patientRepository.getTreatments(patientId, options);
  }

  /**
   * Obtiene las imágenes de un paciente.
   * @param {number} patientId
   * @param {object} options - { limit, offset }
   * @returns {Promise<{ rows: Array, total: number }>}
   */
  async getImages(patientId, options) {
    const patient = await patientRepository.findById(patientId);

    if (!patient) {
      throw new AppError('Paciente no encontrado.', 404);
    }

    return patientRepository.getImages(patientId, options);
  }

  /**
   * Obtiene las facturas de un paciente.
   * @param {number} patientId
   * @param {object} options - { limit, offset }
   * @returns {Promise<{ rows: Array, total: number }>}
   */
  async getInvoices(patientId, options) {
    const patient = await patientRepository.findById(patientId);

    if (!patient) {
      throw new AppError('Paciente no encontrado.', 404);
    }

    return patientRepository.getInvoices(patientId, options);
  }

  /**
   * Obtiene estadísticas generales de pacientes.
   * @returns {Promise<object>}
   */
  async getStats() {
    return patientRepository.getStats();
  }

  /**
   * Obtiene las notas de evolución clínica de un paciente.
   * @param {number} patientId
   * @returns {Promise<Array>}
   */
  async getNotes(patientId) {
    const patient = await patientRepository.findById(patientId);
    if (!patient) {
      throw new AppError('Paciente no encontrado.', 404);
    }
    return patientRepository.getNotes(patientId);
  }

  /**
   * Crea una nueva nota de evolución clínica para un paciente.
   * @param {number} patientId
   * @param {number} userId
   * @param {object} data
   * @returns {Promise<object>}
   */
  async createNote(patientId, userId, data) {
    const patient = await patientRepository.findById(patientId);
    if (!patient) {
      throw new AppError('Paciente no encontrado.', 404);
    }
    if (!data.content || data.content.trim() === '') {
      throw new AppError('El contenido de la nota es obligatorio.', 400);
    }
    return patientRepository.createNote(
      patientId,
      userId,
      data.title || 'Nota Clínica',
      data.content,
      data.type || 'clinica'
    );
  }
}

export default new PatientService();
