// ============================================
// Servicio de Reportes
// ============================================
import { query, als } from '../database/pool.js';
import { formatDateSQL } from '../utils/date.js';

/**
 * Servicio de Reportes
 */
class ReportService {
  // Helper para obtener condiciones de clínica
  getClinicCondition(alias = '') {
    const store = als.getStore();
    if (!store || !store.clinicId) return '';
    const prefix = alias ? `${alias}.` : '';
    return ` AND ${prefix}clinic_id = ${store.clinicId}`;
  }

  /**
   * Reporte de ingresos financieros.
   */
  async getRevenueReport(startDate, endDate) {
    const pCond = this.getClinicCondition('p');
    
    // 1. Ingresos totales
    const totalResult = await query(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM payments p
       WHERE payment_date >= $1 AND payment_date <= $2 AND deleted_at IS NULL ${pCond}`,
      [startDate, endDate]
    );

    // 2. Ingresos por método de pago
    const methodResult = await query(
      `SELECT pm.label AS method, COALESCE(SUM(p.amount), 0) AS total
       FROM payments p
       INNER JOIN payment_methods pm ON p.payment_method_id = pm.id
       WHERE p.payment_date >= $1 AND p.payment_date <= $2 AND p.deleted_at IS NULL ${pCond}
       GROUP BY pm.label`,
      [startDate, endDate]
    );

    // 3. Ingresos por doctor
    const doctorResult = await query(
      `SELECT CONCAT(u.first_name, ' ', u.last_name) AS doctor, COALESCE(SUM(p.amount), 0) AS total
       FROM payments p
       INNER JOIN invoices i ON p.invoice_id = i.id
       INNER JOIN doctors d ON i.doctor_id = d.id
       INNER JOIN users u ON d.user_id = u.id
       WHERE p.payment_date >= $1 AND p.payment_date <= $2 AND p.deleted_at IS NULL AND i.deleted_at IS NULL ${pCond}
       GROUP BY u.first_name, u.last_name`,
      [startDate, endDate]
    );

    // 4. Desglose diario
    const dailyResult = await query(
      `SELECT DATE(payment_date) AS date, COALESCE(SUM(amount), 0) AS total
       FROM payments p
       WHERE payment_date >= $1 AND payment_date <= $2 AND deleted_at IS NULL ${pCond}
       GROUP BY DATE(payment_date)
       ORDER BY DATE(payment_date) ASC`,
      [startDate, endDate]
    );

    return {
      total: parseFloat(totalResult.rows[0].total),
      byMethod: methodResult.rows.map(r => ({ method: r.method, total: parseFloat(r.total) })),
      byDoctor: doctorResult.rows.map(r => ({ doctor: r.doctor, total: parseFloat(r.total) })),
      daily: dailyResult.rows.map(r => ({ date: formatDateSQL(r.date), total: parseFloat(r.total) })),
    };
  }

  /**
   * Reporte de citas médicas.
   */
  async getAppointmentReport(startDate, endDate) {
    const aCond = this.getClinicCondition('a');
    
    // 1. Total de citas
    const totalResult = await query(
      `SELECT COUNT(*) AS total FROM appointments a
       WHERE appointment_date >= $1 AND appointment_date <= $2 AND deleted_at IS NULL ${aCond}`,
      [startDate, endDate]
    );

    // 2. Citas por estado
    const statusResult = await query(
      `SELECT s.label AS status, COUNT(a.id) AS count, s.color
       FROM appointments a
       INNER JOIN appointment_status s ON a.status_id = s.id
       WHERE a.appointment_date >= $1 AND a.appointment_date <= $2 AND a.deleted_at IS NULL ${aCond}
       GROUP BY s.label, s.color, s.sort_order
       ORDER BY s.sort_order`,
      [startDate, endDate]
    );

    // 3. Citas por doctor
    const doctorResult = await query(
      `SELECT CONCAT(u.first_name, ' ', u.last_name) AS doctor, COUNT(a.id) AS count
       FROM appointments a
       INNER JOIN doctors d ON a.doctor_id = d.id
       INNER JOIN users u ON d.user_id = u.id
       WHERE a.appointment_date >= $1 AND a.appointment_date <= $2 AND a.deleted_at IS NULL ${aCond}
       GROUP BY u.first_name, u.last_name`,
      [startDate, endDate]
    );

    return {
      total: parseInt(totalResult.rows[0].total, 10),
      byStatus: statusResult.rows.map(r => ({ status: r.status, count: parseInt(r.count, 10), color: r.color })),
      byDoctor: doctorResult.rows.map(r => ({ doctor: r.doctor, count: parseInt(r.count, 10) })),
    };
  }

  /**
   * Reporte demográfico de pacientes.
   */
  async getPatientReport(startDate, endDate) {
    const pCond = this.getClinicCondition('p');

    // Nuevos pacientes en el rango
    const newPatients = await query(
      `SELECT COUNT(*) AS count FROM patients p
       WHERE created_at >= $1 AND created_at <= $2 AND deleted_at IS NULL ${pCond}`,
      [startDate, endDate]
    );

    // Total de pacientes activos
    const totalActive = await query(
      `SELECT COUNT(*) AS count FROM patients p WHERE is_active = TRUE AND deleted_at IS NULL ${pCond}`
    );

    // Pacientes por género
    const genderResult = await query(
      `SELECT COALESCE(gender, 'no_especificado') AS gender, COUNT(*) AS count
       FROM patients p
       WHERE deleted_at IS NULL ${pCond}
       GROUP BY gender`
    );

    return {
      newPatients: parseInt(newPatients.rows[0].count, 10),
      totalActive: parseInt(totalActive.rows[0].count, 10),
      byGender: genderResult.rows.map(r => ({ gender: r.gender, count: parseInt(r.count, 10) })),
    };
  }

  /**
   * Reporte de tratamientos realizados y populares.
   */
  async getTreatmentReport(startDate, endDate) {
    const ptCond = this.getClinicCondition('pt');
    
    const popularResult = await query(
      `SELECT t.name AS treatment, COUNT(pt.id) AS count, COALESCE(SUM(pt.price), 0) AS total
       FROM patient_treatments pt
       INNER JOIN treatments t ON pt.treatment_id = t.id
       WHERE pt.deleted_at IS NULL
         AND pt.created_at::date >= $1
         AND pt.created_at::date <= $2 ${ptCond}
       GROUP BY t.name
       ORDER BY count DESC, total DESC
       LIMIT 10`,
      [startDate, endDate]
    );

    return {
      popular: popularResult.rows.map(r => ({
        treatment: r.treatment,
        count: parseInt(r.count, 10),
        total: parseFloat(r.total),
      })),
    };
  }

  /**
   * Obtiene las estadísticas resumidas para el Dashboard, según el rol del usuario.
   */
  async getDashboardStats(role, userId) {
    const today = new Date().toISOString().split('T')[0];
    const aCond = this.getClinicCondition('a');
    const pCond = this.getClinicCondition('p');
    const iCond = this.getClinicCondition('i');
    const dCond = this.getClinicCondition('d');

    // Consulta de citas de hoy
    let todayApptsQuery = `
      SELECT a.id, a.start_time, a.end_time, a.reason,
             CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
             CONCAT(u.first_name, ' ', u.last_name) AS doctor_name,
             s.label AS status_label, s.color AS status_color, s.name AS status_name
      FROM appointments a
      INNER JOIN patients p ON a.patient_id = p.id
      INNER JOIN doctors d ON a.doctor_id = d.id
      INNER JOIN users u ON d.user_id = u.id
      INNER JOIN appointment_status s ON a.status_id = s.id
      WHERE a.appointment_date = $1 AND a.deleted_at IS NULL AND u.is_active = TRUE ${aCond}`;
    
    const todayApptsParams = [today];

    if (role === 'doctor') {
      todayApptsQuery += ` AND d.user_id = $2`;
      todayApptsParams.push(userId);
    }

    todayApptsQuery += ` ORDER BY a.start_time ASC`;
    const todayApptsResult = await query(todayApptsQuery, todayApptsParams);

    // 1. Estadísticas para Propietario / Dirección (Ingresos, Facturas, Pacientes, Citas)
    if (role === 'propietario' || role === 'direccion') {
      const revenue = await query(
        `SELECT COALESCE(SUM(amount), 0) AS total FROM payments p
         WHERE DATE(payment_date) = $1 AND deleted_at IS NULL ${this.getClinicCondition('p')}`,
        [today]
      );
      const pendingInvoices = await query(
        `SELECT COALESCE(SUM(balance), 0) AS total, COUNT(*) AS count
         FROM invoices i WHERE status IN ('pendiente', 'parcial') AND deleted_at IS NULL ${iCond}`
      );
      const activePatients = await query(
        `SELECT COUNT(*) AS count FROM patients p WHERE is_active = TRUE AND deleted_at IS NULL ${pCond}`
      );
      const totalAppointments = await query(
        `SELECT COUNT(*) AS count FROM appointments a WHERE appointment_date = $1 AND deleted_at IS NULL ${aCond}`,
        [today]
      );

      return {
        role,
        stats: {
          todayRevenue: parseFloat(revenue.rows[0].total),
          pendingInvoicesAmount: parseFloat(pendingInvoices.rows[0].total),
          pendingInvoicesCount: parseInt(pendingInvoices.rows[0].count, 10),
          activePatients: parseInt(activePatients.rows[0].count, 10),
          todayAppointmentsCount: parseInt(totalAppointments.rows[0].count, 10),
        },
        todayAppointments: todayApptsResult.rows,
      };
    }

    // 2. Estadísticas para Recepcionista o Higienista
    if (role === 'recepcionista' || role === 'higienista') {
      const activePatients = await query(
        `SELECT COUNT(*) AS count FROM patients p WHERE is_active = TRUE AND deleted_at IS NULL ${pCond}`
      );
      const newPatients = await query(
        `SELECT COUNT(*) AS count FROM patients p
         WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE) AND deleted_at IS NULL ${pCond}`
      );
      const todayAppointments = await query(
        `SELECT COUNT(*) AS count FROM appointments a WHERE appointment_date = $1 AND deleted_at IS NULL ${aCond}`,
        [today]
      );
 
      return {
        role,
        stats: {
          activePatients: parseInt(activePatients.rows[0].count, 10),
          newPatientsThisMonth: parseInt(newPatients.rows[0].count, 10),
          todayAppointmentsCount: parseInt(todayAppointments.rows[0].count, 10),
        },
        todayAppointments: todayApptsResult.rows,
      };
    }

    // 3. Estadísticas para Doctor
    if (role === 'doctor') {
      const docResult = await query(`SELECT id FROM doctors d WHERE d.user_id = $1 ${this.getClinicCondition('d')}`, [userId]);
      const doctorId = docResult.rows[0]?.id;

      const myPatientsCount = await query(
        `SELECT COUNT(DISTINCT patient_id) AS count FROM appointments a
         WHERE a.doctor_id = $1 AND a.deleted_at IS NULL ${aCond}`,
        [doctorId]
      );
      const todayAppointments = await query(
        `SELECT COUNT(*) AS count FROM appointments a
         WHERE a.doctor_id = $1 AND a.appointment_date = $2 AND a.deleted_at IS NULL ${aCond}`,
        [doctorId, today]
      );

      return {
        role,
        stats: {
          myPatientsCount: parseInt(myPatientsCount.rows[0].count, 10),
          todayAppointmentsCount: parseInt(todayAppointments.rows[0].count, 10),
        },
        todayAppointments: todayApptsResult.rows,
      };
    }

    return { role, stats: {} };
  }
}

export default new ReportService();
