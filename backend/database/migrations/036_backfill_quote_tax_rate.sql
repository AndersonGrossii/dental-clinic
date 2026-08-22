-- ============================================
-- Migración 036: Backfill tax_rate en tratamientos derivados de presupuestos
-- Los tratamientos creados desde presupuestos (nota "Proveniente de Presupuesto")
-- que quedaron con tax_rate=0 deben heredar la tasa de IVA del presupuesto
-- para que el valor complete (con IVA) sea cobrado al momento de pagar.
-- ============================================

-- 1) Vía vínculo directo quotation_items.patient_treatment_id -> patient_treatments
UPDATE patient_treatments pt
SET tax_rate = q.tax_rate
FROM quotation_items qi
JOIN quotations q ON qi.quotation_id = q.id
WHERE qi.patient_treatment_id = pt.id
  AND (pt.tax_rate IS NULL OR pt.tax_rate = 0)
  AND q.tax_rate > 0
  AND pt.deleted_at IS NULL;

-- 2) Vía notas "Proveniente de Presupuesto #xxx" cuando no hay vínculo directo
UPDATE patient_treatments pt
SET tax_rate = q.tax_rate
FROM quotations q
WHERE pt.notes ILIKE '%Proveniente de Presupuesto #%'
  AND pt.tax_rate = 0
  AND q.quote_number = regexp_replace(pt.notes, '.*#\s*([^ ]+).*', '\1')
  AND q.tax_rate > 0
  AND pt.deleted_at IS NULL;