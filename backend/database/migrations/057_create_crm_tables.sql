-- ============================================
-- Migración 057: Tablas del Dominio CRM (Leads, Oportunidades, Notas y Actividades)
-- ============================================

-- 1. Ampliar messaging_contacts con email si no existe
ALTER TABLE messaging_contacts 
  ADD COLUMN IF NOT EXISTS email VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_msg_contacts_email ON messaging_contacts(email);

-- 2. Catálogo de Orígenes de Leads (crm_lead_sources)
CREATE TABLE IF NOT EXISTS crm_lead_sources (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO crm_lead_sources (code, name, description)
VALUES 
  ('whatsapp', 'WhatsApp', 'Contacto entrante o iniciado por WhatsApp Cloud API'),
  ('instagram', 'Instagram Direct', 'Contacto entrante por mensaje directo o historia de Instagram'),
  ('website', 'Sitio Web / Formulario', 'Lead captado a través de landing page o formulario web'),
  ('manual', 'Entrada Manual', 'Lead registrado presencial o telefónicamente por recepción'),
  ('other', 'Otro Origen', 'Recomendaciones, convenios o fuentes externas')
ON CONFLICT (code) DO NOTHING;

-- 3. Tabla Principal de Leads (crm_leads)
CREATE TABLE IF NOT EXISTS crm_leads (
  id SERIAL PRIMARY KEY,
  clinic_id INTEGER NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
  contact_id INTEGER NOT NULL REFERENCES messaging_contacts(id) ON DELETE CASCADE,
  patient_id INTEGER REFERENCES patients(id) ON DELETE SET NULL,
  source VARCHAR(50) NOT NULL DEFAULT 'manual' REFERENCES crm_lead_sources(code),
  status VARCHAR(50) NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'appointment_scheduled', 'converted', 'lost')),
  interest VARCHAR(255),
  assigned_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  loss_reason TEXT,
  converted_at TIMESTAMP WITH TIME ZONE NULL,
  lost_at TIMESTAMP WITH TIME ZONE NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE NULL
);

CREATE INDEX IF NOT EXISTS idx_crm_leads_clinic_id ON crm_leads(clinic_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_status ON crm_leads(clinic_id, status);
CREATE INDEX IF NOT EXISTS idx_crm_leads_contact_id ON crm_leads(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_patient_id ON crm_leads(patient_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_assigned_user ON crm_leads(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_created_at ON crm_leads(created_at DESC);

-- 4. Tabla de Oportunidades Comerciales (crm_opportunities)
CREATE TABLE IF NOT EXISTS crm_opportunities (
  id SERIAL PRIMARY KEY,
  clinic_id INTEGER NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
  contact_id INTEGER NOT NULL REFERENCES messaging_contacts(id) ON DELETE CASCADE,
  lead_id INTEGER REFERENCES crm_leads(id) ON DELETE SET NULL,
  patient_id INTEGER REFERENCES patients(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  service_interest VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'won', 'lost')),
  estimated_value NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  assigned_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  loss_reason TEXT,
  won_at TIMESTAMP WITH TIME ZONE NULL,
  lost_at TIMESTAMP WITH TIME ZONE NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE NULL
);

CREATE INDEX IF NOT EXISTS idx_crm_opp_clinic_id ON crm_opportunities(clinic_id);
CREATE INDEX IF NOT EXISTS idx_crm_opp_status ON crm_opportunities(clinic_id, status);
CREATE INDEX IF NOT EXISTS idx_crm_opp_contact_id ON crm_opportunities(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_opp_lead_id ON crm_opportunities(lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_opp_assigned ON crm_opportunities(assigned_user_id);

-- 5. Tabla de Notas Comerciales de CRM (crm_notes) — Estrictamente separadas de notas clínicas
CREATE TABLE IF NOT EXISTS crm_notes (
  id SERIAL PRIMARY KEY,
  clinic_id INTEGER NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
  contact_id INTEGER NOT NULL REFERENCES messaging_contacts(id) ON DELETE CASCADE,
  lead_id INTEGER REFERENCES crm_leads(id) ON DELETE SET NULL,
  opportunity_id INTEGER REFERENCES crm_opportunities(id) ON DELETE SET NULL,
  author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  note TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE NULL
);

CREATE INDEX IF NOT EXISTS idx_crm_notes_clinic_id ON crm_notes(clinic_id);
CREATE INDEX IF NOT EXISTS idx_crm_notes_contact_id ON crm_notes(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_notes_lead_id ON crm_notes(lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_notes_opp_id ON crm_notes(opportunity_id);

-- 6. Tabla de Actividades de CRM (crm_activities) — Registro auditable de eventos
CREATE TABLE IF NOT EXISTS crm_activities (
  id SERIAL PRIMARY KEY,
  clinic_id INTEGER NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
  contact_id INTEGER REFERENCES messaging_contacts(id) ON DELETE CASCADE,
  lead_id INTEGER REFERENCES crm_leads(id) ON DELETE SET NULL,
  opportunity_id INTEGER REFERENCES crm_opportunities(id) ON DELETE SET NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  activity_type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  actor_type VARCHAR(20) NOT NULL DEFAULT 'human' CHECK (actor_type IN ('human', 'ai', 'system')),
  metadata JSONB NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_activities_clinic_id ON crm_activities(clinic_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_contact_id ON crm_activities(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_lead_id ON crm_activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_created_at ON crm_activities(created_at DESC);

-- 7. Integrar campos opcionales de CRM en la tabla existente de tasks
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS contact_id INTEGER REFERENCES messaging_contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS opportunity_id INTEGER REFERENCES crm_opportunities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lead_id INTEGER REFERENCES crm_leads(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by_type VARCHAR(20) DEFAULT 'human' CHECK (created_by_type IN ('human', 'ai', 'system')),
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_contact_id ON tasks(contact_id);
CREATE INDEX IF NOT EXISTS idx_tasks_lead_id ON tasks(lead_id);
CREATE INDEX IF NOT EXISTS idx_tasks_opportunity_id ON tasks(opportunity_id);

-- 8. Permisos RBAC para CRM
INSERT INTO permissions (name, description, module)
VALUES 
  ('crm.view', 'Ver tablero, leads y oportunidades del CRM', 'crm'),
  ('crm.create', 'Crear leads, oportunidades y notas en el CRM', 'crm'),
  ('crm.update', 'Actualizar estados, datos y notas de CRM', 'crm'),
  ('crm.delete', 'Eliminar registros de CRM', 'crm'),
  ('crm.manage', 'Gestión completa y configuración de orígenes CRM', 'crm')
ON CONFLICT (name) DO NOTHING;

-- Asignar permisos a propietario y direccion
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r, permissions p 
WHERE r.name IN ('propietario', 'direccion') 
  AND p.module = 'crm'
ON CONFLICT DO NOTHING;

-- Asignar permisos operativos a recepcionista (view, create, update)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r, permissions p 
WHERE r.name = 'recepcionista' 
  AND p.name IN ('crm.view', 'crm.create', 'crm.update')
ON CONFLICT DO NOTHING;
