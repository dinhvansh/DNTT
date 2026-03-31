import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from '../src/server.mjs';

function createAttachmentRepository() {
  const requests = [
    {
      id: 'req-attachment-test',
      requestNo: 'PR-2026-TEST',
      requesterId: 'requester-1',
      requesterName: 'Requester One',
      departmentId: 'dep-a',
      requestType: 'payment_request',
      payeeName: 'Vendor Test',
      paymentType: 'Wire Transfer',
      totalAmount: 1234,
      currency: 'VND',
      priority: 'medium',
      visibilityMode: 'related_and_same_department',
      businessStatus: 'draft',
      erpSyncStatus: 'not_ready',
      createdAt: '2026-03-27T00:00:00.000Z',
      workflowUserIds: [],
      currentStepApproverIds: [],
      details: [],
      workflowSteps: [],
      attachments: [
        {
          id: 'att-1',
          attachmentType: 'invoice',
          fileName: 'invoice.pdf',
          filePath: 'minio://payment-request/attachments/2026-03-27/invoice.pdf',
          fileSize: 12,
          uploadedAt: '2026-03-27T00:00:00.000Z',
        },
      ],
    },
    {
      id: 'req-finance-sensitive',
      requestNo: 'PR-2026-FIN',
      requesterId: 'requester-2',
      requesterName: 'Requester Two',
      departmentId: 'dep-b',
      requestType: 'payment_request',
      payeeName: 'Vendor Finance',
      paymentType: 'Wire Transfer',
      totalAmount: 9999,
      currency: 'VND',
      priority: 'high',
      visibilityMode: 'finance_shared',
      businessStatus: 'approved',
      erpSyncStatus: 'waiting_finance_release',
      createdAt: '2026-03-27T00:00:00.000Z',
      workflowUserIds: [],
      currentStepApproverIds: [],
      details: [],
      workflowSteps: [],
      attachments: [
        {
          id: 'att-2',
          attachmentType: 'bank_proof',
          fileName: 'bank-proof.pdf',
          filePath: 'minio://payment-request/attachments/2026-03-27/bank-proof.pdf',
          fileSize: 12,
          uploadedAt: '2026-03-27T00:00:00.000Z',
        },
      ],
    },
  ];

  return {
    async getAttachmentById(attachmentId) {
      for (const request of requests) {
        const attachment = request.attachments.find((entry) => entry.id === attachmentId);
        if (attachment) {
          return { ...attachment, requestId: request.id };
        }
      }
      return null;
    },
    async getPaymentRequestById(requestId) {
      return requests.find((entry) => entry.id === requestId) ?? null;
    },
    async listDelegations() {
      return [];
    },
  };
}

async function withServer(run) {
  const repository = createAttachmentRepository();
  const storage = {
    async uploadAttachmentBinary() {
      throw new Error('Not used in this test.');
    },
    async getAttachmentBinary() {
      return {
        data: Buffer.from('pdf-bytes'),
        contentType: 'application/pdf',
      };
    },
  };

  const server = createServer({ repository, storage });
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

test('GET /api/attachments/:id/content returns 401 when actor headers are missing', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/attachments/att-1/content`);
    assert.equal(response.status, 401);
  });
});

test('GET /api/attachments/:id/content returns 403 for unrelated actor', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/attachments/att-1/content`, {
      headers: {
        'x-user-id': 'random-user',
        'x-user-department': 'dep-b',
      },
    });

    assert.equal(response.status, 403);
  });
});

test('GET /api/attachments/:id/content returns binary for requester', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/attachments/att-1/content`, {
      headers: {
        'x-user-id': 'requester-1',
        'x-user-department': 'dep-a',
      },
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'application/pdf');
    const body = await response.text();
    assert.equal(body, 'pdf-bytes');
  });
});

test('GET /api/attachments/:id/content allows same-department viewer to access standard attachment', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/attachments/att-1/content`, {
      headers: {
        'x-user-id': 'same-department-user',
        'x-user-department': 'dep-a',
        'x-user-permissions': 'view_department_requests',
      },
    });

    assert.equal(response.status, 200);
  });
});

test('GET /api/attachments/:id/content blocks same-department viewer from sensitive attachment', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/attachments/att-2/content`, {
      headers: {
        'x-user-id': 'same-department-user',
        'x-user-department': 'dep-a',
        'x-user-permissions': 'view_department_requests',
      },
    });

    assert.equal(response.status, 403);
  });
});

test('GET /api/attachments/:id/content allows finance user to access sensitive attachment', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/attachments/att-2/content`, {
      headers: {
        'x-user-id': 'finance-ops-1',
        'x-user-department': 'dep-finance',
        'x-user-permissions': 'view_finance_scoped,release_to_erp',
      },
    });

    assert.equal(response.status, 200);
  });
});
