-- ============================================
-- Migración 020: Aumentar tamaño de columnas de código
-- para incluir sufijo de clínica (ej. FAC-1000-CAB)
-- ============================================

ALTER TABLE invoices
  ALTER COLUMN invoice_number TYPE VARCHAR(30);

ALTER TABLE quotations
  ALTER COLUMN quote_number TYPE VARCHAR(30);
