import { query } from '../backend/database/pool.js';

async function checkConstraints() {
  const res = await query(`
    SELECT conname, contype, pg_get_constraintdef(c.oid)
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'public' AND c.contype = 'u';
  `);
  console.log('Unique constraints:', res.rows);

  const invRes = await query(`SELECT invoice_number, document_type, count(*) FROM invoices GROUP BY invoice_number, document_type HAVING count(*) > 1`);
  console.log('Duplicate invoice_numbers if any:', invRes.rows);

  const allInvoices = await query(`SELECT id, invoice_number, document_type, status, deleted_at FROM invoices ORDER BY id DESC LIMIT 20`);
  console.log('Recent invoices in DB:', allInvoices.rows);

  process.exit(0);
}

checkConstraints().catch(err => {
  console.error(err);
  process.exit(1);
});
