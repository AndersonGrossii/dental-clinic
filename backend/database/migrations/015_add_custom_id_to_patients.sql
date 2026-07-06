-- ============================================
-- Migración 015: Agregar columna custom_id a pacientes
-- ============================================

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS custom_id VARCHAR(50) UNIQUE;

-- Backfill existing patients using their creation year and serial ID sequence
WITH numbered_patients AS (
  SELECT id,
         COALESCE(EXTRACT(YEAR FROM created_at)::integer, 2026) AS year,
         ROW_NUMBER() OVER (PARTITION BY COALESCE(EXTRACT(YEAR FROM created_at)::integer, 2026) ORDER BY id) AS seq
  FROM patients
)
UPDATE patients p
SET custom_id = np.year || '-' || LPAD(np.seq::text, 4, '0')
FROM numbered_patients np
WHERE p.id = np.id AND p.custom_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_patients_custom_id ON patients(custom_id) WHERE deleted_at IS NULL;
