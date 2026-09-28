-- ============================================
-- Migración 058: IA para Mensajería, Base de Conocimiento RAG,
-- Supervisión Humana de Automatizaciones y "Dra. Sonia Primeras Visitas"
-- ============================================

-- 1. Base de Conocimiento RAG de la Clínica (Particionada por clinic_id)
CREATE TABLE IF NOT EXISTS ai_knowledge_base (
  id SERIAL PRIMARY KEY,
  clinic_id INTEGER NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  category VARCHAR(50) NOT NULL, -- 'general', 'tratamientos', 'horarios', 'ubicacion', 'faq', 'politica_precios'
  title VARCHAR(150) NOT NULL,
  content TEXT NOT NULL,
  keywords TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_knowledge_clinic ON ai_knowledge_base(clinic_id, category);

-- 2. Cola de Supervisión Humana para Mensajes Automáticos (Human-in-the-Loop)
CREATE TABLE IF NOT EXISTS ai_message_approvals (
  id SERIAL PRIMARY KEY,
  clinic_id INTEGER NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  lead_id INTEGER REFERENCES crm_leads(id) ON DELETE SET NULL,
  patient_id INTEGER REFERENCES patients(id) ON DELETE SET NULL,
  quotation_id INTEGER REFERENCES quotations(id) ON DELETE SET NULL,
  channel VARCHAR(20) NOT NULL DEFAULT 'WHATSAPP', -- 'WHATSAPP' | 'INSTAGRAM'
  recipient_phone VARCHAR(50) NOT NULL,
  recipient_name VARCHAR(150),
  action_type VARCHAR(50) NOT NULL, -- 'QUOTATION_FOLLOWUP', 'INACTIVE_RECALL', 'LEAD_NURTURE'
  suggested_message TEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING_APPROVAL' CHECK (status IN ('PENDING_APPROVAL', 'APPROVED', 'DISCARDED', 'SENT')),
  reviewed_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_approvals_clinic_status ON ai_message_approvals(clinic_id, status);
CREATE INDEX IF NOT EXISTS idx_ai_approvals_quotation ON ai_message_approvals(quotation_id);

-- 3. Ampliar crm_leads con campos analíticos de IA
ALTER TABLE crm_leads
  ADD COLUMN IF NOT EXISTS ai_score INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ai_urgency VARCHAR(20) DEFAULT NULL, -- 'LOW', 'MEDIUM', 'HIGH'
  ADD COLUMN IF NOT EXISTS ai_summary TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ai_extracted_interest VARCHAR(100) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ai_recommended_action TEXT DEFAULT 'Agendar 1ª Revisión Gratuita',
  ADD COLUMN IF NOT EXISTS ai_last_analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- 4. Ampliar crm_notes para identificar origen de IA con visibilidad compartida
ALTER TABLE crm_notes
  ADD COLUMN IF NOT EXISTS created_by_type VARCHAR(20) DEFAULT 'human' CHECK (created_by_type IN ('human', 'ai'));

-- 5. Crear perfil de "Dra. Sonia Primeras Visitas" exclusivamente para Clínica 1 (Xúquer)
DO $$
DECLARE
  v_role_id INTEGER;
  v_user_id INTEGER;
  v_doctor_id INTEGER;
  v_clinic1_id INTEGER := 1;
BEGIN
  SELECT id INTO v_role_id FROM roles WHERE name = 'doctor';
  
  -- Insertar o buscar usuario de Dra. Sonia en Clínica 1
  SELECT id INTO v_user_id FROM users WHERE email = 'dra.sonia@videsdental.com' AND clinic_id = v_clinic1_id;
  IF v_user_id IS NULL THEN
    INSERT INTO users (role_id, clinic_id, first_name, last_name, email, password_hash, phone, is_active)
    VALUES (v_role_id, v_clinic1_id, 'Dra. Sonia', 'Primeras Visitas', 'dra.sonia@videsdental.com',
            '$2a$12$yAt4AfAs4SsJ7NLWREzYy.5YKmDLhcvQ46p0vDE2LqcJCoFsPhcli', '+34 962 456 789', TRUE)
    RETURNING id INTO v_user_id;
  END IF;

  -- Insertar perfil en doctors con franja estricta de 15 minutos
  SELECT id INTO v_doctor_id FROM doctors WHERE user_id = v_user_id;
  IF v_doctor_id IS NULL THEN
    INSERT INTO doctors (user_id, specialty, license_number, consultation_duration, color)
    VALUES (v_user_id, 'Primeras Visitas / Valoración', 'COL-V-46001', 15, '#ec4899')
    RETURNING id INTO v_doctor_id;
  ELSE
    UPDATE doctors SET consultation_duration = 15, specialty = 'Primeras Visitas / Valoración' WHERE id = v_doctor_id;
  END IF;

  -- Horarios de Dra. Sonia (Lunes a Viernes, 09:00 - 14:00 y 16:00 - 20:00)
  INSERT INTO doctor_schedules (doctor_id, day_of_week, start_time, end_time, break_start, break_end, clinic_id)
  SELECT v_doctor_id, dow, '09:00', '20:00', '14:00', '16:00', v_clinic1_id
  FROM generate_series(1, 5) AS dow
  ON CONFLICT (doctor_id, day_of_week) DO NOTHING;
END $$;

-- 6. Crear perfil de Especialista de Estética en Clínica 2 (Castellón)
DO $$
DECLARE
  v_role_id INTEGER;
  v_user_id INTEGER;
  v_doctor_id INTEGER;
  v_clinic2_id INTEGER := 2;
BEGIN
  SELECT id INTO v_role_id FROM roles WHERE name = 'doctor';
  
  -- Insertar o buscar especialista en Clínica 2
  SELECT id INTO v_user_id FROM users WHERE email = 'estetica.castellon@videsdental.com' AND clinic_id = v_clinic2_id;
  IF v_user_id IS NULL THEN
    INSERT INTO users (role_id, clinic_id, first_name, last_name, email, password_hash, phone, is_active)
    VALUES (v_role_id, v_clinic2_id, 'Dra. Elena', 'Medicina Estética', 'estetica.castellon@videsdental.com',
            '$2a$12$yAt4AfAs4SsJ7NLWREzYy.5YKmDLhcvQ46p0vDE2LqcJCoFsPhcli', '+34 964 123 456', TRUE)
    RETURNING id INTO v_user_id;
  END IF;

  SELECT id INTO v_doctor_id FROM doctors WHERE user_id = v_user_id;
  IF v_doctor_id IS NULL THEN
    INSERT INTO doctors (user_id, specialty, license_number, consultation_duration, color)
    VALUES (v_user_id, 'Medicina Estética', 'COL-CS-12001', 30, '#8b5cf6')
    RETURNING id INTO v_doctor_id;
  END IF;

  -- Horarios especialista estética Castellón (Lunes a Viernes, 10:00 - 19:00)
  INSERT INTO doctor_schedules (doctor_id, day_of_week, start_time, end_time, break_start, break_end, clinic_id)
  SELECT v_doctor_id, dow, '10:00', '19:00', '14:00', '15:00', v_clinic2_id
  FROM generate_series(1, 5) AS dow
  ON CONFLICT (doctor_id, day_of_week) DO NOTHING;
END $$;

-- 7. Sembrar Artículos de la Base de Conocimiento RAG (Xúquer = Dental / Castellón = Estética)
-- Sede 1: Xúquer (Dental)
INSERT INTO ai_knowledge_base (clinic_id, category, title, content, keywords) VALUES
  (1, 'ubicacion', 'Ubicación y Contacto Xúquer',
   'Clínica Vides Dental Xúquer está situada en Av. Reforma 1234, Alcàntera de Xúquer, Valencia. Teléfono de contacto: +34 962 456 789.',
   ARRAY['direccion', 'ubicacion', 'donde estan', 'como llegar', 'telefono']),
  (1, 'primera_revision', 'Primera Revisión Gratuita',
   'En Clínica Vides Dental Xúquer todos los nuevos pacientes disponen de una primera cita de revisión y diagnóstico totalmente gratuita y sin compromiso, atendida por nuestro equipo y la Dra. Sonia Primeras Visitas.',
   ARRAY['primera visita', 'gratis', 'gratuita', 'revision', 'cita nueva', 'cuanto cuesta la primera']),
  (1, 'politica_precios', 'Política Deontológica de Precios',
   'Por ética y rigor odontológico, no proporcionamos precios ni tarifas cerradas por chat o teléfono. Cada anatomía bucal y estructura ósea es única. Tras la primera valoración clínica presencial gratuita con radiografía, el doctor entrega en mano un presupuesto exacto y detallado.',
   ARRAY['precio', 'cuanto cuesta', 'tarifa', 'presupuesto', 'coste', 'valor', 'cuanto vale']),
  (1, 'tratamientos', 'Tratamientos Odontológicos Xúquer',
   'Ofrecemos atención odontológica integral: implantología dental, ortodoncia invisible y brackets, estética dental y carillas, blanqueamiento dental en clínica, prótesis dentales fijas y removibles, periodoncia, endodoncia y limpiezas profesionales.',
   ARRAY['implantes', 'ortodoncia', 'invisalign', 'brackets', 'blanqueamiento', 'limpieza', 'protesis'])
ON CONFLICT DO NOTHING;

-- Sede 2: Castellón (Estética)
INSERT INTO ai_knowledge_base (clinic_id, category, title, content, keywords) VALUES
  (2, 'ubicacion', 'Ubicación y Contacto Castellón',
   'Nuestra Clínica de Estética en Castellón está situada en Calle Cabanes 123, Cabanes, Castellón. Teléfono de contacto: +34 964 123 456.',
   ARRAY['direccion', 'ubicacion', 'donde estan', 'como llegar', 'castellon']),
  (2, 'primera_valoracion', 'Primera Valoración Estética Personalizada',
   'En nuestra clínica de estética de Castellón ofrecemos una primera consulta de valoración personalizada para estudiar las facciones, tipo de piel y objetivos individuales de cada paciente.',
   ARRAY['primera visita', 'valoracion', 'diagnostico estetico', 'consulta estetica']),
  (2, 'politica_precios', 'Política de Precios de Estética',
   'Los tratamientos médico-estéticos se adaptan rigurosamente a la fisionomía y requerimientos de cada paciente. No se facilitan presupuestos cerrados por chat sin valoración médica presencial previa.',
   ARRAY['precio', 'cuanto cuesta', 'tarifa', 'presupuesto', 'coste', 'estetica precio']),
  (2, 'tratamientos', 'Tratamientos de Estética Castellón',
   'Disponemos de tratamientos de medicina estética facial y corporal, armonización facial, rejuvenecimiento cutáneo, bioestimulación y cuidados dermocosméticos avanzados.',
   ARRAY['estetica', 'rejuvenecimiento', 'facial', 'arrugas', 'armonizacion', 'piel'])
ON CONFLICT DO NOTHING;

-- 8. Permisos de Supervisión de IA para Roles Operativos
INSERT INTO permissions (name, description, module) VALUES
  ('ai.supervision.view', 'Ver cola de supervisión de mensajes de IA', 'ai'),
  ('ai.supervision.manage', 'Aprobar, editar o descartar mensajes supervisados de IA', 'ai')
ON CONFLICT (name) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r, permissions p 
WHERE r.name IN ('propietario', 'direccion', 'recepcionista')
  AND p.module = 'ai'
ON CONFLICT DO NOTHING;
