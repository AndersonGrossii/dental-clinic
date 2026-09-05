// ============================================
// Servicio de Transmisión de Eventos en Tiempo Real (SSE Stream Hub)
// Sincroniza al instante la Agenda, Mensajería y Tareas de la Clínica
// ============================================
import { logger } from '../utils/logger.js';

class EventStreamService {
  constructor() {
    // Mapa de conexiones activas: clinicId -> Set de objetos Response
    this.clients = new Map();
    
    // Heartbeat cada 25 segundos para mantener vivas las conexiones
    setInterval(() => this.sendHeartbeat(), 25000);
  }

  /**
   * Registra un nuevo cliente SSE para una clínica específica.
   */
  addClient(clinicId, userId, res) {
    const cId = String(clinicId || 1);
    if (!this.clients.has(cId)) {
      this.clients.set(cId, new Set());
    }

    const clientObj = { userId, res };
    this.clients.get(cId).add(clientObj);

    logger.info(`⚡ [SSE] Cliente conectado (Usuario #${userId}, Clínica #${cId}). Clientes activos: ${this.clients.get(cId).size}`);

    // Enviar evento de bienvenida / conexión establecida
    this.sendToClient(res, 'CONNECTED', {
      connected: true,
      clinicId: cId,
      userId,
      timestamp: new Date().toISOString(),
    });

    // Limpiar al desconectar
    res.on('close', () => {
      if (this.clients.has(cId)) {
        this.clients.get(cId).delete(clientObj);
        if (this.clients.get(cId).size === 0) {
          this.clients.delete(cId);
        }
      }
      logger.info(`⚡ [SSE] Cliente desconectado (Usuario #${userId}, Clínica #${cId})`);
    });
  }

  /**
   * Envía un evento a todos los clientes conectados de una clínica.
   */
  broadcastToClinic(clinicId, eventType, data = {}) {
    const cId = String(clinicId || 1);
    const clinicClients = this.clients.get(cId);
    if (!clinicClients || clinicClients.size === 0) return;

    logger.debug(`⚡ [SSE] Broadcast '${eventType}' para clínica #${cId} a ${clinicClients.size} clientes`);

    for (const client of clinicClients) {
      try {
        this.sendToClient(client.res, eventType, data);
      } catch (err) {
        logger.error('Error enviando evento SSE a cliente:', err.message);
      }
    }
  }

  /**
   * Envía un evento a un usuario específico conectado de una clínica.
   */
  sendToUser(clinicId, targetUserId, eventType, data = {}) {
    const cId = String(clinicId || 1);
    const clinicClients = this.clients.get(cId);
    if (!clinicClients || clinicClients.size === 0) return;

    for (const client of clinicClients) {
      if (String(client.userId) === String(targetUserId)) {
        try {
          this.sendToClient(client.res, eventType, data);
        } catch (err) {
          logger.error(`Error enviando evento SSE a usuario #${targetUserId}:`, err.message);
        }
      }
    }
  }

  /**
   * Helper para formatear y enviar mensaje SSE.
   */
  sendToClient(res, eventType, data) {
    const payload = JSON.stringify(data);
    res.write(`event: ${eventType}\n`);
    res.write(`data: ${payload}\n\n`);
  }

  /**
   * Envía un ping de keep-alive a todos los clientes.
   */
  sendHeartbeat() {
    for (const [clinicId, clientSet] of this.clients.entries()) {
      for (const client of clientSet) {
        try {
          client.res.write(`:ping ${Date.now()}\n\n`);
        } catch {
          // Si falla, el evento 'close' limpiará la conexión
        }
      }
    }
  }
}

export default new EventStreamService();
