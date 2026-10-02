-- ============================================
-- Migración 061: Permitir estado 'RETRY' en automation_jobs
-- ============================================

ALTER TABLE automation_jobs DROP CONSTRAINT IF EXISTS automation_jobs_status_check;

ALTER TABLE automation_jobs ADD CONSTRAINT automation_jobs_status_check 
CHECK (status IN ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'SKIPPED', 'RETRY'));
