-- Migración 047: Cambiar columnas tooth_number a VARCHAR(100) y eliminar restricciones numéricas 1-32
-- Permite especificar múltiples piezas (ej. "14, 15", "18-28") y nomenclatura internacional FDI (ej. 48, 55).

-- 1. Eliminar constraints de rango en tooth_number si existen
ALTER TABLE dental_history DROP CONSTRAINT IF EXISTS dental_history_tooth_number_check;
ALTER TABLE patient_treatments DROP CONSTRAINT IF EXISTS patient_treatments_tooth_number_check;
ALTER TABLE quotation_items DROP CONSTRAINT IF EXISTS quotation_items_tooth_number_check;
ALTER TABLE invoice_items DROP CONSTRAINT IF EXISTS invoice_items_tooth_number_check;
ALTER TABLE patient_images DROP CONSTRAINT IF EXISTS patient_images_tooth_number_check;

-- 2. Modificar tipo de columna a VARCHAR(100)
ALTER TABLE dental_history ALTER COLUMN tooth_number TYPE VARCHAR(100) USING tooth_number::varchar;
ALTER TABLE patient_treatments ALTER COLUMN tooth_number TYPE VARCHAR(100) USING tooth_number::varchar;
ALTER TABLE quotation_items ALTER COLUMN tooth_number TYPE VARCHAR(100) USING tooth_number::varchar;
ALTER TABLE invoice_items ALTER COLUMN tooth_number TYPE VARCHAR(100) USING tooth_number::varchar;
ALTER TABLE patient_images ALTER COLUMN tooth_number TYPE VARCHAR(100) USING tooth_number::varchar;
