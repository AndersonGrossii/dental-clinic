-- ============================================
-- Migración 018: Creación de tabla de clínicas
-- ============================================

CREATE TABLE IF NOT EXISTS clinics (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(3) NOT NULL UNIQUE,
  address TEXT,
  phone VARCHAR(50),
  email VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insertar clínica principal y Vides Dental Cabanes
INSERT INTO clinics (name, code, address, phone, email, is_active)
VALUES 
  ('Vides Dental Xuquer', 'XUQ', 'Av. Reforma 1234, Col. Centro', '+52 55 1234 5678', 'contacto@dentalsonrisa.com', TRUE),
  ('Vides Dental Cabanes', 'CAB', 'Calle Cabanes 123', '+34 612 345 678', 'cabanes@videsdental.com', TRUE)
;
