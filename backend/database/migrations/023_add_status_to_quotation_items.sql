-- ============================================
-- Migración 023: Agregar estado a ítems de cotizaciones
-- ============================================

ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pendiente';
