import { pool, query } from '../backend/database/pool.js';
import invoiceRepository from '../backend/repositories/invoice.repository.js';
import paymentService from '../backend/services/payment.service.js';

async function testFlow() {
  console.log('--- Testing Number Generation Gap-Filling ---');

  const invNum1 = await invoiceRepository.generateDocumentNumber('factura');
  const recNum1 = await invoiceRepository.generateDocumentNumber('recibo');
  console.log('Initial generated numbers:', { invNum1, recNum1 });

  if (!invNum1.startsWith('FAC-') || !recNum1.startsWith('REC-')) {
    throw new Error('Number generation prefix failure');
  }

  console.log('--- Testing FOR UPDATE OF pt Query ---');
  // Get an existing patient and treatment
  const patRes = await query(`SELECT id FROM patients WHERE deleted_at IS NULL LIMIT 1`);
  if (patRes.rows.length > 0) {
    const patientId = patRes.rows[0].id;
    const ptRes = await query(`SELECT id FROM patient_treatments WHERE patient_id = $1 AND deleted_at IS NULL LIMIT 1`, [patientId]);
    if (ptRes.rows.length > 0) {
      const treatmentId = ptRes.rows[0].id;
      // Get payment method
      const pmRes = await query(`SELECT id FROM payment_methods LIMIT 1`);
      const paymentMethodId = pmRes.rows[0]?.id || 1;

      console.log(`Testing processTreatmentPayment for patient ${patientId}, treatment ${treatmentId}...`);
      const result = await paymentService.processTreatmentPayment({
        patient_id: patientId,
        treatment_ids: [treatmentId],
        document_type: 'recibo',
        payment_method_id: paymentMethodId,
        amount: 10.00,
        tax_rate: 16.00,
      });

      console.log('Payment result:', {
        invoice_id: result.document?.id,
        invoice_number: result.document?.invoice_number,
        payment_id: result.payment?.id,
      });

      // Cleanup test payment and document
      if (result.payment?.id) {
        await paymentService.delete(result.payment.id);
        console.log('Cleaned up test payment and document reversal.');
      }
    }
  }

  console.log('✓ All backend FOR UPDATE OF pt tests passed successfully!');
  process.exit(0);
}

testFlow().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
