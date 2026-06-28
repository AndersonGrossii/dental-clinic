// ============================================
// Servicio de Autenticación
// ============================================
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import config from '../config/app.js';
import { query } from '../database/pool.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

/**
 * Servicio encargado de la autenticación y gestión de sesiones.
 */
class AuthService {
  /**
   * Inicia sesión con email y contraseña.
   * Valida credenciales, genera tokens JWT y actualiza último acceso.
   * @param {string} email - Correo electrónico del usuario
   * @param {string} password - Contraseña en texto plano
   * @returns {Promise<{ user: object, accessToken: string, refreshToken: string }>}
   */
  async login(email, password) {
    // Buscar usuario con su rol (incluir password_hash para verificación)
    const result = await query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.phone,
              u.avatar_url, u.is_active, u.password_hash, u.role_id,
              r.name AS role_name,
              d.id AS doctor_id
       FROM users u
       INNER JOIN roles r ON u.role_id = r.id
       LEFT JOIN doctors d ON d.user_id = u.id AND d.deleted_at IS NULL
       WHERE u.email = $1 AND u.deleted_at IS NULL`,
      [email]
    );

    const user = result.rows[0];

    if (!user) {
      throw new AppError('Credenciales inválidas. Verifique su correo y contraseña.', 401);
    }

    if (!user.is_active) {
      throw new AppError('Su cuenta se encuentra desactivada. Contacte al administrador.', 403);
    }

    // Verificar contraseña
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      throw new AppError('Credenciales inválidas. Verifique su correo y contraseña.', 401);
    }

    // Generar tokens
    const tokenPayload = {
      id: user.id,
      email: user.email,
      roleId: user.role_id,
      roleName: user.role_name,
      doctorId: user.doctor_id || null,
      firstName: user.first_name,
      lastName: user.last_name,
    };

    const accessToken = jwt.sign(tokenPayload, config.jwt.secret, {
      expiresIn: config.jwt.expiration,
    });

    const refreshToken = jwt.sign(
      { id: user.id, type: 'refresh' },
      config.jwt.refreshSecret,
      { expiresIn: config.jwt.refreshExpiration }
    );

    // Actualizar último acceso
    await query(
      `UPDATE users SET last_login = NOW(), updated_at = NOW() WHERE id = $1`,
      [user.id]
    );

    logger.info(`Inicio de sesión exitoso para: ${email}`);

    // Retornar usuario sin password_hash
    const { password_hash, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      accessToken,
      refreshToken,
    };
  }

  /**
   * Genera un nuevo access token a partir de un refresh token válido.
   * @param {string} token - Refresh token
   * @returns {Promise<{ accessToken: string }>}
   */
  async refreshToken(token) {
    if (!token) {
      throw new AppError('Token de actualización no proporcionado.', 401);
    }

    let decoded;
    try {
      decoded = jwt.verify(token, config.jwt.refreshSecret);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new AppError('Token de actualización expirado. Inicie sesión nuevamente.', 401);
      }
      throw new AppError('Token de actualización inválido.', 401);
    }

    if (decoded.type !== 'refresh') {
      throw new AppError('Tipo de token inválido.', 401);
    }

    // Obtener datos actualizados del usuario
    const result = await query(
      `SELECT u.id, u.email, u.role_id, r.name AS role_name,
              d.id AS doctor_id
       FROM users u
       INNER JOIN roles r ON u.role_id = r.id
       LEFT JOIN doctors d ON d.user_id = u.id AND d.deleted_at IS NULL
       WHERE u.id = $1 AND u.is_active = TRUE AND u.deleted_at IS NULL`,
      [decoded.id]
    );

    const user = result.rows[0];

    if (!user) {
      throw new AppError('Usuario no encontrado o desactivado.', 401);
    }

    const accessToken = jwt.sign(
      {
        id: user.id,
        email: user.email,
        roleId: user.role_id,
        roleName: user.role_name,
        doctorId: user.doctor_id || null,
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiration }
    );

    return { accessToken };
  }

  /**
   * Cambia la contraseña del usuario autenticado.
   * @param {number} userId - ID del usuario
   * @param {string} currentPassword - Contraseña actual
   * @param {string} newPassword - Nueva contraseña
   * @returns {Promise<void>}
   */
  async changePassword(userId, currentPassword, newPassword) {
    // Obtener usuario con hash actual
    const result = await query(
      `SELECT id, password_hash FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [userId]
    );

    const user = result.rows[0];

    if (!user) {
      throw new AppError('Usuario no encontrado.', 404);
    }

    // Verificar contraseña actual
    const isCurrentValid = await bcrypt.compare(currentPassword, user.password_hash);

    if (!isCurrentValid) {
      throw new AppError('La contraseña actual es incorrecta.', 400);
    }

    // Verificar que la nueva contraseña sea diferente
    const isSamePassword = await bcrypt.compare(newPassword, user.password_hash);

    if (isSamePassword) {
      throw new AppError('La nueva contraseña no puede ser igual a la actual.', 400);
    }

    // Hashear y guardar nueva contraseña
    const newHash = await bcrypt.hash(newPassword, config.bcrypt.saltRounds);

    await query(
      `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
      [newHash, userId]
    );

    logger.info(`Contraseña cambiada exitosamente para usuario ID: ${userId}`);
  }

  /**
   * Genera un token de recuperación de contraseña y lo guarda en la base de datos.
   * @param {string} email - Correo electrónico del usuario
   * @returns {Promise<{ resetToken: string }>}
   */
  async forgotPassword(email) {
    const result = await query(
      `SELECT id, email, first_name FROM users WHERE email = $1 AND deleted_at IS NULL`,
      [email]
    );

    const user = result.rows[0];

    // Por seguridad, no revelar si el email existe o no
    if (!user) {
      logger.warn(`Intento de recuperación de contraseña para email inexistente: ${email}`);
      return { resetToken: null };
    }

    // Generar token de recuperación
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutos

    await query(
      `UPDATE users
       SET password_reset_token = $1, password_reset_expires = $2, updated_at = NOW()
       WHERE id = $3`,
      [hashedToken, expires.toISOString(), user.id]
    );

    logger.info(`Token de recuperación generado para: ${email}`);

    // En producción, aquí se enviaría el email con el token
    return { resetToken };
  }

  /**
   * Restablece la contraseña usando un token de recuperación.
   * @param {string} token - Token de recuperación (sin hashear)
   * @param {string} newPassword - Nueva contraseña
   * @returns {Promise<void>}
   */
  async resetPassword(token, newPassword) {
    // Hashear el token para comparar con el almacenado
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const result = await query(
      `SELECT id, email FROM users
       WHERE password_reset_token = $1
         AND password_reset_expires > NOW()
         AND deleted_at IS NULL`,
      [hashedToken]
    );

    const user = result.rows[0];

    if (!user) {
      throw new AppError('Token de recuperación inválido o expirado.', 400);
    }

    // Hashear nueva contraseña
    const newHash = await bcrypt.hash(newPassword, config.bcrypt.saltRounds);

    // Actualizar contraseña y limpiar tokens
    await query(
      `UPDATE users
       SET password_hash = $1,
           password_reset_token = NULL,
           password_reset_expires = NULL,
           updated_at = NOW()
       WHERE id = $2`,
      [newHash, user.id]
    );

    logger.info(`Contraseña restablecida exitosamente para: ${user.email}`);
  }
}

export default new AuthService();
