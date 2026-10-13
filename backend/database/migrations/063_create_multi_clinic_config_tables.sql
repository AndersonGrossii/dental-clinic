-- ============================================
-- Migración 063: Tablas de Configuración Multi-Clínica
-- (Features, Gabinetes/Recursos y Branding Visual)
-- ============================================

-- 1. Agregar primary_color a clinic_information
ALTER TABLE clinic_information ADD COLUMN IF NOT EXISTS primary_color VARCHAR(7) DEFAULT '#0f86ec';
UPDATE clinic_information SET primary_color = '#0f86ec' WHERE primary_color IS NULL;

-- 2. Tabla de Feature Flags por Clínica
CREATE TABLE IF NOT EXISTS clinic_features (
  id SERIAL PRIMARY KEY,
  clinic_id INTEGER NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  feature_key VARCHAR(50) NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT uq_clinic_feature UNIQUE (clinic_id, feature_key)
);

CREATE INDEX IF NOT EXISTS idx_clinic_features_clinic ON clinic_features(clinic_id);
CREATE INDEX IF NOT EXISTS idx_clinic_features_lookup ON clinic_features(clinic_id, feature_key);

-- 3. Tabla de Gabinetes / Salas de Tratamiento por Clínica
CREATE TABLE IF NOT EXISTS clinic_cabinets (
  id SERIAL PRIMARY KEY,
  clinic_id INTEGER NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(20),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT uq_clinic_cabinet_name UNIQUE (clinic_id, name)
);

CREATE INDEX IF NOT EXISTS idx_clinic_cabinets_clinic ON clinic_cabinets(clinic_id, is_active);
CREATE INDEX IF NOT EXISTS idx_clinic_cabinets_name ON clinic_cabinets(clinic_id, name);

-- 4. Actualizar constraint de exclusión no_double_booking_cabinet para aislar por clínica
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS no_double_booking_cabinet;

ALTER TABLE appointments ADD CONSTRAINT no_double_booking_cabinet EXCLUDE USING gist (
  clinic_id WITH =,
  gabinete WITH =,
  tsrange(
    (appointment_date + start_time),
    (appointment_date + end_time),
    '[)'
  ) WITH &&
) WHERE (deleted_at IS NULL AND status_id NOT IN (5, 6));

-- 5. Backfill determinista de features para clínicas existentes
INSERT INTO clinic_features (clinic_id, feature_key, is_enabled)
SELECT c.id, f.key, f.enabled
FROM clinics c
CROSS JOIN (
  VALUES 
    ('crm', TRUE),
    ('omnichannel_messaging', FALSE),
    ('ai_automations', FALSE),
    ('cabinets', TRUE),
    ('promotional_packs', TRUE),
    ('calendar_productivity', TRUE),
    ('reports', TRUE),
    ('prescriptions', TRUE)
) AS f(key, enabled)
ON CONFLICT ON CONSTRAINT uq_clinic_feature DO NOTHING;

-- 6. Backfill determinista de gabinetes para clínicas existentes
INSERT INTO clinic_cabinets (clinic_id, name, code, is_active)
SELECT c.id, cab.name, cab.code, TRUE
FROM clinics c
CROSS JOIN (
  VALUES 
    ('Gabinete 1', 'GAB1'),
    ('Gabinete 2', 'GAB2'),
    ('Primeras Visitas 1', 'PV1'),
    ('Primeras Visitas 2', 'PV2')
) AS cab(name, code)
ON CONFLICT ON CONSTRAINT uq_clinic_cabinet_name DO NOTHING;
