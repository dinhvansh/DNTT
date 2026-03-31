import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from '../src/server.mjs';

async function withServer(run) {
  const server = createServer();
  server.listen(0);
  await once(server, 'listening');
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await run(baseUrl);
  } finally {
    server.close();
    await once(server, 'close');
  }
}

function adminHeaders() {
  return {
    'x-user-id': 'sys-admin',
    'x-user-department': 'dep-finance',
    'x-user-permissions': 'view_all_requests,approve_request,release_to_erp,hold_erp_sync,retry_erp_push,create_request,edit_own_draft,submit_request,cancel_request,manage_department_setup',
  };
}

test('GET /api/setup/master-data returns 403 for non-admin actor', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/setup/master-data`, {
      headers: {
        'x-user-id': 'requester-1',
      },
    });

    assert.equal(response.status, 403);
  });
});

test('GET /api/setup/master-data returns users, departments, and roles for admin', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/setup/master-data`, {
      headers: adminHeaders(),
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(Array.isArray(body.data.users), true);
    assert.equal(Array.isArray(body.data.departments), true);
    assert.equal(Array.isArray(body.data.roles), true);
  });
});

test('GET /api/erp-reference-data returns active reference values for authenticated requester', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/erp-reference-data`, {
      headers: {
        'x-user-id': 'requester-1',
      },
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.total > 0, true);
    assert.equal(body.data.some((entry) => entry.referenceType === 'expense_type'), true);
    assert.equal(body.data.some((entry) => entry.referenceType === 'gl_account'), true);
  });
});

test('POST /api/setup/erp-reference-data/sync upserts reference values for admin', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/setup/erp-reference-data/sync`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...adminHeaders(),
      },
      body: JSON.stringify({
        referenceType: 'expense_type',
        values: [
          {
            referenceType: 'expense_type',
            code: 'software_license',
            name: 'Software License',
            isActive: true,
            syncSource: 'manual',
          },
        ],
      }),
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data.referenceType, 'expense_type');
    assert.equal(body.data.recordsUpserted, 1);
  });
});

test('GET /api/setup/erp-reference-sync-runs returns recent sync history for admin', async () => {
  await withServer(async (baseUrl) => {
    await fetch(`${baseUrl}/api/setup/erp-reference-data/sync`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...adminHeaders(),
      },
      body: JSON.stringify({
        referenceType: 'expense_type',
        values: [
          {
            referenceType: 'expense_type',
            code: 'temporary_service',
            name: 'Temporary Service',
            isActive: true,
            syncSource: 'manual',
          },
        ],
      }),
    });

    const response = await fetch(`${baseUrl}/api/setup/erp-reference-sync-runs`, {
      headers: adminHeaders(),
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.total > 0, true);
    assert.equal(body.data[0].status, 'success');
    assert.equal(body.data[0].triggeredByName, 'System Admin');
  });
});

test('POST /api/setup/users creates a managed user for admin', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/setup/users`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...adminHeaders(),
      },
      body: JSON.stringify({
        fullName: 'Managed User',
        email: 'managed.user@example.com',
        departmentId: 'dep-a',
        positionCode: 'staff',
        lineManagerId: 'approver-1',
        roleCode: 'staff',
      }),
    });

    assert.equal(response.status, 201);
    const body = await response.json();
    assert.equal(body.data.email, 'managed.user@example.com');
    assert.equal(body.data.positionCode, 'staff');
    assert.equal(body.data.lineManagerId, 'approver-1');
  });
});

test('POST /api/setup/departments creates a department for admin', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/setup/departments`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...adminHeaders(),
      },
      body: JSON.stringify({
        code: 'dep-legal',
        name: 'Legal Department',
      }),
    });

    assert.equal(response.status, 201);
    const body = await response.json();
    assert.equal(body.data.code, 'dep-legal');
    assert.equal(body.data.name, 'Legal Department');
  });
});

test('POST /api/setup/positions creates a position for admin', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/setup/positions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...adminHeaders(),
      },
      body: JSON.stringify({
        code: 'senior_manager',
        name: 'Senior Manager',
        isGlobal: false,
      }),
    });

    assert.equal(response.status, 201);
    const body = await response.json();
    assert.equal(body.data.code, 'senior_manager');
    assert.equal(body.data.name, 'Senior Manager');
    assert.equal(body.data.isGlobal, false);
  });
});

test('PUT /api/setup/master-data/departments/:code updates department name and active status', async () => {
  await withServer(async (baseUrl) => {
    await fetch(`${baseUrl}/api/setup/departments`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...adminHeaders(),
      },
      body: JSON.stringify({
        code: 'dep-temp',
        name: 'Temporary Department',
      }),
    });

    const response = await fetch(`${baseUrl}/api/setup/master-data/departments/dep-temp`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        ...adminHeaders(),
      },
      body: JSON.stringify({
        name: 'Temporary Department Updated',
        isActive: false,
      }),
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data.name, 'Temporary Department Updated');
    assert.equal(body.data.isActive, false);
  });
});

test('PUT /api/setup/master-data/positions/:code updates position name and active status', async () => {
  await withServer(async (baseUrl) => {
    await fetch(`${baseUrl}/api/setup/positions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...adminHeaders(),
      },
      body: JSON.stringify({
        code: 'ops_specialist',
        name: 'Ops Specialist',
        isGlobal: false,
      }),
    });

    const response = await fetch(`${baseUrl}/api/setup/master-data/positions/ops_specialist`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        ...adminHeaders(),
      },
      body: JSON.stringify({
        name: 'Operations Specialist',
        isGlobal: true,
        isActive: false,
      }),
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data.name, 'Operations Specialist');
    assert.equal(body.data.isGlobal, true);
    assert.equal(body.data.isActive, false);
  });
});

test('DELETE /api/setup/master-data/departments/:code deletes unused department', async () => {
  await withServer(async (baseUrl) => {
    await fetch(`${baseUrl}/api/setup/departments`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...adminHeaders(),
      },
      body: JSON.stringify({
        code: 'dep-unused',
        name: 'Unused Department',
      }),
    });

    const response = await fetch(`${baseUrl}/api/setup/master-data/departments/dep-unused`, {
      method: 'DELETE',
      headers: adminHeaders(),
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.success, true);
  });
});

test('DELETE /api/setup/master-data/departments/:code rejects department still in use', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/setup/master-data/departments/dep-a`, {
      method: 'DELETE',
      headers: adminHeaders(),
    });

    assert.equal(response.status, 409);
  });
});

test('DELETE /api/setup/master-data/positions/:code deletes unused position', async () => {
  await withServer(async (baseUrl) => {
    await fetch(`${baseUrl}/api/setup/positions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...adminHeaders(),
      },
      body: JSON.stringify({
        code: 'unused_position',
        name: 'Unused Position',
        isGlobal: false,
      }),
    });

    const response = await fetch(`${baseUrl}/api/setup/master-data/positions/unused_position`, {
      method: 'DELETE',
      headers: adminHeaders(),
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.success, true);
  });
});

test('DELETE /api/setup/master-data/positions/:code rejects position still in use', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/setup/master-data/positions/staff`, {
      method: 'DELETE',
      headers: adminHeaders(),
    });

    assert.equal(response.status, 409);
  });
});

test('POST /api/setup/users works for a newly created department', async () => {
  await withServer(async (baseUrl) => {
    const createDepartmentResponse = await fetch(`${baseUrl}/api/setup/departments`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...adminHeaders(),
      },
      body: JSON.stringify({
        code: 'dep-procurement',
        name: 'Procurement Department',
      }),
    });

    assert.equal(createDepartmentResponse.status, 201);

    const response = await fetch(`${baseUrl}/api/setup/users`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...adminHeaders(),
      },
      body: JSON.stringify({
        fullName: 'Procurement Staff',
        email: 'proc.staff@example.com',
        departmentId: 'dep-procurement',
        positionCode: 'staff',
        lineManagerId: 'approver-1',
        roleCode: 'staff',
      }),
    });

    assert.equal(response.status, 201);
    const body = await response.json();
    assert.equal(body.data.departmentId, 'dep-procurement');
    assert.equal(body.data.email, 'proc.staff@example.com');
  });
});

test('PUT /api/setup/users/:id updates line manager and role for admin', async () => {
  await withServer(async (baseUrl) => {
    const createResponse = await fetch(`${baseUrl}/api/setup/users`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...adminHeaders(),
      },
      body: JSON.stringify({
        fullName: 'Editable User',
        email: 'editable.user@example.com',
        departmentId: 'dep-a',
        positionCode: 'staff',
        lineManagerId: 'approver-1',
        roleCode: 'staff',
      }),
    });
    const created = await createResponse.json();

    const response = await fetch(`${baseUrl}/api/setup/users/${created.data.id}`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        ...adminHeaders(),
      },
      body: JSON.stringify({
        fullName: 'Editable User Updated',
        departmentId: 'dep-finance',
        positionCode: 'auditor',
        lineManagerId: null,
        roleCode: 'auditor',
        isActive: true,
      }),
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data.fullName, 'Editable User Updated');
    assert.equal(body.data.departmentId, 'dep-finance');
    assert.equal(body.data.positionCode, 'auditor');
    assert.equal(body.data.roleCode, 'auditor');
  });
});

test('DELETE /api/setup/users/:id deletes managed user for admin', async () => {
  await withServer(async (baseUrl) => {
    const createResponse = await fetch(`${baseUrl}/api/setup/users`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...adminHeaders(),
      },
      body: JSON.stringify({
        fullName: 'Delete Me',
        email: 'delete.me@example.com',
        departmentId: 'dep-a',
        positionCode: 'staff',
        lineManagerId: 'approver-1',
        roleCode: 'staff',
      }),
    });
    const created = await createResponse.json();

    const response = await fetch(`${baseUrl}/api/setup/users/${created.data.id}`, {
      method: 'DELETE',
      headers: adminHeaders(),
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.success, true);
  });
});
