-- Migration 045: Add quotation_id to payments table
ALTER TABLE payments ADD COLUMN IF NOT EXISTS quotation_id INTEGER REFERENCES quotations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_payments_quotation ON payments(quotation_id);
