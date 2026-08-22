-- ============================================
-- Migración 032: Vincular invoice_items a patient_treatment_id
-- Permite vincular múltiples facturas/recibos a un mismo tratamiento de paciente
-- ============================================

ALTER TABLE invoice_items 
ADD COLUMN IF NOT EXISTS patient_treatment_id INTEGER REFERENCES patient_treatments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_invoice_items_patient_treatment ON invoice_items(patient_treatment_id);

-- Retrocargar patient_treatment_id en invoice_items basado en registros existentes
UPDATE invoice_items ii
SET patient_treatment_id = pt.id
FROM patient_treatments pt
WHERE pt.invoice_id = ii.invoice_id 
  AND ii.patient_treatment_id IS NULL;
