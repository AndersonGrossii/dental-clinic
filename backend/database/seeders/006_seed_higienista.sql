-- ============================================
-- Seed 006: Rol Higienista y sus Permisos
-- ============================================

-- Insertar Rol Higienista
INSERT INTO roles (name, description) VALUES
  ('higienista', 'Higienista Dental con acceso a pacientes, citas e historial clínico')
ON CONFLICT (name) DO NOTHING;

-- Asignar permisos a higienista
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'higienista'
  AND p.name IN (
    'patients.read',
    'appointments.read',
    'dashboard.read'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;
