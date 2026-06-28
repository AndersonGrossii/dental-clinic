-- ============================================
-- Migración 011: Cotizaciones (Presupuestos)
-- ============================================

CREATE TABLE IF NOT EXISTS quotations (
  id SERIAL PRIMARY KEY,
  quote_number VARCHAR(20) NOT NULL UNIQUE,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id INTEGER REFERENCES doctors(id),
  status VARCHAR(20) DEFAULT 'borrador' CHECK (status IN ('borrador', 'enviada', 'aceptada', 'rechazada', 'expirada')),
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  tax_rate DECIMAL(5,2) DEFAULT 16.00,
  tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  discount_percentage DECIMAL(5,2) DEFAULT 0.00,
  discount_amount DECIMAL(12,2) DEFAULT 0.00,
  total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  notes TEXT,
  valid_until DATE,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS quotation_items (
  id SERIAL PRIMARY KEY,
  quotation_id INTEGER NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  treatment_id INTEGER REFERENCES treatments(id),
  description VARCHAR(500) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  discount DECIMAL(5,2) DEFAULT 0.00,
  total DECIMAL(10,2) NOT NULL,
  tooth_number INTEGER,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quotations_patient ON quotations(patient_id);
CREATE INDEX IF NOT EXISTS idx_quotations_number ON quotations(quote_number);
CREATE INDEX IF NOT EXISTS idx_quotation_items_quotation ON quotation_items(quotation_id);

-- Secuencia para número de cotización
CREATE SEQUENCE IF NOT EXISTS quotation_number_seq START WITH 1000;
