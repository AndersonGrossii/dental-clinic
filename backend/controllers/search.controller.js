// ============================================
// Controlador de Búsqueda Global
// ============================================
import searchService from '../services/search.service.js';
import { ApiResponse } from '../utils/response.js';

export const globalSearch = async (req, res, next) => {
  try {
    const { q } = req.query; // Término de búsqueda
    const roleName = req.user.roleName;

    if (!q || q.trim() === '') {
      return ApiResponse.success(res, {}, 'Ingrese un término de búsqueda');
    }

    const results = await searchService.globalSearch(q.trim(), roleName);
    return ApiResponse.success(res, results, 'Búsqueda global completada exitosamente');
  } catch (error) {
    next(error);
  }
};
