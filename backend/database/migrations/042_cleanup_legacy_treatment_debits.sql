-- Migration 042: Soft-delete legacy automatic treatment completion debits in patient_credits
-- These debits were automatically generated on treatment completion before separating Saldo (Crédito) wallet usage.

UPDATE patient_credits 
SET deleted_at = NOW() 
WHERE type = 'debit' 
  AND (notes LIKE 'Consumo por tratamiento%' OR source = 'treatment_completion')
  AND deleted_at IS NULL;
