-- ============================================
-- Migración 026: Estado de ejecución clínica en quotation_items y enlace a historial de tratamientos
-- ============================================

ALTER TABLE quotation_items 
ADD COLUMN IF NOT EXISTS execution_status VARCHAR(20) DEFAULT 'pendiente' 
CHECK (execution_status IN ('pendiente', 'en_proceso', 'realizado'));

ALTER TABLE quotation_items 
ADD COLUMN IF NOT EXISTS patient_treatment_id INTEGER 
REFERENCES patient_treatments(id) ON DELETE SET NULL;
