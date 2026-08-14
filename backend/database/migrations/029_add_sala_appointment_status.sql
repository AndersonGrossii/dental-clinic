-- ============================================
-- Migración 029: Agregar estado 'sala' (En Sala) a appointment_status
-- ============================================

INSERT INTO appointment_status (name, label, color, sort_order) VALUES
  ('sala', 'En Sala', '#06b6d4', 3)
ON CONFLICT (name) DO UPDATE SET
  label = EXCLUDED.label,
  color = EXCLUDED.color,
  sort_order = EXCLUDED.sort_order;
