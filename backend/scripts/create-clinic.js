// ============================================
// CLI Script: Aprovisionamiento de Nueva Clínica
// Uso: node backend/scripts/create-clinic.js --config <ruta.json> [--dry-run]
// ============================================
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../database/pool.js';
import { VALID_FEATURES, isValidFeatureKey } from '../config/features.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function printHelp() {
  console.log(`
🦷 Vides Dental — Aprovisionamiento de Nueva Clínica
Uso:
  node backend/scripts/create-clinic.js --config <ruta-json> [--dry-run]

Opciones:
  --config <path>    Ruta al archivo JSON de configuración de la clínica.
  --dry-run          Simula la creación y valida datos sin modificar la base de datos.
  --help             Muestra esta ayuda.
`);
}

async function run() {
  const args = process.argv.slice(2);
  let configPath = null;
  let isDryRun = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--config' && args[i + 1]) {
      configPath = args[i + 1];
      i++;
    } else if (args[i] === '--dry-run') {
      isDryRun = true;
    } else if (args[i] === '--help') {
      printHelp();
      process.exit(0);
    }
  }

  if (!configPath) {
    console.error('❌ Error: El parámetro --config <ruta-json> es obligatorio.');
    printHelp();
    process.exit(1);
  }

  const resolvedPath = path.resolve(process.cwd(), configPath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`❌ Error: El archivo de configuración no existe en "${resolvedPath}".`);
    process.exit(1);
  }

  let rawConfig;
  try {
    rawConfig = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
  } catch (err) {
    console.error(`❌ Error: Formato JSON inválido en "${resolvedPath}":`, err.message);
    process.exit(1);
  }

  // 1. Validaciones obligatorias
  if (!rawConfig.name || typeof rawConfig.name !== 'string' || !rawConfig.name.trim()) {
    console.error('❌ Error de validación: El campo "name" es obligatorio.');
    process.exit(1);
  }

  if (!rawConfig.code || typeof rawConfig.code !== 'string' || rawConfig.code.trim().length !== 3) {
    console.error('❌ Error de validación: El campo "code" debe ser un código único de exactamente 3 caracteres (e.g. "GAN").');
    process.exit(1);
  }

  const code = rawConfig.code.trim().toUpperCase();
  const primaryColor = (rawConfig.primary_color || '#0f86ec').trim();
  if (!/^#[0-9A-Fa-f]{6}$/.test(primaryColor)) {
    console.error(`❌ Error de validación: "primary_color" debe ser un color hexadecimal válido (e.g. "#10b981"). Valor recibido: "${primaryColor}".`);
    process.exit(1);
  }

  // 2. Validar feature keys contra el catálogo oficial
  const features = rawConfig.features || {};
  for (const key of Object.keys(features)) {
    if (!isValidFeatureKey(key)) {
      console.error(`❌ Error de validación: Clave de feature desconocida "${key}". Las claves permitidas son: ${Object.values(VALID_FEATURES).join(', ')}.`);
      process.exit(1);
    }
  }

  // 3. Validar duplicados de código en DB
  const codeCheck = await pool.query('SELECT id, name FROM clinics WHERE code = $1', [code]);
  if (codeCheck.rows.length > 0) {
    console.error(`❌ Error: Ya existe una clínica con el código "${code}" (Clínica ID: ${codeCheck.rows[0].id}, "${codeCheck.rows[0].name}").`);
    process.exit(1);
  }

  // 4. Modo Simulación (--dry-run)
  const cabinets = Array.isArray(rawConfig.cabinets) ? rawConfig.cabinets : [
    { name: 'Gabinete 1', code: 'GAB1', is_active: true },
    { name: 'Gabinete 2', code: 'GAB2', is_active: true },
  ];

  console.log(`\n======================================================`);
  console.log(`🏥 PLAN DE APROVISIONAMIENTO: ${rawConfig.name} [${code}]`);
  console.log(`======================================================`);
  console.log(`▶ Modo: ${isDryRun ? '🔍 SIMULACIÓN (--dry-run, sin cambios en DB)' : '⚡ EJECUCIÓN REAL (Transaccional)'}`);
  console.log(`▶ Nombre Comercial: ${rawConfig.name}`);
  console.log(`▶ Razón Social:     ${rawConfig.legal_name || rawConfig.name}`);
  console.log(`▶ Identificador:    ${code}`);
  console.log(`▶ CIF/NIF/Tax ID:   ${rawConfig.tax_id || 'N/A'}`);
  console.log(`▶ Color Primario:   ${primaryColor}`);
  console.log(`▶ Teléfono / Email: ${rawConfig.phone || 'N/A'} | ${rawConfig.email || 'N/A'}`);
  console.log(`▶ Dirección:        ${rawConfig.address || 'N/A'}, ${rawConfig.city || ''}`);
  console.log(`\n📌 Módulos (Feature Flags):`);
  for (const key of Object.values(VALID_FEATURES)) {
    const isEnabled = features[key] !== undefined ? Boolean(features[key]) : true;
    console.log(`   - ${key.padEnd(25)}: ${isEnabled ? '✅ Habilitado' : '❌ Desactivado'}`);
  }
  console.log(`\n🛋️ Gabinetes a Registrar (${cabinets.length}):`);
  for (const cab of cabinets) {
    console.log(`   - ${cab.name} (${cab.code || 'S/C'}) [${cab.is_active !== false ? 'Activo' : 'Inactivo'}]`);
  }
  console.log(`======================================================\n`);

  if (isDryRun) {
    console.log('✅ Verificación completada con éxito. No se realizaron cambios en la base de datos.');
    process.exit(0);
  }

  // 5. Ejecución real dentro de transacción ACID
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Insertar clínica
    const clinicRes = await client.query(
      `INSERT INTO clinics (name, code, address, phone, email, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, TRUE, NOW(), NOW())
       RETURNING id`,
      [rawConfig.name.trim(), code, rawConfig.address || null, rawConfig.phone || null, rawConfig.email || null]
    );
    const newClinicId = clinicRes.rows[0].id;

    // Insertar información institucional y branding
    await client.query(
      `INSERT INTO clinic_information (
         clinic_id, name, legal_name, tax_id, address, city, state, country,
         postal_code, phone, email, website, logo_url, primary_color, currency,
         tax_rate, opening_time, closing_time, timezone, created_at, updated_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8,
         $9, $10, $11, $12, $13, $14, $15,
         $16, $17, $18, $19, NOW(), NOW()
       )`,
      [
        newClinicId,
        rawConfig.name.trim(),
        rawConfig.legal_name || rawConfig.name.trim(),
        rawConfig.tax_id || null,
        rawConfig.address || null,
        rawConfig.city || 'Valencia',
        rawConfig.state || 'Valencia',
        rawConfig.country || 'España',
        rawConfig.postal_code || null,
        rawConfig.phone || null,
        rawConfig.email || null,
        rawConfig.website || null,
        rawConfig.logo_url || null,
        primaryColor,
        rawConfig.currency || 'EUR',
        rawConfig.tax_rate !== undefined ? rawConfig.tax_rate : 0,
        rawConfig.opening_time || '08:00:00',
        rawConfig.closing_time || '20:00:00',
        rawConfig.timezone || 'Europe/Madrid',
      ]
    );

    // Insertar feature flags
    for (const key of Object.values(VALID_FEATURES)) {
      const isEnabled = features[key] !== undefined ? Boolean(features[key]) : true;
      await client.query(
        `INSERT INTO clinic_features (clinic_id, feature_key, is_enabled, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())`,
        [newClinicId, key, isEnabled]
      );
    }

    // Insertar gabinetes
    for (const cab of cabinets) {
      await client.query(
        `INSERT INTO clinic_cabinets (clinic_id, name, code, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())`,
        [newClinicId, cab.name.trim(), cab.code ? cab.code.trim() : null, cab.is_active !== false]
      );
    }

    // Registrar en auditoría
    await client.query(
      `INSERT INTO audit_logs (clinic_id, action, table_name, record_id, details, created_at)
       VALUES ($1, 'CREATE_CLINIC_CLI', 'clinics', $2, $3, NOW())`,
      [newClinicId, newClinicId, JSON.stringify({ name: rawConfig.name, code, primary_color: primaryColor })]
    );

    await client.query('COMMIT');
    console.log(`🎉 ¡Clínica aprovisionada exitosamente con ID ${newClinicId}!`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error fatal durante la creación de la clínica. Transacción revertida (ROLLBACK):', err.message);
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
