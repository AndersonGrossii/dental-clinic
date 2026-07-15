-- ============================================
-- Migración 022: Unique constraint on clinic_information.clinic_id
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_clinic_information_clinic_id'
  ) THEN
    -- Remove duplicates keeping the most recent row per clinic_id
    DELETE FROM clinic_information ci
    WHERE ci.id NOT IN (
      SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY clinic_id ORDER BY created_at DESC) AS rn
        FROM clinic_information
      ) sub WHERE rn = 1
    );

    ALTER TABLE clinic_information
    ADD CONSTRAINT uq_clinic_information_clinic_id UNIQUE (clinic_id);
  END IF;
END $$;
