-- ============================================
-- Migración 009: Tratamientos
-- ============================================

CREATE TABLE IF NOT EXISTS treatment_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description VARCHAR(255),
  color VARCHAR(7) DEFAULT '#6366f1',
  icon VARCHAR(50),
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS treatments (
  id SERIAL PRIMARY KEY,
  category_id INTEGER REFERENCES treatment_categories(id) ON DELETE SET NULL,
  name VARCHAR(200) NOT NULL,
  code VARCHAR(20),
  description TEXT,
  default_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  duration_minutes INTEGER DEFAULT 30,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS patient_treatments (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  treatment_id INTEGER NOT NULL REFERENCES treatments(id) ON DELETE RESTRICT,
  doctor_id INTEGER REFERENCES doctors(id),
  appointment_id INTEGER,
  tooth_number INTEGER,
  price DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'en_progreso', 'completado', 'cancelado')),
  notes TEXT,
  start_date DATE,
  end_date DATE,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_treatments_category ON treatments(category_id);
CREATE INDEX IF NOT EXISTS idx_treatments_active ON treatments(is_active) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_patient_treatments_patient ON patient_treatments(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_treatments_doctor ON patient_treatments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_patient_treatments_status ON patient_treatments(status);
