-- ============================================
-- Migración 027: Vincular patient_treatments a invoice_id para trazabilidad de facturación
-- ============================================

ALTER TABLE patient_treatments 
ADD COLUMN IF NOT EXISTS invoice_id INTEGER REFERENCES invoices(id) ON DELETE SET NULL;
