// ============================================
// Rutas de Packs Promocionales de Tratamientos
// ============================================
import { Router } from 'express';
import * as controller from '../controllers/promotional-pack.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { managementOnly, allRoles } from '../middlewares/role.middleware.js';
import { auditMiddleware } from '../middlewares/audit.middleware.js';

const router = Router();

router.use(authMiddleware);

// Lectura de packs promocionales (disponible para todos los roles autorizados)
router.get('/', allRoles, controller.getAll);
router.get('/:id', allRoles, controller.getById);

// Gestión de packs promocionales (crear, editar, activar/desactivar, eliminar)
router.post('/', allRoles, auditMiddleware('CREAR_PACK_PROMOCIONAL', 'promotional_packs'), controller.create);
router.put('/:id', allRoles, auditMiddleware('ACTUALIZAR_PACK_PROMOCIONAL', 'promotional_packs'), controller.update);
router.patch('/:id/status', allRoles, auditMiddleware('CAMBIAR_ESTADO_PACK_PROMOCIONAL', 'promotional_packs'), controller.toggleStatus);
router.delete('/:id', managementOnly, auditMiddleware('ELIMINAR_PACK_PROMOCIONAL', 'promotional_packs'), controller.remove);

export default router;
