ALTER TABLE payment_request_details
  ADD COLUMN IF NOT EXISTS expense_type_code TEXT,
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'VND',
  ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(18, 6) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS note TEXT;

UPDATE payment_request_details
SET currency = 'VND'
WHERE currency IS NULL;
