-- ============================================
-- Migración 052: Tablas de Inteligencia Artificial y Motor de Automatizaciones Clínicas
-- ============================================

-- 1. Tabla de Reglas de Automatización
CREATE TABLE IF NOT EXISTS automation_rules (
  id SERIAL PRIMARY KEY,
  clinic_id INTEGER NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
  rule_type VARCHAR(50) NOT NULL, -- 'CONFIRMATION_24H', 'RECALL_HYGIENE_6M', 'RECALL_SURGERY_7D', 'RECALL_ORTHO_30D'
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  trigger_days INTEGER NOT NULL DEFAULT 1,
  template_body TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE NULL,
  CONSTRAINT uq_automation_rules_clinic_type UNIQUE (clinic_id, rule_type)
);

CREATE INDEX IF NOT EXISTS idx_automation_rules_clinic ON automation_rules(clinic_id);
CREATE INDEX IF NOT EXISTS idx_automation_rules_active ON automation_rules(is_active);

-- 2. Tabla de Logs de Ejecución de Automatizaciones
CREATE TABLE IF NOT EXISTS automation_logs (
  id SERIAL PRIMARY KEY,
  clinic_id INTEGER NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
  rule_type VARCHAR(50) NOT NULL,
  patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
  appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
  channel VARCHAR(50) NOT NULL DEFAULT 'WHATSAPP',
  status VARCHAR(50) NOT NULL DEFAULT 'SENT', -- 'SENT', 'CONFIRMED', 'CANCELLED', 'FAILED', 'DISCARDED'
  details JSONB,
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automation_logs_clinic ON automation_logs(clinic_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_patient ON automation_logs(patient_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_appt ON automation_logs(appointment_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_date ON automation_logs(executed_at DESC);

-- 3. Sembrado de Reglas Predeterminadas para la Clínica Principal
INSERT INTO automation_rules (clinic_id, rule_type, name, description, is_active, trigger_days, template_body)
VALUES 
(
  1, 
  'CONFIRMATION_24H', 
  'Confirmación de Cita 24h Antes', 
  'Envía un mensaje de WhatsApp a los pacientes con cita al día siguiente solicitando confirmación.',
  TRUE, 
  1, 
  '¡Hola {{patient_name}}! 🦷 Le recordamos su cita mañana {{date}} a las {{time}} con {{doctor_name}} en Clínica Vides Dental.\n\nPor favor, responda:\n1️⃣ para CONFIRMAR su asistencia\n2️⃣ para SOLICITAR REAGENDAR o CANCELAR'
),
(
  1, 
  'RECALL_HYGIENE_6M', 
  'Recall de Limpieza Dental Preventiva (6 Meses)', 
  'Identifica pacientes cuya última profilaxis fue hace más de 180 días sin citas futuras agendadas.',
  TRUE, 
  180, 
  '¡Hola {{patient_name}}! 🦷✨ Han pasado 6 meses desde su última limpieza dental en Clínica Vides Dental. La prevención es la clave para un sonrisa sana. ¿Desea que le agendemos su revisión preventiva para esta semana?'
),
(
  1, 
  'RECALL_SURGERY_7D', 
  'Revisión Post-Quirúrgica / Retirada de Puntos (7 Días)', 
  'Recuerda agendar la revisión de control a los 7 días de una extracción o cirugía.',
  TRUE, 
  7, 
  '¡Hola {{patient_name}}! Esperamos que se encuentre muy bien tras su procedimiento. Le recordamos agendar su cita de control post-quirúrgico y revisión. ¿En qué horario le resultaría más cómodo?'
),
(
  1, 
  'RECALL_ORTHO_30D', 
  'Mantenimiento de Ortodoncia (30 Días)', 
  'Seguimiento a pacientes de ortodoncia que no han agendado su ajuste mensual.',
  TRUE, 
  30, 
  '¡Hola {{patient_name}}! 🦷 Es momento de su revisión y ajuste mensual de ortodoncia para continuar con el progreso de su tratamiento. ¿Agendamos su cita?'
)
ON CONFLICT (clinic_id, rule_type) DO NOTHING;
