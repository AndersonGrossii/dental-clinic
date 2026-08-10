-- ============================================
-- Migración 012: Soporte para Citas de Primera Visita / Invitados
-- ============================================

ALTER TABLE appointments ALTER COLUMN patient_id DROP NOT NULL;

ALTER TABLE appointments 
  ADD COLUMN IF NOT EXISTS guest_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS guest_phone VARCHAR(30),
  ADD COLUMN IF NOT EXISTS guest_email VARCHAR(100);
