// ============================================
// Rutas de Odontograma Clínico
// ============================================
import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { allRoles, clinicalStaff } from '../middlewares/role.middleware.js';
import { auditMiddleware } from '../middlewares/audit.middleware.js';
import * as odontogramController from '../controllers/odontogram.controller.js';

const router = Router({ mergeParams: true });

router.use(authMiddleware);

// 1. Ver odontograma del paciente (todos los roles)
router.get('/', allRoles, odontogramController.getByPatient);

// 2. Registrar hallazgo o procedimiento (personal clínico)
router.post(
  '/',
  clinicalStaff,
  auditMiddleware('CREAR_ENTRADA_ODONTOGRAMA', 'odontogram_entries'),
  odontogramController.create
);

// 3. Actualizar hallazgo o procedimiento (personal clínico)
router.put(
  '/:entryId',
  clinicalStaff,
  auditMiddleware('ACTUALIZAR_ENTRADA_ODONTOGRAMA', 'odontogram_entries'),
  odontogramController.update
);

// 4. Eliminar hallazgo del odontograma (personal clínico)
router.delete(
  '/:entryId',
  clinicalStaff,
  auditMiddleware('ELIMINAR_ENTRADA_ODONTOGRAMA', 'odontogram_entries'),
  odontogramController.remove
);

export default router;
