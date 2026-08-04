-- ============================================
-- Migración 025: Vincular quotation_items a invoice_id para bloqueo de edición
-- ============================================

ALTER TABLE quotation_items 
ADD COLUMN IF NOT EXISTS invoice_id INTEGER REFERENCES invoices(id) ON DELETE SET NULL;

-- Actualizar ítems de cotizaciones que ya hayan sido facturadas previamente
UPDATE quotation_items qi
SET invoice_id = inv.id
FROM invoices inv
WHERE qi.quotation_id = inv.quotation_id 
  AND inv.quotation_id IS NOT NULL;
