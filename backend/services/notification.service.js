// ============================================
// Servicio de Notificaciones — Lógica de negocio
// ============================================
import notificationRepository from '../repositories/notification.repository.js';
import { AppError } from '../utils/errors.js';

/**
 * Servicio que encapsula la lógica de negocio para la gestión de notificaciones.
 */
class NotificationService {
  /**
   * Obtiene las notificaciones de un usuario con paginación.
   * @param {number} userId - ID del usuario
   * @param {object} options - { limit, offset }
   * @returns {Promise<{ data: Array, total: number }>}
   */
  async getByUser(userId, options = {}) {
    const { rows, total } = await notificationRepository.findByUser(userId, options);
    return { data: rows, total };
  }

  /**
   * Obtiene el conteo de notificaciones no leídas de un usuario.
   * @param {number} userId - ID del usuario
   * @returns {Promise<number>}
   */
  async getUnreadCount(userId) {
    return notificationRepository.countUnread(userId);
  }

  /**
   * Marca una notificación como leída.
   * Verifica que pertenezca al usuario solicitante.
   * @param {number} id - ID de la notificación
   * @param {number} userId - ID del usuario
   * @returns {Promise<object>}
   * @throws {AppError} Si no existe o no pertenece al usuario
   */
  async markAsRead(id, userId) {
    const notification = await notificationRepository.markAsRead(id, userId);
    if (!notification) {
      throw new AppError('Notificación no encontrada o no pertenece al usuario.', 404);
    }
    return notification;
  }

  /**
   * Marca todas las notificaciones de un usuario como leídas.
   * @param {number} userId - ID del usuario
   * @returns {Promise<number>} Cantidad de notificaciones actualizadas
   */
  async markAllAsRead(userId) {
    return notificationRepository.markAllAsRead(userId);
  }

  /**
   * Crea una nueva notificación.
   * @param {object} data - { user_id, title, message, type, reference_type, reference_id }
   * @returns {Promise<object>}
   */
  async create(data) {
    if (!data.user_id || !data.title || !data.message) {
      throw new AppError('Los campos user_id, title y message son obligatorios para crear una notificación.', 400);
    }
    return notificationRepository.createNotification(data);
  }

  /**
   * Crea una notificación de recordatorio de cita.
   * @param {number} userId - ID del usuario destinatario
   * @param {object} appointment - Datos de la cita
   * @returns {Promise<object>}
   */
  async createAppointmentReminder(userId, appointment) {
    const patientName = appointment.patient_name ||
      `${appointment.patient_first_name || ''} ${appointment.patient_last_name || ''}`.trim();

    return this.create({
      user_id: userId,
      title: 'Recordatorio de cita',
      message: `Tiene una cita programada con ${patientName} el ${appointment.appointment_date} a las ${appointment.start_time}.`,
      type: 'reminder',
      reference_type: 'appointment',
      reference_id: appointment.id,
    });
  }

  /**
   * Crea una notificación de cancelación de cita.
   * @param {number} userId - ID del usuario destinatario
   * @param {object} appointment - Datos de la cita cancelada
   * @returns {Promise<object>}
   */
  async createAppointmentCancellation(userId, appointment) {
    const patientName = appointment.patient_name ||
      `${appointment.patient_first_name || ''} ${appointment.patient_last_name || ''}`.trim();

    return this.create({
      user_id: userId,
      title: 'Cita cancelada',
      message: `La cita con ${patientName} del ${appointment.appointment_date} a las ${appointment.start_time} ha sido cancelada.${appointment.cancellation_reason ? ` Motivo: ${appointment.cancellation_reason}` : ''}`,
      type: 'warning',
      reference_type: 'appointment',
      reference_id: appointment.id,
    });
  }
}

export default new NotificationService();
