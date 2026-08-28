-- ============================================
-- Migración 043: Actualizar método de pago id #3 (tarjeta_debito) a name = 'financing', label = 'Financiación'
-- ============================================

UPDATE payment_methods 
SET name = 'financing', 
    label = 'Financiación' 
WHERE id = 3 OR name = 'tarjeta_debito';
