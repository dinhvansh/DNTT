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

function buildPayload() {
  return {
    departmentId: 'dep-a',
    payeeName: 'New Vendor Co',
    paymentType: 'Wire Transfer',
    currency: 'VND',
    totalAmount: 250000,
    priority: 'high',
    reason: 'Quarterly payment',
    visibilityMode: 'related_only',
    lineItems: [
      {
        description: 'Infrastructure service',
        glCode: '6100-IT',
        amount: 250000,
      },
    ],
    attachments: [
      {
        attachmentType: 'invoice',
        fileName: 'invoice-q1.pdf',
        filePath: 'local-upload/invoice-q1.pdf',
        fileSize: 204800,
      },
    ],
  };
}

test('POST /api/payment-requests returns 401 when actor headers are missing', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/payment-requests`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(buildPayload()),
    });

    assert.equal(response.status, 401);
  });
});

test('POST /api/payment-requests returns 400 for invalid payload', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/payment-requests`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'requester-1',
        'x-user-permissions': 'submit_request',
      },
      body: JSON.stringify({ payeeName: 'Missing fields' }),
    });

    assert.equal(response.status, 400);
  });
});

test('POST /api/payment-requests creates a new request for actor', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/payment-requests`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'requester-1',
        'x-user-permissions': 'submit_request',
      },
      body: JSON.stringify(buildPayload()),
    });

    assert.equal(response.status, 201);
    const body = await response.json();
    assert.equal(body.data.requesterId, 'requester-1');
    assert.equal(body.data.payeeName, 'New Vendor Co');
    assert.equal(body.data.businessStatus, 'draft');
    assert.equal(body.data.attachments.length, 1);
    assert.equal(body.data.attachments[0].fileName, 'invoice-q1.pdf');
  });
});

test('POST /api/payment-requests returns 400 for invalid attachment metadata', async () => {
  await withServer(async (baseUrl) => {
    const payload = buildPayload();
    payload.attachments = [
      {
        attachmentType: 'invoice',
        fileName: '',
        filePath: 'local-upload/bad.pdf',
        fileSize: -1,
      },
    ];

    const response = await fetch(`${baseUrl}/api/payment-requests`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'requester-1',
        'x-user-permissions': 'submit_request',
      },
      body: JSON.stringify(payload),
    });

    assert.equal(response.status, 400);
    const body = await response.json();
    assert.match(body.details.join(' '), /attachments\[0\]\.fileName/);
    assert.match(body.details.join(' '), /attachments\[0\]\.fileSize/);
  });
});

test('POST /api/payment-requests returns 403 when actor creates request for another department', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/payment-requests`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'requester-1',
        'x-user-department': 'dep-b',
        'x-user-permissions': 'submit_request',
      },
      body: JSON.stringify(buildPayload()),
    });

    assert.equal(response.status, 403);
  });
});
