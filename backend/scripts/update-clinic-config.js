// ============================================
// CLI Script: Actualización de Configuración de Clínica
// Uso: node backend/scripts/update-clinic-config.js --clinic <id> --config <ruta.json> [--dry-run]
// ============================================
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../database/pool.js';
import { VALID_FEATURES, isValidFeatureKey, resolvePresetFeatures, CLINIC_PRESETS } from '../config/features.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function printHelp() {
  console.log(`
🦷 Vides Dental — Actualización de Configuración de Clínica
Uso:
  node backend/scripts/update-clinic-config.js --clinic <id> [--config <ruta-json>] [--preset <dental|non-dental|aesthetic>] [--dry-run]

Opciones:
  --clinic <id>      Identificador numérico de la clínica a actualizar (alias: --clinic-id).
  --config <path>    Ruta al archivo JSON con los cambios de configuración.
  --preset <nombre>  Aplica un preset de especialidad con 1 solo comando:
                     • 'dental': Habilita odontograma, historial dental y recetas.
                     • 'non-dental': Deshabilita odontograma e historial odontológico.
                     • 'aesthetic': Deshabilita odontograma e historial, mantiene recetas.
  --dry-run          Simula las modificaciones sin persistir en la base de datos.
  --help             Muestra esta ayuda.
`);
}

async function run() {
  const args = process.argv.slice(2);
  let clinicId = null;
  let configPath = null;
  let presetName = null;
  let isDryRun = false;

  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '--clinic' || args[i] === '--clinic-id') && args[i + 1]) {
      clinicId = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--config' && args[i + 1]) {
      configPath = args[i + 1];
      i++;
    } else if (args[i] === '--preset' && args[i + 1]) {
      presetName = args[i + 1];
      i++;
    } else if (args[i] === '--dry-run') {
      isDryRun = true;
    } else if (args[i] === '--help') {
      printHelp();
      process.exit(0);
    }
  }

  if (!clinicId || isNaN(clinicId)) {
    console.error('❌ Error: El parámetro --clinic <id> es obligatorio y debe ser un número entero.');
    printHelp();
    process.exit(1);
  }

  if (!configPath && !presetName) {
    console.error('❌ Error: Debes proporcionar al menos --config <ruta-json> o --preset <nombre>.');
    printHelp();
    process.exit(1);
  }

  let rawConfig = {};
  if (configPath) {
    const resolvedPath = path.resolve(process.cwd(), configPath);
    if (!fs.existsSync(resolvedPath)) {
      console.error(`❌ Error: El archivo de configuración no existe en "${resolvedPath}".`);
      process.exit(1);
    }
    try {
      rawConfig = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
    } catch (err) {
      console.error(`❌ Error: Formato JSON inválido en "${resolvedPath}":`, err.message);
      process.exit(1);
    }
  }

  // Si se especificó un preset, fusionar sus features
  if (presetName) {
    const presetFeatures = resolvePresetFeatures(presetName);
    if (!presetFeatures) {
      console.error(`❌ Error de validación: Preset no reconocido "${presetName}". Presets permitidos: dental, non-dental, aesthetic.`);
      process.exit(1);
    }
    rawConfig.features = {
      ...(presetFeatures || {}),
      ...(rawConfig.features || {}),
    };
    console.log(`ℹ️  Preset aplicado: "${presetName.toLowerCase()}" -> ${JSON.stringify(presetFeatures)}`);
  }

  // 1. Verificar existencia de la clínica
  const clinicCheck = await pool.query('SELECT id, name, code, is_active FROM clinics WHERE id = $1', [clinicId]);
  if (clinicCheck.rows.length === 0) {
    console.error(`❌ Error: No existe ninguna clínica con el ID ${clinicId}.`);
    process.exit(1);
  }
  const currentClinic = clinicCheck.rows[0];

  // 2. Validar primary_color si se proporciona
  if (rawConfig.primary_color) {
    if (!/^#[0-9A-Fa-f]{6}$/.test(rawConfig.primary_color.trim())) {
      console.error(`❌ Error de validación: "primary_color" debe ser un color hexadecimal válido (e.g. "#10b981").`);
      process.exit(1);
    }
  }

  // 3. Validar feature keys contra el catálogo
  const features = rawConfig.features || {};
  for (const key of Object.keys(features)) {
    if (!isValidFeatureKey(key)) {
      console.error(`❌ Error de validación: Clave de feature desconocida "${key}". Las claves permitidas son: ${Object.values(VALID_FEATURES).join(', ')}.`);
      process.exit(1);
    }
  }

  // 4. Validar gabinetes y verificar dependencias de citas futuras
  const cabinets = Array.isArray(rawConfig.cabinets) ? rawConfig.cabinets : [];
  for (const cab of cabinets) {
    if (cab.is_active === false && cab.name) {
      const futureCheck = await pool.query(
        `SELECT COUNT(*) AS total
         FROM appointments a
         WHERE a.clinic_id = $1 
           AND a.gabinete ILIKE $2
           AND (a.appointment_date > CURRENT_DATE OR (a.appointment_date = CURRENT_DATE AND a.end_time > CURRENT_TIME))
           AND a.deleted_at IS NULL
           AND a.status_id NOT IN (SELECT id FROM appointment_status WHERE name IN ('cancelada', 'no_asistio'))`,
        [clinicId, cab.name.trim()]
      );
      const futureCount = parseInt(futureCheck.rows[0]?.total || '0', 10);
      if (futureCount > 0) {
        console.error(`❌ Error de integridad: No se puede desactivar el gabinete "${cab.name}" de la clínica ${clinicId} porque tiene ${futureCount} cita(s) futura(s) programada(s). Reasigne las citas antes de desactivarlo.`);
        process.exit(1);
      }
    }
  }

  console.log(`\n======================================================`);
  console.log(`🔄 PLAN DE ACTUALIZACIÓN: ${currentClinic.name} (ID: ${clinicId}, [${currentClinic.code}])`);
  console.log(`======================================================`);
  console.log(`▶ Modo: ${isDryRun ? '🔍 SIMULACIÓN (--dry-run, sin cambios en DB)' : '⚡ EJECUCIÓN REAL (Transaccional)'}`);

  if (rawConfig.name) console.log(`▶ Nombre:           ${rawConfig.name}`);
  if (rawConfig.primary_color) console.log(`▶ Color Primario:   ${rawConfig.primary_color}`);
  if (rawConfig.phone) console.log(`▶ Teléfono:         ${rawConfig.phone}`);
  if (rawConfig.email) console.log(`▶ Email:            ${rawConfig.email}`);

  if (Object.keys(features).length > 0) {
    console.log(`\n📌 Modificaciones de Módulos (Feature Flags):`);
    for (const [key, enabled] of Object.entries(features)) {
      console.log(`   - ${key.padEnd(25)} ➔ ${enabled ? '✅ Habilitar' : '❌ Desactivar'}`);
    }
  }

  if (cabinets.length > 0) {
    console.log(`\n🛋️ Modificaciones de Gabinetes (${cabinets.length}):`);
    for (const cab of cabinets) {
      console.log(`   - ${cab.name} (${cab.code || 'S/C'}) [${cab.is_active !== false ? 'Activo' : 'Desactivado'}]`);
    }
  }
  console.log(`======================================================\n`);

  if (isDryRun) {
    console.log('✅ Verificación completada con éxito. No se realizaron cambios en la base de datos.');
    process.exit(0);
  }

  // 5. Aplicar cambios dentro de transacción ACID
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Actualizar nombre o datos base en clinics si aplica
    if (rawConfig.name || rawConfig.address || rawConfig.phone || rawConfig.email) {
      await client.query(
        `UPDATE clinics
         SET name = COALESCE($1, name),
             address = COALESCE($2, address),
             phone = COALESCE($3, phone),
             email = COALESCE($4, email),
             updated_at = NOW()
         WHERE id = $5`,
        [rawConfig.name || null, rawConfig.address || null, rawConfig.phone || null, rawConfig.email || null, clinicId]
      );
    }

    // Actualizar clinic_information
    const infoUpdates = [];
    const infoParams = [clinicId];
    let pIdx = 2;

    if (rawConfig.name) { infoUpdates.push(`name = $${pIdx++}`); infoParams.push(rawConfig.name); }
    if (rawConfig.legal_name) { infoUpdates.push(`legal_name = $${pIdx++}`); infoParams.push(rawConfig.legal_name); }
    if (rawConfig.tax_id) { infoUpdates.push(`tax_id = $${pIdx++}`); infoParams.push(rawConfig.tax_id); }
    if (rawConfig.address) { infoUpdates.push(`address = $${pIdx++}`); infoParams.push(rawConfig.address); }
    if (rawConfig.phone) { infoUpdates.push(`phone = $${pIdx++}`); infoParams.push(rawConfig.phone); }
    if (rawConfig.email) { infoUpdates.push(`email = $${pIdx++}`); infoParams.push(rawConfig.email); }
    if (rawConfig.logo_url) { infoUpdates.push(`logo_url = $${pIdx++}`); infoParams.push(rawConfig.logo_url); }
    if (rawConfig.primary_color) { infoUpdates.push(`primary_color = $${pIdx++}`); infoParams.push(rawConfig.primary_color); }

    if (infoUpdates.length > 0) {
      await client.query(
        `UPDATE clinic_information
         SET ${infoUpdates.join(', ')}, updated_at = NOW()
         WHERE clinic_id = $1`,
        infoParams
      );
    }

    // Actualizar features
    for (const [key, enabled] of Object.entries(features)) {
      await client.query(
        `INSERT INTO clinic_features (clinic_id, feature_key, is_enabled, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())
         ON CONFLICT ON CONSTRAINT uq_clinic_feature
         DO UPDATE SET is_enabled = EXCLUDED.is_enabled, updated_at = NOW()`,
        [clinicId, key, Boolean(enabled)]
      );
    }

    // Actualizar o crear gabinetes
    for (const cab of cabinets) {
      await client.query(
        `INSERT INTO clinic_cabinets (clinic_id, name, code, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         ON CONFLICT ON CONSTRAINT uq_clinic_cabinet_name
         DO UPDATE SET code = COALESCE(EXCLUDED.code, clinic_cabinets.code),
                       is_active = EXCLUDED.is_active,
                       updated_at = NOW()`,
        [clinicId, cab.name.trim(), cab.code ? cab.code.trim() : null, cab.is_active !== false]
      );
    }

    // Auditoría
    await client.query(
      `INSERT INTO audit_logs (clinic_id, action, table_name, record_id, details, created_at)
       VALUES ($1, 'UPDATE_CLINIC_CONFIG_CLI', 'clinics', $1, $2, NOW())`,
      [clinicId, JSON.stringify({ updatedKeys: Object.keys(rawConfig) })]
    );

    await client.query('COMMIT');
    console.log(`🎉 ¡Configuración de la clínica ${clinicId} actualizada exitosamente!`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error fatal durante la actualización de la clínica. Transacción revertida (ROLLBACK):', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('Error inesperado:', err);
  process.exit(1);
});
