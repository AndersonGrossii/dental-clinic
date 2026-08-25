-- ============================================
-- Migración 037: Establecer tasa de IVA / impuesto en 0% por defecto
-- ============================================

ALTER TABLE clinic_information ALTER COLUMN tax_rate SET DEFAULT 0.00;
ALTER TABLE quotations ALTER COLUMN tax_rate SET DEFAULT 0.00;
ALTER TABLE invoices ALTER COLUMN tax_rate SET DEFAULT 0.00;
ALTER TABLE patient_treatments ALTER COLUMN tax_rate SET DEFAULT 0.00;

UPDATE clinic_information SET tax_rate = 0.00;
UPDATE quotations SET tax_rate = 0.00, tax_amount = 0.00;
UPDATE invoices SET tax_rate = 0.00, tax_amount = 0.00;
UPDATE patient_treatments SET tax_rate = 0.00;
