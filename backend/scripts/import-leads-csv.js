// ============================================
// CLI Script: Importador de Leads desde CSV
// Uso: node backend/scripts/import-leads-csv.js <archivo.csv> [--clinic=1] [--dry-run] [--allow-duplicates]
// ============================================
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool, als } from '../database/pool.js';
import crmService from '../services/crm.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function printHelp() {
  console.log(`
📋 Importador de Leads desde CSV — CRM Dental
Uso:
  node backend/scripts/import-leads-csv.js <ruta-archivo.csv> [opciones]

Opciones:
  --clinic=<id>          ID de la clínica destino (por defecto: 1)
  --source=<code>        Origen predeterminado ('manual', 'website', 'whatsapp', 'instagram', 'other'). Default: 'manual'
  --status=<estado>      Estado inicial ('new', 'contacted', 'qualified'). Default: 'new'
  --allow-duplicates     Permite crear nuevo lead aunque el teléfono ya exista como lead activo
  --dry-run              Modo simulación: lee, valida y muestra la vista previa sin guardar en BD
  --help                 Muestra esta ayuda

Reglas de Negocio:
  • Nombre: Se combinan los campos 'Nombre' y 'Apellidos'.
  • Teléfono: Se toma prioritariamente el campo 'MOVIL'. Si está vacío, se prueba 'Telefono'.
  • Si no existe ni móvil ni teléfono, la fila se salta automáticamente.
`);
}

/**
 * Parser de CSV robusto con detección automática de delimitador (, o ;) y manejo de comillas.
 */
function parseCSV(content) {
  // Eliminar BOM si existe
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
  }

  // Detectar delimitador de la primera línea no vacía
  const firstLine = content.split(/\r?\n/).find(l => l.trim().length > 0) || '';
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;

  let delimiter = ',';
  if (semiCount > commaCount && semiCount > tabCount) delimiter = ';';
  else if (tabCount > commaCount && tabCount > semiCount) delimiter = '\t';

  const rows = [];
  let currentRow = [];
  let currentField = '';
  let insideQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        // Doble comilla escapada
        currentField += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === delimiter && !insideQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
      currentRow.push(currentField.trim());
      currentField = '';
      if (currentRow.some(val => val.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
    } else {
      currentField += char;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some(val => val.length > 0)) {
      rows.push(currentRow);
    }
  }

  if (rows.length === 0) return { headers: [], records: [] };

  const rawHeaders = rows[0];
  const records = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const record = {};
    rawHeaders.forEach((header, idx) => {
      record[header] = row[idx] !== undefined ? row[idx] : '';
    });
    records.push(record);
  }

  return { delimiter, headers: rawHeaders, records };
}

/**
 * Normaliza nombres de encabezados quitando tildes, mayúsculas y caracteres especiales.
 */
function normalizeHeader(h) {
  return (h || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Limpia y normaliza números de teléfono.
 */
function cleanPhone(raw) {
  if (!raw) return '';
  let str = String(raw).trim();
  // Conservar '+' inicial si lo tiene para formato internacional
  const hasPlus = str.startsWith('+');
  const digits = str.replace(/\D/g, '');
  if (!digits || digits.length < 6) return '';
  return hasPlus ? `+${digits}` : digits;
}

async function run() {
  const args = process.argv.slice(2);
  let csvFilePath = null;
  let clinicId = 1;
  let defaultSource = 'manual';
  let defaultStatus = 'new';
  let allowDuplicates = false;
  let isDryRun = false;

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else if (arg === '--dry-run') {
      isDryRun = true;
    } else if (arg === '--allow-duplicates') {
      allowDuplicates = true;
    } else if (arg.startsWith('--clinic=')) {
      clinicId = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--source=')) {
      defaultSource = arg.split('=')[1].trim();
    } else if (arg.startsWith('--status=')) {
      defaultStatus = arg.split('=')[1].trim();
    } else if (!arg.startsWith('--') && !csvFilePath) {
      csvFilePath = arg;
    }
  }

  if (!csvFilePath) {
    console.error('❌ Error: Debe especificar la ruta del archivo CSV a importar.');
    printHelp();
    process.exit(1);
  }

  const resolvedPath = path.resolve(process.cwd(), csvFilePath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`❌ Error: El archivo "${resolvedPath}" no existe.`);
    process.exit(1);
  }

  console.log('\n=============================================================');
  console.log('  📥 IMPORTADOR DE LEADS DESDE ARCHIVO CSV');
  console.log('=============================================================');
  console.log(`📁 Archivo:         ${resolvedPath}`);
  console.log(`🏥 Clínica ID:      ${clinicId}`);
  console.log(`🏷️  Origen defecto:  ${defaultSource}`);
  console.log(`📊 Estado defecto:  ${defaultStatus}`);
  console.log(`⚙️  Modo:            ${isDryRun ? 'SIMULACIÓN (--dry-run, sin cambios)' : 'PRODUCCIÓN (Escritura en BD)'}`);
  console.log('-------------------------------------------------------------\n');

  // Verificar que la clínica existe
  const clinicCheck = await pool.query('SELECT id, name FROM clinics WHERE id = $1 AND is_active = TRUE', [clinicId]);
  if (clinicCheck.rows.length === 0) {
    console.error(`❌ Error: La clínica con ID ${clinicId} no existe en la base de datos.`);
    process.exit(1);
  }
  console.log(`🏥 Clínica Destino: [ID ${clinicId}] ${clinicCheck.rows[0].name}`);

  // Leer y parsear el archivo CSV
  const fileContent = fs.readFileSync(resolvedPath, 'utf8');
  const { delimiter, headers, records } = parseCSV(fileContent);

  console.log(`📑 Delimitador detectado: "${delimiter === '\t' ? '\\t' : delimiter}"`);
  console.log(`📑 Columnas detectadas: ${headers.join(' | ')}`);
  console.log(`📊 Total de filas leídas: ${records.length}\n`);

  if (records.length === 0) {
    console.log('⚠️ El archivo CSV no contiene filas de datos para procesar.');
    process.exit(0);
  }

  // Identificar índices o nombres normalizados de campos clave
  const headerMap = {};
  headers.forEach(h => {
    headerMap[normalizeHeader(h)] = h;
  });

  // Mapear campos
  const findKey = (...candidates) => {
    for (const c of candidates) {
      const norm = normalizeHeader(c);
      if (headerMap[norm]) return headerMap[norm];
    }
    return null;
  };

  const keyNombre = findKey('nombre', 'first_name', 'firstname', 'name');
  const keyApellidos = findKey('apellidos', 'apellido', 'last_name', 'lastname', 'surname');
  const keyNombreCompleto = findKey('nombrecompleto', 'nombreyapellidos', 'paciente', 'cliente', 'lead');
  const keyMovil = findKey('movil', 'móvil', 'mobile', 'celular', 'telefonomovil', 'telmovil');
  const keyTelefono = findKey('telefono', 'teléfono', 'phone', 'tel', 'fijo', 'telefonofijo');
  const keyEmail = findKey('email', 'correo', 'mail', 'correoelectronico');
  const keyInteres = findKey('interes', 'interés', 'tratamiento', 'servicio', 'motivo', 'interest');
  const keyNotas = findKey('notas', 'nota', 'observaciones', 'comentarios', 'notes');
  const keyOrigen = findKey('origen', 'fuente', 'source', 'canal');

  console.log('🔍 Mapeo de columnas establecido:');
  console.log(`  • Nombre:          ${keyNombre || '(No encontrado)'}`);
  console.log(`  • Apellidos:       ${keyApellidos || '(No encontrado)'}`);
  console.log(`  • Nombre Completo: ${keyNombreCompleto || '(No encontrado)'}`);
  console.log(`  • Móvil:           ${keyMovil || '(No encontrado)'}`);
  console.log(`  • Teléfono:        ${keyTelefono || '(No encontrado)'}`);
  console.log(`  • Email:           ${keyEmail || '(No encontrado)'}`);
  console.log(`  • Interés:         ${keyInteres || '(No encontrado)'}`);
  console.log(`  • Notas:           ${keyNotas || '(No encontrado)'}\n`);

  let countImported = 0;
  let countSkippedNoPhone = 0;
  let countDuplicatesUpdated = 0;
  let countErrors = 0;

  const validSources = ['whatsapp', 'instagram', 'website', 'manual', 'other'];

  for (let idx = 0; idx < records.length; idx++) {
    const row = records[idx];
    const rowNum = idx + 2; // +2 por header y 1-based index

    // 1. Resolver Teléfono: probar MOVIL primero, si no hay probar Telefono
    const rawMovil = keyMovil ? row[keyMovil] : '';
    const rawTel = keyTelefono ? row[keyTelefono] : '';

    const phoneCandidate = (rawMovil && String(rawMovil).trim()) || (rawTel && String(rawTel).trim()) || '';
    const finalPhone = cleanPhone(phoneCandidate);

    if (!finalPhone) {
      countSkippedNoPhone++;
      continue;
    }

    // 2. Resolver Nombre: combinar Nombre y Apellidos (y normalizar "APELLIDOS, NOMBRE" a "NOMBRE APELLIDOS" si aplica)
    const rawNombre = (keyNombre ? row[keyNombre] : '').trim();
    const rawApellidos = (keyApellidos ? row[keyApellidos] : '').trim();
    let finalName = '';

    if (rawNombre || rawApellidos) {
      let baseName = rawNombre;
      if (baseName.includes(',')) {
        const parts = baseName.split(',').map(p => p.trim());
        if (parts.length === 2 && parts[0] && parts[1]) {
          baseName = `${parts[1]} ${parts[0]}`;
        }
      }
      finalName = [baseName, rawApellidos].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    } else if (keyNombreCompleto && row[keyNombreCompleto]) {
      finalName = String(row[keyNombreCompleto]).trim();
    }

    if (!finalName) {
      finalName = `Lead ${finalPhone}`;
    }

    // 3. Email, Interés, Notas, Origen y Metadatos Adicionales
    const finalEmail = (keyEmail && row[keyEmail] ? String(row[keyEmail]).trim() : null) || null;
    const finalInterest = (keyInteres && row[keyInteres] ? String(row[keyInteres]).trim() : null) || null;
    
    // Capturar metadatos útiles del archivo (Historial, NIF, Localidad, etc.)
    const metaParts = [];
    if (row['Nº Historial']) metaParts.push(`Historial: ${row['Nº Historial']}`);
    if (row['NIF']) metaParts.push(`NIF: ${row['NIF']}`);
    if (row['Localidad']) metaParts.push(`Ciudad: ${row['Localidad']}`);
    if (row['Fecha de alta']) metaParts.push(`Alta: ${row['Fecha de alta']}`);

    const rawNotes = keyNotas && row[keyNotas] ? String(row[keyNotas]).trim() : '';
    let finalNotes = 'Importado desde CSV Pacientes';
    if (metaParts.length > 0) {
      finalNotes += ` (${metaParts.join(' | ')})`;
    }
    if (rawNotes) {
      finalNotes += ` - ${rawNotes}`;
    }

    let rowSource = defaultSource;
    if (keyOrigen && row[keyOrigen]) {
      const srcCandidate = String(row[keyOrigen]).trim().toLowerCase();
      if (validSources.includes(srcCandidate)) {
        rowSource = srcCandidate;
      }
    }

    if (isDryRun) {
      if (countImported < 10) {
        console.log(`  [SIMULACIÓN Fila ${rowNum}] ✅ Nombre: "${finalName}" | Tel: "${finalPhone}" | Email: "${finalEmail || '-'}" | Interés: "${finalInterest || '-'}"`);
      }
      countImported++;
      continue;
    }

    // 4. Inserción real en Base de Datos usando crmService
    try {
      await als.run({ clinicId, isOwner: true, roleName: 'propietario' }, async () => {
        const result = await crmService.createLead({
          clinicId,
          phone: finalPhone,
          name: finalName,
          email: finalEmail,
          source: rowSource,
          status: defaultStatus,
          interest: finalInterest,
          notes: finalNotes,
          allowDuplicate: allowDuplicates,
          allow_duplicate: allowDuplicates,
          force: allowDuplicates,
        });

        if (result.isDuplicate || result.convertedToOpportunity) {
          countDuplicatesUpdated++;
        }
        countImported++;
      });
    } catch (err) {
      // Si el error es de duplicado y no se permitió duplicar, reportar advertencia
      if (err.message && err.message.includes('Ya existe un lead activo')) {
        countDuplicatesUpdated++;
      } else {
        countErrors++;
        console.error(`  [Fila ${rowNum}] ❌ Error importando "${finalName}" (${finalPhone}): ${err.message}`);
      }
    }
  }

  console.log('\n=============================================================');
  console.log('  📊 RESUMEN DE LA IMPORTACIÓN');
  console.log('=============================================================');
  console.log(`📋 Total de filas analizadas:           ${records.length}`);
  console.log(`✅ Leads procesados/creados:            ${countImported}`);
  console.log(`⏭️  Saltados (Sin móvil ni teléfono):     ${countSkippedNoPhone}`);
  console.log(`🔄 Contactos/Leads existentes o dupl.:   ${countDuplicatesUpdated}`);
  console.log(`❌ Errores:                             ${countErrors}`);
  console.log('=============================================================\n');

  if (isDryRun) {
    console.log('💡 La simulación ha finalizado sin realizar cambios en la base de datos.');
    console.log('   Para ejecutar la importación real, retira la bandera --dry-run.\n');
  } else {
    console.log('🎉 Importación completada satisfactoriamente en la base de datos.\n');
  }

  await pool.end();
}

run().catch(async (err) => {
  console.error('❌ Error fatal en el proceso de importación:', err);
  try { await pool.end(); } catch (_) {}
  process.exit(1);
});
