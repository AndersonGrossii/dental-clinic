// ============================================
// Controlador de Eventos en Tiempo Real (SSE Stream Controller)
// ============================================
import jwt from 'jsonwebtoken';
import config from '../config/app.js';
import eventStreamService from '../services/event-stream.service.js';

export const handleEventStream = (req, res) => {
  let user = req.user;

  // Si no está adjuntado por middleware pero viene por query param ?token=
  if (!user && req.query.token) {
    try {
      user = jwt.verify(req.query.token, config.jwt.secret);
    } catch {
      return res.status(401).json({ success: false, message: 'Token inválido para SSE' });
    }
  }

  if (!user) {
    return res.status(401).json({ success: false, message: 'No autenticado' });
  }

  // Configurar headers para SSE y desactivar compresión/buffering
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Para Nginx
  res.flushHeaders();

  const clinicId = user.clinicId || user.clinic_id || 1;
  const userId = user.id;

  eventStreamService.addClient(clinicId, userId, res);
};
