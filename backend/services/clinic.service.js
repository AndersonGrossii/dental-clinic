// ============================================
// Servicio de Clínicas
// ============================================
import clinicRepository from '../repositories/clinic.repository.js';

class ClinicService {
  async getClinics(user) {
    return await clinicRepository.getClinicsForUser(user.id, user.roleName);
  }
}

export default new ClinicService();
