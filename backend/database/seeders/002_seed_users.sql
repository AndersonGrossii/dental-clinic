-- ============================================
-- Seed 002: Usuarios por Defecto
-- Las contraseñas son hashes bcrypt pre-generados
-- Admin123! / Recep123! / Doctor123!
-- ============================================

-- Propietario: admin@dentalclinic.com / Admin123!
INSERT INTO users (role_id, first_name, last_name, email, password_hash, phone, is_active) VALUES
  ((SELECT id FROM roles WHERE name = 'propietario'), 'Carlos', 'Mendoza', 'admin@dentalclinic.com',
   '$2a$12$B/nbsB0ZRghbC/3MdSBPRuTWD1VwnVxT798EfXGgntOfyzR1KBVV2', '+52 55 1234 5678', TRUE)
ON CONFLICT (email) DO NOTHING;

-- Recepcionista: recepcion@dentalclinic.com / Recep123!
INSERT INTO users (role_id, first_name, last_name, email, password_hash, phone, is_active) VALUES
  ((SELECT id FROM roles WHERE name = 'recepcionista'), 'María', 'García', 'recepcion@dentalclinic.com',
   '$2a$12$wCzgKcF/IFhLczK8kWrYWupvsbtZIhw8U9EV5B3coxoCSpVl7Qy6C', '+52 55 2345 6789', TRUE)
ON CONFLICT (email) DO NOTHING;

-- Doctor 1: dr.rodriguez@dentalclinic.com / Doctor123!
INSERT INTO users (role_id, first_name, last_name, email, password_hash, phone, is_active) VALUES
  ((SELECT id FROM roles WHERE name = 'doctor'), 'Juan', 'Rodríguez', 'dr.rodriguez@dentalclinic.com',
   '$2a$12$yAt4AfAs4SsJ7NLWREzYy.5YKmDLhcvQ46p0vDE2LqcJCoFsPhcli', '+52 55 3456 7890', TRUE)
ON CONFLICT (email) DO NOTHING;

-- Doctor 2: dra.lopez@dentalclinic.com / Doctor123!
INSERT INTO users (role_id, first_name, last_name, email, password_hash, phone, is_active) VALUES
  ((SELECT id FROM roles WHERE name = 'doctor'), 'Ana', 'López', 'dra.lopez@dentalclinic.com',
   '$2a$12$yAt4AfAs4SsJ7NLWREzYy.5YKmDLhcvQ46p0vDE2LqcJCoFsPhcli', '+52 55 4567 8901', TRUE)
ON CONFLICT (email) DO NOTHING;

-- Crear perfil de doctores
INSERT INTO doctors (user_id, specialty, license_number, consultation_duration, color)
SELECT id, 'Odontología General', 'CED-12345', 30, '#0891b2'
FROM users WHERE email = 'dr.rodriguez@dentalclinic.com'
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO doctors (user_id, specialty, license_number, consultation_duration, color)
SELECT id, 'Ortodoncia', 'CED-67890', 45, '#7c3aed'
FROM users WHERE email = 'dra.lopez@dentalclinic.com'
ON CONFLICT (user_id) DO NOTHING;

-- Horarios de doctores (Lunes a Viernes, 9:00 - 18:00)
INSERT INTO doctor_schedules (doctor_id, day_of_week, start_time, end_time, break_start, break_end)
SELECT d.id, dow, '09:00', '18:00', '13:00', '14:00'
FROM doctors d
CROSS JOIN generate_series(1, 5) AS dow
JOIN users u ON u.id = d.user_id
WHERE u.email = 'dr.rodriguez@dentalclinic.com'
ON CONFLICT (doctor_id, day_of_week) DO NOTHING;

INSERT INTO doctor_schedules (doctor_id, day_of_week, start_time, end_time, break_start, break_end)
SELECT d.id, dow, '08:00', '16:00', '12:00', '13:00'
FROM doctors d
CROSS JOIN generate_series(1, 5) AS dow
JOIN users u ON u.id = d.user_id
WHERE u.email = 'dra.lopez@dentalclinic.com'
ON CONFLICT (doctor_id, day_of_week) DO NOTHING;

-- Sábado para Dr. Rodríguez
INSERT INTO doctor_schedules (doctor_id, day_of_week, start_time, end_time, break_start, break_end)
SELECT d.id, 6, '09:00', '14:00', NULL, NULL
FROM doctors d
JOIN users u ON u.id = d.user_id
WHERE u.email = 'dr.rodriguez@dentalclinic.com'
ON CONFLICT (doctor_id, day_of_week) DO NOTHING;
