-- ============================================
-- Migración 064: Features de Herramientas Clínicas Dentales
-- (Odontograma e Historial Odontológico)
-- ============================================

INSERT INTO clinic_features (clinic_id, feature_key, is_enabled)
SELECT c.id, f.key, f.enabled
FROM clinics c
CROSS JOIN (
  VALUES 
    ('odontogram', TRUE),
    ('dental_history', TRUE)
) AS f(key, enabled)
ON CONFLICT (clinic_id, feature_key) DO NOTHING;
