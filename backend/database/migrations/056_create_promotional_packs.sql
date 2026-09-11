-- ============================================
-- Migración 056: Packs Promocionales de Tratamientos
-- ============================================

-- 1. Tabla de Packs Promocionales
CREATE TABLE IF NOT EXISTS promotional_packs (
  id SERIAL PRIMARY KEY,
  clinic_id INTEGER NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  fixed_price DECIMAL(10,2) NOT NULL CHECK (fixed_price >= 0),
  is_active BOOLEAN DEFAULT TRUE,
  start_date DATE,
  end_date DATE,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_promotional_packs_clinic ON promotional_packs(clinic_id, is_active) WHERE deleted_at IS NULL;

-- 2. Tabla de Ítems / Tratamientos incluidos en el Pack
CREATE TABLE IF NOT EXISTS promotional_pack_items (
  id SERIAL PRIMARY KEY,
  pack_id INTEGER NOT NULL REFERENCES promotional_packs(id) ON DELETE CASCADE,
  treatment_id INTEGER NOT NULL REFERENCES treatments(id) ON DELETE RESTRICT,
  clinic_id INTEGER NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT uq_pack_treatment UNIQUE (pack_id, treatment_id)
);

CREATE INDEX IF NOT EXISTS idx_pack_items_pack ON promotional_pack_items(pack_id);
CREATE INDEX IF NOT EXISTS idx_pack_items_treatment ON promotional_pack_items(treatment_id);

-- 3. Columnas de trazabilidad histórica y agrupación en quotation_items
ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS promotional_pack_id INTEGER REFERENCES promotional_packs(id) ON DELETE SET NULL;
ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS pack_group_id VARCHAR(50);
ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS pack_name VARCHAR(200);
ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS pack_fixed_price DECIMAL(10,2);
ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS is_pack_item BOOLEAN DEFAULT FALSE;
ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS is_pack_header BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_quotation_items_pack_group ON quotation_items(pack_group_id) WHERE pack_group_id IS NOT NULL;
