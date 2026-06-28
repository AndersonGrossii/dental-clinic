-- ============================================
-- Seed 001: Roles del Sistema
-- ============================================

INSERT INTO roles (name, description) VALUES
  ('propietario', 'Propietario/Administrador con acceso completo al sistema'),
  ('recepcionista', 'Recepcionista con acceso a gestión de pacientes, citas y facturación'),
  ('doctor', 'Doctor con acceso a su calendario, pacientes y tratamientos')
ON CONFLICT (name) DO NOTHING;

-- Permisos del sistema
INSERT INTO permissions (name, description, module) VALUES
  ('users.create', 'Crear usuarios', 'usuarios'),
  ('users.read', 'Ver usuarios', 'usuarios'),
  ('users.update', 'Editar usuarios', 'usuarios'),
  ('users.delete', 'Eliminar usuarios', 'usuarios'),
  ('patients.create', 'Crear pacientes', 'pacientes'),
  ('patients.read', 'Ver pacientes', 'pacientes'),
  ('patients.update', 'Editar pacientes', 'pacientes'),
  ('patients.delete', 'Eliminar pacientes', 'pacientes'),
  ('appointments.create', 'Crear citas', 'citas'),
  ('appointments.read', 'Ver citas', 'citas'),
  ('appointments.update', 'Editar citas', 'citas'),
  ('appointments.delete', 'Cancelar citas', 'citas'),
  ('treatments.create', 'Crear tratamientos', 'tratamientos'),
  ('treatments.read', 'Ver tratamientos', 'tratamientos'),
  ('treatments.update', 'Editar tratamientos', 'tratamientos'),
  ('treatments.delete', 'Eliminar tratamientos', 'tratamientos'),
  ('invoices.create', 'Crear facturas', 'facturación'),
  ('invoices.read', 'Ver facturas', 'facturación'),
  ('invoices.update', 'Editar facturas', 'facturación'),
  ('quotations.create', 'Crear cotizaciones', 'cotizaciones'),
  ('quotations.read', 'Ver cotizaciones', 'cotizaciones'),
  ('payments.create', 'Registrar pagos', 'pagos'),
  ('payments.read', 'Ver pagos', 'pagos'),
  ('reports.read', 'Ver reportes', 'reportes'),
  ('settings.read', 'Ver configuración', 'configuración'),
  ('settings.update', 'Editar configuración', 'configuración'),
  ('dashboard.read', 'Ver dashboard', 'dashboard')
ON CONFLICT (name) DO NOTHING;

-- Asignar todos los permisos al propietario
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'propietario'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Asignar permisos a recepcionista
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'recepcionista'
  AND p.name IN (
    'patients.create', 'patients.read', 'patients.update', 'patients.delete',
    'appointments.create', 'appointments.read', 'appointments.update', 'appointments.delete',
    'treatments.read',
    'invoices.create', 'invoices.read', 'invoices.update',
    'quotations.create', 'quotations.read',
    'payments.create', 'payments.read',
    'dashboard.read'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Asignar permisos a doctor
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'doctor'
  AND p.name IN (
    'patients.read',
    'appointments.read',
    'treatments.read', 'treatments.create', 'treatments.update',
    'dashboard.read'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;
