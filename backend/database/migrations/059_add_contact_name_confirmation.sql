-- ============================================
-- Migración 059: Confirmación de Nombre de Contacto por IA
-- ============================================

ALTER TABLE messaging_contacts 
ADD COLUMN IF NOT EXISTS is_name_confirmed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS confirmed_name VARCHAR(255);

-- Para los pacientes ya registrados en el sistema, su nombre ya es verificado
UPDATE messaging_contacts 
SET is_name_confirmed = TRUE, confirmed_name = name 
WHERE patient_id IS NOT NULL AND is_name_confirmed IS FALSE;
