-- ============================================
-- Migración 028: Establecer clinic_id por defecto a 1
-- ============================================

ALTER TABLE users ALTER COLUMN clinic_id SET DEFAULT 1;
ALTER TABLE patients ALTER COLUMN clinic_id SET DEFAULT 1;
ALTER TABLE appointments ALTER COLUMN clinic_id SET DEFAULT 1;
ALTER TABLE treatments ALTER COLUMN clinic_id SET DEFAULT 1;
ALTER TABLE invoices ALTER COLUMN clinic_id SET DEFAULT 1;
ALTER TABLE quotations ALTER COLUMN clinic_id SET DEFAULT 1;
ALTER TABLE medical_history ALTER COLUMN clinic_id SET DEFAULT 1;
ALTER TABLE dental_history ALTER COLUMN clinic_id SET DEFAULT 1;
ALTER TABLE payments ALTER COLUMN clinic_id SET DEFAULT 1;
ALTER TABLE documents ALTER COLUMN clinic_id SET DEFAULT 1;
ALTER TABLE notifications ALTER COLUMN clinic_id SET DEFAULT 1;
ALTER TABLE audit_logs ALTER COLUMN clinic_id SET DEFAULT 1;
ALTER TABLE doctors ALTER COLUMN clinic_id SET DEFAULT 1;
ALTER TABLE patient_images ALTER COLUMN clinic_id SET DEFAULT 1;
ALTER TABLE patient_notes ALTER COLUMN clinic_id SET DEFAULT 1;
ALTER TABLE patient_treatments ALTER COLUMN clinic_id SET DEFAULT 1;
ALTER TABLE doctor_schedules ALTER COLUMN clinic_id SET DEFAULT 1;
ALTER TABLE doctor_unavailability ALTER COLUMN clinic_id SET DEFAULT 1;
ALTER TABLE invoice_items ALTER COLUMN clinic_id SET DEFAULT 1;
ALTER TABLE quotation_items ALTER COLUMN clinic_id SET DEFAULT 1;
ALTER TABLE clinic_information ALTER COLUMN clinic_id SET DEFAULT 1;
ALTER TABLE settings ALTER COLUMN clinic_id SET DEFAULT 1;
ALTER TABLE prescriptions ALTER COLUMN clinic_id SET DEFAULT 1;
