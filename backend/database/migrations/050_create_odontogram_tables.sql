-- ============================================
-- Migración 050: Odontograma Digital Clínico Avanzado
-- ============================================

CREATE TABLE IF NOT EXISTS odontogram_entries (
  id SERIAL PRIMARY KEY,
  clinic_id INTEGER NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  tooth_number VARCHAR(10) NOT NULL,
  surfaces TEXT[] DEFAULT '{}',
  condition VARCHAR(50) NOT NULL,
  state VARCHAR(20) NOT NULL DEFAULT 'DIAGNOSED' CHECK (state IN ('DIAGNOSED', 'PLANNED', 'COMPLETED')),
  severity VARCHAR(20) DEFAULT 'MODERATE' CHECK (severity IN ('EARLY', 'MODERATE', 'SEVERE')),
  notes TEXT,
  created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE NULL
);

CREATE INDEX IF NOT EXISTS idx_odontogram_clinic_id ON odontogram_entries(clinic_id);
CREATE INDEX IF NOT EXISTS idx_odontogram_patient_id ON odontogram_entries(patient_id);
CREATE INDEX IF NOT EXISTS idx_odontogram_tooth ON odontogram_entries(tooth_number);
CREATE INDEX IF NOT EXISTS idx_odontogram_state ON odontogram_entries(state);
