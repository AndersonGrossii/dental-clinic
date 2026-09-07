-- ============================================
-- Migración 055: Días Festivos y Bloqueos de Agenda de Clínica (clinic_holidays)
-- Permite registrar días festivos nacionales, autonómicos y locales para bloquear la agenda.
-- Pre-carga festivos oficiales de España y Comunitat Valenciana (área Alcàntera de Xúquer).
-- ============================================

CREATE TABLE IF NOT EXISTS clinic_holidays (
  id SERIAL PRIMARY KEY,
  clinic_id INTEGER NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  holiday_date DATE NOT NULL,
  name VARCHAR(255) NOT NULL,
  scope VARCHAR(50) NOT NULL DEFAULT 'NACIONAL' CHECK (scope IN ('NACIONAL', 'AUTONOMICO', 'LOCAL', 'CLINICA')),
  description TEXT,
  is_full_day BOOLEAN NOT NULL DEFAULT TRUE,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(clinic_id, holiday_date)
);

CREATE INDEX IF NOT EXISTS idx_clinic_holidays_clinic ON clinic_holidays(clinic_id);
CREATE INDEX IF NOT EXISTS idx_clinic_holidays_date ON clinic_holidays(holiday_date);

-- Pre-carga anticipada de Festivos Oficiales (Nacionales y Comunitat Valenciana) para todas las clínicas
DO $$
DECLARE
  c_id INTEGER;
BEGIN
  FOR c_id IN SELECT id FROM clinics LOOP
    -- Festivos 2026
    INSERT INTO clinic_holidays (clinic_id, holiday_date, name, scope, description)
    VALUES
      (c_id, '2026-01-01', 'Año Nuevo', 'NACIONAL', 'Festivo Nacional de España'),
      (c_id, '2026-01-06', 'Epifanía del Señor (Reyes Magos)', 'NACIONAL', 'Festivo Nacional de España'),
      (c_id, '2026-03-19', 'San José', 'AUTONOMICO', 'Festivo Comunitat Valenciana'),
      (c_id, '2026-04-03', 'Viernes Santo', 'NACIONAL', 'Festivo Nacional de España'),
      (c_id, '2026-04-06', 'Lunes de Pascua', 'AUTONOMICO', 'Festivo Comunitat Valenciana'),
      (c_id, '2026-04-13', 'San Vicente Ferrer', 'LOCAL', 'Festivo Local de Alcàntera de Xúquer'),
      (c_id, '2026-05-01', 'Fiesta del Trabajo', 'NACIONAL', 'Festivo Nacional de España'),
      (c_id, '2026-06-24', 'San Juan', 'AUTONOMICO', 'Festivo Comunitat Valenciana'),
      (c_id, '2026-08-15', 'Asunción de la Virgen', 'NACIONAL', 'Festivo Nacional de España'),
      (c_id, '2026-09-04', 'Fiestas Patronales (Santíssim Crist del Miracle)', 'LOCAL', 'Festivo Local de Alcàntera de Xúquer'),
      (c_id, '2026-10-09', 'Día de la Comunitat Valenciana', 'AUTONOMICO', 'Festivo Autonómico Comunitat Valenciana'),
      (c_id, '2026-10-12', 'Fiesta Nacional de España', 'NACIONAL', 'Festivo Nacional de España'),
      (c_id, '2026-11-01', 'Todos los Santos', 'NACIONAL', 'Festivo Nacional de España'),
      (c_id, '2026-12-06', 'Día de la Constitución Española', 'NACIONAL', 'Festivo Nacional de España'),
      (c_id, '2026-12-08', 'Inmaculada Concepción', 'NACIONAL', 'Festivo Nacional de España'),
      (c_id, '2026-12-25', 'Natividad del Señor (Navidad)', 'NACIONAL', 'Festivo Nacional de España'),

    -- Festivos 2027
      (c_id, '2027-01-01', 'Año Nuevo', 'NACIONAL', 'Festivo Nacional de España'),
      (c_id, '2027-01-06', 'Epifanía del Señor (Reyes Magos)', 'NACIONAL', 'Festivo Nacional de España'),
      (c_id, '2027-03-19', 'San José', 'AUTONOMICO', 'Festivo Comunitat Valenciana'),
      (c_id, '2027-03-26', 'Viernes Santo', 'NACIONAL', 'Festivo Nacional de España'),
      (c_id, '2027-03-29', 'Lunes de Pascua', 'AUTONOMICO', 'Festivo Comunitat Valenciana'),
      (c_id, '2027-04-05', 'San Vicente Ferrer', 'LOCAL', 'Festivo Local de Alcàntera de Xúquer'),
      (c_id, '2027-05-01', 'Fiesta del Trabajo', 'NACIONAL', 'Festivo Nacional de España'),
      (c_id, '2027-06-24', 'San Juan', 'AUTONOMICO', 'Festivo Comunitat Valenciana'),
      (c_id, '2027-08-15', 'Asunción de la Virgen', 'NACIONAL', 'Festivo Nacional de España'),
      (c_id, '2027-09-03', 'Fiestas Patronales (Santíssim Crist del Miracle)', 'LOCAL', 'Festivo Local de Alcàntera de Xúquer'),
      (c_id, '2027-10-09', 'Día de la Comunitat Valenciana', 'AUTONOMICO', 'Festivo Autonómico Comunitat Valenciana'),
      (c_id, '2027-10-12', 'Fiesta Nacional de España', 'NACIONAL', 'Festivo Nacional de España'),
      (c_id, '2027-11-01', 'Todos los Santos', 'NACIONAL', 'Festivo Nacional de España'),
      (c_id, '2027-12-06', 'Día de la Constitución Española', 'NACIONAL', 'Festivo Nacional de España'),
      (c_id, '2027-12-08', 'Inmaculada Concepción', 'NACIONAL', 'Festivo Nacional de España'),
      (c_id, '2027-12-25', 'Natividad del Señor (Navidad)', 'NACIONAL', 'Festivo Nacional de España')
    ON CONFLICT (clinic_id, holiday_date) DO NOTHING;
  END LOOP;
END $$;
