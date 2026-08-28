-- Migration 044: Add quotation_item_id and patient_treatment_id to payments table
ALTER TABLE payments ADD COLUMN IF NOT EXISTS quotation_item_id INTEGER REFERENCES quotation_items(id) ON DELETE SET NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS patient_treatment_id INTEGER REFERENCES patient_treatments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payments_quotation_item ON payments(quotation_item_id);
CREATE INDEX IF NOT EXISTS idx_payments_patient_treatment ON payments(patient_treatment_id);
