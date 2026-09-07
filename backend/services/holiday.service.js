// ============================================
// Servicio de Días Festivos y Bloqueos de Agenda
// ============================================
import holidayRepository from '../repositories/holiday.repository.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

class HolidayService {
  /**
   * Catálogo de festivos oficiales (Nacionales y Comunitat Valenciana) por año.
   */
  getOfficialHolidaysCatalog(year) {
    const y = parseInt(year, 10);
    if (y === 2026) {
      return [
        { holidayDate: `${y}-01-01`, name: 'Año Nuevo', scope: 'NACIONAL', description: 'Festivo Nacional de España' },
        { holidayDate: `${y}-01-06`, name: 'Epifanía del Señor (Reyes Magos)', scope: 'NACIONAL', description: 'Festivo Nacional de España' },
        { holidayDate: `${y}-03-19`, name: 'San José', scope: 'AUTONOMICO', description: 'Festivo Comunitat Valenciana' },
        { holidayDate: `${y}-04-03`, name: 'Viernes Santo', scope: 'NACIONAL', description: 'Festivo Nacional de España' },
        { holidayDate: `${y}-04-06`, name: 'Lunes de Pascua', scope: 'AUTONOMICO', description: 'Festivo Comunitat Valenciana' },
        { holidayDate: `${y}-04-13`, name: 'San Vicente Ferrer', scope: 'LOCAL', description: 'Festivo Local de Alcàntera de Xúquer' },
        { holidayDate: `${y}-05-01`, name: 'Fiesta del Trabajo', scope: 'NACIONAL', description: 'Festivo Nacional de España' },
        { holidayDate: `${y}-06-24`, name: 'San Juan', scope: 'AUTONOMICO', description: 'Festivo Comunitat Valenciana' },
        { holidayDate: `${y}-08-15`, name: 'Asunción de la Virgen', scope: 'NACIONAL', description: 'Festivo Nacional de España' },
        { holidayDate: `${y}-09-04`, name: 'Fiestas Patronales (Santíssim Crist del Miracle)', scope: 'LOCAL', description: 'Festivo Local de Alcàntera de Xúquer' },
        { holidayDate: `${y}-10-09`, name: 'Día de la Comunitat Valenciana', scope: 'AUTONOMICO', description: 'Festivo Autonómico Comunitat Valenciana' },
        { holidayDate: `${y}-10-12`, name: 'Fiesta Nacional de España', scope: 'NACIONAL', description: 'Festivo Nacional de España' },
        { holidayDate: `${y}-11-01`, name: 'Todos los Santos', scope: 'NACIONAL', description: 'Festivo Nacional de España' },
        { holidayDate: `${y}-12-06`, name: 'Día de la Constitución Española', scope: 'NACIONAL', description: 'Festivo Nacional de España' },
        { holidayDate: `${y}-12-08`, name: 'Inmaculada Concepción', scope: 'NACIONAL', description: 'Festivo Nacional de España' },
        { holidayDate: `${y}-12-25`, name: 'Natividad del Señor (Navidad)', scope: 'NACIONAL', description: 'Festivo Nacional de España' },
      ];
    } else if (y === 2027) {
      return [
        { holidayDate: `${y}-01-01`, name: 'Año Nuevo', scope: 'NACIONAL', description: 'Festivo Nacional de España' },
        { holidayDate: `${y}-01-06`, name: 'Epifanía del Señor (Reyes Magos)', scope: 'NACIONAL', description: 'Festivo Nacional de España' },
        { holidayDate: `${y}-03-19`, name: 'San José', scope: 'AUTONOMICO', description: 'Festivo Comunitat Valenciana' },
        { holidayDate: `${y}-03-26`, name: 'Viernes Santo', scope: 'NACIONAL', description: 'Festivo Nacional de España' },
        { holidayDate: `${y}-03-29`, name: 'Lunes de Pascua', scope: 'AUTONOMICO', description: 'Festivo Comunitat Valenciana' },
        { holidayDate: `${y}-04-05`, name: 'San Vicente Ferrer', scope: 'LOCAL', description: 'Festivo Local de Alcàntera de Xúquer' },
        { holidayDate: `${y}-05-01`, name: 'Fiesta del Trabajo', scope: 'NACIONAL', description: 'Festivo Nacional de España' },
        { holidayDate: `${y}-06-24`, name: 'San Juan', scope: 'AUTONOMICO', description: 'Festivo Comunitat Valenciana' },
        { holidayDate: `${y}-08-15`, name: 'Asunción de la Virgen', scope: 'NACIONAL', description: 'Festivo Nacional de España' },
        { holidayDate: `${y}-09-03`, name: 'Fiestas Patronales (Santíssim Crist del Miracle)', scope: 'LOCAL', description: 'Festivo Local de Alcàntera de Xúquer' },
        { holidayDate: `${y}-10-09`, name: 'Día de la Comunitat Valenciana', scope: 'AUTONOMICO', description: 'Festivo Autonómico Comunitat Valenciana' },
        { holidayDate: `${y}-10-12`, name: 'Fiesta Nacional de España', scope: 'NACIONAL', description: 'Festivo Nacional de España' },
        { holidayDate: `${y}-11-01`, name: 'Todos los Santos', scope: 'NACIONAL', description: 'Festivo Nacional de España' },
        { holidayDate: `${y}-12-06`, name: 'Día de la Constitución Española', scope: 'NACIONAL', description: 'Festivo Nacional de España' },
        { holidayDate: `${y}-12-08`, name: 'Inmaculada Concepción', scope: 'NACIONAL', description: 'Festivo Nacional de España' },
        { holidayDate: `${y}-12-25`, name: 'Natividad del Señor (Navidad)', scope: 'NACIONAL', description: 'Festivo Nacional de España' },
      ];
    }

    // Para otros años, festivos fijos por defecto
    return [
      { holidayDate: `${y}-01-01`, name: 'Año Nuevo', scope: 'NACIONAL', description: 'Festivo Nacional' },
      { holidayDate: `${y}-01-06`, name: 'Epifanía del Señor (Reyes Magos)', scope: 'NACIONAL', description: 'Festivo Nacional' },
      { holidayDate: `${y}-03-19`, name: 'San José', scope: 'AUTONOMICO', description: 'Festivo Comunitat Valenciana' },
      { holidayDate: `${y}-05-01`, name: 'Fiesta del Trabajo', scope: 'NACIONAL', description: 'Festivo Nacional' },
      { holidayDate: `${y}-06-24`, name: 'San Juan', scope: 'AUTONOMICO', description: 'Festivo Comunitat Valenciana' },
      { holidayDate: `${y}-08-15`, name: 'Asunción de la Virgen', scope: 'NACIONAL', description: 'Festivo Nacional' },
      { holidayDate: `${y}-10-09`, name: 'Día de la Comunitat Valenciana', scope: 'AUTONOMICO', description: 'Festivo Comunitat Valenciana' },
      { holidayDate: `${y}-10-12`, name: 'Fiesta Nacional de España', scope: 'NACIONAL', description: 'Festivo Nacional' },
      { holidayDate: `${y}-11-01`, name: 'Todos los Santos', scope: 'NACIONAL', description: 'Festivo Nacional' },
      { holidayDate: `${y}-12-06`, name: 'Día de la Constitución', scope: 'NACIONAL', description: 'Festivo Nacional' },
      { holidayDate: `${y}-12-08`, name: 'Inmaculada Concepción', scope: 'NACIONAL', description: 'Festivo Nacional' },
      { holidayDate: `${y}-12-25`, name: 'Navidad', scope: 'NACIONAL', description: 'Festivo Nacional' },
    ];
  }

  /**
   * Obtiene la lista de festivos.
   */
  async getHolidays(clinicId, dateFrom = null, dateTo = null) {
    return holidayRepository.getHolidays(clinicId, dateFrom, dateTo);
  }

  /**
   * Comprueba si una fecha es festivo para la clínica.
   */
  async isHoliday(clinicId, dateStr) {
    const cleanDate = typeof dateStr === 'string' ? dateStr.split('T')[0] : new Date(dateStr).toISOString().split('T')[0];
    const holiday = await holidayRepository.getHolidayByDate(clinicId, cleanDate);
    return holiday;
  }

  /**
   * Registra un nuevo festivo en la clínica.
   */
  async createHoliday(clinicId, data, userId) {
    const { holiday_date, name, scope = 'LOCAL', description = null, is_full_day = true } = data;

    if (!holiday_date) {
      throw new AppError('La fecha del festivo es obligatoria.', 400);
    }
    if (!name || !name.trim()) {
      throw new AppError('El nombre del festivo es obligatorio.', 400);
    }

    const cleanDate = holiday_date.split('T')[0];

    const record = await holidayRepository.createHoliday({
      clinicId,
      holidayDate: cleanDate,
      name: name.trim(),
      scope,
      description: description ? description.trim() : null,
      isFullDay: Boolean(is_full_day),
      createdBy: userId,
    });

    logger.info(`Festivo "${name}" registrado para la clínica #${clinicId} el día ${cleanDate}`);
    return record;
  }

  /**
   * Elimina un festivo.
   */
  async deleteHoliday(id, clinicId) {
    const deleted = await holidayRepository.deleteHoliday(id, clinicId);
    if (!deleted) {
      throw new AppError('Festivo no encontrado o no pertenece a esta clínica.', 404);
    }
    logger.info(`Festivo #${id} eliminado de la clínica #${clinicId}`);
    return deleted;
  }

  /**
   * Carga o re-sincroniza los festivos oficiales de la Comunitat Valenciana para un año.
   */
  async seedOfficialHolidays(clinicId, year, userId) {
    const targetYear = parseInt(year, 10) || new Date().getFullYear();
    const catalog = this.getOfficialHolidaysCatalog(targetYear);
    const createdList = [];

    for (const item of catalog) {
      const rec = await holidayRepository.createHoliday({
        clinicId,
        holidayDate: item.holidayDate,
        name: item.name,
        scope: item.scope,
        description: item.description,
        isFullDay: true,
        createdBy: userId,
      });
      createdList.push(rec);
    }

    logger.info(`Se han sincronizado ${createdList.length} festivos oficiales de la Comunitat Valenciana para el año ${targetYear} en clínica #${clinicId}`);
    return createdList;
  }
}

export default new HolidayService();
