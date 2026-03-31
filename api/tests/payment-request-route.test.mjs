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

test('GET /api/payment-requests/:id returns 401 when actor headers are missing', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/payment-requests/req-related-only`);
    assert.equal(response.status, 401);
  });
});

test('GET /api/payment-requests/:id returns 403 for unrelated actor', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/payment-requests/req-related-only`, {
      headers: {
        'x-user-id': 'random-user',
        'x-user-department': 'dep-a',
        'x-user-permissions': 'view_department_requests',
      },
    });

    assert.equal(response.status, 403);
  });
});

test('GET /api/payment-requests/:id returns 200 for requester', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/payment-requests/req-related-only`, {
      headers: {
        'x-user-id': 'requester-1',
      },
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data.id, 'req-related-only');
    assert.deepEqual(
      (body.data.attachments ?? []).map((attachment) => attachment.id),
      ['att-related-invoice']
    );
  });
});

test('GET /api/payment-requests/:id returns 200 for finance in finance_shared mode', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/payment-requests/req-finance-shared`, {
      headers: {
        'x-user-id': 'finance-ops-1',
        'x-user-department': 'dep-finance',
        'x-user-permissions': 'view_finance_scoped,release_to_erp',
      },
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data.allowedActions?.releaseToErp, true);
  });
});

test('GET /api/payment-requests/:id masks sensitive fields for same-department viewer while keeping request visible', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/payment-requests/req-same-department`, {
      headers: {
        'x-user-id': 'random-user',
        'x-user-department': 'dep-a',
        'x-user-permissions': 'view_department_requests',
      },
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data.bankName, 'ACB');
    assert.equal(body.data.bankAccountNumber, '********4455');
    assert.equal(body.data.canViewBankDetails, false);
    assert.deepEqual(
      (body.data.attachments ?? []).map((attachment) => attachment.id),
      ['att-same-dept-invoice']
    );
  });
});

test('GET /api/payment-requests/:id returns 200 for finance after finance reject', async () => {
  await withServer(async (baseUrl) => {
    const rejectResponse = await fetch(`${baseUrl}/api/payment-requests/req-finance-shared/finance-reject`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'finance-ops-1',
        'x-user-department': 'dep-finance',
        'x-user-permissions': 'view_finance_scoped,release_to_erp,hold_erp_sync',
      },
      body: JSON.stringify({ note: 'Missing supporting documents.' }),
    });

    assert.equal(rejectResponse.status, 200);

    const response = await fetch(`${baseUrl}/api/payment-requests/req-finance-shared`, {
      headers: {
        'x-user-id': 'finance-ops-1',
        'x-user-department': 'dep-finance',
        'x-user-permissions': 'view_finance_scoped,release_to_erp,hold_erp_sync',
      },
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data.businessStatus, 'rejected');
  });
});

test('GET /api/payment-requests/:id returns allowed approve/reject actions for delegated approver', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/payment-requests/req-related-only`, {
      headers: {
        'x-user-id': 'delegate-1',
        'x-user-permissions': 'approve_request',
      },
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data.allowedActions?.approve, true);
    assert.equal(body.data.allowedActions?.reject, true);
  });
});

test('GET /api/payment-requests/:id returns 200 for admin with view_all_requests', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/payment-requests/req-related-only`, {
      headers: {
        'x-user-id': 'sys-admin',
        'x-user-permissions': 'view_all_requests',
      },
    });

    assert.equal(response.status, 200);
  });
});

test('GET /api/payment-requests/:id returns 200 for auditor with no mutation actions', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/payment-requests/req-related-only`, {
      headers: {
        'x-user-id': 'auditor-1',
        'x-user-permissions': 'view_all_requests,view_audit_entries',
      },
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data.allowedActions?.approve, false);
    assert.equal(body.data.allowedActions?.reject, false);
    assert.equal(body.data.allowedActions?.releaseToErp, false);
  });
});

test('GET /api/payment-requests/:id returns 404 for unknown request', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/payment-requests/req-missing`, {
      headers: {
        'x-user-id': 'sys-admin',
        'x-user-permissions': 'view_all_requests',
      },
    });

    assert.equal(response.status, 404);
  });
});
