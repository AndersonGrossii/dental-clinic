// ============================================
// Servicio de Búsqueda Global
// ============================================
import api from './api.service.js';

class SearchService {
  async globalSearch(term) {
    return await api.get('/search', { q: term });
  }
}

const searchService = new SearchService();
export default searchService;
