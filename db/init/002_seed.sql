INSERT INTO roles (role_id, role_code, role_name, is_system)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'admin', 'System Admin', TRUE),
  ('00000000-0000-0000-0000-000000000002', 'director', 'Director', TRUE),
  ('00000000-0000-0000-0000-000000000003', 'manager', 'Manager', TRUE),
  ('00000000-0000-0000-0000-000000000004', 'finance_operations', 'Finance Operations', TRUE),
  ('00000000-0000-0000-0000-000000000005', 'erp_integration_admin', 'ERP Integration Admin', TRUE),
  ('00000000-0000-0000-0000-000000000006', 'staff', 'Staff', TRUE)
ON CONFLICT (role_code) DO NOTHING;

INSERT INTO role_permissions (role_code, permission_code)
VALUES
  ('admin', 'create_request'),
  ('admin', 'edit_own_draft'),
  ('admin', 'submit_request'),
  ('admin', 'cancel_request'),
  ('admin', 'view_all_requests'),
  ('admin', 'approve_request'),
  ('admin', 'release_to_erp'),
  ('admin', 'hold_erp_sync'),
  ('admin', 'retry_erp_push'),
  ('admin', 'manage_department_setup'),
  ('director', 'create_request'),
  ('director', 'edit_own_draft'),
  ('director', 'submit_request'),
  ('director', 'cancel_request'),
  ('director', 'approve_request'),
  ('director', 'view_department_requests'),
  ('manager', 'create_request'),
  ('manager', 'edit_own_draft'),
  ('manager', 'submit_request'),
  ('manager', 'cancel_request'),
  ('manager', 'approve_request'),
  ('manager', 'view_department_requests'),
  ('finance_operations', 'create_request'),
  ('finance_operations', 'edit_own_draft'),
  ('finance_operations', 'submit_request'),
  ('finance_operations', 'cancel_request'),
  ('finance_operations', 'view_finance_scoped'),
  ('finance_operations', 'release_to_erp'),
  ('finance_operations', 'hold_erp_sync'),
  ('finance_operations', 'retry_erp_push'),
  ('staff', 'create_request'),
  ('staff', 'edit_own_draft'),
  ('staff', 'submit_request'),
  ('staff', 'cancel_request'),
  ('erp_integration_admin', 'retry_erp_push')
ON CONFLICT (role_code, permission_code) DO NOTHING;

INSERT INTO departments (department_id, department_code, department_name)
VALUES
  ('10000000-0000-0000-0000-000000000001', 'dep-a', 'Operations Department'),
  ('10000000-0000-0000-0000-000000000002', 'dep-b', 'Tax Department'),
  ('10000000-0000-0000-0000-000000000003', 'dep-finance', 'Finance Operations')
ON CONFLICT (department_code) DO NOTHING;

INSERT INTO users (user_id, employee_code, full_name, email, department_id, line_manager_id, identity_subject, is_active)
VALUES
  ('20000000-0000-0000-0000-000000000001', 'E001', 'Nguyen Van A', 'requester1@example.com', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', 'requester-1', TRUE),
  ('20000000-0000-0000-0000-000000000002', 'E002', 'Tran Thi B', 'requester2@example.com', '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000005', 'requester-2', TRUE),
  ('20000000-0000-0000-0000-000000000003', 'E003', 'Le Thi C', 'requester3@example.com', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000006', 'requester-3', TRUE),
  ('20000000-0000-0000-0000-000000000004', 'E004', 'Approver One', 'approver1@example.com', '10000000-0000-0000-0000-000000000001', NULL, 'approver-1', TRUE),
  ('20000000-0000-0000-0000-000000000005', 'E005', 'Approver Two', 'approver2@example.com', '10000000-0000-0000-0000-000000000002', NULL, 'approver-2', TRUE),
  ('20000000-0000-0000-0000-000000000006', 'E006', 'Approver Three', 'approver3@example.com', '10000000-0000-0000-0000-000000000001', NULL, 'approver-3', TRUE),
  ('20000000-0000-0000-0000-000000000007', 'E007', 'Head Of Department', 'hod1@example.com', '10000000-0000-0000-0000-000000000001', NULL, 'hod-1', TRUE),
  ('20000000-0000-0000-0000-000000000008', 'E008', 'Delegate User', 'delegate1@example.com', '10000000-0000-0000-0000-000000000001', NULL, 'delegate-1', TRUE),
  ('20000000-0000-0000-0000-000000000009', 'E009', 'Finance Operations', 'financeops@example.com', '10000000-0000-0000-0000-000000000003', NULL, 'finance-ops-1', TRUE),
  ('20000000-0000-0000-0000-000000000010', 'E010', 'System Admin', 'sysadmin@example.com', '10000000-0000-0000-0000-000000000003', NULL, 'sys-admin', TRUE),
  ('20000000-0000-0000-0000-000000000011', 'E011', 'Department Member', 'departmentmember@example.com', '10000000-0000-0000-0000-000000000001', NULL, 'department-member', TRUE),
  ('20000000-0000-0000-0000-000000000012', 'E012', 'Random User', 'randomuser@example.com', '10000000-0000-0000-0000-000000000001', NULL, 'random-user', TRUE),
  ('20000000-0000-0000-0000-000000000013', 'E013', 'Chief Finance Officer', 'cfo1@example.com', '10000000-0000-0000-0000-000000000003', NULL, 'cfo-1', TRUE),
  ('20000000-0000-0000-0000-000000000014', 'E014', 'Chief Executive Officer', 'ceo1@example.com', '10000000-0000-0000-0000-000000000003', NULL, 'ceo-1', TRUE)
ON CONFLICT (email) DO NOTHING;

INSERT INTO user_roles (user_id, role_code)
VALUES
  ('20000000-0000-0000-0000-000000000001', 'staff'),
  ('20000000-0000-0000-0000-000000000002', 'staff'),
  ('20000000-0000-0000-0000-000000000003', 'staff'),
  ('20000000-0000-0000-0000-000000000004', 'manager'),
  ('20000000-0000-0000-0000-000000000005', 'manager'),
  ('20000000-0000-0000-0000-000000000006', 'manager'),
  ('20000000-0000-0000-0000-000000000007', 'director'),
  ('20000000-0000-0000-0000-000000000008', 'staff'),
  ('20000000-0000-0000-0000-000000000009', 'finance_operations'),
  ('20000000-0000-0000-0000-000000000010', 'admin'),
  ('20000000-0000-0000-0000-000000000011', 'staff'),
  ('20000000-0000-0000-0000-000000000012', 'staff'),
  ('20000000-0000-0000-0000-000000000013', 'director'),
  ('20000000-0000-0000-0000-000000000014', 'director')
ON CONFLICT (user_id, role_code) DO NOTHING;

INSERT INTO department_approval_setup (
  department_approval_setup_id,
  department_id,
  reviewer_user_id,
  hod_user_id,
  fallback_user_id,
  effective_from,
  is_active
)
VALUES
  (
    '31000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000006',
    '20000000-0000-0000-0000-000000000007',
    NULL,
    '2026-01-01T00:00:00Z',
    TRUE
  ),
  (
    '31000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000005',
    '20000000-0000-0000-0000-000000000005',
    NULL,
    '2026-01-01T00:00:00Z',
    TRUE
  )
ON CONFLICT (department_approval_setup_id) DO NOTHING;

INSERT INTO global_approver_config (
  global_approver_config_id,
  company_code,
  cfo_user_id,
  ceo_user_id,
  cfo_amount_threshold,
  ceo_amount_threshold,
  is_active
)
VALUES
  (
    '32000000-0000-0000-0000-000000000001',
    'default',
    '20000000-0000-0000-0000-000000000013',
    '20000000-0000-0000-0000-000000000014',
    500000,
    1000000,
    TRUE
  )
ON CONFLICT (company_code) DO NOTHING;

INSERT INTO delegations (
  delegation_id,
  delegator_user_id,
  delegate_user_id,
  request_type,
  valid_from,
  valid_to,
  scope,
  is_active
)
VALUES
  (
    '30000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000004',
    '20000000-0000-0000-0000-000000000008',
    'payment_request',
    '2026-03-20T00:00:00Z',
    '2026-03-30T23:59:59Z',
    '{"type":"all"}'::jsonb,
    TRUE
  )
ON CONFLICT (delegation_id) DO NOTHING;

INSERT INTO payment_requests (
  request_id,
  request_no,
  requester_id,
  department_id,
  request_date,
  request_type,
  payment_type,
  payee_type,
  priority,
  payee_name,
  currency,
  total_amount,
  visibility_mode,
  business_status,
  erp_sync_status,
  created_at,
  updated_at
)
VALUES
  (
    '40000000-0000-0000-0000-000000000001',
    'PR-2026-0001',
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '2026-03-24',
    'payment_request',
    'Wire Transfer',
    'vendor',
    'high',
    'Apex Global Systems',
    'VND',
    125000,
    'related_only',
    'pending_approval',
    'not_ready',
    '2026-03-24T14:22:00Z',
    '2026-03-24T14:22:00Z'
  ),
  (
    '40000000-0000-0000-0000-000000000002',
    'PR-2026-0002',
    '20000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002',
    '2026-03-25',
    'payment_request',
    'Service Payment',
    'vendor',
    'critical',
    'Vertex Tax Solutions',
    'VND',
    920000,
    'finance_shared',
    'approved',
    'waiting_finance_release',
    '2026-03-25T08:30:00Z',
    '2026-03-25T08:30:00Z'
  ),
  (
    '40000000-0000-0000-0000-000000000003',
    'PR-2026-0003',
    '20000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000001',
    '2026-03-25',
    'payment_request',
    'Vendor Payment',
    'vendor',
    'medium',
    'Stellar Logistics',
    'VND',
    430000,
    'related_and_same_department',
    'pending_approval',
    'not_ready',
    '2026-03-25T10:15:00Z',
    '2026-03-25T10:15:00Z'
  )
ON CONFLICT (request_no) DO NOTHING;

INSERT INTO request_workflow_instances (
  workflow_instance_id,
  request_id,
  current_step_no,
  status
)
VALUES
  ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 1, 'pending'),
  ('50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', 2, 'approved'),
  ('50000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000003', 1, 'pending')
ON CONFLICT (request_id) DO NOTHING;

INSERT INTO request_workflow_steps (
  step_id,
  workflow_instance_id,
  step_no,
  step_code,
  original_user_id,
  acting_user_id,
  status
)
VALUES
  ('60000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 1, 'line_manager', '20000000-0000-0000-0000-000000000004', NULL, 'pending'),
  ('60000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001', 2, 'hod', '20000000-0000-0000-0000-000000000007', NULL, 'pending'),
  ('60000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000002', 1, 'line_manager', '20000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000005', 'approved'),
  ('60000000-0000-0000-0000-000000000004', '50000000-0000-0000-0000-000000000002', 2, 'cfo', '20000000-0000-0000-0000-000000000013', '20000000-0000-0000-0000-000000000013', 'approved'),
  ('60000000-0000-0000-0000-000000000005', '50000000-0000-0000-0000-000000000003', 1, 'reviewer', '20000000-0000-0000-0000-000000000006', NULL, 'pending')
ON CONFLICT (workflow_instance_id, step_no) DO NOTHING;
