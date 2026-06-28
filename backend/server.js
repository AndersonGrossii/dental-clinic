// ============================================
// Servidor — Punto de entrada de la aplicación
// ============================================
import app from './app.js';
import config from './config/app.js';
import { testConnection } from './database/pool.js';
import { runMigrations } from './database/migrations/runner.js';
import { runSeeders } from './database/seeders/runner.js';
import { logger } from './utils/logger.js';

/**
 * Inicia el servidor Express.
 * 1. Verifica conexión a PostgreSQL
 * 2. Ejecuta migraciones pendientes
 * 3. Ejecuta seeders si es necesario
 * 4. Inicia el servidor HTTP
 */
const startServer = async () => {
  try {
    // 1. Verificar conexión a la base de datos
    logger.info('Verificando conexión a PostgreSQL...');
    const dbConnected = await testConnection();
    if (!dbConnected) {
      logger.error('No se pudo conectar a PostgreSQL. Abortando inicio.');
      process.exit(1);
    }

    // 2. Ejecutar migraciones
    logger.info('Ejecutando migraciones...');
    await runMigrations();
    logger.info('Migraciones completadas.');

    // 3. Ejecutar seeders
    logger.info('Ejecutando seeders...');
    await runSeeders();
    logger.info('Seeders completados.');

    // 4. Iniciar servidor
    app.listen(config.app.port, '0.0.0.0', () => {
      logger.info(`
╔══════════════════════════════════════════════════╗
║  Sistema de Gestión de Clínica Dental            ║
║  Servidor iniciado en puerto ${config.app.port}               ║
║  Entorno: ${config.app.env.padEnd(38)}║
║  API: http://localhost:${config.app.port}/api/v1              ║
╚══════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    logger.error('Error fatal al iniciar el servidor:', error);
    process.exit(1);
  }
};

// Manejo de señales para cierre limpio
process.on('SIGTERM', () => {
  logger.info('SIGTERM recibido. Cerrando servidor...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT recibido. Cerrando servidor...');
  process.exit(0);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection:', reason);
});

startServer();
