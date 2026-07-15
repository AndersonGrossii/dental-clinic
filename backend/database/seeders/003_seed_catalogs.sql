-- ============================================
-- Seed 003: Catálogos del Sistema
-- ============================================

-- Estados de citas
INSERT INTO appointment_status (name, label, color, sort_order) VALUES
  ('programada', 'Programada', '#3b82f6', 1),
  ('confirmada', 'Confirmada', '#10b981', 2),
  ('en_consulta', 'En Consulta', '#f59e0b', 3),
  ('completada', 'Completada', '#22c55e', 4),
  ('cancelada', 'Cancelada', '#ef4444', 5),
  ('no_asistio', 'No Asistió', '#6b7280', 6),
  ('reprogramada', 'Reprogramada', '#8b5cf6', 7)
ON CONFLICT (name) DO NOTHING;

-- Métodos de pago
INSERT INTO payment_methods (name, label, is_active, sort_order) VALUES
  ('efectivo', 'Efectivo', TRUE, 1),
  ('tarjeta_credito', 'Tarjeta de Crédito', TRUE, 2),
  ('tarjeta_debito', 'Tarjeta de Débito', TRUE, 3),
  ('transferencia', 'Transferencia Bancaria', TRUE, 4)
ON CONFLICT (name) DO NOTHING;

-- Categorías de tratamientos
INSERT INTO treatment_categories (name, description, color, sort_order) VALUES
  ('Preventivo', 'Tratamientos preventivos y de higiene', '#10b981', 1),
  ('Restaurativo', 'Restauraciones y reconstrucciones', '#3b82f6', 2),
  ('Endodoncia', 'Tratamientos de conductos', '#f59e0b', 3),
  ('Cirugía', 'Procedimientos quirúrgicos', '#ef4444', 4),
  ('Ortodoncia', 'Tratamientos de ortodoncia', '#8b5cf6', 5),
  ('Estético', 'Tratamientos estéticos', '#ec4899', 6),
  ('Prótesis', 'Prótesis dentales', '#06b6d4', 7),
  ('Periodoncia', 'Tratamiento de encías', '#14b8a6', 8),
  ('Diagnóstico', 'Consultas y diagnóstico', '#6366f1', 9)
ON CONFLICT (name) DO NOTHING;

-- Tratamientos
INSERT INTO treatments (category_id, name, code, description, default_price, duration_minutes) VALUES
  ((SELECT id FROM treatment_categories WHERE name = 'Diagnóstico'), 'Consulta General', 'CONS-001', 'Consulta y evaluación general', 500.00, 30),
  ((SELECT id FROM treatment_categories WHERE name = 'Diagnóstico'), 'Radiografía Panorámica', 'DIAG-001', 'Radiografía panorámica digital', 600.00, 15),
  ((SELECT id FROM treatment_categories WHERE name = 'Diagnóstico'), 'Radiografía Periapical', 'DIAG-002', 'Radiografía periapical digital', 200.00, 10),
  ((SELECT id FROM treatment_categories WHERE name = 'Preventivo'), 'Limpieza Dental', 'PREV-001', 'Limpieza dental profesional con ultrasonido', 800.00, 45),
  ((SELECT id FROM treatment_categories WHERE name = 'Preventivo'), 'Aplicación de Flúor', 'PREV-002', 'Aplicación tópica de flúor', 350.00, 15),
  ((SELECT id FROM treatment_categories WHERE name = 'Preventivo'), 'Sellador Dental', 'PREV-003', 'Sellador de fisuras por pieza', 400.00, 20),
  ((SELECT id FROM treatment_categories WHERE name = 'Restaurativo'), 'Resina Compuesta', 'REST-001', 'Restauración con resina compuesta', 1200.00, 45),
  ((SELECT id FROM treatment_categories WHERE name = 'Restaurativo'), 'Amalgama', 'REST-002', 'Restauración con amalgama', 800.00, 40),
  ((SELECT id FROM treatment_categories WHERE name = 'Restaurativo'), 'Incrustación', 'REST-003', 'Incrustación dental', 3500.00, 60),
  ((SELECT id FROM treatment_categories WHERE name = 'Endodoncia'), 'Endodoncia Anterior', 'ENDO-001', 'Tratamiento de conductos diente anterior', 4000.00, 90),
  ((SELECT id FROM treatment_categories WHERE name = 'Endodoncia'), 'Endodoncia Premolar', 'ENDO-002', 'Tratamiento de conductos premolar', 5000.00, 90),
  ((SELECT id FROM treatment_categories WHERE name = 'Endodoncia'), 'Endodoncia Molar', 'ENDO-003', 'Tratamiento de conductos molar', 6500.00, 120),
  ((SELECT id FROM treatment_categories WHERE name = 'Cirugía'), 'Extracción Simple', 'CIR-001', 'Extracción dental simple', 1500.00, 30),
  ((SELECT id FROM treatment_categories WHERE name = 'Cirugía'), 'Extracción Quirúrgica', 'CIR-002', 'Extracción quirúrgica compleja', 3500.00, 60),
  ((SELECT id FROM treatment_categories WHERE name = 'Cirugía'), 'Implante Dental', 'CIR-003', 'Implante dental con corona', 18000.00, 120),
  ((SELECT id FROM treatment_categories WHERE name = 'Ortodoncia'), 'Brackets Metálicos', 'ORT-001', 'Tratamiento con brackets metálicos (pago mensual)', 3500.00, 45),
  ((SELECT id FROM treatment_categories WHERE name = 'Ortodoncia'), 'Brackets Estéticos', 'ORT-002', 'Tratamiento con brackets estéticos', 5000.00, 45),
  ((SELECT id FROM treatment_categories WHERE name = 'Ortodoncia'), 'Alineadores Invisibles', 'ORT-003', 'Tratamiento con alineadores transparentes', 8000.00, 30),
  ((SELECT id FROM treatment_categories WHERE name = 'Estético'), 'Blanqueamiento Dental', 'EST-001', 'Blanqueamiento dental en consultorio', 4500.00, 60),
  ((SELECT id FROM treatment_categories WHERE name = 'Estético'), 'Carilla de Porcelana', 'EST-002', 'Carilla dental de porcelana por pieza', 8000.00, 60),
  ((SELECT id FROM treatment_categories WHERE name = 'Prótesis'), 'Corona de Porcelana', 'PROT-001', 'Corona de porcelana sobre metal', 5500.00, 60),
  ((SELECT id FROM treatment_categories WHERE name = 'Prótesis'), 'Corona de Zirconia', 'PROT-002', 'Corona de zirconia', 8500.00, 60),
  ((SELECT id FROM treatment_categories WHERE name = 'Prótesis'), 'Dentadura Completa', 'PROT-003', 'Prótesis total removible', 12000.00, 90),
  ((SELECT id FROM treatment_categories WHERE name = 'Periodoncia'), 'Curetaje por Cuadrante', 'PER-001', 'Curetaje subgingival por cuadrante', 2000.00, 45),
  ((SELECT id FROM treatment_categories WHERE name = 'Periodoncia'), 'Cirugía Periodontal', 'PER-002', 'Cirugía periodontal por cuadrante', 5000.00, 90)
ON CONFLICT DO NOTHING;

-- Información de la clínica (una por clínica)
INSERT INTO clinic_information (clinic_id, name, legal_name, tax_id, address, city, state, country, postal_code, phone, email, currency, tax_rate)
SELECT c.id, 'Vides Dental Xuquer', 'Vides Dental Xuquer S.A. de C.V.', 'CDS850101ABC',
  'Av. Reforma 1234, Col. Centro', 'Ciudad de México', 'CDMX', 'México', '06000',
  '+52 55 1234 5678', 'contacto@dentalsonrisa.com', 'MXN', 16.00
FROM clinics c
WHERE c.code = 'XUQ'
  AND NOT EXISTS (SELECT 1 FROM clinic_information ci WHERE ci.clinic_id = c.id);

INSERT INTO clinic_information (clinic_id, name, legal_name, tax_id, address, city, state, country, postal_code, phone, email, currency, tax_rate)
SELECT c.id, 'Vides Dental Cabanes', 'Vides Dental Cabanes S.L.', 'B12345678',
  'Calle Cabanes 123', 'Cabanes', 'Castellón', 'España', '12180',
  '+34 612 345 678', 'cabanes@videsdental.com', 'EUR', 21.00
FROM clinics c
WHERE c.code = 'CAB'
  AND NOT EXISTS (SELECT 1 FROM clinic_information ci WHERE ci.clinic_id = c.id);

-- Configuraciones por defecto
INSERT INTO settings (key, value, description, category) VALUES
  ('appointment_duration', '30', 'Duración predeterminada de citas en minutos', 'citas'),
  ('appointment_reminder_hours', '24', 'Horas antes de la cita para enviar recordatorio', 'citas'),
  ('invoice_prefix', 'FAC', 'Prefijo para números de factura', 'facturación'),
  ('quote_prefix', 'COT', 'Prefijo para números de cotización', 'facturación'),
  ('quote_validity_days', '30', 'Días de validez para cotizaciones', 'facturación'),
  ('currency_symbol', '$', 'Símbolo de moneda', 'general'),
  ('date_format', 'DD/MM/YYYY', 'Formato de fecha', 'general'),
  ('time_format', '24h', 'Formato de hora', 'general'),
  ('theme', 'light', 'Tema visual predeterminado', 'apariencia')
ON CONFLICT (key) DO NOTHING;
