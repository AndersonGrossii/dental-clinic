-- ============================================
-- Seed 004: Datos de Ejemplo (Pacientes y Citas)
-- ============================================

-- Pacientes de ejemplo
INSERT INTO patients (first_name, last_name, dni, birth_date, gender, phone, mobile, email, address, city, state, occupation, insurance_provider, created_by) VALUES
  ('Roberto', 'Hernández Soto', '1234567890', '1985-03-15', 'masculino', '+52 55 1111 2222', '+52 55 1111 3333', 'roberto.hernandez@email.com', 'Calle Juárez 45, Col. Roma', 'Ciudad de México', 'CDMX', 'Ingeniero', 'Seguros Atlas', (SELECT id FROM users WHERE email = 'recepcion@dentalclinic.com')),
  ('Laura', 'Martínez Rivera', '2345678901', '1990-07-22', 'femenino', '+52 55 2222 3333', '+52 55 2222 4444', 'laura.martinez@email.com', 'Av. Insurgentes 789, Col. Condesa', 'Ciudad de México', 'CDMX', 'Abogada', NULL, (SELECT id FROM users WHERE email = 'recepcion@dentalclinic.com')),
  ('Miguel', 'Torres Valdez', '3456789012', '1978-11-30', 'masculino', '+52 55 3333 4444', NULL, 'miguel.torres@email.com', 'Blvd. de los Héroes 234', 'Ciudad de México', 'CDMX', 'Contador', 'GNP Seguros', (SELECT id FROM users WHERE email = 'recepcion@dentalclinic.com')),
  ('Sofía', 'García Luna', '4567890123', '1995-02-14', 'femenino', '+52 55 4444 5555', '+52 55 4444 6666', 'sofia.garcia@email.com', 'Calle Madero 567, Col. Centro', 'Ciudad de México', 'CDMX', 'Diseñadora', NULL, (SELECT id FROM users WHERE email = 'recepcion@dentalclinic.com')),
  ('Andrés', 'López Castillo', '5678901234', '1982-09-08', 'masculino', '+52 55 5555 6666', NULL, 'andres.lopez@email.com', 'Av. Universidad 890', 'Ciudad de México', 'CDMX', 'Profesor', 'Metlife', (SELECT id FROM users WHERE email = 'recepcion@dentalclinic.com'))
ON CONFLICT DO NOTHING;
