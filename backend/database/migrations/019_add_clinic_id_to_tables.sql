-- ============================================
-- Migración 019: Agregar clinic_id a tablas
-- ============================================

-- 1. Agregar columna clinic_id como nullable temporalmente
ALTER TABLE users ADD COLUMN IF NOT EXISTS clinic_id INTEGER REFERENCES clinics(id);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS clinic_id INTEGER REFERENCES clinics(id);
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS clinic_id INTEGER REFERENCES clinics(id);
ALTER TABLE treatments ADD COLUMN IF NOT EXISTS clinic_id INTEGER REFERENCES clinics(id);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS clinic_id INTEGER REFERENCES clinics(id);
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS clinic_id INTEGER REFERENCES clinics(id);
ALTER TABLE medical_history ADD COLUMN IF NOT EXISTS clinic_id INTEGER REFERENCES clinics(id);
ALTER TABLE dental_history ADD COLUMN IF NOT EXISTS clinic_id INTEGER REFERENCES clinics(id);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS clinic_id INTEGER REFERENCES clinics(id);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS clinic_id INTEGER REFERENCES clinics(id);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS clinic_id INTEGER REFERENCES clinics(id);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS clinic_id INTEGER REFERENCES clinics(id);
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS clinic_id INTEGER REFERENCES clinics(id);
ALTER TABLE patient_images ADD COLUMN IF NOT EXISTS clinic_id INTEGER REFERENCES clinics(id);
ALTER TABLE patient_notes ADD COLUMN IF NOT EXISTS clinic_id INTEGER REFERENCES clinics(id);
ALTER TABLE patient_treatments ADD COLUMN IF NOT EXISTS clinic_id INTEGER REFERENCES clinics(id);
ALTER TABLE doctor_schedules ADD COLUMN IF NOT EXISTS clinic_id INTEGER REFERENCES clinics(id);
ALTER TABLE doctor_unavailability ADD COLUMN IF NOT EXISTS clinic_id INTEGER REFERENCES clinics(id);
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS clinic_id INTEGER REFERENCES clinics(id);
ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS clinic_id INTEGER REFERENCES clinics(id);
ALTER TABLE clinic_information ADD COLUMN IF NOT EXISTS clinic_id INTEGER REFERENCES clinics(id);
ALTER TABLE settings ADD COLUMN IF NOT EXISTS clinic_id INTEGER REFERENCES clinics(id);

-- 2. Asignar clinic_id = 1 (main clinic) a todos los registros existentes
UPDATE users SET clinic_id = 1;
UPDATE patients SET clinic_id = 1;
UPDATE appointments SET clinic_id = 1;
UPDATE treatments SET clinic_id = 1;
UPDATE invoices SET clinic_id = 1;
UPDATE quotations SET clinic_id = 1;
UPDATE medical_history SET clinic_id = 1;
UPDATE dental_history SET clinic_id = 1;
UPDATE payments SET clinic_id = 1;
UPDATE documents SET clinic_id = 1;
UPDATE notifications SET clinic_id = 1;
UPDATE audit_logs SET clinic_id = 1;
UPDATE doctors SET clinic_id = 1;
UPDATE patient_images SET clinic_id = 1;
UPDATE patient_notes SET clinic_id = 1;
UPDATE patient_treatments SET clinic_id = 1;
UPDATE doctor_schedules SET clinic_id = 1;
UPDATE doctor_unavailability SET clinic_id = 1;
UPDATE invoice_items SET clinic_id = 1;
UPDATE quotation_items SET clinic_id = 1;
UPDATE clinic_information SET clinic_id = 1;
UPDATE settings SET clinic_id = 1;

-- 3. Alterar a NOT NULL
ALTER TABLE users ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE patients ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE appointments ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE treatments ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE invoices ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE quotations ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE medical_history ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE dental_history ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE payments ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE documents ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE notifications ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE audit_logs ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE doctors ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE patient_images ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE patient_notes ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE patient_treatments ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE doctor_schedules ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE doctor_unavailability ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE invoice_items ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE quotation_items ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE clinic_information ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE settings ALTER COLUMN clinic_id SET NOT NULL;

-- 4. Ajustar UNIQUE constraint en settings
ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_key_key;
ALTER TABLE settings ADD CONSTRAINT settings_clinic_key_unique UNIQUE (clinic_id, key);
