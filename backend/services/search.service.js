// ============================================
// Servicio de Búsqueda Global — Lógica de negocio
// ============================================
import { query, als } from '../database/pool.js';
import { AppError } from '../utils/errors.js';

/**
 * Servicio que encapsula la lógica de búsqueda global del sistema.
 * Busca en múltiples entidades respetando los permisos del rol.
 */
class SearchService {
  getClinicCondition(alias = '') {
    const store = als.getStore();
    if (!store || !store.clinicId) return '';
    const prefix = alias ? `${alias}.` : '';
    return ` AND ${prefix}clinic_id = ${store.clinicId}`;
  }

  /**
   * Ejecuta una búsqueda global en múltiples entidades del sistema.
   * @param {string} term - Término de búsqueda
   * @param {string} userRole - Rol del usuario que realiza la búsqueda
   * @returns {Promise<object>} Resultados agrupados por tipo de entidad
   * @throws {AppError} Si el término es muy corto
   */
  async globalSearch(term, userRole) {
    if (!term || term.trim().length < 2) {
      throw new AppError('El término de búsqueda debe tener al menos 2 caracteres.', 400);
    }

    const sanitizedTerm = term.trim();
    const likeTerm = `%${sanitizedTerm}%`;
    const results = {};

    // === Búsqueda de Pacientes ===
    const patientsResult = await query(
      `SELECT
         p.id,
         p.first_name,
         p.last_name,
         CONCAT(p.first_name, ' ', p.last_name) AS full_name,
         p.dni,
         p.phone,
         p.email,
         p.custom_id
       FROM patients p
       WHERE p.deleted_at IS NULL ${this.getClinicCondition('p')}
         AND (
           CONCAT(p.first_name, ' ', p.last_name) ILIKE $1
           OR p.dni ILIKE $1
           OR p.phone ILIKE $1
           OR p.email ILIKE $1
           OR p.custom_id ILIKE $1
         )
       ORDER BY p.last_name, p.first_name
       LIMIT 10`,
      [likeTerm]
    );
    results.patients = patientsResult.rows.map((row) => ({
      id: row.id,
      type: 'patient',
      label: row.full_name,
      subtitle: row.custom_id ? `ID: ${row.custom_id}` : (row.dni ? `DNI: ${row.dni}` : row.phone || row.email || ''),
      url: `/patients/${row.id}`,
    }));

    // === Búsqueda de Doctores ===
    const doctorsResult = await query(
      `SELECT
         d.id,
         CONCAT(u.first_name, ' ', u.last_name) AS full_name,
         d.specialty
       FROM doctors d
       INNER JOIN users u ON d.user_id = u.id
       WHERE d.deleted_at IS NULL
         AND u.deleted_at IS NULL ${this.getClinicCondition('d')}
         AND CONCAT(u.first_name, ' ', u.last_name) ILIKE $1
       ORDER BY u.last_name, u.first_name
       LIMIT 10`,
      [likeTerm]
    );
    results.doctors = doctorsResult.rows.map((row) => ({
      id: row.id,
      type: 'doctor',
      label: row.full_name,
      subtitle: row.specialty,
      url: `/doctors/${row.id}`,
    }));

    // === Búsqueda de Citas ===
    const appointmentsResult = await query(
      `SELECT
         a.id,
         a.appointment_date,
         a.start_time,
         CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
         CONCAT(u.first_name, ' ', u.last_name) AS doctor_name,
         s.label AS status_label
       FROM appointments a
       INNER JOIN patients p ON a.patient_id = p.id
       INNER JOIN doctors d ON a.doctor_id = d.id
       INNER JOIN users u ON d.user_id = u.id
       INNER JOIN appointment_status s ON a.status_id = s.id
       WHERE a.deleted_at IS NULL ${this.getClinicCondition('a')}
         AND (
           CONCAT(p.first_name, ' ', p.last_name) ILIKE $1
           OR CAST(a.appointment_date AS TEXT) ILIKE $1
         )
       ORDER BY a.appointment_date DESC
       LIMIT 10`,
      [likeTerm]
    );
    results.appointments = appointmentsResult.rows.map((row) => ({
      id: row.id,
      type: 'appointment',
      label: `${row.patient_name} — ${row.appointment_date}`,
      subtitle: `${row.start_time} · Dr. ${row.doctor_name} · ${row.status_label}`,
      url: `/appointments/${row.id}`,
    }));

    // === Búsqueda de Tratamientos ===
    const treatmentsResult = await query(
      `SELECT
         t.id,
         t.name,
         t.code,
         t.default_price,
         tc.name AS category_name
       FROM treatments t
       LEFT JOIN treatment_categories tc ON t.category_id = tc.id
       WHERE t.deleted_at IS NULL ${this.getClinicCondition('t')}
         AND t.is_active = TRUE
         AND (
           t.name ILIKE $1
           OR t.code ILIKE $1
         )
       ORDER BY t.name
       LIMIT 10`,
      [likeTerm]
    );
    results.treatments = treatmentsResult.rows.map((row) => ({
      id: row.id,
      type: 'treatment',
      label: row.name,
      subtitle: `${row.category_name || 'Sin categoría'} · $${row.default_price}`,
      url: `/treatments/${row.id}`,
    }));

    // === Búsqueda de Facturas ===
    // Solo propietarios y recepcionistas pueden buscar facturas
    if (['propietario', 'recepcionista'].includes(userRole)) {
      const invoicesResult = await query(
        `SELECT
           i.id,
           i.invoice_number,
           i.total,
           i.status,
           CONCAT(p.first_name, ' ', p.last_name) AS patient_name
         FROM invoices i
         INNER JOIN patients p ON i.patient_id = p.id
         WHERE i.deleted_at IS NULL ${this.getClinicCondition('i')}
           AND (
             i.invoice_number ILIKE $1
             OR CONCAT(p.first_name, ' ', p.last_name) ILIKE $1
           )
         ORDER BY i.created_at DESC
         LIMIT 10`,
        [likeTerm]
      );
      results.invoices = invoicesResult.rows.map((row) => ({
        id: row.id,
        type: 'invoice',
        label: `Factura ${row.invoice_number}`,
        subtitle: `${row.patient_name} · $${row.total} · ${row.status}`,
        url: `/invoices/${row.id}`,
      }));
    }

    // Calcular total de resultados
    const totalResults = Object.values(results).reduce(
      (sum, group) => sum + group.length,
      0
    );

    return {
      term: sanitizedTerm,
      totalResults,
      results,
    };
  }
}

export default new SearchService();
