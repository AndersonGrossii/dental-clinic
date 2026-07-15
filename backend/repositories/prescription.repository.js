import { query, scopeClinic, transaction, als } from '../database/pool.js';
import { BaseRepository } from './base.repository.js';

class PrescriptionRepository extends BaseRepository {
  constructor() {
    super('prescriptions');
  }

  async generateNumber() {
    const store = als.getStore();
    let clinicSuffix = '';
    if (store?.clinicId) {
      const codeResult = await query('SELECT code FROM clinics WHERE id = $1', [store.clinicId]);
      if (codeResult.rows.length > 0) {
        clinicSuffix = '-' + codeResult.rows[0].code;
      }
    }
    const result = await query("SELECT nextval('prescription_number_seq') AS seq");
    const seq = result.rows[0].seq.toString().padStart(4, '0');
    return `PRC-${seq}${clinicSuffix}`;
  }

  async findByPatient(patientId, { limit = 20, offset = 0, sortBy = 'p.issued_date', sortOrder = 'DESC' } = {}) {
    const conditions = ['p.deleted_at IS NULL'];
    const params = [];
    scopeClinic(conditions, params, 'p');
    conditions.push(`p.patient_id = $${params.length + 1}`);
    params.push(patientId);
    let paramIndex = params.length + 1;

    const safeSortBy = /^[a-zA-Z_.]+$/.test(sortBy) ? sortBy : 'p.issued_date';
    const safeSortOrder = sortOrder === 'ASC' ? 'ASC' : 'DESC';

    const countResult = await query(
      `SELECT COUNT(*) AS total
       FROM prescriptions p
       WHERE ${conditions.join(' AND ')}`,
      params
    );
    const total = parseInt(countResult.rows[0].total, 10);

    const dataResult = await query(
      `SELECT p.*,
              CONCAT(u.first_name, ' ', u.last_name) AS doctor_name,
              doc.specialty AS doctor_specialty
       FROM prescriptions p
       LEFT JOIN doctors doc ON p.doctor_id = doc.id
       LEFT JOIN users u ON doc.user_id = u.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY ${safeSortBy} ${safeSortOrder}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    return { rows: dataResult.rows, total };
  }

  async findByIdWithItems(id) {
    const conditions = ['p.deleted_at IS NULL'];
    const params = [id];
    scopeClinic(conditions, params, 'p');
    conditions.push(`p.id = $1`);

    const prescResult = await query(
      `SELECT p.*,
              CONCAT(pt.first_name, ' ', pt.last_name) AS patient_name,
              pt.dni AS patient_dni,
              CONCAT(u.first_name, ' ', u.last_name) AS doctor_name,
              doc.specialty AS doctor_specialty
       FROM prescriptions p
       INNER JOIN patients pt ON p.patient_id = pt.id
       LEFT JOIN doctors doc ON p.doctor_id = doc.id
       LEFT JOIN users u ON doc.user_id = u.id
       WHERE ${conditions.join(' AND ')}`,
      params
    );

    if (prescResult.rows.length === 0) return null;

    const itemsResult = await query(
      `SELECT * FROM prescription_items
       WHERE prescription_id = $1
       ORDER BY sort_order ASC, id ASC`,
      [id]
    );

    return { ...prescResult.rows[0], items: itemsResult.rows };
  }

  async createWithItems(prescriptionData, items) {
    return transaction(async (client) => {
      const clinicId = this.getClinicId();
      const dataWithClinic = { ...prescriptionData, clinic_id: clinicId };

      const keys = Object.keys(dataWithClinic);
      const values = Object.values(dataWithClinic);
      const placeholders = keys.map((_, i) => `$${i + 1}`);

      const prescResult = await client.query(
        `INSERT INTO prescriptions (${keys.join(', ')})
         VALUES (${placeholders.join(', ')})
         RETURNING *`,
        values
      );

      const prescription = prescResult.rows[0];
      const insertedItems = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const itemResult = await client.query(
          `INSERT INTO prescription_items (prescription_id, medication_name, dosage, frequency, duration, instructions, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [prescription.id, item.medication_name, item.dosage || null, item.frequency || null, item.duration || null, item.instructions || null, i]
        );
        insertedItems.push(itemResult.rows[0]);
      }

      return { ...prescription, items: insertedItems };
    });
  }
}

export default new PrescriptionRepository();
