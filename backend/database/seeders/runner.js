// ============================================
// Runner de Seeders SQL
// ============================================
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from '../pool.js';
import { logger } from '../../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Crea la tabla de control de seeders si no existe.
 */
const createSeedersTable = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS _seeders (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);
};

/**
 * Obtiene los seeders ya ejecutados.
 * @returns {Promise<Set<string>>}
 */
const getExecutedSeeders = async () => {
  const result = await query('SELECT filename FROM _seeders ORDER BY filename');
  return new Set(result.rows.map(r => r.filename));
};

/**
 * Ejecuta todos los seeders pendientes en orden.
 */
export const runSeeders = async () => {
  try {
    await createSeedersTable();
    const executed = await getExecutedSeeders();

    const seederFiles = fs
      .readdirSync(__dirname)
      .filter(f => f.endsWith('.sql'))
      .sort();

    let seedersRun = 0;

    for (const file of seederFiles) {
      if (executed.has(file)) {
        continue;
      }

      logger.info(`Ejecutando seeder: ${file}`);
      const sql = fs.readFileSync(path.join(__dirname, file), 'utf8');

      try {
        await query(sql);
        await query('INSERT INTO _seeders (filename) VALUES ($1)', [file]);
        seedersRun++;
        logger.info(`✓ Seeder completado: ${file}`);
      } catch (error) {
        logger.error(`✗ Error en seeder ${file}:`, error.message);
        // Los seeders no son críticos, continuamos
        logger.warn(`Continuando con los demás seeders...`);
      }
    }

    if (seedersRun === 0) {
      logger.info('No hay seeders pendientes.');
    } else {
      logger.info(`${seedersRun} seeder(s) ejecutado(s) exitosamente.`);
    }
  } catch (error) {
    logger.error('Error ejecutando seeders:', error.message);
    throw error;
  }
};

// Ejecución directa desde CLI
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runSeeders()
    .then(() => {
      logger.info('Proceso de seeders finalizado.');
      process.exit(0);
    })
    .catch((err) => {
      logger.error('Error fatal en seeders:', err);
      process.exit(1);
    });
}
