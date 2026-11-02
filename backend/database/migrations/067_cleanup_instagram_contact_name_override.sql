-- ============================================
-- Migración 067: Limpiar sobrescritura manual de @andersongrossii
-- Restablece el nombre para que muestre el ID del remitente real
-- ============================================

UPDATE messaging_contacts
SET name = '@ig_user_' || RIGHT(phone, 4), updated_at = NOW()
WHERE name = '@andersongrossii';
