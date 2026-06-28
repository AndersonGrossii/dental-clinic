-- ============================================
-- Migración 010: Citas
-- ============================================

CREATE TABLE IF NOT EXISTS appointment_status (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  label VARCHAR(50) NOT NULL,
  color VARCHAR(7) NOT NULL DEFAULT '#6b7280',
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS appointments (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE RESTRICT,
  status_id INTEGER NOT NULL REFERENCES appointment_status(id) DEFAULT 1,
  treatment_id INTEGER REFERENCES treatments(id),
  appointment_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  reason TEXT,
  notes TEXT,
  cancellation_reason TEXT,
  is_first_visit BOOLEAN DEFAULT FALSE,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  -- Prevenir doble reserva
  CONSTRAINT no_double_booking EXCLUDE USING gist (
    doctor_id WITH =,
    tsrange(
      (appointment_date + start_time),
      (appointment_date + end_time),
      '[)'
    ) WITH &&
  ) WHERE (deleted_at IS NULL AND status_id NOT IN (5, 6))
);

CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status_id);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_date ON appointments(doctor_id, appointment_date);
