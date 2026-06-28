// ============================================
// Utilidades de Paginación
// ============================================

/**
 * Extrae parámetros de paginación de la query string.
 * @param {object} query - req.query
 * @param {number} [defaultLimit=20]
 * @returns {{ page: number, limit: number, offset: number, sortBy: string, sortOrder: string }}
 */
export const parsePagination = (query, defaultLimit = 20) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  const offset = (page - 1) * limit;
  const sortBy = query.sortBy || 'created_at';
  const sortOrder = query.sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  return { page, limit, offset, sortBy, sortOrder };
};

/**
 * Genera metadata de paginación para la respuesta.
 * @param {number} totalItems - Total de registros
 * @param {number} page - Página actual
 * @param {number} limit - Registros por página
 * @returns {object}
 */
export const buildPaginationMeta = (totalItems, page, limit) => {
  const totalPages = Math.ceil(totalItems / limit);
  return {
    currentPage: page,
    totalPages,
    totalItems,
    itemsPerPage: limit,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
};
