INSERT INTO roles (role_id, role_code, role_name, is_system)
VALUES ('00000000-0000-0000-0000-000000000007', 'auditor', 'Auditor', TRUE)
ON CONFLICT (role_code) DO NOTHING;

INSERT INTO role_permissions (role_code, permission_code)
VALUES
  ('auditor', 'view_all_requests'),
  ('auditor', 'view_audit_entries')
ON CONFLICT (role_code, permission_code) DO NOTHING;

INSERT INTO users (
  user_id,
  employee_code,
  full_name,
  email,
  department_id,
  identity_subject,
  is_active
)
VALUES (
  '20000000-0000-0000-0000-000000000015',
  'E015',
  'Internal Auditor',
  'auditor1@example.com',
  '10000000-0000-0000-0000-000000000003',
  'auditor-1',
  TRUE
)
ON CONFLICT (email) DO NOTHING;

INSERT INTO user_roles (user_id, role_code)
VALUES ('20000000-0000-0000-0000-000000000015', 'auditor')
ON CONFLICT (user_id, role_code) DO NOTHING;
