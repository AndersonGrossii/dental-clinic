-- ============================================
-- Migración 051: Soporte para Instagram Direct Messaging
-- ============================================

ALTER TABLE messaging_contacts 
  ADD COLUMN IF NOT EXISTS instagram_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS channel_preference VARCHAR(50) DEFAULT 'WHATSAPP';

CREATE INDEX IF NOT EXISTS idx_msg_contacts_ig_id ON messaging_contacts(instagram_id);

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS story_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS is_story_reply BOOLEAN DEFAULT FALSE;

ALTER TABLE messaging_templates
  ADD COLUMN IF NOT EXISTS channel VARCHAR(50) DEFAULT 'ALL';

-- Plantillas predeterminadas de Instagram DM
INSERT INTO messaging_templates (clinic_id, name, channel, category, language, body, variables_count)
VALUES 
(1, 'bienvenida_instagram', 'INSTAGRAM', 'MARKETING', 'es', '¡Hola! 🦷✨ Gracias por escribir a Clínica Vides Dental en Instagram. ¿En qué podemos ayudarte hoy? Un asesor te atenderá a la brevedad.', 0),
(1, 'info_tratamientos_ig', 'INSTAGRAM', 'UTILITY', 'es', '¡Hola! Con gusto te brindamos información sobre nuestros tratamientos (Ortodoncia, Implantes, Blanqueamiento y Limpieza). ¿Te gustaría agendar una valoración?', 0)
ON CONFLICT (clinic_id, name, language) DO NOTHING;
