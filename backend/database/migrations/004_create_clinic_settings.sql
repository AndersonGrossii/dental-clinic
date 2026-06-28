-- ============================================
-- Migración 004: Tabla de Información de la Clínica
-- ============================================

CREATE TABLE IF NOT EXISTS clinic_information (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  legal_name VARCHAR(255),
  tax_id VARCHAR(50),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  country VARCHAR(100) DEFAULT 'México',
  postal_code VARCHAR(20),
  phone VARCHAR(20),
  email VARCHAR(255),
  website VARCHAR(255),
  logo_url VARCHAR(500),
  currency VARCHAR(10) DEFAULT 'MXN',
  tax_rate DECIMAL(5,2) DEFAULT 16.00,
  opening_time TIME DEFAULT '08:00:00',
  closing_time TIME DEFAULT '20:00:00',
  timezone VARCHAR(50) DEFAULT 'America/Mexico_City',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settings (
  id SERIAL PRIMARY KEY,
  key VARCHAR(100) NOT NULL UNIQUE,
  value TEXT,
  description VARCHAR(255),
  category VARCHAR(50) DEFAULT 'general',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);
CREATE INDEX IF NOT EXISTS idx_settings_category ON settings(category);
