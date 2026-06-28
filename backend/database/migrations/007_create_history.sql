-- ============================================
-- Migración 007: Historial Médico y Dental
-- ============================================

CREATE TABLE IF NOT EXISTS medical_history (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  condition VARCHAR(255) NOT NULL,
  diagnosis TEXT,
  treatment TEXT,
  start_date DATE,
  end_date DATE,
  is_current BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS dental_history (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  tooth_number INTEGER CHECK (tooth_number BETWEEN 1 AND 32),
  condition VARCHAR(100) NOT NULL,
  treatment VARCHAR(255),
  treatment_date DATE,
  doctor_id INTEGER REFERENCES doctors(id),
  notes TEXT,
  status VARCHAR(20) DEFAULT 'activo' CHECK (status IN ('activo', 'completado', 'en_progreso')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS patient_notes (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  title VARCHAR(200),
  content TEXT NOT NULL,
  type VARCHAR(30) DEFAULT 'general' CHECK (type IN ('general', 'clinica', 'seguimiento', 'observacion')),
  is_private BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_medical_history_patient ON medical_history(patient_id);
CREATE INDEX IF NOT EXISTS idx_dental_history_patient ON dental_history(patient_id);
CREATE INDEX IF NOT EXISTS idx_dental_history_tooth ON dental_history(tooth_number);
CREATE INDEX IF NOT EXISTS idx_patient_notes_patient ON patient_notes(patient_id);
