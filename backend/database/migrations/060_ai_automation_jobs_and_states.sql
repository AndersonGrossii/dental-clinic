-- ============================================
-- Migración 060: Motor de Trabajos de Automatización Asíncrona (Jobs),
-- Idempotencia Transaccional y Estados de Conversación
-- ============================================

-- 1. Tabla de Trabajos de Automatización (Jobs)
CREATE TABLE IF NOT EXISTS automation_jobs (
  id SERIAL PRIMARY KEY,
  clinic_id INTEGER NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
  job_type VARCHAR(50) NOT NULL, -- 'CONFIRMATION_24H', 'RECALL_HYGIENE_6M', 'RECALL_SURGERY_7D', 'QUOTATION_FOLLOWUP_SCAN', 'LEAD_INACTIVE_FOLLOWUP'
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'SKIPPED', 'RETRY')),
  idempotency_key VARCHAR(255) NOT NULL,
  payload JSONB DEFAULT '{}'::jsonb,
  result JSONB DEFAULT '{}'::jsonb,
  error_message TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE NULL,
  completed_at TIMESTAMP WITH TIME ZONE NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT uq_automation_jobs_clinic_idempotency UNIQUE (clinic_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_automation_jobs_clinic ON automation_jobs(clinic_id);
CREATE INDEX IF NOT EXISTS idx_automation_jobs_status_sched ON automation_jobs(clinic_id, status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_automation_jobs_type ON automation_jobs(job_type);

-- 2. Contexto de conversación en conversations para flujos multi-turno (Booking interactivo)
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS context_state JSONB DEFAULT '{}'::jsonb;
