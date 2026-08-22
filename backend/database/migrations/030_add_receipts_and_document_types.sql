-- ============================================
-- Migración 030: Document Types (Factura vs Recibo)
-- ============================================

-- Agregar columna document_type a la tabla invoices si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invoices' AND column_name = 'document_type'
  ) THEN
    ALTER TABLE invoices 
      ADD COLUMN document_type VARCHAR(20) DEFAULT 'factura' 
      CHECK (document_type IN ('factura', 'recibo'));
  END IF;
END $$;

-- Actualizar facturas históricas para asegurar que tengan document_type = 'factura'
UPDATE invoices SET document_type = 'factura' WHERE document_type IS NULL;

-- Secuencia para números de recibo (inicia en 1)
CREATE SEQUENCE IF NOT EXISTS receipt_number_seq START WITH 1;

-- Índice para acelerar búsquedas por tipo de documento
CREATE INDEX IF NOT EXISTS idx_invoices_document_type ON invoices(document_type);
