-- ============================================
-- Migración 016: Agregar Gabinete y Relación de Citas en Notas
-- ============================================

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS gabinete VARCHAR(50) NOT NULL DEFAULT 'Gabinete 1';

ALTER TABLE patient_notes ADD COLUMN IF NOT EXISTS appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL;
