-- ============================================
-- Migración 041: Agregar Método de Pago Saldo (Crédito)
-- Permite usar el saldo a favor del paciente como método de pago.
-- ============================================

INSERT INTO payment_methods (name, label, is_active, sort_order)
VALUES ('saldo_credito', 'Saldo (Crédito)', TRUE, 5)
ON CONFLICT (name) DO NOTHING;
