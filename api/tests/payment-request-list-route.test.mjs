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

test('GET /api/payment-requests returns 401 when actor headers are missing', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/payment-requests`);
    assert.equal(response.status, 401);
  });
});

test('GET /api/payment-requests returns only related requests for requester', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/payment-requests`, {
      headers: {
        'x-user-id': 'requester-1',
      },
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.total, 1);
    assert.deepEqual(body.data.map((entry) => entry.id), ['req-related-only']);
  });
});

test('GET /api/payment-requests includes same-department records when allowed by visibility and permission', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/payment-requests`, {
      headers: {
        'x-user-id': 'department-member',
        'x-user-department': 'dep-a',
        'x-user-permissions': 'view_department_requests',
      },
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.data.map((entry) => entry.id), ['req-same-department']);
  });
});

test('GET /api/payment-requests includes finance shared records for finance scope actor', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/payment-requests`, {
      headers: {
        'x-user-id': 'finance-ops-1',
        'x-user-permissions': 'view_finance_scoped,release_to_erp',
      },
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.data.map((entry) => entry.id), ['req-finance-shared']);
  });
});

test('GET /api/payment-requests returns all records for admin', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/payment-requests`, {
      headers: {
        'x-user-id': 'sys-admin',
        'x-user-permissions': 'view_all_requests',
      },
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.total, 3);
  });
});
