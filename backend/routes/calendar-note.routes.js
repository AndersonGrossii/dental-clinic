// ============================================
// Rutas de Notas de Calendario — /api/v1/calendar-notes
// ============================================
import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { allRoles } from '../middlewares/role.middleware.js';
import { auditMiddleware } from '../middlewares/audit.middleware.js';
import * as calendarNoteController from '../controllers/calendar-note.controller.js';

const router = Router();

router.use(authMiddleware);

router.get('/', allRoles, calendarNoteController.getAll);
router.get('/:id', allRoles, calendarNoteController.getById);

router.post(
  '/',
  allRoles,
  auditMiddleware('CREAR_NOTA_CALENDARIO', 'calendar_notes'),
  calendarNoteController.create
);

router.put(
  '/:id',
  allRoles,
  auditMiddleware('ACTUALIZAR_NOTA_CALENDARIO', 'calendar_notes'),
  calendarNoteController.update
);

router.delete(
  '/:id',
  allRoles,
  auditMiddleware('ELIMINAR_NOTA_CALENDARIO', 'calendar_notes'),
  calendarNoteController.remove
);

export default router;
