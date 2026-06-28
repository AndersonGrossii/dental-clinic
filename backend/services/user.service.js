// ============================================
// Servicio de Usuarios
// ============================================
import bcrypt from 'bcryptjs';
import config from '../config/app.js';
import userRepository from '../repositories/user.repository.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

/**
 * Servicio encargado de la gestión de usuarios del sistema.
 * Solo accesible por propietarios.
 */
class UserService {
  /**
   * Obtiene todos los usuarios con paginación y filtros.
   * @param {object} options - Opciones de paginación y filtros
   * @returns {Promise<{ rows: Array, total: number }>}
   */
  async getAll(options) {
    const { rows, total } = await userRepository.findAllWithRoles(options);
    return { rows, total };
  }

  /**
   * Obtiene un usuario por su ID con información del rol.
   * @param {number} id - ID del usuario
   * @returns {Promise<object>}
   */
  async getById(id) {
    const user = await userRepository.findByIdWithRole(id);

    if (!user) {
      throw new AppError('Usuario no encontrado.', 404);
    }

    return user;
  }

  /**
   * Crea un nuevo usuario en el sistema.
   * @param {object} data - Datos del usuario
   * @returns {Promise<object>}
   */
  async create(data) {
    // Verificar que el email no esté en uso
    const existingUser = await userRepository.findByEmail(data.email);

    if (existingUser) {
      throw new AppError('Ya existe un usuario con ese correo electrónico.', 409);
    }

    // Hashear contraseña
    const passwordHash = await bcrypt.hash(data.password, config.bcrypt.saltRounds);

    const userData = {
      role_id: data.roleId,
      first_name: data.firstName,
      last_name: data.lastName,
      email: data.email,
      password_hash: passwordHash,
      phone: data.phone || null,
      avatar_url: data.avatarUrl || null,
      is_active: true,
    };

    const newUser = await userRepository.create(userData);

    // Retornar sin el hash de contraseña
    const { password_hash, ...userWithoutPassword } = newUser;

    logger.info(`Usuario creado: ${newUser.email} (ID: ${newUser.id})`);

    return userWithoutPassword;
  }

  /**
   * Actualiza un usuario existente.
   * @param {number} id - ID del usuario
   * @param {object} data - Datos a actualizar
   * @returns {Promise<object>}
   */
  async update(id, data) {
    const existingUser = await userRepository.findById(id);

    if (!existingUser) {
      throw new AppError('Usuario no encontrado.', 404);
    }

    // Si se cambia el email, verificar que no esté en uso por otro usuario
    if (data.email && data.email !== existingUser.email) {
      const emailInUse = await userRepository.findByEmail(data.email);

      if (emailInUse) {
        throw new AppError('Ya existe un usuario con ese correo electrónico.', 409);
      }
    }

    const updateData = {};

    if (data.firstName !== undefined) updateData.first_name = data.firstName;
    if (data.lastName !== undefined) updateData.last_name = data.lastName;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.roleId !== undefined) updateData.role_id = data.roleId;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.avatarUrl !== undefined) updateData.avatar_url = data.avatarUrl;

    if (Object.keys(updateData).length === 0) {
      throw new AppError('No se proporcionaron datos para actualizar.', 400);
    }

    const updatedUser = await userRepository.update(id, updateData);

    if (!updatedUser) {
      throw new AppError('No se pudo actualizar el usuario.', 500);
    }

    // Retornar sin el hash de contraseña
    const { password_hash, ...userWithoutPassword } = updatedUser;

    logger.info(`Usuario actualizado: ID ${id}`);

    return userWithoutPassword;
  }

  /**
   * Elimina un usuario de forma lógica (soft delete).
   * @param {number} id - ID del usuario
   * @returns {Promise<void>}
   */
  async delete(id) {
    const user = await userRepository.findById(id);

    if (!user) {
      throw new AppError('Usuario no encontrado.', 404);
    }

    const deleted = await userRepository.softDelete(id);

    if (!deleted) {
      throw new AppError('No se pudo eliminar el usuario.', 500);
    }

    logger.info(`Usuario eliminado (soft): ID ${id}`);
  }

  /**
   * Activa o desactiva un usuario.
   * @param {number} id - ID del usuario
   * @returns {Promise<object>}
   */
  async toggleStatus(id) {
    const user = await userRepository.findById(id);

    if (!user) {
      throw new AppError('Usuario no encontrado.', 404);
    }

    const updatedUser = await userRepository.update(id, {
      is_active: !user.is_active,
    });

    const { password_hash, ...userWithoutPassword } = updatedUser;
    const statusMsg = updatedUser.is_active ? 'activado' : 'desactivado';

    logger.info(`Usuario ${statusMsg}: ID ${id}`);

    return userWithoutPassword;
  }

  /**
   * Resetea la contraseña de un usuario (por parte del administrador).
   * @param {number} id - ID del usuario
   * @param {string} newPassword - Nueva contraseña
   * @returns {Promise<void>}
   */
  async resetPassword(id, newPassword) {
    const user = await userRepository.findById(id);

    if (!user) {
      throw new AppError('Usuario no encontrado.', 404);
    }

    const passwordHash = await bcrypt.hash(newPassword, config.bcrypt.saltRounds);

    await userRepository.update(id, { password_hash: passwordHash });

    logger.info(`Contraseña reseteada por administrador para usuario ID: ${id}`);
  }
}

export default new UserService();
