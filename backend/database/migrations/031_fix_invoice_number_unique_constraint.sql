-- Migration 031: Reemplazar el constraint único estricto de invoice_number por un índice único parcial
-- Esto permite reutilizar/rellenar huecos de números de comprobantes (FAC y REC) cuando son cancelados o eliminados.

ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_invoice_number_key;
DROP INDEX IF EXISTS invoices_invoice_number_unique_idx;

CREATE UNIQUE INDEX invoices_invoice_number_unique_idx 
ON invoices (invoice_number) 
WHERE deleted_at IS NULL AND status != 'cancelada';
