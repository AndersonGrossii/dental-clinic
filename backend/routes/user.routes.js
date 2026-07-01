// ============================================
// Rutas de Usuarios — /api/v1/users
// ============================================
import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { managementOnly } from '../middlewares/role.middleware.js';
import { validate } from '../middlewares/validation.middleware.js';
import { createUserRules, updateUserRules, adminResetPasswordRules } from '../validators/user.validator.js';
import { auditMiddleware } from '../middlewares/audit.middleware.js';
import * as userController from '../controllers/user.controller.js';

const router = Router();

// Todas las rutas requieren autenticación y rol de dirección/propietario
router.use(authMiddleware, managementOnly);

/**
 * @route   GET /api/v1/users
 * @desc    Listar todos los usuarios con paginación
 * @access  Dirección / Propietario
 */
router.get('/', userController.getAll);

/**
 * @route   POST /api/v1/users
 * @desc    Crear un nuevo usuario
 * @access  Dirección / Propietario
 */
router.post('/', validate(createUserRules), auditMiddleware('CREAR_USUARIO', 'users'), userController.create);

/**
 * @route   GET /api/v1/users/:id
 * @desc    Obtener un usuario por ID
 * @access  Dirección / Propietario
 */
router.get('/:id', userController.getById);

/**
 * @route   PUT /api/v1/users/:id
 * @desc    Actualizar un usuario
 * @access  Dirección / Propietario
 */
router.put('/:id', validate(updateUserRules), auditMiddleware('ACTUALIZAR_USUARIO', 'users'), userController.update);

/**
 * @route   DELETE /api/v1/users/:id
 * @desc    Eliminar un usuario (soft delete) — solo propietario puede borrar propietario
 * @access  Dirección / Propietario (con restricción en controlador)
 */
router.delete('/:id', auditMiddleware('ELIMINAR_USUARIO', 'users'), userController.remove);

/**
 * @route   PATCH /api/v1/users/:id/toggle-status
 * @desc    Activar o desactivar un usuario
 * @access  Dirección / Propietario
 */
router.patch('/:id/toggle-status', auditMiddleware('CAMBIAR_ESTADO_USUARIO', 'users'), userController.toggleStatus);

/**
 * @route   POST /api/v1/users/:id/reset-password
 * @desc    Resetear contraseña de un usuario
 * @access  Propietario
 */
router.post('/:id/reset-password', validate(adminResetPasswordRules), auditMiddleware('RESETEAR_CONTRASEÑA_USUARIO', 'users'), userController.resetPassword);

export default router;
