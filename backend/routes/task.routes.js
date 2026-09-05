// ============================================
// Rutas de Tareas — /api/v1/tasks
// ============================================
import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { allRoles } from '../middlewares/role.middleware.js';
import { auditMiddleware } from '../middlewares/audit.middleware.js';
import * as taskController from '../controllers/task.controller.js';

const router = Router();

router.use(authMiddleware);

router.get('/', allRoles, taskController.getAll);
router.get('/:id', allRoles, taskController.getById);

router.post(
  '/',
  allRoles,
  auditMiddleware('CREAR_TAREA', 'tasks'),
  taskController.create
);

router.put(
  '/:id',
  allRoles,
  auditMiddleware('ACTUALIZAR_TAREA', 'tasks'),
  taskController.update
);

router.patch(
  '/:id/status',
  allRoles,
  auditMiddleware('CAMBIAR_ESTADO_TAREA', 'tasks'),
  taskController.updateStatus
);

router.delete(
  '/:id',
  allRoles,
  auditMiddleware('ELIMINAR_TAREA', 'tasks'),
  taskController.remove
);

export default router;
