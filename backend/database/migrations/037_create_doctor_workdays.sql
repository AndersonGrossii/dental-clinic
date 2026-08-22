-- ============================================
-- Migración 037: Días Específicos de Atención de Médicos (doctor_workdays)
-- Permite asignar fechas específicas en el calendario para doctores visitantes/especialistas.
-- ============================================

CREATE TABLE IF NOT EXISTS doctor_workdays (
  id SERIAL PRIMARY KEY,
  doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  clinic_id INTEGER DEFAULT 1 REFERENCES clinics(id),
  work_date DATE NOT NULL,
  start_time TIME NOT NULL DEFAULT '09:00',
  end_time TIME NOT NULL DEFAULT '18:00',
  break_start TIME,
  break_end TIME,
  notes VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(doctor_id, work_date)
);

CREATE INDEX IF NOT EXISTS idx_doctor_workdays_doctor ON doctor_workdays(doctor_id);
CREATE INDEX IF NOT EXISTS idx_doctor_workdays_date ON doctor_workdays(work_date);
