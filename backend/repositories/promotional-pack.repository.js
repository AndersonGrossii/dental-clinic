// ============================================
// Repositorio de Packs Promocionales de Tratamientos
// ============================================
import { query, transaction, scopeClinic, als } from '../database/pool.js';
import { BaseRepository } from './base.repository.js';

class PromotionalPackRepository extends BaseRepository {
  constructor() {
    super('promotional_packs');
  }

  /**
   * Obtiene todos los packs de la clínica activa con sus tratamientos incluidos.
   */
  async findAllWithItems({ includeInactive = false, search = '' } = {}) {
    const conditions = ['p.deleted_at IS NULL'];
    const params = [];
    scopeClinic(conditions, params, 'p');
    let paramIndex = params.length + 1;

    if (!includeInactive) {
      conditions.push('p.is_active = TRUE');
    }

    if (search) {
      conditions.push(`(p.name ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const sql = `
      SELECT p.*,
             COALESCE(
               json_agg(
                 json_build_object(
                   'id', pi.id,
                   'treatment_id', t.id,
                   'treatment_name', t.name,
                   'treatment_code', t.code,
                   'default_price', t.default_price,
                   'quantity', pi.quantity,
                   'sort_order', pi.sort_order
                 ) ORDER BY pi.sort_order ASC, pi.id ASC
               ) FILTER (WHERE pi.id IS NOT NULL AND t.id IS NOT NULL),
               '[]'::json
             ) AS items,
             COALESCE(
               SUM(t.default_price * pi.quantity) FILTER (WHERE t.id IS NOT NULL),
               0
             ) AS original_total_price
      FROM promotional_packs p
      LEFT JOIN promotional_pack_items pi ON p.id = pi.pack_id
      LEFT JOIN treatments t ON pi.treatment_id = t.id AND t.deleted_at IS NULL
      ${whereClause}
      GROUP BY p.id
      ORDER BY p.is_active DESC, p.name ASC
    `;

    const result = await query(sql, params);
    return result.rows;
  }

  /**
   * Obtiene un pack promocional específico por ID con sus tratamientos incluidos.
   */
  async findByIdWithItems(id) {
    const conditions = ['p.deleted_at IS NULL', 'p.id = $1'];
    const params = [id];
    scopeClinic(conditions, params, 'p');

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const sql = `
      SELECT p.*,
             COALESCE(
               json_agg(
                 json_build_object(
                   'id', pi.id,
                   'treatment_id', t.id,
                   'treatment_name', t.name,
                   'treatment_code', t.code,
                   'default_price', t.default_price,
                   'quantity', pi.quantity,
                   'sort_order', pi.sort_order
                 ) ORDER BY pi.sort_order ASC, pi.id ASC
               ) FILTER (WHERE pi.id IS NOT NULL AND t.id IS NOT NULL),
               '[]'::json
             ) AS items,
             COALESCE(
               SUM(t.default_price * pi.quantity) FILTER (WHERE t.id IS NOT NULL),
               0
             ) AS original_total_price
      FROM promotional_packs p
      LEFT JOIN promotional_pack_items pi ON p.id = pi.pack_id
      LEFT JOIN treatments t ON pi.treatment_id = t.id AND t.deleted_at IS NULL
      ${whereClause}
      GROUP BY p.id
    `;

    const result = await query(sql, params);
    return result.rows[0] || null;
  }

  /**
   * Crea un pack promocional con sus tratamientos dentro de una transacción.
   */
  async createWithItems(packData, items = []) {
    return transaction(async (client) => {
      const store = als.getStore();
      const clinicId = store?.clinicId || packData.clinic_id || 1;

      const packInsertSql = `
        INSERT INTO promotional_packs (clinic_id, name, description, fixed_price, is_active, start_date, end_date, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;
      const packValues = [
        clinicId,
        packData.name,
        packData.description || null,
        packData.fixed_price,
        packData.is_active !== undefined ? packData.is_active : true,
        packData.start_date || null,
        packData.end_date || null,
        packData.created_by || null,
      ];

      const packResult = await client.query(packInsertSql, packValues);
      const createdPack = packResult.rows[0];

      const insertedItems = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const itemSql = `
          INSERT INTO promotional_pack_items (pack_id, treatment_id, clinic_id, quantity, sort_order)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING *
        `;
        const itemValues = [
          createdPack.id,
          item.treatment_id,
          clinicId,
          item.quantity || 1,
          item.sort_order !== undefined ? item.sort_order : i,
        ];
        const itemRes = await client.query(itemSql, itemValues);
        insertedItems.push(itemRes.rows[0]);
      }

      return {
        ...createdPack,
        items: insertedItems,
      };
    });
  }

  /**
   * Actualiza un pack promocional y reemplaza sus ítems en una transacción.
   */
  async updateWithItems(id, packData, items = null) {
    return transaction(async (client) => {
      const store = als.getStore();
      const clinicId = store?.clinicId;

      const fields = [];
      const values = [];
      let idx = 1;

      if (packData.name !== undefined) {
        fields.push(`name = $${idx++}`);
        values.push(packData.name);
      }
      if (packData.description !== undefined) {
        fields.push(`description = $${idx++}`);
        values.push(packData.description);
      }
      if (packData.fixed_price !== undefined) {
        fields.push(`fixed_price = $${idx++}`);
        values.push(packData.fixed_price);
      }
      if (packData.is_active !== undefined) {
        fields.push(`is_active = $${idx++}`);
        values.push(packData.is_active);
      }
      if (packData.start_date !== undefined) {
        fields.push(`start_date = $${idx++}`);
        values.push(packData.start_date);
      }
      if (packData.end_date !== undefined) {
        fields.push(`end_date = $${idx++}`);
        values.push(packData.end_date);
      }

      fields.push(`updated_at = NOW()`);

      let updatedPack = null;
      if (fields.length > 1) {
        const conditions = [`id = $${idx++}`, 'deleted_at IS NULL'];
        values.push(id);
        if (clinicId) {
          conditions.push(`clinic_id = $${idx++}`);
          values.push(clinicId);
        }

        const updateSql = `
          UPDATE promotional_packs
          SET ${fields.join(', ')}
          WHERE ${conditions.join(' AND ')}
          RETURNING *
        `;
        const res = await client.query(updateSql, values);
        updatedPack = res.rows[0];
      }

      if (items !== null && Array.isArray(items)) {
        // Eliminar ítems previos del pack
        const deleteSql = `
          DELETE FROM promotional_pack_items
          WHERE pack_id = $1 ${clinicId ? 'AND clinic_id = $2' : ''}
        `;
        await client.query(deleteSql, clinicId ? [id, clinicId] : [id]);

        // Insertar nuevos ítems
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const insertItemSql = `
            INSERT INTO promotional_pack_items (pack_id, treatment_id, clinic_id, quantity, sort_order)
            VALUES ($1, $2, $3, $4, $5)
          `;
          await client.query(insertItemSql, [
            id,
            item.treatment_id,
            clinicId || updatedPack?.clinic_id || 1,
            item.quantity || 1,
            item.sort_order !== undefined ? item.sort_order : i,
          ]);
        }
      }

      return this.findByIdWithItems(id);
    });
  }

  /**
   * Activa o desactiva un pack promocional.
   */
  async toggleStatus(id, isActive) {
    const store = als.getStore();
    const clinicId = store?.clinicId;
    const conditions = ['id = $1', 'deleted_at IS NULL'];
    const params = [id, isActive];
    if (clinicId) {
      conditions.push('clinic_id = $3');
      params.push(clinicId);
    }

    const sql = `
      UPDATE promotional_packs
      SET is_active = $2, updated_at = NOW()
      WHERE ${conditions.join(' AND ')}
      RETURNING *
    `;
    const result = await query(sql, params);
    return result.rows[0] || null;
  }

  /**
   * Eliminación lógica (soft delete) del pack promocional.
   */
  async softDelete(id) {
    const store = als.getStore();
    const clinicId = store?.clinicId;
    const conditions = ['id = $1', 'deleted_at IS NULL'];
    const params = [id];
    if (clinicId) {
      conditions.push('clinic_id = $2');
      params.push(clinicId);
    }

    const sql = `
      UPDATE promotional_packs
      SET deleted_at = NOW(), is_active = FALSE, updated_at = NOW()
      WHERE ${conditions.join(' AND ')}
      RETURNING *
    `;
    const result = await query(sql, params);
    return result.rows[0] || null;
  }
}

export default new PromotionalPackRepository();
