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

test('GET /api/payment-requests/:id/audit-logs returns 401 when actor headers are missing', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/payment-requests/req-related-only/audit-logs`);
    assert.equal(response.status, 401);
  });
});

test('GET /api/payment-requests/:id/audit-logs returns entries for requester who can view the request', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/payment-requests/req-related-only/audit-logs`, {
      headers: {
        'x-user-id': 'requester-1',
      },
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.ok(body.data.length > 0);
  });
});

test('GET /api/payment-requests/:id/audit-logs returns entries for auditor', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/payment-requests/req-related-only/audit-logs`, {
      headers: {
        'x-user-id': 'auditor-1',
        'x-user-permissions': 'view_all_requests,view_audit_entries',
      },
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.total >= 1, true);
    assert.equal(body.data[0].actionCode.length > 0, true);
  });
});

test('GET /api/payment-requests/:id/audit-logs includes create and submit events for new request', async () => {
  await withServer(async (baseUrl) => {
    const createResponse = await fetch(`${baseUrl}/api/payment-requests`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'requester-1',
        'x-user-permissions': 'create_request,submit_request',
      },
      body: JSON.stringify({
        departmentId: 'dep-a',
        payeeName: 'Audit Vendor',
        paymentType: 'Wire Transfer',
        currency: 'VND',
        totalAmount: 100000,
        priority: 'medium',
        reason: 'Audit route test',
        visibilityMode: 'related_only',
        lineItems: [
          {
            description: 'Audit line',
            amount: 100000,
          },
        ],
      }),
    });
    const created = await createResponse.json();

    await fetch(`${baseUrl}/api/payment-requests/${created.data.id}/submit`, {
      method: 'POST',
      headers: {
        'x-user-id': 'requester-1',
        'x-user-permissions': 'submit_request',
      },
    });

    const response = await fetch(`${baseUrl}/api/payment-requests/${created.data.id}/audit-logs`, {
      headers: {
        'x-user-id': 'auditor-1',
        'x-user-permissions': 'view_all_requests,view_audit_entries',
      },
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    const actionCodes = body.data.map((entry) => entry.actionCode);
    assert.equal(actionCodes.includes('create_request'), true);
    assert.equal(actionCodes.includes('submit_request'), true);
  });
});
