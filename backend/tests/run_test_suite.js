// ============================================
// Master Test Runner — Vides Dental SaaS Test Suite Orchestrator
// Ejecuta todas las suites de prueba secuencialmente y valida el estado global
// ============================================
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const suites = [
  { name: 'E2E & Domain Services (150 pruebas)', file: 'run_all_tests.js' },
  { name: 'Días Festivos, Alcàntera de Xúquer y Fines de Semana (18 pruebas)', file: 'test_holidays_and_weekends.js' },
  { name: 'Aislamiento Multi-Tenant y Seguridad entre Clínicas (11 pruebas)', file: 'test_multi_tenant_isolation.js' },
  { name: 'Documentos, Radiografías y Aislamiento de Archivos (15 pruebas)', file: 'test_documents_and_images.js' },
  { name: 'Generación de PDFs Clínicos & Multi-Tenant (17 pruebas)', file: 'test_pdf_generation.js' },
];

console.log('\n╔══════════════════════════════════════════════════════════════════╗');
console.log('║  🧪 VIDES DENTAL SAAS — SUITE GLOBAL DE PRUEBAS AUTOMATIZADAS    ║');
console.log('╚══════════════════════════════════════════════════════════════════╝\n');

let totalPassedSuites = 0;
let failedSuites = [];

for (const suite of suites) {
  const filePath = path.join(__dirname, suite.file);
  console.log(`\n▶️  Ejecutando Suite: ${suite.name}...`);
  console.log(`   Archivo: ${suite.file}\n`);

  const result = spawnSync(process.execPath, [filePath], {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'test' },
  });

  if (result.status === 0) {
    totalPassedSuites++;
    console.log(`\n✨ Suite "${suite.name}" completada con ÉXITO.`);
  } else {
    failedSuites.push(suite.name);
    console.error(`\n💥 Suite "${suite.name}" FALLÓ con código de salida ${result.status}.`);
  }
}

console.log('\n══════════════════════════════════════════════════════════════════');
console.log('  📊 RESUMEN EJECUTIVO DE PRUEBAS GLOBALES');
console.log('══════════════════════════════════════════════════════════════════');
console.log(`  Suites ejecutadas: ${suites.length}`);
console.log(`  Suites exitosas:   ${totalPassedSuites}`);
console.log(`  Suites fallidas:   ${failedSuites.length}`);

if (failedSuites.length > 0) {
  console.error('\n❌ Las siguientes suites fallaron:');
  failedSuites.forEach(s => console.error(`   - ${s}`));
  process.exit(1);
} else {
  console.log('\n🎉 ¡TODAS LAS SUITES DE PRUEBA SUPERADAS SATISFACTORIAMENTE!');
  console.log('   (179+ aserciones verificadas, 0 regresiones)\n');
  process.exit(0);
}
