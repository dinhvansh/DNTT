CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS vendors (
  vendor_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_code TEXT NOT NULL UNIQUE,
  vendor_name TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'VND',
  bank_account_name TEXT,
  bank_account_number TEXT,
  bank_name TEXT,
  sync_source TEXT NOT NULL DEFAULT 'manual',
  last_synced_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO vendors (
  vendor_id,
  vendor_code,
  vendor_name,
  currency,
  bank_account_name,
  bank_account_number,
  bank_name,
  sync_source,
  last_synced_at,
  is_active
)
VALUES
  ('16000000-0000-0000-0000-000000000001', 'VEND-GLI', 'Global Logistics Inc.', 'VND', 'Global Logistics Inc.', '001122334455', 'ACB', 'manual', NOW(), TRUE),
  ('16000000-0000-0000-0000-000000000002', 'VEND-AWS', 'Amazon Web Services', 'USD', 'Amazon Web Services', '998877665544', 'HSBC', 'erp_seed', NOW(), TRUE),
  ('16000000-0000-0000-0000-000000000003', 'VEND-VTX', 'Vertex Tax Solutions', 'VND', 'Vertex Tax Solutions', '112233445566', 'VCB', 'erp_seed', NOW(), TRUE)
ON CONFLICT (vendor_code) DO NOTHING;
