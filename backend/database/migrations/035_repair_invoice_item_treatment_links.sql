-- ============================================
-- Migración 035: Reparar links de invoice_items -> patient_treatments
-- Corrige vínculos incorrectos/obsoletos heredados de la migración 032
-- (que asignaba todos los items de una factura a un único tratamiento,
--  o a tratamientos borrados). Previene que tratamientos pagados
--  aparezcan como deuda pendiente en el balance del paciente.
-- ============================================

-- 1) Invoice 3 (FAC-0003-XUQ, paciente 8): el item de "Extracción Quirúrgica"
--    apuntaba al tratamiento borrado (pt 4); debe apuntar al activo (pt 25).
UPDATE invoice_items ii
SET patient_treatment_id = 25
WHERE ii.id = 4
  AND ii.invoice_id = 3
  AND ii.patient_treatment_id = 4;

-- 2) Invoice 9 (FAC-0009-XUQ, paciente 6): el item "Extracción Simple" (id 13)
--    apuntaba al "Sellador Dental" (pt 9); debe apuntar al tratamiento 10.
UPDATE invoice_items ii
SET patient_treatment_id = 10
WHERE ii.id = 13
  AND ii.invoice_id = 9
  AND ii.patient_treatment_id = 9;

-- 3) Invoice 12 (FAC-0012-XUQ, paciente 1): item 17 ("Extracción Simple")
--    quedó sin vincular; el tratamiento activo del mismo paciente es el 12.
UPDATE invoice_items ii
SET patient_treatment_id = 12
WHERE ii.id = 17
  AND ii.invoice_id = 12
  AND ii.patient_treatment_id IS NULL;

-- 4) Invoice 16 (FAC-0016-XUQ, paciente 3): el item "Sellador Dental" (id 22)
--    apuntaba al "Extracción Quirúrgica" (pt 15); debe apuntar al 16.
UPDATE invoice_items ii
SET patient_treatment_id = 16
WHERE ii.id = 22
  AND ii.invoice_id = 16
  AND ii.patient_treatment_id = 15;

-- 5) Invoice 48 (REC-0001-XUQ, paciente 8): los 3 items "Extracción Simple"
--    (ids 63,64,65) apuntaban todos al "Sellador Dental" (pt 1);
--    se distribuyen en orden a los tratamientos activos 2, 51, 52.
UPDATE invoice_items ii
SET patient_treatment_id = CASE ii.id
  WHEN 63 THEN 2
  WHEN 64 THEN 51
  WHEN 65 THEN 52
  ELSE ii.patient_treatment_id
END
WHERE ii.invoice_id = 48
  AND ii.id IN (63, 64, 65)
  AND ii.patient_treatment_id = 1;

-- 6) Invoice 31 (FAC-0031-XUQ, paciente 13): el item "Implante Dental" (id 46)
--    apuntaba al tratamiento borrado (pt 28); debe apuntar al activo (pt 30).
UPDATE invoice_items ii
SET patient_treatment_id = 30
WHERE ii.id = 46
  AND ii.invoice_id = 31
  AND ii.patient_treatment_id = 28;