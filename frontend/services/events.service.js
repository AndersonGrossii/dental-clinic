// ============================================
// Cliente de Eventos en Tiempo Real (SSE Real-Time Hub)
// Escucha actualizaciones en vivo de la agenda, mensajería y tareas
// ============================================
import state from '../scripts/state.js';
import toast from '../components/toast/toast.js';

class EventsService {
  constructor() {
    this.eventSource = null;
    this.reconnectTimeout = null;
    this.reconnectAttempts = 0;
    this.apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:4000/api/v1' : '/api/v1';
  }

  /**
   * Inicia la conexión SSE si hay un token activo.
   */
  connect() {
    const token = state.get('token');
    if (!token || this.eventSource) return;

    try {
      const streamUrl = `${this.apiUrl}/events/stream?token=${encodeURIComponent(token)}`;
      this.eventSource = new EventSource(streamUrl);

      this.eventSource.addEventListener('CONNECTED', (e) => {
        this.reconnectAttempts = 0;
        console.log('⚡ [SSE] Conexión en tiempo real activa con la clínica.');
      });

      // 1. Confirmación de Cita 24h vía WhatsApp
      this.eventSource.addEventListener('APPOINTMENT_CONFIRMED', (e) => {
        const data = JSON.parse(e.data || '{}');
        toast.success(`✅ Consulta de ${data.patientName || 'Paciente'} CONFIRMADA por WhatsApp.`);
        window.dispatchEvent(new CustomEvent('dental:appointment_updated', { detail: data }));
      });

      // 2. Cancelación de Cita 24h vía WhatsApp
      this.eventSource.addEventListener('APPOINTMENT_CANCELLED', (e) => {
        const data = JSON.parse(e.data || '{}');
        toast.warning(`⚠️ Consulta de ${data.patientName || 'Paciente'} CANCELADA por WhatsApp. Horario liberado.`);
        window.dispatchEvent(new CustomEvent('dental:appointment_updated', { detail: data }));
      });

      // 3. Mensaje Entrante de WhatsApp o Instagram
      this.eventSource.addEventListener('MESSAGING_INCOMING', (e) => {
        const data = JSON.parse(e.data || '{}');
        toast.info(`💬 Nuevo mensaje de ${data.senderName || data.phone || 'Paciente'} (${data.channel || 'Chat'})`);
        window.dispatchEvent(new CustomEvent('dental:message_received', { detail: data }));
      });

      // 4. Tarea de Recepción Creada
      this.eventSource.addEventListener('TASK_CREATED', (e) => {
        const data = JSON.parse(e.data || '{}');
        toast.warning(`📋 Nueva tarea urgente para recepción: ${data.title || ''}`);
        window.dispatchEvent(new CustomEvent('dental:task_updated', { detail: data }));
      });

      // 5. Mensaje de Chat Interno del Personal
      this.eventSource.addEventListener('INTERNAL_CHAT_MESSAGE', (e) => {
        const data = JSON.parse(e.data || '{}');
        window.dispatchEvent(new CustomEvent('dental:internal_chat_received', { detail: data }));
      });

      this.eventSource.onerror = () => {
        this.disconnect();
        this.scheduleReconnect();
      };
    } catch (err) {
      console.error('Error al inicializar EventSource:', err);
    }
  }

  /**
   * Cierra la conexión SSE.
   */
  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  /**
   * Reintenta la conexión con backoff exponencial.
   */
  scheduleReconnect() {
    const token = state.get('token');
    if (!token) return;

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectTimeout = setTimeout(() => this.connect(), delay);
  }
}

export default new EventsService();
