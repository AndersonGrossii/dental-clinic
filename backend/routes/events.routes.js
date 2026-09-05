// ============================================
// Rutas de Eventos en Tiempo Real — /api/v1/events
// ============================================
import { Router } from 'express';
import { handleEventStream } from '../controllers/events.controller.js';

const router = Router();

// Stream SSE (soporta ?token= para EventSource del navegador)
router.get('/stream', handleEventStream);

export default router;
