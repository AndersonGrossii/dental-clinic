import assert from 'assert';
import quotationRepository from '../repositories/quotation.repository.js';
import invoiceRepository from '../repositories/invoice.repository.js';
import invoiceService from '../services/invoice.service.js';
import paymentService from '../services/payment.service.js';
import pdfService from '../services/pdf.service.js';
import { query, als } from '../database/pool.js';

async function runTest() {
  console.log('\n========================================');
  console.log('🧪 SUITE: Saldo Pendiente del Presupuesto en Recibos/Facturas');
  console.log('========================================\n');

  await als.run({ clinicId: 1, userId: 1 }, async () => {
    // 1. Setup Patient and Treatment
    const pRes = await query('SELECT id FROM patients WHERE deleted_at IS NULL LIMIT 1');
    const patientId = pRes.rows[0].id;
    const tRes = await query('SELECT id FROM treatments WHERE deleted_at IS NULL LIMIT 1');
    const treatmentId = tRes.rows[0].id;

    // 2. Create Quotation of 600 €
    const qNum = await quotationRepository.generateNumber();
    const qData = {
      quote_number: qNum,
      patient_id: patientId,
      quotation_date: '2026-10-21',
      subtotal: 600,
      tax_rate: 0,
      tax_amount: 0,
      discount_percentage: 0,
      discount_amount: 0,
      total: 600,
      status: 'aceptada',
      created_by: 1,
      clinic_id: 1,
    };
    const qItems = [{
      treatment_id: treatmentId,
      description: 'Tratamiento Prueba Saldo 600',
      quantity: 1,
      unit_price: 600,
      discount: 0,
      total: 600,
      status: 'aceptado',
      clinic_id: 1,
    }];
    const createdQuote = await quotationRepository.createWithItems(qData, qItems);
    console.log(`✓ Presupuesto creado: #${createdQuote.quote_number} (Total: ${createdQuote.total} €)`);

    try {
      // 3. Create Receipt for payment of 500 € on the 600 € treatment
      const qItem = createdQuote.items[0];
      const itemAllocs = [{ id: qItem.id, amount: 500 }];
      const receipt = await invoiceService.createFromQuotation(createdQuote.id, 1, [qItem.id], 'recibo', itemAllocs);
      console.log(`✓ Recibo generado: #${receipt.invoice_number} (Total: ${receipt.total} €)`);

      // 4. Pay 500 €
      await paymentService.create({
        invoice_id: receipt.id,
        payment_method_id: 1,
        amount: 500,
        payment_date: '2026-10-21',
        created_by: 1,
      });
      console.log(`✓ Pago de 500,00 € registrado exitosamente`);

      // 5. Fetch receipt with items and verify attached quotation info
      const fetchedReceipt = await invoiceService.getById(receipt.id);
      assert.strictEqual(parseFloat(fetchedReceipt.total), 500, 'El total del recibo debe ser 500');
      assert.strictEqual(parseFloat(fetchedReceipt.amount_paid), 500, 'El monto pagado del recibo debe ser 500');
      assert.strictEqual(parseFloat(fetchedReceipt.balance), 0, 'El saldo propio del recibo debe ser 0');

      assert(fetchedReceipt.quotation, 'El recibo debe contener información del presupuesto vinculado');
      assert.strictEqual(fetchedReceipt.quotation_number, createdQuote.quote_number, 'El número de presupuesto vinculado debe coincidir');
      assert.strictEqual(parseFloat(fetchedReceipt.quotation_total), 600, 'El total del presupuesto debe ser 600 €');
      assert.strictEqual(parseFloat(fetchedReceipt.quotation_amount_paid), 500, 'El monto acumulado pagado del presupuesto debe ser 500 €');
      assert.strictEqual(parseFloat(fetchedReceipt.quotation_remaining_balance), 100, 'El saldo pendiente del presupuesto que debe el paciente debe ser 100 €');
      console.log(`✓ Verificación exitosa: El paciente pagó 500 € de un presupuesto de 600 € y se refleja un saldo pendiente de 100 € a la clínica`);

      // 6. Test PDF Generation with quotation balance
      const pdfResult = await pdfService.generateReceiptPDF(receipt.id);
      assert(pdfResult && pdfResult.buffer && pdfResult.buffer.length > 1000, 'El PDF del recibo debe generarse con buffer válido');
      console.log(`✓ PDF Oficial del recibo generado correctamente (${pdfResult.buffer.length} bytes, archivo: ${pdfResult.filename})`);

      // 7. Pay the remaining 100 € with a second receipt
      const secondItemAllocs = [{ id: qItem.id, amount: 100 }];
      const secondReceipt = await invoiceService.createFromQuotation(createdQuote.id, 1, [qItem.id], 'recibo', secondItemAllocs);
      await paymentService.create({
        invoice_id: secondReceipt.id,
        payment_method_id: 1,
        amount: 100,
        payment_date: '2026-10-21',
        created_by: 1,
      });

      const fetchedSecondReceipt = await invoiceService.getById(secondReceipt.id);
      assert.strictEqual(parseFloat(fetchedSecondReceipt.quotation_remaining_balance), 0, 'El saldo pendiente del presupuesto ahora debe ser 0 € tras completar el pago');
      console.log(`✓ Tras abonar los 100 € restantes, el saldo pendiente del presupuesto a la clínica es 0,00 € (completado)`);

      // Clean up second receipt
      await query('DELETE FROM payments WHERE invoice_id = $1', [secondReceipt.id]);
      await query('DELETE FROM invoice_items WHERE invoice_id = $1', [secondReceipt.id]);
      await query('DELETE FROM invoices WHERE id = $1', [secondReceipt.id]);

    } finally {
      // Cleanup first receipt & quotation
      await query('DELETE FROM payments WHERE invoice_id IN (SELECT id FROM invoices WHERE quotation_id = $1)', [createdQuote.id]);
      await query('DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE quotation_id = $1)', [createdQuote.id]);
      await query('DELETE FROM invoices WHERE quotation_id = $1', [createdQuote.id]);
      await query('DELETE FROM quotation_items WHERE quotation_id = $1', [createdQuote.id]);
      await query('DELETE FROM quotations WHERE id = $1', [createdQuote.id]);
      console.log('✓ Limpieza de datos de prueba completada\n');
    }

    console.log('========================================');
    console.log('🎉 TODAS LAS VERIFICACIONES PASARON EXITOSAMENTE');
    console.log('========================================\n');
  });
}

runTest().catch((err) => {
  console.error('❌ Error en prueba:', err);
  process.exit(1);
});
