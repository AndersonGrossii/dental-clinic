-- ============================================
-- Migración 065: Asegurar credenciales y limpiar auto-conversaciones de Instagram
-- ============================================

INSERT INTO settings (clinic_id, key, value, description, category)
VALUES 
  (1, 'instagram_access_token', 'IGAAPd3tgPAGFBZAFkzbllMdzBHUHJmb0JOczdlYk1EVmw0VEpnNHdTa29PT09jMTR1ZAXJDY3VGTzNqdW5UZAFZATV0hYZAHQ3WTk3OXdHQVpmbGU0am9LaExFNlBtTmpHYjNIZAWRTRjJSYXJaa2VXSjRTcXVZAMmd6YWFqbjhFOFhLNAZDZD', 'Token de acceso a Instagram Graph API', 'messaging'),
  (1, 'instagram_account_id', '17841452159448211', 'ID de cuenta Instagram Business/Creator', 'messaging'),
  (1, 'instagram_page_id', 'me', 'ID de página o endpoint Instagram', 'messaging')
ON CONFLICT (clinic_id, key) DO UPDATE SET value = EXCLUDED.value;

-- Limpiar conversaciones residuales donde la propia clínica se hablaba a sí misma antes del filtro de eco
DELETE FROM messages WHERE conversation_id IN (
  SELECT id FROM conversations WHERE contact_phone IN ('17841452159448211', '29046445808282647')
);
DELETE FROM conversations WHERE contact_phone IN ('17841452159448211', '29046445808282647');
DELETE FROM messaging_contacts WHERE phone IN ('17841452159448211', '29046445808282647');
