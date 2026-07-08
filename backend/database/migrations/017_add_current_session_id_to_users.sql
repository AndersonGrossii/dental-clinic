-- ============================================
-- Migración: Agregar columna current_session_id a users
-- ============================================

ALTER TABLE users ADD COLUMN current_session_id VARCHAR(255) DEFAULT NULL;
