// ============================================
// Prueba Automatizada: Treatment Promotional Packs (TASK-115)
// Valida los 16 criterios obligatorios de paquetes promocionales:
// 1. Crear pack con datos válidos
// 2. Agregar múltiples tratamientos a un pack
// 3. Verificar que el precio fijo se guarda y devuelve correctamente
// 4. Editar un pack existente
// 5. Activar / desactivar un pack (toggle-status)
// 6. Carga de ítems al seleccionar pack en cotización
// 7. Todos los tratamientos del pack aparecen en el presupuesto
// 8. Se aplica el precio fijo promocional en el subtotal
// 9. Los precios individuales del pack no se suman al subtotal
// 10. Los precios originales de los tratamientos en catálogo no se alteran
// 11. Presupuesto histórico inmutable tras editar el pack
// 12. Pack inactivo rechazado para nuevos presupuestos
// 13. Pack expirado rechazado para nuevos presupuestos
// 14. Aislamiento multi-clínica (Clínica 1 vs Clínica 2)
// 15. Cotizaciones estándar sin packs funcionan con 0 regresiones
// 16. Cotización mixta (Tratamiento 1.500 € + Pack 4.000 € + Tratamiento 100 € = 5.600 €)
// Extra: Generación de PDF oficial con formato de pack
// ============================================
process.env.NODE_ENV = 'test';
import { query, als } from '../database/pool.js';
import promotionalPackService from '../services/promotional-pack.service.js';
import quotationService from '../services/quotation.service.js';
import pdfService from '../services/pdf.service.js';

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

async function runPromotionalPacksTests() {
  console.log('\n=============================================================');
  console.log('  🎁 PRUEBAS: PAQUETES PROMOCIONALES DE TRATAMIENTOS (TASK-115)');
  console.log('=============================================================\n');

  const testSuffix = Date.now();
  let t1Id, t2Id, t3Id;
  let tC2Id;
  let patient1Id, patientC2Id;
  let packCreatedId;
  let quoteCreatedId;

  try {
    // -----------------------------------------------------------------
    // PREPARACIÓN DE DATOS (SETUP)
    // -----------------------------------------------------------------
    console.log('🔹 [SETUP] Creando tratamientos maestros y pacientes de prueba...');

    // Tratamientos en Clínica 1
    // T1: Blanqueamiento Láser - 1.500 €
    const t1Res = await query(
      `INSERT INTO treatments (clinic_id, name, description, default_price, duration_minutes, is_active)
       VALUES (1, 'Blanqueamiento Dental Láser ${testSuffix}', 'Tratamiento estético avanzado', 1500.00, 60, true)
       RETURNING id, default_price`
    );
    t1Id = t1Res.rows[0].id;

    // T2: Limpieza Ultrasonido Profunda - 100 €
    const t2Res = await query(
      `INSERT INTO treatments (clinic_id, name, description, default_price, duration_minutes, is_active)
       VALUES (1, 'Limpieza Ultrasonido Profunda ${testSuffix}', 'Profilaxis dental completa', 100.00, 45, true)
       RETURNING id, default_price`
    );
    t2Id = t2Res.rows[0].id;

    // T3: Férula de Descarga - 300 €
    const t3Res = await query(
      `INSERT INTO treatments (clinic_id, name, description, default_price, duration_minutes, is_active)
       VALUES (1, 'Férula de Descarga Michigan ${testSuffix}', 'Tratamiento bruxismo', 300.00, 30, true)
       RETURNING id, default_price`
    );
    t3Id = t3Res.rows[0].id;

    // Tratamiento en Clínica 2 (para probar aislamiento)
    const tC2Res = await query(
      `INSERT INTO treatments (clinic_id, name, description, default_price, duration_minutes, is_active)
       VALUES (2, 'Implante Tenant 2 ${testSuffix}', 'Tratamiento de otra clínica', 850.00, 90, true)
       RETURNING id, default_price`
    );
    tC2Id = tC2Res.rows[0].id;

    // Pacientes
    const p1Res = await query(
      `INSERT INTO patients (clinic_id, first_name, last_name, dni, email)
       VALUES (1, 'Ana', 'Packs_${testSuffix}', '44556677T', 'ana_packs_${testSuffix}@test.com')
       RETURNING id`
    );
    patient1Id = p1Res.rows[0].id;

    const pC2Res = await query(
      `INSERT INTO patients (clinic_id, first_name, last_name, dni, email)
       VALUES (2, 'Roberto', 'Tenant2_${testSuffix}', '77889900M', 'roberto_${testSuffix}@test.com')
       RETURNING id`
    );
    patientC2Id = pC2Res.rows[0].id;

    console.log('✅ [SETUP] Datos preparados exitosamente.\n');

    // =================================================================
    // ESCENARIO 1: Crear pack con datos válidos
    // ESCENARIO 2: Agregar múltiples tratamientos a un pack
    // ESCENARIO 3: Verificar que el precio fijo se guarda y devuelve
    // =================================================================
    console.log('--- [ESCENARIOS 1, 2, 3] Creación de Pack Promocional con Múltiples Tratamientos y Precio Fijo ---');
    await als.run({ clinicId: 1, userId: 1 }, async () => {
      const packPayload = {
        name: `Pack Sonrisa Radiante ${testSuffix}`,
        description: 'Blanqueamiento Láser + Limpieza Profunda en oferta especial',
        fixed_price: 1200.00, // Suma regular = 1.500 + 100 = 1.600 € -> Oferta = 1.200 €
        start_date: '2026-09-01',
        end_date: '2026-12-31',
        items: [
          { treatment_id: t1Id, quantity: 1, sort_order: 1 },
          { treatment_id: t2Id, quantity: 1, sort_order: 2 },
        ],
      };

      const createdPack = await promotionalPackService.create(packPayload);
      packCreatedId = createdPack.id;

      // Escenario 1
      assert(createdPack && createdPack.id > 0, 'Escenario 1: Creación de pack promocional exitosa', `ID: ${createdPack.id}`);
      assert(createdPack.name === packPayload.name, 'Escenario 1: Nombre de pack guardado correctamente');
      assert(createdPack.is_active === true, 'Escenario 1: Pack activo por defecto');

      // Escenario 2
      assert(Array.isArray(createdPack.items) && createdPack.items.length === 2, 'Escenario 2: Múltiples tratamientos asociados al pack', `Count: ${createdPack.items.length}`);
      const hasT1 = createdPack.items.some(it => it.treatment_id === t1Id);
      const hasT2 = createdPack.items.some(it => it.treatment_id === t2Id);
      assert(hasT1 && hasT2, 'Escenario 2: Tratamientos T1 y T2 vinculados correctamente');

      // Escenario 3
      assert(parseFloat(createdPack.fixed_price) === 1200.00, 'Escenario 3: Precio fijo promocional persistido como 1200.00 €');
      assert(parseFloat(createdPack.total_catalog_value) === 1600.00, 'Escenario 3: Valor de catálogo computado correctamente (1600.00 €)');
      assert(parseFloat(createdPack.savings_amount) === 400.00, 'Escenario 3: Ahorro calculado correctamente (400.00 €)');
    });

    // =================================================================
    // ESCENARIO 4: Editar un pack existente
    // =================================================================
    console.log('\n--- [ESCENARIO 4] Edición de Pack Existente ---');
    await als.run({ clinicId: 1, userId: 1 }, async () => {
      const updatePayload = {
        name: `Pack Sonrisa Total VIP ${testSuffix}`,
        description: 'Blanqueamiento Láser + Limpieza + Férula con precio especial',
        fixed_price: 1400.00,
        items: [
          { treatment_id: t1Id, quantity: 1, sort_order: 1 },
          { treatment_id: t2Id, quantity: 1, sort_order: 2 },
          { treatment_id: t3Id, quantity: 1, sort_order: 3 },
        ],
      };

      const updatedPack = await promotionalPackService.update(packCreatedId, updatePayload);
      assert(updatedPack.name === updatePayload.name, 'Escenario 4: Nombre de pack actualizado');
      assert(parseFloat(updatedPack.fixed_price) === 1400.00, 'Escenario 4: Precio fijo actualizado a 1400.00 €');
      assert(updatedPack.items.length === 3, 'Escenario 4: Tratamientos actualizados a 3 elementos');

      // Restaurar a 2 tratamientos y 1200 € para los siguientes tests de cotización
      await promotionalPackService.update(packCreatedId, {
        name: `Pack Sonrisa Radiante ${testSuffix}`,
        fixed_price: 1200.00,
        items: [
          { treatment_id: t1Id, quantity: 1, sort_order: 1 },
          { treatment_id: t2Id, quantity: 1, sort_order: 2 },
        ],
      });
    });

    // =================================================================
    // ESCENARIO 5: Activar / Desactivar pack (toggle-status)
    // =================================================================
    console.log('\n--- [ESCENARIO 5] Activar / Desactivar Pack ---');
    await als.run({ clinicId: 1, userId: 1 }, async () => {
      const toggledOff = await promotionalPackService.toggleStatus(packCreatedId);
      assert(toggledOff.is_active === false, 'Escenario 5: Pack desactivado correctamente (is_active: false)');

      const toggledOn = await promotionalPackService.toggleStatus(packCreatedId);
      assert(toggledOn.is_active === true, 'Escenario 5: Pack reactivado correctamente (is_active: true)');
    });

    // =================================================================
    // ESCENARIOS 6, 7, 8, 9, 10: Cotización con Pack Promocional
    // =================================================================
    console.log('\n--- [ESCENARIOS 6, 7, 8, 9, 10] Selección de Pack en Cotización y Aplicación de Precio Fijo ---');
    await als.run({ clinicId: 1, userId: 1 }, async () => {
      const quoteGroupId = `pack_grp_${testSuffix}`;
      const quotePayload = {
        patient_id: patient1Id,
        quotation_date: '2026-09-11',
        valid_until: '2026-10-11',
        discount_percentage: 0,
        items: [
          // 1 Pack Header (lleva el precio fijo 1200 €)
          {
            description: `🎁 Pack Sonrisa Radiante ${testSuffix}`,
            quantity: 1,
            unit_price: 1200.00,
            discount: 0,
            status: 'aceptado',
            execution_status: 'pendiente',
            promotional_pack_id: packCreatedId,
            pack_group_id: quoteGroupId,
            pack_name: `Pack Sonrisa Radiante ${testSuffix}`,
            pack_fixed_price: 1200.00,
            is_pack_header: true,
            is_pack_item: false,
          },
          // Tratamiento 1 del pack: Blanqueamiento (unit_price: 0.00)
          {
            treatment_id: t1Id,
            description: `↳ Blanqueamiento Dental Láser ${testSuffix} (Incluido en pack)`,
            tooth_number: '11',
            quantity: 1,
            unit_price: 0.00,
            discount: 0,
            status: 'aceptado',
            execution_status: 'pendiente',
            promotional_pack_id: packCreatedId,
            pack_group_id: quoteGroupId,
            pack_name: `Pack Sonrisa Radiante ${testSuffix}`,
            pack_fixed_price: 1200.00,
            is_pack_header: false,
            is_pack_item: true,
          },
          // Tratamiento 2 del pack: Limpieza (unit_price: 0.00)
          {
            treatment_id: t2Id,
            description: `↳ Limpieza Ultrasonido Profunda ${testSuffix} (Incluido en pack)`,
            quantity: 1,
            unit_price: 0.00,
            discount: 0,
            status: 'aceptado',
            execution_status: 'pendiente',
            promotional_pack_id: packCreatedId,
            pack_group_id: quoteGroupId,
            pack_name: `Pack Sonrisa Radiante ${testSuffix}`,
            pack_fixed_price: 1200.00,
            is_pack_header: false,
            is_pack_item: true,
          },
        ],
      };

      const createdQuote = await quotationService.create(quotePayload);
      quoteCreatedId = createdQuote.id;

      // Escenario 6 & 7
      assert(createdQuote && createdQuote.id > 0, 'Escenario 6: Creación de cotización con pack exitosa');
      assert(createdQuote.items.length === 3, 'Escenario 7: Los 3 ítems del pack (1 cabecera + 2 tratamientos) aparecen en el presupuesto');

      const packHeaderItem = createdQuote.items.find(i => i.is_pack_header);
      const packChildItems = createdQuote.items.filter(i => i.is_pack_item);

      assert(!!packHeaderItem, 'Escenario 7: Cabecera del pack identificada correctamente');
      assert(packChildItems.length === 2, 'Escenario 7: Ambos tratamientos incluidos aparecen como ítems de pack');

      // Escenario 8: Se aplica el precio fijo promocional en el subtotal
      assert(parseFloat(createdQuote.subtotal) === 1200.00, 'Escenario 8: Subtotal del presupuesto refleja exactamente el precio fijo (1200.00 €)');
      assert(parseFloat(createdQuote.total) === 1200.00, 'Escenario 8: Total del presupuesto es exactamente 1200.00 €');

      // Escenario 9: Los precios individuales del pack no se suman
      const sumOfChildPrices = packChildItems.reduce((acc, it) => acc + parseFloat(it.total || 0), 0);
      assert(sumOfChildPrices === 0.00, 'Escenario 9: Los tratamientos incluidos en el pack tienen total 0.00 € y no duplican el subtotal');

      // Escenario 10: Los precios originales de los tratamientos en el catálogo no se alteran
      const checkT1 = (await query('SELECT default_price FROM treatments WHERE id = $1', [t1Id])).rows[0];
      const checkT2 = (await query('SELECT default_price FROM treatments WHERE id = $1', [t2Id])).rows[0];
      assert(parseFloat(checkT1.default_price) === 1500.00, 'Escenario 10: Precio maestro de Blanqueamiento permanece intacto en 1500.00 €');
      assert(parseFloat(checkT2.default_price) === 100.00, 'Escenario 10: Precio maestro de Limpieza permanece intacto en 100.00 €');
    });

    // =================================================================
    // ESCENARIO 11: Presupuesto histórico inmutable tras editar el pack
    // =================================================================
    console.log('\n--- [ESCENARIO 11] Inmutabilidad de Presupuestos Históricos ---');
    await als.run({ clinicId: 1, userId: 1 }, async () => {
      // Modificamos el pack maestro a 1.350 € y cambiamos su nombre
      await promotionalPackService.update(packCreatedId, {
        name: `Pack Modificado Posteriormente ${testSuffix}`,
        fixed_price: 1350.00,
        items: [
          { treatment_id: t1Id, quantity: 1 },
        ],
      });

      // Verificamos que el presupuesto creado anteriormente permanece 100% inmutable
      const historicalQuote = await quotationService.getById(quoteCreatedId);
      assert(parseFloat(historicalQuote.subtotal) === 1200.00, 'Escenario 11: Subtotal histórico permanece 1200.00 € tras modificar el pack');
      assert(parseFloat(historicalQuote.total) === 1200.00, 'Escenario 11: Total histórico permanece 1200.00 €');
      const headerItem = historicalQuote.items.find(i => i.is_pack_header);
      assert(headerItem.pack_name === `Pack Sonrisa Radiante ${testSuffix}`, 'Escenario 11: Nombre snapshot del pack en el ítem se mantiene inalterado');
      assert(parseFloat(headerItem.pack_fixed_price) === 1200.00, 'Escenario 11: Precio snapshot del pack en el ítem se mantiene inalterado');
    });

    // =================================================================
    // ESCENARIO 12: Pack inactivo rechazado para nuevo presupuesto
    // =================================================================
    console.log('\n--- [ESCENARIO 12] Rechazo de Pack Inactivo en Nueva Cotización ---');
    await als.run({ clinicId: 1, userId: 1 }, async () => {
      // Crear pack inactivo
      const inactivePack = await promotionalPackService.create({
        name: `Pack Desactivado ${testSuffix}`,
        fixed_price: 500.00,
        is_active: false,
        items: [{ treatment_id: t2Id, quantity: 1 }],
      });

      let rejected = false;
      try {
        await quotationService.create({
          patient_id: patient1Id,
          items: [
            {
              description: 'Pack Desactivado',
              quantity: 1,
              unit_price: 500.00,
              promotional_pack_id: inactivePack.id,
              is_pack_header: true,
            },
          ],
        });
      } catch (err) {
        rejected = true;
        assert(err.message.includes('inactivo') || err.message.includes('activo'), 'Escenario 12: Error descriptivo al usar pack inactivo', `Msg: ${err.message}`);
      }
      assert(rejected, 'Escenario 12: Creación de cotización con pack inactivo fue correctamente rechazada');
    });

    // =================================================================
    // ESCENARIO 13: Pack expirado rechazado para nuevo presupuesto
    // =================================================================
    console.log('\n--- [ESCENARIO 13] Rechazo de Pack Expirado en Nueva Cotización ---');
    await als.run({ clinicId: 1, userId: 1 }, async () => {
      // Crear pack cuya fecha de fin ya expiró (año 2025)
      const expiredPack = await promotionalPackService.create({
        name: `Pack Expirado ${testSuffix}`,
        fixed_price: 750.00,
        start_date: '2025-01-01',
        end_date: '2025-12-31',
        items: [{ treatment_id: t2Id, quantity: 1 }],
      });

      let rejected = false;
      try {
        await quotationService.create({
          patient_id: patient1Id,
          items: [
            {
              description: 'Pack Expirado',
              quantity: 1,
              unit_price: 750.00,
              promotional_pack_id: expiredPack.id,
              is_pack_header: true,
            },
          ],
        });
      } catch (err) {
        rejected = true;
        assert(err.message.includes('expirado'), 'Escenario 13: Error descriptivo al usar pack expirado', `Msg: ${err.message}`);
      }
      assert(rejected, 'Escenario 13: Creación de cotización con pack expirado fue correctamente rechazada');
    });

    // =================================================================
    // ESCENARIO 14: Aislamiento Multi-Clínica (Tenant Isolation)
    // =================================================================
    console.log('\n--- [ESCENARIO 14] Aislamiento Multi-Tenant (Clínica 1 vs Clínica 2) ---');
    // Clínica 2 no debe ver el pack de Clínica 1
    await als.run({ clinicId: 2, userId: 2 }, async () => {
      const c2Packs = await promotionalPackService.getAll();
      const leaked = c2Packs.some(p => p.id === packCreatedId);
      assert(!leaked, 'Escenario 14: Clínica 2 no lista packs de Clínica 1');

      let getRejected = false;
      try {
        await promotionalPackService.getById(packCreatedId);
      } catch (err) {
        getRejected = true;
      }
      assert(getRejected, 'Escenario 14: Clínica 2 no puede acceder por ID a pack de Clínica 1');

      // Tampoco puede usar el pack de Clínica 1 en una cotización de Clínica 2
      let quoteCrossRejected = false;
      try {
        await quotationService.create({
          patient_id: patientC2Id,
          items: [
            {
              description: 'Pack Infiltrado',
              quantity: 1,
              unit_price: 1200.00,
              promotional_pack_id: packCreatedId,
              is_pack_header: true,
            },
          ],
        });
      } catch (err) {
        quoteCrossRejected = true;
      }
      assert(quoteCrossRejected, 'Escenario 14: Clínica 2 no puede crear cotizaciones con packs de Clínica 1');
    });

    // =================================================================
    // ESCENARIO 15: Cotización estándar sin packs sigue funcionando (Regresión Cero)
    // =================================================================
    console.log('\n--- [ESCENARIO 15] Cotización Estándar Regular (Regresión Cero) ---');
    await als.run({ clinicId: 1, userId: 1 }, async () => {
      const regularQuote = await quotationService.create({
        patient_id: patient1Id,
        quotation_date: '2026-09-11',
        valid_until: '2026-10-11',
        discount_percentage: 10, // Descuento global 10% sobre 1700 € = 170 € -> Total = 1530 €
        items: [
          {
            treatment_id: t1Id,
            description: `Blanqueamiento normal ${testSuffix}`,
            quantity: 1,
            unit_price: 1500.00,
            status: 'aceptado',
          },
          {
            treatment_id: t2Id,
            description: `Limpieza normal ${testSuffix}`,
            quantity: 2,
            unit_price: 100.00,
            status: 'aceptado',
          },
        ],
      });

      assert(regularQuote && regularQuote.id > 0, 'Escenario 15: Cotización estándar sin packs creada exitosamente');
      assert(parseFloat(regularQuote.subtotal) === 1700.00, 'Escenario 15: Subtotal de cotización estándar calculado correctamente (1700.00 €)');
      assert(parseFloat(regularQuote.total) === 1530.00, 'Escenario 15: Total con 10% de descuento calculado correctamente (1530.00 €)');
    });

    // =================================================================
    // ESCENARIO 16: Cotización Mixta (Tratamiento Individual + Pack + Tratamiento Individual)
    // Ejemplo exacto del requerimiento:
    // Tratamiento 1: 1.500 €
    // Pack Promocional: 4.000 € (con tratamientos internos a 0 €)
    // Tratamiento 2: 100 €
    // Total Esperado: 5.600 €
    // =================================================================
    console.log('\n--- [ESCENARIO 16] Cotización Mixta (1.500 € + Pack 4.000 € + 100 € = 5.600 €) ---');
    await als.run({ clinicId: 1, userId: 1 }, async () => {
      // Creamos un pack de 4.000 €
      const pack4000 = await promotionalPackService.create({
        name: `Pack Gran Estética Dental ${testSuffix}`,
        fixed_price: 4000.00,
        items: [
          { treatment_id: t1Id, quantity: 2 }, // 2 blanqueamientos en pack
          { treatment_id: t3Id, quantity: 1 }, // 1 férula en pack
        ],
      });

      const mixedGroupId = `pack_mixed_${testSuffix}`;
      const mixedQuote = await quotationService.create({
        patient_id: patient1Id,
        quotation_date: '2026-09-11',
        discount_percentage: 0,
        items: [
          // 1. Tratamiento Individual A: 1.500 €
          {
            treatment_id: t1Id,
            description: `Tratamiento Individual A ${testSuffix}`,
            quantity: 1,
            unit_price: 1500.00,
            discount: 0,
            status: 'aceptado',
          },
          // 2. Cabecera de Pack: 4.000 €
          {
            description: `🎁 Pack Gran Estética Dental ${testSuffix}`,
            quantity: 1,
            unit_price: 4000.00,
            discount: 0,
            promotional_pack_id: pack4000.id,
            pack_group_id: mixedGroupId,
            pack_name: `Pack Gran Estética Dental ${testSuffix}`,
            pack_fixed_price: 4000.00,
            is_pack_header: true,
            is_pack_item: false,
            status: 'aceptado',
          },
          // 3. Tratamientos incluidos en el pack (unit_price: 0.00)
          {
            treatment_id: t1Id,
            description: `↳ Blanqueamiento Láser Cuadrante 1 ${testSuffix}`,
            quantity: 1,
            unit_price: 0.00,
            discount: 0,
            promotional_pack_id: pack4000.id,
            pack_group_id: mixedGroupId,
            is_pack_header: false,
            is_pack_item: true,
            status: 'aceptado',
          },
          {
            treatment_id: t1Id,
            description: `↳ Blanqueamiento Láser Cuadrante 2 ${testSuffix}`,
            quantity: 1,
            unit_price: 0.00,
            discount: 0,
            promotional_pack_id: pack4000.id,
            pack_group_id: mixedGroupId,
            is_pack_header: false,
            is_pack_item: true,
            status: 'aceptado',
          },
          {
            treatment_id: t3Id,
            description: `↳ Férula de Descarga ${testSuffix}`,
            quantity: 1,
            unit_price: 0.00,
            discount: 0,
            promotional_pack_id: pack4000.id,
            pack_group_id: mixedGroupId,
            is_pack_header: false,
            is_pack_item: true,
            status: 'aceptado',
          },
          // 4. Tratamiento Individual B: 100 €
          {
            treatment_id: t2Id,
            description: `Tratamiento Individual B ${testSuffix}`,
            quantity: 1,
            unit_price: 100.00,
            discount: 0,
            status: 'aceptado',
          },
        ],
      });

      assert(mixedQuote && mixedQuote.id > 0, 'Escenario 16: Cotización mixta creada exitosamente');
      assert(parseFloat(mixedQuote.subtotal) === 5600.00, 'Escenario 16: Subtotal exacto de 5.600 € (1.500 + 4.000 + 100)');
      assert(parseFloat(mixedQuote.total) === 5600.00, 'Escenario 16: Total exacto de 5.600 €');

      // Extra: Verificar generación de PDF oficial para esta cotización mixta
      const pdfResult = await pdfService.generateQuotationPDF(mixedQuote.id);
      const pdfBuffer = pdfResult?.buffer || pdfResult;
      assert(Buffer.isBuffer(pdfBuffer) && pdfBuffer.length > 1000, 'Extra: PDF generado exitosamente para cotización con packs promocionales', `Size: ${pdfBuffer.length} bytes`);
    });

  } catch (globalErr) {
    console.error('❌ Error inesperado durante la ejecución de las pruebas:', globalErr);
    failed++;
  } finally {
    // Limpieza de datos de prueba
    console.log('\n🔹 [CLEANUP] Limpiando datos de prueba generados...');
    try {
      if (testSuffix) {
        // 1. quotation_items
        await query(`DELETE FROM quotation_items WHERE quotation_id IN (SELECT id FROM quotations WHERE patient_id IN (${patient1Id || 0}, ${patientC2Id || 0})) OR treatment_id IN (${t1Id || 0}, ${t2Id || 0}, ${t3Id || 0}, ${tC2Id || 0})`);
        // 2. quotations
        await query(`DELETE FROM quotations WHERE patient_id IN (${patient1Id || 0}, ${patientC2Id || 0}) OR id IN (${quoteCreatedId || 0})`);
        // 3. promotional_pack_items
        await query(`DELETE FROM promotional_pack_items WHERE pack_id IN (SELECT id FROM promotional_packs WHERE name LIKE '%${testSuffix}%') OR treatment_id IN (${t1Id || 0}, ${t2Id || 0}, ${t3Id || 0}, ${tC2Id || 0})`);
        // 4. promotional_packs
        await query(`DELETE FROM promotional_packs WHERE name LIKE '%${testSuffix}%'`);
        // 5. treatments
        await query(`DELETE FROM treatments WHERE id IN (${t1Id || 0}, ${t2Id || 0}, ${t3Id || 0}, ${tC2Id || 0}) OR name LIKE '%${testSuffix}%'`);
        // 6. patients
        await query(`DELETE FROM patients WHERE id IN (${patient1Id || 0}, ${patientC2Id || 0}) OR email LIKE '%${testSuffix}%'`);
      }
      console.log('✅ [CLEANUP] Limpieza completada.');
    } catch (cleanErr) {
      console.error('⚠️ [CLEANUP] Error durante la limpieza:', cleanErr.message);
    }
  }

  // Resumen final
  console.log('\n=============================================================');
  console.log('  📊 RESUMEN DE EJECUCIÓN — PAQUETES PROMOCIONALES');
  console.log('=============================================================');
  console.log(`  Total pruebas ejecutadas: ${passed + failed}`);
  console.log(`  Pruebas superadas (PASS): ${passed}`);
  console.log(`  Pruebas fallidas  (FAIL): ${failed}`);

  if (failed > 0) {
    console.error('\n❌ La suite de pruebas de Paquetes Promocionales falló.');
    process.exit(1);
  } else {
    console.log('\n🎉 ¡TODAS LAS 16 PRUEBAS OBLIGATORIAS + PDF FUERON SUPERADAS CON ÉXITO!\n');
    process.exit(0);
  }
}

runPromotionalPacksTests();
