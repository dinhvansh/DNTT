ALTER TABLE integration_jobs
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

ALTER TABLE integration_jobs
  ADD COLUMN IF NOT EXISTS error_category TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_integration_jobs_target_idempotency
  ON integration_jobs (target_system, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
