// ============================================
// Pool de Conexiones PostgreSQL
// ============================================
import pg from 'pg';
import config from '../config/app.js';
import { logger } from '../utils/logger.js';

const { Pool } = pg;

/**
 * Pool de conexiones a PostgreSQL.
 * Configurado con los parámetros del archivo de entorno.
 */
const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.name,
  user: config.db.user,
  password: config.db.password,
  max: config.db.poolMax,
  idleTimeoutMillis: config.db.poolIdleTimeout,
  connectionTimeoutMillis: 10000,
  ssl: config.db.ssl ? { rejectUnauthorized: false } : false,
});

// Evento de conexión
pool.on('connect', () => {
  logger.info('Nueva conexión al pool de PostgreSQL');
});

// Evento de error
pool.on('error', (err) => {
  logger.error('Error inesperado en el pool de PostgreSQL:', err);
});

/**
 * Ejecuta una consulta SQL parametrizada.
 * @param {string} text - Consulta SQL con placeholders ($1, $2, ...)
 * @param {Array} params - Parámetros para la consulta
 * @returns {Promise<pg.QueryResult>}
 */
const query = async (text, params) => {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;

  if (config.app.env === 'development') {
    logger.debug(`Consulta ejecutada en ${duration}ms — filas: ${result.rowCount}`);
  }

  return result;
};

/**
 * Obtiene un cliente del pool para transacciones.
 * IMPORTANTE: Siempre liberar el cliente con client.release()
 * @returns {Promise<pg.PoolClient>}
 */
const getClient = async () => {
  const client = await pool.connect();
  return client;
};

/**
 * Ejecuta una función dentro de una transacción.
 * @param {Function} callback - Función que recibe el cliente de la transacción
 * @returns {Promise<any>} Resultado del callback
 */
const transaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Verifica la conexión a la base de datos.
 * @returns {Promise<boolean>}
 */
const testConnection = async () => {
  try {
    const result = await pool.query('SELECT NOW() AS current_time');
    logger.info(`Conexión a PostgreSQL exitosa: ${result.rows[0].current_time}`);
    return true;
  } catch (error) {
    logger.error('Error al conectar con PostgreSQL:', error.message);
    return false;
  }
};

export { pool, query, getClient, transaction, testConnection };
