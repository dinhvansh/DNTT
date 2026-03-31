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

test('GET /api/finance-release-queue returns 401 when actor headers are missing', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/finance-release-queue`);
    assert.equal(response.status, 401);
  });
});

test('GET /api/finance-release-queue returns approved waiting-finance records for finance operations', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/finance-release-queue`, {
      headers: {
        'x-user-id': 'finance-ops-1',
        'x-user-permissions': 'release_to_erp,hold_erp_sync',
      },
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.data.map((entry) => entry.id), ['req-finance-shared']);
    assert.equal(body.data[0].erpReadinessSummary.isReady, false);
    assert.match(body.data[0].erpReadinessSummary.firstErrorMessage, /detail line/i);
  });
});

test('GET /api/finance-release-queue returns 403 for requester', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/finance-release-queue`, {
      headers: {
        'x-user-id': 'requester-1',
      },
    });

    assert.equal(response.status, 403);
  });
});
