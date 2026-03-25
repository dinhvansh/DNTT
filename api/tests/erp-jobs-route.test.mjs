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

test('GET /api/erp-jobs returns 401 when actor headers are missing', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/erp-jobs`);
    assert.equal(response.status, 401);
  });
});

test('GET /api/erp-jobs returns jobs for finance operations', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/erp-jobs`, {
      headers: {
        'x-user-id': 'finance-ops-1',
        'x-user-permissions': 'retry_erp_push,release_to_erp',
      },
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.total, 1);
    assert.equal(body.data[0].allowedActions?.retry, true);
  });
});

test('GET /api/erp-jobs returns 403 for requester', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/erp-jobs`, {
      headers: {
        'x-user-id': 'requester-1',
      },
    });

    assert.equal(response.status, 403);
  });
});

test('POST /api/erp-jobs/:id/retry returns 200 for finance operations', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/erp-jobs/job-fixture-failed-001/retry`, {
      method: 'POST',
      headers: {
        'x-user-id': 'finance-ops-1',
        'x-user-permissions': 'retry_erp_push',
      },
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data.status, 'pending');
    assert.equal(body.data.retryCount, 2);
  });
});

test('POST /api/erp-jobs/:id/retry returns 403 for actor without retry permission', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/erp-jobs/job-fixture-failed-001/retry`, {
      method: 'POST',
      headers: {
        'x-user-id': 'approver-1',
        'x-user-permissions': 'approve_request',
      },
    });

    assert.equal(response.status, 403);
  });
});
