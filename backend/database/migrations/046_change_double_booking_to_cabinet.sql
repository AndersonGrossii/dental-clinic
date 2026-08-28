-- ============================================
-- Migración 046: Cambiar constraint de doble reserva
-- Ahora se permite que un doctor tenga citas simultáneas
-- en gabinetes distintos. Solo se bloquea la doble reserva
-- en el MISMO gabinete.
-- ============================================

-- Eliminar la constraint antigua basada en doctor_id
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS no_double_booking;

-- Crear nueva constraint basada en gabinete
-- Un gabinete no puede tener dos citas activas al mismo tiempo
ALTER TABLE appointments ADD CONSTRAINT no_double_booking_cabinet EXCLUDE USING gist (
  gabinete WITH =,
  tsrange(
    (appointment_date + start_time),
    (appointment_date + end_time),
    '[)'
  ) WITH &&
) WHERE (deleted_at IS NULL AND status_id NOT IN (5, 6));
