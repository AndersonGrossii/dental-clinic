-- ============================================
-- Migración 040: Permitir pagos independientes (Adelantamientos)
-- Permite registrar pagos directamente desde el perfil del paciente
-- sin vincular obligatoriamente a una factura o presupuesto.
-- ============================================

ALTER TABLE payments ALTER COLUMN invoice_id DROP NOT NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS is_advance BOOLEAN DEFAULT FALSE;

-- Poblar patient_id en pagos existentes utilizando sus facturas asociadas
UPDATE payments p
SET patient_id = i.patient_id
FROM invoices i
WHERE p.invoice_id = i.id AND p.patient_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_payments_patient ON payments(patient_id);
