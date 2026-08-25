-- ============================================
-- Migración 039: Agregar receipt_id a invoices
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invoices' AND column_name = 'receipt_id'
  ) THEN
    ALTER TABLE invoices 
      ADD COLUMN receipt_id INTEGER REFERENCES invoices(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_invoices_receipt_id ON invoices(receipt_id);
