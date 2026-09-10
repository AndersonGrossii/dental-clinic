// ============================================
// Pruebas: Documentos y Radiografías de Pacientes (TASK-103)
// ============================================
process.env.NODE_ENV = 'test';
import { query, als } from '../database/pool.js';
import patientService from '../services/patient.service.js';

let passed = 0;
let failed = 0;

function assert(condition, testName, extraInfo = '') {
  if (condition) {
    console.log(`  ✅ PASS: ${testName} ${extraInfo}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${testName} ${extraInfo}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n=============================================================');
  console.log('  📁 PRUEBAS: DOCUMENTOS Y RADIOGRAFÍAS (TASK-103)');
  console.log('=============================================================\n');

  let patientC1 = null;
  let imageC1 = null;
  let docC1 = null;

  try {
    // 1. Limpieza preventiva
    await query("DELETE FROM patient_images WHERE file_name LIKE 'test_rx_%'");
    await query("DELETE FROM documents WHERE file_name LIKE 'test_doc_%'");
    await query("DELETE FROM patients WHERE email LIKE 'doc_test_%@clinic1.com'");

    // 2. Crear paciente en Clínica #1
    console.log('🔹 [1/4] Creando paciente y subiendo radiografía y documento en Clínica #1');
    await als.run({ clinicId: 1, userId: 1 }, async () => {
      const unique = Date.now();
      patientC1 = await patientService.create({
        first_name: 'TestDoc',
        last_name: `Paciente_${unique}`,
        dni: `DOC${unique.toString().slice(-5)}`,
        phone: '611222333',
        email: `doc_test_${unique}@clinic1.com`,
      });
      assert(patientC1 && patientC1.id, 'Paciente creado en Clínica 1', `(ID: ${patientC1.id})`);

      // Subir imagen/radiografía
      imageC1 = await patientService.addImage(
        patientC1.id,
        {
          filename: `test_rx_${unique}.png`,
          originalname: 'rx_periapical_18.png',
          size: 102400,
          mimetype: 'image/png',
        },
        {
          category: 'periapical',
          tooth_number: '18',
          description: 'Control de raíz pieza 18',
        },
        1
      );
      assert(imageC1 && imageC1.id, 'Radiografía subida exitosamente', `(ID: ${imageC1.id})`);
      assert(imageC1.category === 'periapical', 'Categoría periapical asignada correctamente');
      assert(imageC1.tooth_number === 18, 'Número de pieza dental 18 guardado correctamente');

      // Subir documento
      docC1 = await patientService.addDocument(
        patientC1.id,
        {
          filename: `test_doc_${unique}.pdf`,
          originalname: 'consentimiento_cirugia.pdf',
          size: 204800,
          mimetype: 'application/pdf',
        },
        {
          category: 'consentimiento',
          description: 'Consentimiento informado para extracción',
        },
        1
      );
      assert(docC1 && docC1.id, 'Documento subido exitosamente', `(ID: ${docC1.id})`);
      assert(docC1.category === 'consentimiento', 'Categoría consentimiento guardada correctamente');
    });

    // 3. Consultas y Filtros en Clínica #1
    console.log('\n🔹 [2/4] Verificando listado y filtros de radiografías y documentos en Clínica #1');
    await als.run({ clinicId: 1, userId: 1 }, async () => {
      const allImages = await patientService.getImages(patientC1.id);
      assert(allImages.length === 1, 'getImages devuelve la radiografía creada');

      const filteredImages = await patientService.getImages(patientC1.id, { toothNumber: 18 });
      assert(filteredImages.length === 1, 'Filtro por número de diente 18 devuelve 1 resultado');

      const emptyImages = await patientService.getImages(patientC1.id, { toothNumber: 24 });
      assert(emptyImages.length === 0, 'Filtro por otro número de diente devuelve 0 resultados');

      const docs = await patientService.getDocuments(patientC1.id);
      assert(docs.total === 1 && docs.rows.length === 1, 'getDocuments devuelve el documento creado');
    });

    // 4. Aislamiento Multi-Tenant desde Clínica #2
    console.log('\n🔹 [3/4] Verificando aislamiento multi-tenant desde Clínica #2');
    await als.run({ clinicId: 2, userId: 2 }, async () => {
      let threwImage = false;
      try {
        await patientService.getImages(patientC1.id);
      } catch (err) {
        threwImage = true;
      }
      assert(threwImage, 'Clínica 2 NO puede listar radiografías del paciente de Clínica 1');

      let threwDoc = false;
      try {
        await patientService.getDocuments(patientC1.id);
      } catch (err) {
        threwDoc = true;
      }
      assert(threwDoc, 'Clínica 2 NO puede listar documentos del paciente de Clínica 1');

      let threwDelete = false;
      try {
        await patientService.deleteImage(patientC1.id, imageC1.id);
      } catch (err) {
        threwDelete = true;
      }
      assert(threwDelete, 'Clínica 2 NO puede eliminar radiografía del paciente de Clínica 1');
    });

    // 5. Eliminación (Soft Delete) en Clínica #1
    console.log('\n🔹 [4/4] Verificando eliminación soft-delete en Clínica #1');
    await als.run({ clinicId: 1, userId: 1 }, async () => {
      await patientService.deleteImage(patientC1.id, imageC1.id);
      const remainingImages = await patientService.getImages(patientC1.id);
      assert(remainingImages.length === 0, 'Radiografía marcada como eliminada (soft delete)');

      await patientService.deleteDocument(patientC1.id, docC1.id);
      const remainingDocs = await patientService.getDocuments(patientC1.id);
      assert(remainingDocs.total === 0, 'Documento marcado como eliminado (soft delete)');
    });

    // Limpieza final
    if (patientC1?.id) {
      await query('DELETE FROM patient_images WHERE patient_id = $1', [patientC1.id]);
      await query('DELETE FROM documents WHERE patient_id = $1', [patientC1.id]);
      await query('DELETE FROM patients WHERE id = $1', [patientC1.id]);
    }
  } catch (error) {
    console.error('Error fatal durante la prueba:', error);
    failed++;
  }

  console.log('\n=============================================================');
  console.log(`  📊 RESULTADOS: ${passed} PRUEBAS EXITOSAS, ${failed} FALLIDAS`);
  console.log('=============================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

runTests();
