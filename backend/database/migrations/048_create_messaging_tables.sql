-- ============================================
-- Migración 048: Tablas de Mensajería Unificada (WhatsApp & Omnichannel)
-- ============================================

-- 1. Tabla de Contactos de Mensajería
CREATE TABLE IF NOT EXISTS messaging_contacts (
  id SERIAL PRIMARY KEY,
  clinic_id INTEGER NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
  phone VARCHAR(50) NOT NULL,
  name VARCHAR(255),
  external_id VARCHAR(255),
  patient_id INTEGER REFERENCES patients(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE NULL,
  CONSTRAINT uq_messaging_contact_clinic_phone UNIQUE (clinic_id, phone)
);

CREATE INDEX IF NOT EXISTS idx_msg_contacts_clinic_id ON messaging_contacts(clinic_id);
CREATE INDEX IF NOT EXISTS idx_msg_contacts_patient_id ON messaging_contacts(patient_id);
CREATE INDEX IF NOT EXISTS idx_msg_contacts_phone ON messaging_contacts(phone);

-- 2. Tabla de Conversaciones
CREATE TABLE IF NOT EXISTS conversations (
  id SERIAL PRIMARY KEY,
  clinic_id INTEGER NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
  contact_id INTEGER NOT NULL REFERENCES messaging_contacts(id) ON DELETE CASCADE,
  channel VARCHAR(50) NOT NULL DEFAULT 'WHATSAPP',
  status VARCHAR(50) NOT NULL DEFAULT 'OPEN',
  unread_count INTEGER NOT NULL DEFAULT 0,
  automation_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  assigned_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_message_preview TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE NULL,
  CONSTRAINT uq_conversation_clinic_contact_channel UNIQUE (clinic_id, contact_id, channel)
);

CREATE INDEX IF NOT EXISTS idx_conversations_clinic_id ON conversations(clinic_id);
CREATE INDEX IF NOT EXISTS idx_conversations_contact_id ON conversations(contact_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_last_msg ON conversations(last_message_at DESC);

-- 3. Tabla de Mensajes
CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  clinic_id INTEGER NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
  direction VARCHAR(20) NOT NULL CHECK (direction IN ('INBOUND', 'OUTBOUND')),
  message_type VARCHAR(50) NOT NULL DEFAULT 'TEXT',
  body TEXT NOT NULL,
  external_id VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'DELIVERED',
  raw_payload JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_clinic_id ON messages(clinic_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at ASC);
CREATE INDEX IF NOT EXISTS idx_messages_external_id ON messages(external_id);

-- 4. Tabla de Plantillas de Mensajería (Templates)
CREATE TABLE IF NOT EXISTS messaging_templates (
  id SERIAL PRIMARY KEY,
  clinic_id INTEGER NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL DEFAULT 'UTILITY',
  language VARCHAR(10) NOT NULL DEFAULT 'es',
  body TEXT NOT NULL,
  variables_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE NULL,
  CONSTRAINT uq_msg_templates_clinic_name_lang UNIQUE (clinic_id, name, language)
);

CREATE INDEX IF NOT EXISTS idx_msg_templates_clinic_id ON messaging_templates(clinic_id);

-- 5. Insertar plantillas predeterminadas de ejemplo para las clínicas existentes
INSERT INTO messaging_templates (clinic_id, name, category, language, body, variables_count)
SELECT c.id, 'recordatorio_cita', 'UTILITY', 'es', 'Hola {{1}}, le recordamos su cita dental en Clínica Vides Dental el día {{2}} a las {{3}}.', 3
FROM clinics c
ON CONFLICT (clinic_id, name, language) DO NOTHING;

INSERT INTO messaging_templates (clinic_id, name, category, language, body, variables_count)
SELECT c.id, 'bienvenida_paciente', 'UTILITY', 'es', '¡Hola {{1}}! Gracias por comunicarte con Clínica Vides Dental. ¿En qué podemos ayudarte hoy?', 1
FROM clinics c
ON CONFLICT (clinic_id, name, language) DO NOTHING;

INSERT INTO messaging_templates (clinic_id, name, category, language, body, variables_count)
SELECT c.id, 'confirmacion_presupuesto', 'UTILITY', 'es', 'Estimado/a {{1}}, su plan de tratamiento y presupuesto #{{2}} ya está disponible para su revisión.', 2
FROM clinics c
ON CONFLICT (clinic_id, name, language) DO NOTHING;
