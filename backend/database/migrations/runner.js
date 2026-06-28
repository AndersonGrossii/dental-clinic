// ============================================
// Runner de Migraciones SQL
// ============================================
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool, query } from '../pool.js';
import { logger } from '../../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Crea la tabla de control de migraciones si no existe.
 */
const createMigrationsTable = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);
};

/**
 * Obtiene las migraciones ya ejecutadas.
 * @returns {Promise<Set<string>>}
 */
const getExecutedMigrations = async () => {
  const result = await query('SELECT filename FROM _migrations ORDER BY filename');
  return new Set(result.rows.map(r => r.filename));
};

/**
 * Ejecuta todas las migraciones pendientes en orden.
 */
export const runMigrations = async () => {
  try {
    // Habilitar extensión btree_gist para el constraint EXCLUDE
    await query('CREATE EXTENSION IF NOT EXISTS btree_gist').catch(() => {
      logger.warn('No se pudo crear extensión btree_gist (puede requerir superusuario)');
    });

    await createMigrationsTable();
    const executed = await getExecutedMigrations();

    // Leer archivos de migración ordenados
    const migrationFiles = fs
      .readdirSync(__dirname)
      .filter(f => f.endsWith('.sql'))
      .sort();

    let migrationsRun = 0;

    for (const file of migrationFiles) {
      if (executed.has(file)) {
        continue;
      }

      logger.info(`Ejecutando migración: ${file}`);
      const sql = fs.readFileSync(path.join(__dirname, file), 'utf8');

      try {
        await query(sql);
        await query('INSERT INTO _migrations (filename) VALUES ($1)', [file]);
        migrationsRun++;
        logger.info(`✓ Migración completada: ${file}`);
      } catch (error) {
        logger.error(`✗ Error en migración ${file}:`, error.message);
        throw error;
      }
    }

    if (migrationsRun === 0) {
      logger.info('No hay migraciones pendientes.');
    } else {
      logger.info(`${migrationsRun} migración(es) ejecutada(s) exitosamente.`);
    }
  } catch (error) {
    logger.error('Error ejecutando migraciones:', error.message);
    throw error;
  }
};

// Ejecución directa desde CLI
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigrations()
    .then(() => {
      logger.info('Proceso de migraciones finalizado.');
      process.exit(0);
    })
    .catch((err) => {
      logger.error('Error fatal en migraciones:', err);
      process.exit(1);
    });
}
