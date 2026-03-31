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

test('GET /api/my-approvals returns 401 when actor headers are missing', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/my-approvals`);
    assert.equal(response.status, 401);
  });
});

test('GET /api/my-approvals returns delegated request for delegate approver', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/my-approvals`, {
      headers: {
        'x-user-id': 'delegate-1',
        'x-user-permissions': 'approve_request',
      },
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.data.map((entry) => entry.id), ['req-related-only']);
  });
});

test('GET /api/my-approvals returns direct current-step approval for approver', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/my-approvals`, {
      headers: {
        'x-user-id': 'approver-3',
        'x-user-permissions': 'approve_request',
      },
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.data.map((entry) => entry.id), ['req-same-department']);
  });
});

test('GET /api/my-approvals returns empty list for requester without approval permission', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/my-approvals`, {
      headers: {
        'x-user-id': 'requester-1',
      },
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.total, 0);
  });
});

test('GET /api/my-approvals keeps finance-rejected request visible for finance worklist', async () => {
  await withServer(async (baseUrl) => {
    const rejectResponse = await fetch(`${baseUrl}/api/payment-requests/req-finance-shared/finance-reject`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'finance-ops-1',
        'x-user-permissions': 'view_finance_scoped,release_to_erp,hold_erp_sync',
      },
      body: JSON.stringify({ note: 'Missing supporting documents.' }),
    });

    assert.equal(rejectResponse.status, 200);

    const inboxResponse = await fetch(`${baseUrl}/api/my-approvals`, {
      headers: {
        'x-user-id': 'finance-ops-1',
        'x-user-permissions': 'view_finance_scoped,release_to_erp,hold_erp_sync',
      },
    });

    assert.equal(inboxResponse.status, 200);
    const body = await inboxResponse.json();
    assert.ok(body.data.some((entry) => entry.id === 'req-finance-shared'));
  });
});
