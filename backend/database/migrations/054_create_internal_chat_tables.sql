-- ============================================
-- Migración 054: Tablas de Chat Interno del Personal (Retención Efímera – solo día actual)
-- ============================================

-- 1. Tabla de Mensajes de Chat Interno
CREATE TABLE IF NOT EXISTS internal_chat_messages (
  id SERIAL PRIMARY KEY,
  clinic_id INTEGER NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id INTEGER REFERENCES users(id) ON DELETE CASCADE, -- NULL = Canal General de la clínica
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_internal_chat_clinic ON internal_chat_messages(clinic_id);
CREATE INDEX IF NOT EXISTS idx_internal_chat_created ON internal_chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_internal_chat_recip ON internal_chat_messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_internal_chat_sender_recip ON internal_chat_messages(sender_id, recipient_id);

-- 2. Tabla de Estado de Lectura del Canal General
CREATE TABLE IF NOT EXISTS internal_chat_reads (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  clinic_id INTEGER NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  last_general_read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (user_id, clinic_id)
);
