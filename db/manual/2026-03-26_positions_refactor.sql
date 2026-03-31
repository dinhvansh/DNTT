CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS positions (
  position_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  position_code TEXT NOT NULL UNIQUE,
  position_name TEXT NOT NULL,
  is_global BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS position_id UUID REFERENCES positions(position_id);

ALTER TABLE department_approval_setup
  ADD COLUMN IF NOT EXISTS reviewer_position_id UUID REFERENCES positions(position_id),
  ADD COLUMN IF NOT EXISTS hod_position_id UUID REFERENCES positions(position_id),
  ADD COLUMN IF NOT EXISTS fallback_position_id UUID REFERENCES positions(position_id),
  ADD COLUMN IF NOT EXISTS step_order_json JSONB NOT NULL DEFAULT '["line_manager","reviewer","hod"]'::jsonb;

ALTER TABLE global_approver_config
  ADD COLUMN IF NOT EXISTS cfo_position_id UUID REFERENCES positions(position_id),
  ADD COLUMN IF NOT EXISTS ceo_position_id UUID REFERENCES positions(position_id);

INSERT INTO positions (position_id, position_code, position_name, is_global, is_active)
VALUES
  ('15000000-0000-0000-0000-000000000001', 'staff', 'Staff', FALSE, TRUE),
  ('15000000-0000-0000-0000-000000000002', 'line_manager', 'Line Manager', FALSE, TRUE),
  ('15000000-0000-0000-0000-000000000003', 'reviewer', 'Reviewer', FALSE, TRUE),
  ('15000000-0000-0000-0000-000000000004', 'hod', 'Head Of Department', FALSE, TRUE),
  ('15000000-0000-0000-0000-000000000005', 'finance_operations', 'Finance Operations', TRUE, TRUE),
  ('15000000-0000-0000-0000-000000000006', 'auditor', 'Auditor', TRUE, TRUE),
  ('15000000-0000-0000-0000-000000000007', 'system_admin', 'System Admin', TRUE, TRUE),
  ('15000000-0000-0000-0000-000000000008', 'cfo', 'Chief Financial Officer', TRUE, TRUE),
  ('15000000-0000-0000-0000-000000000009', 'ceo', 'Chief Executive Officer', TRUE, TRUE)
ON CONFLICT (position_code) DO UPDATE
SET
  position_name = EXCLUDED.position_name,
  is_global = EXCLUDED.is_global,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

UPDATE users
SET position_id = '15000000-0000-0000-0000-000000000001'::uuid
WHERE email IN (
  'requester1@example.com',
  'requester2@example.com',
  'requester3@example.com',
  'delegate1@example.com',
  'departmentmember@example.com',
  'randomuser@example.com'
) AND position_id IS NULL;

UPDATE users
SET position_id = '15000000-0000-0000-0000-000000000002'::uuid
WHERE email = 'approver1@example.com' AND position_id IS NULL;

UPDATE users
SET position_id = '15000000-0000-0000-0000-000000000003'::uuid
WHERE email IN ('approver2@example.com', 'approver3@example.com') AND position_id IS NULL;

UPDATE users
SET position_id = '15000000-0000-0000-0000-000000000004'::uuid
WHERE email = 'hod1@example.com' AND position_id IS NULL;

UPDATE users
SET position_id = '15000000-0000-0000-0000-000000000005'::uuid
WHERE email = 'financeops@example.com' AND position_id IS NULL;

UPDATE users
SET position_id = '15000000-0000-0000-0000-000000000006'::uuid
WHERE email = 'auditor1@example.com' AND position_id IS NULL;

UPDATE users
SET position_id = '15000000-0000-0000-0000-000000000007'::uuid
WHERE email = 'sysadmin@example.com' AND position_id IS NULL;

UPDATE users
SET position_id = '15000000-0000-0000-0000-000000000008'::uuid
WHERE email = 'cfo1@example.com' AND position_id IS NULL;

UPDATE users
SET position_id = '15000000-0000-0000-0000-000000000009'::uuid
WHERE email = 'ceo1@example.com' AND position_id IS NULL;

UPDATE department_approval_setup
SET reviewer_position_id = COALESCE(
      reviewer_position_id,
      (
        SELECT u.position_id
        FROM users u
        WHERE u.user_id = department_approval_setup.reviewer_user_id
      )
    ),
    hod_position_id = COALESCE(
      hod_position_id,
      (
        SELECT u.position_id
        FROM users u
        WHERE u.user_id = department_approval_setup.hod_user_id
      )
    ),
    fallback_position_id = COALESCE(
      fallback_position_id,
      (
        SELECT u.position_id
        FROM users u
        WHERE u.user_id = department_approval_setup.fallback_user_id
      )
    ),
    step_order_json = CASE
      WHEN step_order_json IS NULL OR jsonb_array_length(step_order_json) = 0
        THEN '["line_manager","reviewer","hod"]'::jsonb
      ELSE step_order_json
    END;

UPDATE department_approval_setup das
SET step_order_json = '["reviewer","line_manager","hod"]'::jsonb
WHERE das.department_id = '10000000-0000-0000-0000-000000000002'::uuid
  AND (
    das.step_order_json IS NULL
    OR das.step_order_json = '["line_manager","reviewer","hod"]'::jsonb
  );

UPDATE global_approver_config
SET cfo_position_id = COALESCE(
      cfo_position_id,
      (
        SELECT u.position_id
        FROM users u
        WHERE u.user_id = global_approver_config.cfo_user_id
      )
    ),
    ceo_position_id = COALESCE(
      ceo_position_id,
      (
        SELECT u.position_id
        FROM users u
        WHERE u.user_id = global_approver_config.ceo_user_id
      )
    );
