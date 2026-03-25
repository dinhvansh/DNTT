import { createRequire } from 'node:module';

let _pool = null;
const REGISTERED_FIXTURE_USERS = [];

function getPool(databaseUrl) {
  if (!_pool) {
    const require = createRequire(import.meta.url);
    const { Pool } = require('pg');
    _pool = new Pool({ connectionString: databaseUrl });
  }
  return _pool;
}

/**
 * Resolve a full actor context (userId, departmentId, permissions)
 * from a user's email address by querying PostgreSQL.
 *
 * Returns null if no matching user is found.
 */
export async function resolveActorByEmail(config, email) {
  if (config.apiDataSource !== 'postgres' || !config.databaseUrl) {
    return resolveActorFromFixtures(email);
  }

  const pool = getPool(config.databaseUrl);

  const result = await pool.query(
    `
      SELECT
        COALESCE(u.identity_subject, u.user_id::text) AS "userId",
        u.full_name AS "fullName",
        u.email AS "email",
        COALESCE(d.department_code, u.department_id::text) AS "departmentId",
        COALESCE(
          ARRAY_AGG(DISTINCT rp.permission_code) FILTER (WHERE rp.permission_code IS NOT NULL),
          ARRAY[]::text[]
        ) AS "permissions"
      FROM users u
      LEFT JOIN departments d ON d.department_id = u.department_id
      LEFT JOIN user_roles ur ON ur.user_id = u.user_id
      LEFT JOIN role_permissions rp ON rp.role_code = ur.role_code
      WHERE u.email = $1
        AND u.is_active = TRUE
      GROUP BY u.user_id, u.identity_subject, u.full_name, u.email, d.department_code, u.department_id
      LIMIT 1
    `,
    [email]
  );

  if (!result.rows[0]) {
    return null;
  }

  const row = result.rows[0];
  return {
    userId: row.userId,
    fullName: row.fullName,
    email: row.email,
    departmentId: row.departmentId,
    permissions: row.permissions,
  };
}

// Fallback for fixture mode (dev without postgres)
const FIXTURE_USERS = [
  { email: 'requester1@example.com', userId: 'requester-1', fullName: 'Nguyen Van A', departmentId: 'dep-a', permissions: [] },
  { email: 'requester2@example.com', userId: 'requester-2', fullName: 'Tran Thi B', departmentId: 'dep-b', permissions: [] },
  { email: 'approver1@example.com', userId: 'approver-1', fullName: 'Approver One', departmentId: 'dep-a', permissions: ['approve_request', 'view_department_requests'] },
  { email: 'approver2@example.com', userId: 'approver-2', fullName: 'Approver Two', departmentId: 'dep-b', permissions: ['approve_request', 'view_department_requests'] },
  { email: 'financeops@example.com', userId: 'finance-ops-1', fullName: 'Finance Operations', departmentId: 'dep-finance', permissions: ['view_finance_scoped', 'release_to_erp', 'hold_erp_sync', 'retry_erp_push'] },
  { email: 'sysadmin@example.com', userId: 'sys-admin', fullName: 'System Admin', departmentId: 'dep-finance', permissions: ['view_all_requests', 'approve_request', 'release_to_erp', 'hold_erp_sync', 'retry_erp_push'] },
  { email: 'ceo1@example.com', userId: 'ceo-1', fullName: 'Chief Executive Officer', departmentId: 'dep-finance', permissions: ['approve_request', 'view_department_requests'] },
];

function resolveActorFromFixtures(email) {
  return [...REGISTERED_FIXTURE_USERS, ...FIXTURE_USERS].find((u) => u.email === email) ?? null;
}

function mapDepartmentCodeToUuid(departmentId) {
  switch (departmentId) {
    case 'dep-a':
      return '10000000-0000-0000-0000-000000000001';
    case 'dep-b':
      return '10000000-0000-0000-0000-000000000002';
    case 'dep-finance':
      return '10000000-0000-0000-0000-000000000003';
    default:
      return null;
  }
}

function normalizeRoleCode(roleCode) {
  const allowedRoles = new Set(['staff', 'manager', 'director', 'finance_operations', 'admin']);
  return allowedRoles.has(roleCode) ? roleCode : 'staff';
}

function getPermissionsForRole(roleCode) {
  switch (roleCode) {
    case 'manager':
    case 'director':
      return ['approve_request', 'view_department_requests', 'create_request', 'edit_own_draft', 'submit_request', 'cancel_request'];
    case 'finance_operations':
      return ['view_finance_scoped', 'release_to_erp', 'hold_erp_sync', 'retry_erp_push'];
    case 'admin':
      return ['view_all_requests', 'approve_request', 'release_to_erp', 'hold_erp_sync', 'retry_erp_push', 'create_request', 'edit_own_draft', 'submit_request', 'cancel_request', 'manage_department_setup'];
    default:
      return ['create_request', 'edit_own_draft', 'submit_request', 'cancel_request'];
  }
}

function buildIdentitySubject(email) {
  const localPart = email.split('@')[0] ?? 'user';
  const normalized = localPart.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `local-${normalized}-${Date.now().toString(36)}`;
}

export async function registerActor(config, input) {
  const departmentId = mapDepartmentCodeToUuid(input.departmentId);
  if (!departmentId) {
    throw new Error('Department is not supported.');
  }

  const roleCode = normalizeRoleCode(input.roleCode);

  if (config.apiDataSource !== 'postgres' || !config.databaseUrl) {
    const existing = resolveActorFromFixtures(input.email);
    if (existing) {
      throw new Error('Email is already registered.');
    }

    const registered = {
      email: input.email,
      userId: buildIdentitySubject(input.email),
      fullName: input.fullName,
      departmentId: input.departmentId,
      permissions: getPermissionsForRole(roleCode),
    };

    REGISTERED_FIXTURE_USERS.unshift(registered);
    return registered;
  }

  const pool = getPool(config.databaseUrl);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const existingResult = await client.query(
      `SELECT user_id::text AS "userId" FROM users WHERE email = $1 LIMIT 1`,
      [input.email]
    );

    if (existingResult.rowCount > 0) {
      throw new Error('Email is already registered.');
    }

    const identitySubject = buildIdentitySubject(input.email);

    const insertedUser = await client.query(
      `
        INSERT INTO users (
          full_name,
          email,
          department_id,
          identity_subject,
          is_active
        )
        VALUES ($1, $2, $3::uuid, $4, TRUE)
        RETURNING user_id::text AS "userId"
      `,
      [input.fullName, input.email, departmentId, identitySubject]
    );

    await client.query(
      `
        INSERT INTO user_roles (
          user_id,
          role_code
        )
        VALUES ($1::uuid, $2)
      `,
      [insertedUser.rows[0].userId, roleCode]
    );

    await client.query('COMMIT');
    return resolveActorByEmail(config, input.email);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
