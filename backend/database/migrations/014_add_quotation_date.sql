-- ============================================
-- Migración 014: Agregar columna quotation_date
-- ============================================

ALTER TABLE quotations
  ADD COLUMN IF NOT EXISTS quotation_date DATE DEFAULT CURRENT_DATE;

CREATE INDEX IF NOT EXISTS idx_quotations_date ON quotations(quotation_date);
