// ============================================
// Repositorio de Usuarios
// ============================================
import { BaseRepository } from './base.repository.js';
import { query } from '../database/pool.js';

/**
 * Repositorio para operaciones de datos de usuarios.
 * Extiende BaseRepository con métodos específicos para la tabla users.
 */
class UserRepository extends BaseRepository {
  constructor() {
    super('users');
  }

  /**
   * Busca un usuario por correo electrónico.
   * @param {string} email
   * @returns {Promise<object|null>}
   */
  async findByEmail(email) {
    const result = await query(
      `SELECT u.*, r.name AS role_name
       FROM users u
       INNER JOIN roles r ON u.role_id = r.id
       WHERE u.email = $1 AND u.deleted_at IS NULL`,
      [email]
    );
    return result.rows[0] || null;
  }

  /**
   * Obtiene todos los usuarios con información de su rol, con paginación.
   * @param {object} options - { limit, offset, sortBy, sortOrder, filters }
   * @returns {Promise<{ rows: Array, total: number }>}
   */
  async findAllWithRoles({ limit = 20, offset = 0, sortBy = 'u.created_at', sortOrder = 'DESC', filters = {} } = {}) {
    const conditions = ['u.deleted_at IS NULL'];
    const params = [];
    let paramIndex = 1;

    // Filtro por rol
    if (filters.roleId) {
      conditions.push(`u.role_id = $${paramIndex}`);
      params.push(filters.roleId);
      paramIndex++;
    }

    // Filtro por estado activo
    if (filters.isActive !== undefined && filters.isActive !== '') {
      conditions.push(`u.is_active = $${paramIndex}`);
      params.push(filters.isActive);
      paramIndex++;
    }

    // Filtro por búsqueda de texto (nombre o email)
    if (filters.search) {
      conditions.push(`(u.first_name ILIKE $${paramIndex} OR u.last_name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`);
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const safeSortBy = /^[a-zA-Z_.]+$/.test(sortBy) ? sortBy : 'u.created_at';
    const safeSortOrder = sortOrder === 'ASC' ? 'ASC' : 'DESC';

    // Contar total
    const countResult = await query(
      `SELECT COUNT(*) AS total FROM users u ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total, 10);

    // Obtener datos con rol
    const dataResult = await query(
      `SELECT u.id, u.role_id, u.first_name, u.last_name, u.email, u.phone,
              u.avatar_url, u.is_active, u.last_login, u.created_at, u.updated_at,
              r.name AS role_name, r.description AS role_description
       FROM users u
       INNER JOIN roles r ON u.role_id = r.id
       ${whereClause}
       ORDER BY ${safeSortBy} ${safeSortOrder}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    return { rows: dataResult.rows, total };
  }

  /**
   * Busca un usuario por ID con información de su rol.
   * @param {number} id
   * @returns {Promise<object|null>}
   */
  async findByIdWithRole(id) {
    const result = await query(
      `SELECT u.id, u.role_id, u.first_name, u.last_name, u.email, u.phone,
              u.avatar_url, u.is_active, u.last_login, u.created_at, u.updated_at,
              r.name AS role_name, r.description AS role_description,
              d.id AS doctor_id, d.specialty, d.license_number
       FROM users u
       INNER JOIN roles r ON u.role_id = r.id
       LEFT JOIN doctors d ON d.user_id = u.id AND d.deleted_at IS NULL
       WHERE u.id = $1 AND u.deleted_at IS NULL`,
      [id]
    );
    return result.rows[0] || null;
  }
}

export default new UserRepository();
