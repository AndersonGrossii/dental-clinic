-- ============================================
-- Migración 024: Actualizar CHECK constraint en quotations.status para incluir 'parcial'
-- ============================================

ALTER TABLE quotations DROP CONSTRAINT IF EXISTS quotations_status_check;
ALTER TABLE quotations ADD CONSTRAINT quotations_status_check CHECK (status IN ('borrador', 'enviada', 'parcial', 'aceptada', 'rechazada', 'expirada'));
