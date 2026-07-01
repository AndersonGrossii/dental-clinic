-- ============================================
-- Seed 005: Rol Dirección + Usuario Sonia
-- ============================================

-- Rol Dirección/Gerente
INSERT INTO roles (name, description) VALUES
  ('direccion', 'Dirección/Gerente con acceso completo al sistema excepto eliminación del propietario')
ON CONFLICT (name) DO NOTHING;

-- Asignar todos los permisos a dirección (igual que propietario)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'direccion'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Sonia, Gerente: sonia@dentalclinic.com / Admin123!
INSERT INTO users (role_id, first_name, last_name, email, password_hash, phone, is_active) VALUES
  ((SELECT id FROM roles WHERE name = 'direccion'), 'Sonia', 'Martínez', 'sonia@dentalclinic.com',
   '$2a$12$B/nbsB0ZRghbC/3MdSBPRuTWD1VwnVxT798EfXGgntOfyzR1KBVV2', '+52 55 5678 9012', TRUE)
ON CONFLICT (email) DO NOTHING;
