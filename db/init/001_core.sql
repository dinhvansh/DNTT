CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'business_status') THEN
    CREATE TYPE business_status AS ENUM (
      'draft',
      'submitted',
      'pending_approval',
      'returned',
      'rejected',
      'approved',
      'cancelled'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'erp_sync_status') THEN
    CREATE TYPE erp_sync_status AS ENUM (
      'not_ready',
      'waiting_finance_release',
      'hold_by_finance',
      'pending',
      'processing',
      'success',
      'failed',
      'manual_review_required'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'workflow_step_status') THEN
    CREATE TYPE workflow_step_status AS ENUM (
      'pending',
      'approved',
      'rejected',
      'returned',
      'skipped',
      'cancelled'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'integration_job_status') THEN
    CREATE TYPE integration_job_status AS ENUM (
      'pending',
      'processing',
      'success',
      'failed',
      'manual_review_required',
      'cancelled'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS roles (
  role_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_code TEXT NOT NULL UNIQUE,
  role_name TEXT NOT NULL,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_code TEXT NOT NULL,
  permission_code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (role_code, permission_code)
);

CREATE TABLE IF NOT EXISTS departments (
  department_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_code TEXT NOT NULL UNIQUE,
  department_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_code TEXT UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  department_id UUID REFERENCES departments(department_id),
  line_manager_id UUID REFERENCES users(user_id),
  identity_subject TEXT UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  role_code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, role_code)
);

CREATE TABLE IF NOT EXISTS department_approval_setup (
  department_approval_setup_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES departments(department_id),
  reviewer_user_id UUID REFERENCES users(user_id),
  hod_user_id UUID REFERENCES users(user_id),
  fallback_user_id UUID REFERENCES users(user_id),
  effective_from TIMESTAMPTZ,
  effective_to TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS global_approver_config (
  global_approver_config_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_code TEXT NOT NULL UNIQUE,
  cfo_user_id UUID REFERENCES users(user_id),
  ceo_user_id UUID REFERENCES users(user_id),
  cfo_amount_threshold NUMERIC(18, 2),
  ceo_amount_threshold NUMERIC(18, 2),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS delegations (
  delegation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delegator_user_id UUID NOT NULL REFERENCES users(user_id),
  delegate_user_id UUID NOT NULL REFERENCES users(user_id),
  request_type TEXT NOT NULL DEFAULT 'payment_request',
  valid_from TIMESTAMPTZ NOT NULL,
  valid_to TIMESTAMPTZ NOT NULL,
  scope JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS request_templates (
  template_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_code TEXT NOT NULL UNIQUE,
  template_name TEXT NOT NULL,
  request_type TEXT NOT NULL,
  description TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  form_schema_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  detail_schema_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  attachment_rules_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  visibility_mode TEXT NOT NULL DEFAULT 'related_only',
  output_template_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS approval_policies (
  policy_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_code TEXT NOT NULL UNIQUE,
  policy_name TEXT NOT NULL,
  request_type TEXT NOT NULL,
  config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS template_policy_mappings (
  mapping_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES request_templates(template_id),
  department_id UUID REFERENCES departments(department_id),
  amount_min NUMERIC(18, 2),
  amount_max NUMERIC(18, 2),
  priority INTEGER NOT NULL DEFAULT 1,
  policy_id UUID NOT NULL REFERENCES approval_policies(policy_id),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payment_requests (
  request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_no TEXT NOT NULL UNIQUE,
  template_id UUID REFERENCES request_templates(template_id),
  template_version INTEGER,
  requester_id UUID NOT NULL REFERENCES users(user_id),
  department_id UUID REFERENCES departments(department_id),
  request_date DATE NOT NULL DEFAULT CURRENT_DATE,
  request_type TEXT NOT NULL DEFAULT 'payment_request',
  payment_type TEXT,
  payee_type TEXT,
  priority TEXT NOT NULL DEFAULT 'medium',
  vendor_code TEXT,
  payee_name TEXT,
  currency TEXT NOT NULL DEFAULT 'VND',
  total_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
  reason TEXT,
  due_date DATE,
  urgent_flag BOOLEAN NOT NULL DEFAULT FALSE,
  bank_account_name TEXT,
  bank_account_number TEXT,
  bank_name TEXT,
  visibility_mode TEXT NOT NULL DEFAULT 'related_only',
  business_status business_status NOT NULL DEFAULT 'draft',
  erp_sync_status erp_sync_status NOT NULL DEFAULT 'not_ready',
  finance_release_by UUID REFERENCES users(user_id),
  finance_release_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payment_request_details (
  detail_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES payment_requests(request_id) ON DELETE CASCADE,
  line_no INTEGER NOT NULL,
  description TEXT NOT NULL,
  invoice_no TEXT,
  invoice_date DATE,
  due_date DATE,
  cost_center TEXT,
  gl_account TEXT,
  project_code TEXT,
  po_no TEXT,
  contract_no TEXT,
  amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
  vat_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
  remark TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (request_id, line_no)
);

CREATE TABLE IF NOT EXISTS payment_request_attachments (
  attachment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES payment_requests(request_id) ON DELETE CASCADE,
  detail_id UUID REFERENCES payment_request_details(detail_id) ON DELETE SET NULL,
  attachment_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  uploaded_by UUID REFERENCES users(user_id),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS request_workflow_instances (
  workflow_instance_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL UNIQUE REFERENCES payment_requests(request_id) ON DELETE CASCADE,
  policy_id UUID REFERENCES approval_policies(policy_id),
  policy_version INTEGER,
  snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  current_step_no INTEGER,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS request_workflow_steps (
  step_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_instance_id UUID NOT NULL REFERENCES request_workflow_instances(workflow_instance_id) ON DELETE CASCADE,
  step_no INTEGER NOT NULL,
  step_code TEXT NOT NULL,
  original_user_id UUID REFERENCES users(user_id),
  acting_user_id UUID REFERENCES users(user_id),
  status workflow_step_status NOT NULL DEFAULT 'pending',
  action_at TIMESTAMPTZ,
  action_note TEXT,
  skipped_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workflow_instance_id, step_no)
);

CREATE TABLE IF NOT EXISTS integration_jobs (
  job_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ref_type TEXT NOT NULL,
  ref_id UUID NOT NULL,
  target_system TEXT NOT NULL,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status integration_job_status NOT NULL DEFAULT 'pending',
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS erp_push_logs (
  log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES payment_requests(request_id) ON DELETE CASCADE,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  response_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL,
  attempt_no INTEGER NOT NULL DEFAULT 1,
  error_message TEXT,
  pushed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES users(user_id),
  entity_type TEXT NOT NULL,
  entity_id UUID,
  action_code TEXT NOT NULL,
  action_note TEXT,
  before_json JSONB,
  after_json JSONB,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_requests_requester_id
  ON payment_requests (requester_id);

CREATE INDEX IF NOT EXISTS idx_payment_requests_department_id
  ON payment_requests (department_id);

CREATE INDEX IF NOT EXISTS idx_payment_requests_business_status
  ON payment_requests (business_status);

CREATE INDEX IF NOT EXISTS idx_payment_requests_erp_sync_status
  ON payment_requests (erp_sync_status);

CREATE INDEX IF NOT EXISTS idx_request_workflow_steps_assignee
  ON request_workflow_steps (original_user_id, acting_user_id, status);

CREATE INDEX IF NOT EXISTS idx_integration_jobs_status_next_retry
  ON integration_jobs (status, next_retry_at);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
  ON audit_logs (entity_type, entity_id, created_at DESC);
