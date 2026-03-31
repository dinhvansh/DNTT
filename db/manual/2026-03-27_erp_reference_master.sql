CREATE TABLE IF NOT EXISTS erp_reference_values (
  erp_reference_value_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_type TEXT NOT NULL,
  reference_code TEXT NOT NULL,
  reference_name TEXT NOT NULL,
  parent_code TEXT,
  currency TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  sync_source TEXT NOT NULL DEFAULT 'manual',
  last_synced_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (reference_type, reference_code)
);

CREATE TABLE IF NOT EXISTS erp_sync_runs (
  erp_sync_run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_type TEXT NOT NULL,
  sync_mode TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'success',
  records_upserted INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  triggered_by UUID REFERENCES users(user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_erp_reference_values_type_active
  ON erp_reference_values (reference_type, is_active, reference_name);

INSERT INTO erp_reference_values (
  erp_reference_value_id,
  reference_type,
  reference_code,
  reference_name,
  parent_code,
  currency,
  metadata_json,
  sync_source,
  last_synced_at,
  is_active
)
VALUES
  ('80000000-0000-0000-0000-000000000001', 'expense_type', 'service_fee', 'Service Fee', NULL, NULL, '{}'::jsonb, 'seed', NOW(), TRUE),
  ('80000000-0000-0000-0000-000000000002', 'expense_type', 'vendor_invoice', 'Vendor Invoice', NULL, NULL, '{}'::jsonb, 'seed', NOW(), TRUE),
  ('80000000-0000-0000-0000-000000000003', 'expense_type', 'tax_payment', 'Tax Payment', NULL, NULL, '{}'::jsonb, 'seed', NOW(), TRUE),
  ('80000000-0000-0000-0000-000000000004', 'expense_type', 'travel_expense', 'Travel Expense', NULL, NULL, '{}'::jsonb, 'seed', NOW(), TRUE),
  ('80000000-0000-0000-0000-000000000005', 'expense_type', 'advance_settlement', 'Advance Settlement', NULL, NULL, '{}'::jsonb, 'seed', NOW(), TRUE),
  ('80000000-0000-0000-0000-000000000006', 'gl_account', '6100-IT', 'IT Service Expense', NULL, 'VND', '{}'::jsonb, 'seed', NOW(), TRUE),
  ('80000000-0000-0000-0000-000000000007', 'gl_account', '6200-OPS', 'Operations Expense', NULL, 'VND', '{}'::jsonb, 'seed', NOW(), TRUE),
  ('80000000-0000-0000-0000-000000000008', 'gl_account', '6300-TAX', 'Tax Expense', NULL, 'VND', '{}'::jsonb, 'seed', NOW(), TRUE),
  ('80000000-0000-0000-0000-000000000009', 'cost_center', 'CC-OPS', 'Operations Cost Center', NULL, NULL, '{}'::jsonb, 'seed', NOW(), TRUE),
  ('80000000-0000-0000-0000-000000000010', 'cost_center', 'CC-FIN', 'Finance Cost Center', NULL, NULL, '{}'::jsonb, 'seed', NOW(), TRUE),
  ('80000000-0000-0000-0000-000000000011', 'project', 'PRJ-DNTT', 'DNTT Transformation Program', NULL, NULL, '{}'::jsonb, 'seed', NOW(), TRUE),
  ('80000000-0000-0000-0000-000000000012', 'project', 'PRJ-ERP', 'ERP Stabilization', NULL, NULL, '{}'::jsonb, 'seed', NOW(), TRUE)
ON CONFLICT (reference_type, reference_code) DO UPDATE
SET
  reference_name = EXCLUDED.reference_name,
  parent_code = EXCLUDED.parent_code,
  currency = EXCLUDED.currency,
  metadata_json = EXCLUDED.metadata_json,
  sync_source = EXCLUDED.sync_source,
  last_synced_at = EXCLUDED.last_synced_at,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();
