-- ============================================
-- Migración 066: Actualizar contactos con identificador real de Instagram
-- ============================================

UPDATE messaging_contacts
SET name = '@andersongrossii', updated_at = NOW()
WHERE phone LIKE '%9095' OR name IN ('@ig_user_9095', '@ig_user_4262');
