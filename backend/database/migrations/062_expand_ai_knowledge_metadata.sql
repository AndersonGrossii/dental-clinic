-- ============================================
-- Migración 062: Extensión de Metadatos Semánticos para Base de Conocimiento RAG
-- Soporte para: synonyms, intent, priority, required_tool, do_not_say, next_action
-- ============================================

-- 1. Añadir columnas de metadatos semánticos a ai_knowledge_base
ALTER TABLE ai_knowledge_base
  ADD COLUMN IF NOT EXISTS synonyms TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS intent VARCHAR(50) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS required_tool VARCHAR(50) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS do_not_say TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS next_action TEXT DEFAULT NULL;

-- 2. Índices para búsqueda eficiente por clínica e intención
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_intent ON ai_knowledge_base(clinic_id, intent);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_priority ON ai_knowledge_base(clinic_id, priority DESC);

-- 3. Actualizar artículos base sembrados previamente con metadatos semánticos enriquecidos
-- Sede 1: Xúquer (Dental)
UPDATE ai_knowledge_base
SET 
  intent = 'LOCATION',
  priority = 2,
  synonyms = ARRAY['direccion', 'dirección', 'donde estais', 'dónde estáis', 'donde queda', 'como llegar', 'localizacion', 'metro', 'telefono', 'teléfono'],
  next_action = 'Ofrecer ayuda para llegar o proponer agendar primera revisión presencial.'
WHERE clinic_id = 1 AND category = 'ubicacion';

UPDATE ai_knowledge_base
SET 
  intent = 'FIRST_VISIT',
  priority = 3,
  required_tool = 'availability_tool',
  synonyms = ARRAY['primera consulta', 'revision gratis', 'revisión gratuita', 'primera cita', 'diagnostico inicial', 'cita nueva', 'cuanto cuesta la primera revision'],
  next_action = 'Consultar huecos con Dra. Sonia y proponer 2 alternativas horarias.'
WHERE clinic_id = 1 AND category = 'primera_revision';

UPDATE ai_knowledge_base
SET 
  intent = 'PRICE_INQUIRY',
  priority = 3,
  synonyms = ARRAY['precios', 'tarifas', 'cuanto cuesta', 'cuánto cuesta', 'cuanto vale', 'presupuesto', 'coste', 'costo', 'financiacion', 'descuento'],
  do_not_say = 'Nunca facilitar precios cerrados, cifras monetarias o tarifas por chat sin valoración clínica presencial previa.',
  next_action = 'Explicar política deontológica y ofrecer la 1ª revisión gratuita para obtener presupuesto exacto y por escrito.'
WHERE clinic_id = 1 AND category = 'politica_precios';

UPDATE ai_knowledge_base
SET 
  intent = 'TREATMENT_INFORMATION',
  priority = 2,
  synonyms = ARRAY['implantes', 'ortodoncia', 'invisalign', 'brackets', 'blanqueamiento', 'limpieza', 'protesis', 'carillas', 'endodoncia', 'empastes'],
  next_action = 'Describir brevemente el tratamiento y proponer primera revisión diagnóstica.'
WHERE clinic_id = 1 AND category = 'tratamientos';

-- Insertar artículo de Horarios para Sede 1 si no existe
INSERT INTO ai_knowledge_base (clinic_id, category, title, content, keywords, synonyms, intent, priority, next_action)
VALUES (
  1,
  'horarios',
  'Horarios de Atención Xúquer',
  'Clínica Vides Dental Xúquer está abierta de lunes a viernes en horario ininterrumpido de 09:00 a 20:00. Fines de semana cerrado salvo urgencias programadas.',
  ARRAY['horario', 'abierto', 'cerrado', 'a que hora abris', 'a que hora cerrais', 'sabados'],
  ARRAY['dias de atencion', 'hora de cierre', 'hora de apertura', 'cuando abren', 'atencion al publico'],
  'OPENING_HOURS',
  2,
  'Indicar horarios vigentes y ofrecer concertar una cita en la franja más cómoda para el paciente.'
)
ON CONFLICT DO NOTHING;

-- Sede 2: Castellón (Estética)
UPDATE ai_knowledge_base
SET 
  intent = 'LOCATION',
  priority = 2,
  synonyms = ARRAY['direccion', 'dirección', 'donde estais', 'dónde estáis', 'donde queda', 'cabanes', 'castellon', 'castellón'],
  next_action = 'Ofrecer asistencia para ubicación o coordinar primera consulta presencial.'
WHERE clinic_id = 2 AND category = 'ubicacion';

UPDATE ai_knowledge_base
SET 
  intent = 'FIRST_VISIT',
  priority = 3,
  required_tool = 'availability_tool',
  synonyms = ARRAY['primera consulta estetica', 'valoracion presencial', 'diagnostico estetico', 'consulta estetica inicial'],
  next_action = 'Ofrecer coordinar cita con el especialista de estética.'
WHERE clinic_id = 2 AND category = 'primera_valoracion';

UPDATE ai_knowledge_base
SET 
  intent = 'PRICE_INQUIRY',
  priority = 3,
  synonyms = ARRAY['precios estetica', 'cuanto cuesta botox', 'acido hialuronico precio', 'tarifas faciales', 'coste estetica'],
  do_not_say = 'No presupuestar tratamientos médico-estéticos sin exploración anatómica presencial previa.',
  next_action = 'Invitar a una consulta de valoración presencial para estudiar el caso individualmente.'
WHERE clinic_id = 2 AND category = 'politica_precios';

UPDATE ai_knowledge_base
SET 
  intent = 'TREATMENT_INFORMATION',
  priority = 2,
  synonyms = ARRAY['rejuvenecimiento', 'facial', 'arrugas', 'armonizacion', 'piel', 'acido hialuronico', 'botox', 'bioestimulacion'],
  next_action = 'Explicar tratamientos y coordinar valoración médica presencial.'
WHERE clinic_id = 2 AND category = 'tratamientos';

-- Insertar artículo de Horarios para Sede 2 si no existe
INSERT INTO ai_knowledge_base (clinic_id, category, title, content, keywords, synonyms, intent, priority, next_action)
VALUES (
  2,
  'horarios',
  'Horarios de Atención Castellón',
  'Nuestra clínica de estética en Castellón atiende de lunes a viernes de 10:00 a 19:00 con cita previa.',
  ARRAY['horario', 'abierto', 'cerrado', 'a que hora abren', 'sabados'],
  ARRAY['dias de atencion', 'hora de cierre', 'cuando atienden'],
  'OPENING_HOURS',
  2,
  'Indicar horarios vigentes y ofrecer agendar cita de valoración.'
)
ON CONFLICT DO NOTHING;
