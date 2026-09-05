-- ============================================
-- Migración 053: Mejoras para Agenda Personal
-- Destinatarios múltiples, visibilidad global y desacoplamiento
-- ============================================

-- 1. Mejoras en tabla tasks (Tareas)
ALTER TABLE tasks 
  ADD COLUMN IF NOT EXISTS assigned_user_ids INTEGER[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_team_visible BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_tasks_team_visible ON tasks(is_team_visible);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_ids ON tasks USING GIN(assigned_user_ids);

-- 2. Mejoras en tabla calendar_notes (Notas Adhesivas)
ALTER TABLE calendar_notes 
  ADD COLUMN IF NOT EXISTS assigned_to_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_user_ids INTEGER[] DEFAULT '{}';

ALTER TABLE calendar_notes 
  ALTER COLUMN is_team_visible SET DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_calendar_notes_assigned_to ON calendar_notes(assigned_to_user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_notes_assigned_ids ON calendar_notes USING GIN(assigned_user_ids);

-- 3. Mejoras en tabla patient_followups (Seguimientos)
ALTER TABLE patient_followups 
  ADD COLUMN IF NOT EXISTS assigned_user_ids INTEGER[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_team_visible BOOLEAN DEFAULT FALSE,
  ALTER COLUMN patient_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_followups_team_visible ON patient_followups(is_team_visible);
CREATE INDEX IF NOT EXISTS idx_followups_assigned_ids ON patient_followups USING GIN(assigned_user_ids);
