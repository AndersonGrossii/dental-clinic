import { query } from '../backend/database/pool.js';

async function fixUniqueConstraint() {
  console.log('--- Applying Partial Unique Index Migration ---');

  // 1. Drop old strict unique constraint if exists
  await query(`ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_invoice_number_key;`);
  await query(`DROP INDEX IF EXISTS invoices_invoice_number_unique_idx;`);

  // 2. Create partial unique index that only enforces uniqueness for active non-canceled invoices
  await query(`
    CREATE UNIQUE INDEX invoices_invoice_number_unique_idx 
    ON invoices (invoice_number) 
    WHERE deleted_at IS NULL AND status != 'cancelada';
  `);

  console.log('✓ Successfully created partial unique index on invoices(invoice_number)!');
  process.exit(0);
}

fixUniqueConstraint().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
