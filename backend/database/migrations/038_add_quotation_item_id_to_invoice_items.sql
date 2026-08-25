-- ============================================
-- Migración 038: Vincular invoice_items a quotation_item_id
-- Permite vincular pagos/facturas/recibos a ítems específicos de cotización
-- ============================================

ALTER TABLE invoice_items 
ADD COLUMN IF NOT EXISTS quotation_item_id INTEGER REFERENCES quotation_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_invoice_items_quotation_item ON invoice_items(quotation_item_id);
