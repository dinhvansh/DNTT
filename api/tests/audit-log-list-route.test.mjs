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

test('GET /api/audit-logs returns 403 for actor without audit permission', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/audit-logs`, {
      headers: {
        'x-user-id': 'requester-1',
      },
    });

    assert.equal(response.status, 403);
  });
});

test('GET /api/audit-logs returns config audit entries for admin after setup changes', async () => {
  await withServer(async (baseUrl) => {
    await fetch(`${baseUrl}/api/setup/departments/dep-a`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        ...adminHeaders(),
      },
      body: JSON.stringify({
        reviewerPositionCode: 'reviewer',
        hodPositionCode: 'hod',
        fallbackPositionCode: 'staff',
        stepOrder: ['reviewer', 'line_manager', 'hod'],
      }),
    });

    await fetch(`${baseUrl}/api/setup/global-approvers`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        ...adminHeaders(),
      },
      body: JSON.stringify({
        cfoPositionCode: 'cfo',
        ceoPositionCode: 'ceo',
        cfoAmountThreshold: 750000,
        ceoAmountThreshold: 1500000,
      }),
    });

    const response = await fetch(`${baseUrl}/api/audit-logs?entityType=department_approval_setup`, {
      headers: adminHeaders(),
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.total >= 1, true);
    assert.equal(body.data.some((entry) => entry.actionCode === 'update_department_approval_setup'), true);

    const globalResponse = await fetch(`${baseUrl}/api/audit-logs?entityType=global_approver_config`, {
      headers: adminHeaders(),
    });
    assert.equal(globalResponse.status, 200);
    const globalBody = await globalResponse.json();
    assert.equal(globalBody.data.some((entry) => entry.actionCode === 'update_global_approver_config'), true);
  });
});

test('GET /api/audit-logs returns request-scoped audit entries for auditor', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/audit-logs?entityType=payment_request&entityId=req-related-only`, {
      headers: {
        'x-user-id': 'auditor-1',
        'x-user-permissions': 'view_all_requests,view_audit_entries',
      },
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.total >= 1, true);
    assert.equal(body.data.every((entry) => entry.entityType === 'payment_request'), true);
  });
});
