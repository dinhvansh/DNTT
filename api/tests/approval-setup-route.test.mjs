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

function staffHeaders() {
  return {
    'x-user-id': 'requester-1',
    'x-user-department': 'dep-a',
    'x-user-permissions': 'create_request,edit_own_draft,submit_request,cancel_request',
  };
}

test('GET /api/setup/approval returns 403 for non-admin actor', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/setup/approval`, {
      headers: staffHeaders(),
    });

    assert.equal(response.status, 403);
  });
});

test('GET /api/setup/approval returns departments, users, and global config for admin', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/setup/approval`, {
      headers: adminHeaders(),
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(Array.isArray(body.data.departments), true);
    assert.equal(Array.isArray(body.data.users), true);
    assert.equal(body.data.globalConfig.companyCode, 'default');
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
        code: 'dep-uat',
        name: 'UAT Department',
      }),
    });

    assert.equal(response.status, 201);
    const body = await response.json();
    assert.equal(body.data.code, 'dep-uat');
    assert.equal(body.data.name, 'UAT Department');
  });
});

test('PUT /api/setup/departments/:code updates reviewer and hod for admin', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/setup/departments/dep-a`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        ...adminHeaders(),
      },
      body: JSON.stringify({
        reviewerUserId: 'approver-1',
        hodUserId: 'hod-1',
        fallbackUserId: 'delegate-1',
      }),
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data.code, 'dep-a');
    assert.equal(body.data.setup.reviewerUserId, 'approver-1');
    assert.equal(body.data.setup.hodUserId, 'hod-1');
    assert.equal(body.data.setup.fallbackUserId, 'delegate-1');
  });
});

test('PUT /api/setup/global-approvers rejects inverted thresholds', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/setup/global-approvers`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        ...adminHeaders(),
      },
      body: JSON.stringify({
        cfoUserId: 'cfo-1',
        ceoUserId: 'ceo-1',
        cfoAmountThreshold: 1000000,
        ceoAmountThreshold: 500000,
      }),
    });

    assert.equal(response.status, 400);
  });
});

test('PUT /api/setup/global-approvers updates CFO and CEO config for admin', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/setup/global-approvers`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        ...adminHeaders(),
      },
      body: JSON.stringify({
        cfoUserId: 'cfo-1',
        ceoUserId: 'ceo-1',
        cfoAmountThreshold: 750000,
        ceoAmountThreshold: 1500000,
      }),
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data.cfoAmountThreshold, 750000);
    assert.equal(body.data.ceoAmountThreshold, 1500000);
  });
});
