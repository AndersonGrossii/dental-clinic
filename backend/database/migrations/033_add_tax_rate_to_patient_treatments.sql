-- ============================================
-- Migración 033: Añadir tax_rate a patient_treatments
-- Guarda la tasa de impuesto (IVA) configurada en el primer comprobante del tratamiento
-- ============================================

ALTER TABLE patient_treatments 
ADD COLUMN IF NOT EXISTS tax_rate DECIMAL(5,2) DEFAULT 0.00;

-- Retrocargar tax_rate en patient_treatments desde la primera factura vinculada
UPDATE patient_treatments pt
SET tax_rate = inv.tax_rate
FROM invoices inv
WHERE pt.invoice_id = inv.id 
  AND inv.tax_rate > 0 
  AND (pt.tax_rate IS NULL OR pt.tax_rate = 0);
