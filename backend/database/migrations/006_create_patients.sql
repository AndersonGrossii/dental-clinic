-- ============================================
-- Migración 006: Tabla de Pacientes
-- ============================================

CREATE TABLE IF NOT EXISTS patients (
  id SERIAL PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  dni VARCHAR(20),
  passport VARCHAR(30),
  birth_date DATE,
  gender VARCHAR(10) CHECK (gender IN ('masculino', 'femenino', 'otro')),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  postal_code VARCHAR(20),
  phone VARCHAR(20),
  mobile VARCHAR(20),
  email VARCHAR(255),
  emergency_contact_name VARCHAR(200),
  emergency_contact_phone VARCHAR(20),
  emergency_contact_relationship VARCHAR(50),
  allergies TEXT,
  medical_conditions TEXT,
  current_medications TEXT,
  insurance_provider VARCHAR(100),
  insurance_number VARCHAR(50),
  occupation VARCHAR(100),
  notes TEXT,
  photo_url VARCHAR(500),
  is_active BOOLEAN DEFAULT TRUE,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(last_name, first_name);
CREATE INDEX IF NOT EXISTS idx_patients_dni ON patients(dni) WHERE dni IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_patients_email ON patients(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_patients_active ON patients(is_active) WHERE deleted_at IS NULL;

-- Búsqueda full-text en nombre
CREATE INDEX IF NOT EXISTS idx_patients_fulltext ON patients
  USING GIN (to_tsvector('spanish', coalesce(first_name, '') || ' ' || coalesce(last_name, '')));
