-- ============================================
-- Migración 008: Documentos e Imágenes
-- ============================================

CREATE TABLE IF NOT EXISTS patient_images (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size INTEGER,
  mime_type VARCHAR(100),
  category VARCHAR(50) DEFAULT 'radiografia' CHECK (category IN ('radiografia', 'fotografia', 'panoramica', 'periapical', 'otro')),
  description TEXT,
  tooth_number INTEGER,
  uploaded_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS documents (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size INTEGER,
  mime_type VARCHAR(100),
  category VARCHAR(50) DEFAULT 'otro' CHECK (category IN ('consentimiento', 'receta', 'referencia', 'laboratorio', 'otro')),
  description TEXT,
  uploaded_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_patient_images_patient ON patient_images(patient_id);
CREATE INDEX IF NOT EXISTS idx_documents_patient ON documents(patient_id);
