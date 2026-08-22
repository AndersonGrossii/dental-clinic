-- ============================================
-- Migración 034: Saldo a Favor del Paciente (Créditos/Débitos)
-- Permite registrar sobrepagos como crédito aplicable a futuros tratamientos.
-- ============================================

-- Libro de movimientos de saldo a favor
CREATE TABLE IF NOT EXISTS patient_credits (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  clinic_id INTEGER DEFAULT 1 REFERENCES clinics(id),
  type VARCHAR(10) NOT NULL CHECK (type IN ('credit', 'debit')),
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  source VARCHAR(30) DEFAULT 'overpayment' CHECK (source IN ('overpayment', 'payment_apply', 'manual')),
  invoice_id INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
  payment_id INTEGER REFERENCES payments(id) ON DELETE SET NULL,
  reference VARCHAR(100),
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_patient_credits_patient ON patient_credits(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_credits_invoice ON patient_credits(invoice_id);
CREATE INDEX IF NOT EXISTS idx_patient_credits_payment ON patient_credits(payment_id);

-- Parte de un pago cubierta por saldo a favor (0 = solo efectivo)
ALTER TABLE payments ADD COLUMN IF NOT EXISTS credit_used DECIMAL(12,2) NOT NULL DEFAULT 0.00;