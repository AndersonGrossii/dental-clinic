// ============================================
// Servicio de Agendamiento en Segundo Plano (Background Cron Engine)
// Ejecuta de forma 100% autónoma las confirmaciones 24h y los recalls diarios
// ============================================
import automationSchedulerService from './automation-scheduler.service.js';
import internalChatService from './internal-chat.service.js';
import { query } from '../database/pool.js';
import { logger } from '../utils/logger.js';

class CronService {
  constructor() {
    this.timer = null;
    this.isRunning = false;
    this.lastExecutedDates = {
      confirmations: null,
      recall: null,
    };
    this.lastPurgeDate = null;
  }

  /**
   * Inicia el motor de cron en segundo plano.
   */
  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    logger.info('⏰ [CRON] Motor de automatizaciones en segundo plano iniciado.');

    // Ejecutar verificación de pulso cada 60 segundos
    this.timer = setInterval(() => this.tick(), 60000);

    // Pulso inicial inmediato al arrancar el servidor
    this.tick();
  }

  /**
   * Detiene el motor de cron.
   */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    logger.info('⏹️ [CRON] Motor de automatizaciones detenido.');
  }

  /**
   * Pulso periódico ejecutado cada minuto para verificar tareas pendientes.
   */
  async tick() {
    try {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const todayDateStr = now.toISOString().split('T')[0];

      // 1. Tarea de Confirmación de Citas 24h (Programada diariamente a las 09:00 AM)
      if (currentHour >= 9 && this.lastExecutedDates.confirmations !== todayDateStr) {
        this.lastExecutedDates.confirmations = todayDateStr;
        await this.executeAllClinicsConfirmations();
      }

      // 2. Tarea de Recall y Retención Preventiva (Programada diariamente a las 10:00 AM)
      if (currentHour >= 10 && this.lastExecutedDates.recall !== todayDateStr) {
        this.lastExecutedDates.recall = todayDateStr;
        await this.executeAllClinicsRecall();
      }

      // 3. Tarea de Purga de Chat Interno (Mensajes del día anterior, ejecutar a medianoche)
      if (currentHour === 0 && this.lastPurgeDate !== todayDateStr) {
        this.lastPurgeDate = todayDateStr;
        await this.executePurgeChatMessages();
      }
    } catch (err) {
      logger.error('❌ [CRON] Error en pulso del cron scheduler:', err.message);
    }
  }

  /**
   * Purgado de mensajes de chat interno anteriores al día actual (se ejecuta a medianoche).
   */
  async executePurgeChatMessages() {
    try {
      const deleted = await internalChatService.purgeExpired();
      if (deleted > 0) {
        logger.info(`🧹 [CRON] Purgados ${deleted} mensajes de chat interno del día anterior.`);
      }
    } catch (err) {
      logger.error('❌ [CRON] Error al purgar mensajes antiguos de chat interno:', err.message);
    }
  }

  /**
   * Ejecuta el escaneo de confirmaciones 24h para todas las clínicas activas.
   */
  async executeAllClinicsConfirmations() {
    try {
      logger.info('🚀 [CRON] Iniciando escaneo autónomo de confirmaciones 24h...');
      const clinicsRes = await query(
        `SELECT id, name FROM clinics WHERE is_active = TRUE ORDER BY id ASC`
      );

      for (const clinic of clinicsRes.rows) {
        logger.info(`[CRON] Procesando confirmaciones para clínica #${clinic.id} (${clinic.name})...`);
        const result = await automationSchedulerService.run24hAppointmentConfirmationScan(clinic.id);
        logger.info(`[CRON] Clínica #${clinic.id}: ${result.sent} recordatorios 24h enviados.`);
      }
    } catch (err) {
      logger.error('❌ [CRON] Error ejecutando confirmaciones automáticas:', err);
    }
  }

  /**
   * Ejecuta el barrido de recall diario para todas las clínicas activas.
   */
  async executeAllClinicsRecall() {
    try {
      logger.info('🚀 [CRON] Iniciando barrido diario autónomo de recall...');
      const clinicsRes = await query(
        `SELECT id, name FROM clinics WHERE is_active = TRUE ORDER BY id ASC`
      );

      for (const clinic of clinicsRes.rows) {
        logger.info(`[CRON] Procesando recall para clínica #${clinic.id} (${clinic.name})...`);
        const result = await automationSchedulerService.runDailyRecallSweep(clinic.id);
        logger.info(`[CRON] Clínica #${clinic.id}: ${result.total} mensajes de recall disparados.`);
      }
    } catch (err) {
      logger.error('❌ [CRON] Error ejecutando recall automático:', err);
    }
  }

  /**
   * Estado actual del planificador.
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastExecutedDates: this.lastExecutedDates,
      serverTime: new Date().toISOString(),
    };
  }
}

export default new CronService();
