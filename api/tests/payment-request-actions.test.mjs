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

test('POST /api/payment-requests/:id/approve returns 401 when actor headers are missing', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/payment-requests/req-related-only/approve`, {
      method: 'POST',
    });

    assert.equal(response.status, 401);
  });
});

test('POST /api/payment-requests/:id/submit returns 200 for requester draft', async () => {
  await withServer(async (baseUrl) => {
    const createResponse = await fetch(`${baseUrl}/api/payment-requests`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'requester-1',
        'x-user-permissions': 'submit_request',
      },
      body: JSON.stringify({
        departmentId: 'dep-a',
        payeeName: 'Draft Vendor',
        paymentType: 'Wire Transfer',
        currency: 'VND',
        totalAmount: 100000,
        priority: 'medium',
        reason: 'Draft for submit',
        visibilityMode: 'related_only',
        lineItems: [
          {
            description: 'Draft line',
            amount: 100000,
          },
        ],
      }),
    });
    const draft = await createResponse.json();

    const response = await fetch(`${baseUrl}/api/payment-requests/${draft.data.id}/submit`, {
      method: 'POST',
      headers: {
        'x-user-id': 'requester-1',
        'x-user-permissions': 'submit_request',
      },
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data.businessStatus, 'pending_approval');
    assert.deepEqual(body.data.currentStepApproverIds, ['approver-1']);
    assert.deepEqual(body.data.workflowUserIds, ['approver-1', 'approver-3', 'hod-1']);
  });
});

test('POST /api/payment-requests/:id/submit includes CFO and CEO at configured thresholds', async () => {
  await withServer(async (baseUrl) => {
    const createResponse = await fetch(`${baseUrl}/api/payment-requests`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'requester-1',
        'x-user-permissions': 'submit_request',
      },
      body: JSON.stringify({
        departmentId: 'dep-a',
        payeeName: 'High Value Vendor',
        paymentType: 'Wire Transfer',
        currency: 'VND',
        totalAmount: 1200000,
        priority: 'critical',
        reason: 'Threshold test',
        visibilityMode: 'related_only',
        lineItems: [
          {
            description: 'High value line',
            amount: 1200000,
          },
        ],
      }),
    });
    const draft = await createResponse.json();

    const response = await fetch(`${baseUrl}/api/payment-requests/${draft.data.id}/submit`, {
      method: 'POST',
      headers: {
        'x-user-id': 'requester-1',
        'x-user-permissions': 'submit_request',
      },
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.data.workflowUserIds, ['approver-1', 'approver-3', 'hod-1', 'cfo-1', 'ceo-1']);
    assert.deepEqual(body.data.currentStepApproverIds, ['approver-1']);
  });
});

test('POST /api/payment-requests/:id/submit deduplicates repeated approvers by keeping the highest step', async () => {
  await withServer(async (baseUrl) => {
    const createResponse = await fetch(`${baseUrl}/api/payment-requests`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'requester-2',
        'x-user-permissions': 'submit_request',
      },
      body: JSON.stringify({
        departmentId: 'dep-b',
        payeeName: 'Dedup Vendor',
        paymentType: 'Wire Transfer',
        currency: 'VND',
        totalAmount: 200000,
        priority: 'medium',
        reason: 'Dedup test',
        visibilityMode: 'related_only',
        lineItems: [
          {
            description: 'Dedup line',
            amount: 200000,
          },
        ],
      }),
    });
    const draft = await createResponse.json();

    const response = await fetch(`${baseUrl}/api/payment-requests/${draft.data.id}/submit`, {
      method: 'POST',
      headers: {
        'x-user-id': 'requester-2',
        'x-user-permissions': 'submit_request',
      },
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.data.workflowUserIds, ['approver-2']);
    assert.deepEqual(body.data.currentStepApproverIds, ['approver-2']);
  });
});

test('POST /api/payment-requests/:id/submit returns 403 for non-requester', async () => {
  await withServer(async (baseUrl) => {
    const createResponse = await fetch(`${baseUrl}/api/payment-requests`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'requester-1',
        'x-user-permissions': 'submit_request',
      },
      body: JSON.stringify({
        departmentId: 'dep-a',
        payeeName: 'Draft Vendor',
        paymentType: 'Wire Transfer',
        currency: 'VND',
        totalAmount: 100000,
        priority: 'medium',
        reason: 'Draft for submit',
        visibilityMode: 'related_only',
        lineItems: [
          {
            description: 'Draft line',
            amount: 100000,
          },
        ],
      }),
    });
    const draft = await createResponse.json();

    const response = await fetch(`${baseUrl}/api/payment-requests/${draft.data.id}/submit`, {
      method: 'POST',
      headers: {
        'x-user-id': 'approver-1',
        'x-user-permissions': 'submit_request,approve_request',
      },
    });

    assert.equal(response.status, 403);
  });
});

test('POST /api/payment-requests/:id/cancel returns 200 for requester draft', async () => {
  await withServer(async (baseUrl) => {
    const createResponse = await fetch(`${baseUrl}/api/payment-requests`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'requester-1',
        'x-user-permissions': 'create_request,edit_own_draft,submit_request,cancel_request',
      },
      body: JSON.stringify({
        departmentId: 'dep-a',
        payeeName: 'Cancelable Draft',
        paymentType: 'Wire Transfer',
        currency: 'VND',
        totalAmount: 50000,
        priority: 'medium',
        reason: 'Draft cancel test',
        visibilityMode: 'related_only',
        lineItems: [
          {
            description: 'Cancelable line',
            amount: 50000,
          },
        ],
      }),
    });
    const draft = await createResponse.json();

    const response = await fetch(`${baseUrl}/api/payment-requests/${draft.data.id}/cancel`, {
      method: 'POST',
      headers: {
        'x-user-id': 'requester-1',
        'x-user-permissions': 'cancel_request',
      },
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data.businessStatus, 'cancelled');
    assert.equal(body.data.allowedActions?.cancel, false);
  });
});

test('POST /api/payment-requests/:id/cancel returns 403 after submit', async () => {
  await withServer(async (baseUrl) => {
    const createResponse = await fetch(`${baseUrl}/api/payment-requests`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'requester-1',
        'x-user-permissions': 'create_request,edit_own_draft,submit_request,cancel_request',
      },
      body: JSON.stringify({
        departmentId: 'dep-a',
        payeeName: 'Submitted Request',
        paymentType: 'Wire Transfer',
        currency: 'VND',
        totalAmount: 50000,
        priority: 'medium',
        reason: 'Submitted cancel test',
        visibilityMode: 'related_only',
        lineItems: [
          {
            description: 'Submitted line',
            amount: 50000,
          },
        ],
      }),
    });
    const draft = await createResponse.json();

    await fetch(`${baseUrl}/api/payment-requests/${draft.data.id}/submit`, {
      method: 'POST',
      headers: {
        'x-user-id': 'requester-1',
        'x-user-permissions': 'submit_request',
      },
    });

    const response = await fetch(`${baseUrl}/api/payment-requests/${draft.data.id}/cancel`, {
      method: 'POST',
      headers: {
        'x-user-id': 'requester-1',
        'x-user-permissions': 'cancel_request',
      },
    });

    assert.equal(response.status, 403);
  });
});

test('POST /api/payment-requests/:id/cancel returns 403 for non-requester draft', async () => {
  await withServer(async (baseUrl) => {
    const createResponse = await fetch(`${baseUrl}/api/payment-requests`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'requester-1',
        'x-user-permissions': 'create_request,edit_own_draft,submit_request,cancel_request',
      },
      body: JSON.stringify({
        departmentId: 'dep-a',
        payeeName: 'Draft Ownership',
        paymentType: 'Wire Transfer',
        currency: 'VND',
        totalAmount: 50000,
        priority: 'medium',
        reason: 'Ownership cancel test',
        visibilityMode: 'related_only',
        lineItems: [
          {
            description: 'Ownership line',
            amount: 50000,
          },
        ],
      }),
    });
    const draft = await createResponse.json();

    const response = await fetch(`${baseUrl}/api/payment-requests/${draft.data.id}/cancel`, {
      method: 'POST',
      headers: {
        'x-user-id': 'approver-1',
        'x-user-permissions': 'cancel_request',
      },
    });

    assert.equal(response.status, 403);
  });
});

test('POST /api/payment-requests/:id/approve returns 202 for delegated approver', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/payment-requests/req-related-only/approve`, {
      method: 'POST',
      headers: {
        'x-user-id': 'delegate-1',
        'x-user-permissions': 'approve_request',
      },
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data.businessStatus, 'pending_approval');
    assert.deepEqual(body.data.currentStepApproverIds, ['approver-3']);
    assert.equal(body.data.allowedActions?.approve, false);
  });
});

test('POST /api/payment-requests/:id/approve returns 403 for actor without approval permission', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/payment-requests/req-related-only/approve`, {
      method: 'POST',
      headers: {
        'x-user-id': 'approver-1',
      },
    });

    assert.equal(response.status, 403);
  });
});

test('POST /api/payment-requests/:id/release-to-erp returns 202 for finance operations', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/payment-requests/req-finance-shared/release-to-erp`, {
      method: 'POST',
      headers: {
        'x-user-id': 'finance-ops-1',
        'x-user-permissions': 'release_to_erp',
      },
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data.erpSyncStatus, 'pending');
    assert.equal(body.data.allowedActions?.releaseToErp, false);
  });
});

test('POST /api/payment-requests/:id/release-to-erp returns 403 for business approver', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/payment-requests/req-finance-shared/release-to-erp`, {
      method: 'POST',
      headers: {
        'x-user-id': 'approver-2',
        'x-user-permissions': 'approve_request',
      },
    });

    assert.equal(response.status, 403);
  });
});

test('POST /api/payment-requests/:id/hold-erp-sync returns 200 for finance operations', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/payment-requests/req-finance-shared/hold-erp-sync`, {
      method: 'POST',
      headers: {
        'x-user-id': 'finance-ops-1',
        'x-user-permissions': 'hold_erp_sync',
      },
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data.erpSyncStatus, 'hold_by_finance');
    assert.equal(body.data.allowedActions?.holdSync, true);
  });
});

test('POST /api/payment-requests/:id/hold-erp-sync returns 403 for business approver', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/payment-requests/req-finance-shared/hold-erp-sync`, {
      method: 'POST',
      headers: {
        'x-user-id': 'approver-2',
        'x-user-permissions': 'approve_request',
      },
    });

    assert.equal(response.status, 403);
  });
});

test('POST /api/payment-requests/:id/approve marks final step request as approved', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/payment-requests/req-same-department/approve`, {
      method: 'POST',
      headers: {
        'x-user-id': 'approver-3',
        'x-user-permissions': 'approve_request',
      },
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data.businessStatus, 'approved');
    assert.equal(body.data.erpSyncStatus, 'waiting_finance_release');
    assert.deepEqual(body.data.currentStepApproverIds, []);
  });
});

test('POST /api/payment-requests/:id/approve walks the full configured chain before approval', async () => {
  await withServer(async (baseUrl) => {
    const createResponse = await fetch(`${baseUrl}/api/payment-requests`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'requester-1',
        'x-user-permissions': 'submit_request',
      },
      body: JSON.stringify({
        departmentId: 'dep-a',
        payeeName: 'Chain Vendor',
        paymentType: 'Wire Transfer',
        currency: 'VND',
        totalAmount: 650000,
        priority: 'high',
        reason: 'Chain walk test',
        visibilityMode: 'related_only',
        lineItems: [
          {
            description: 'Chain line',
            amount: 650000,
          },
        ],
      }),
    });
    const draft = await createResponse.json();

    await fetch(`${baseUrl}/api/payment-requests/${draft.data.id}/submit`, {
      method: 'POST',
      headers: {
        'x-user-id': 'requester-1',
        'x-user-permissions': 'submit_request',
      },
    });

    const lmApprove = await fetch(`${baseUrl}/api/payment-requests/${draft.data.id}/approve`, {
      method: 'POST',
      headers: {
        'x-user-id': 'approver-1',
        'x-user-permissions': 'approve_request',
      },
    });
    const lmBody = await lmApprove.json();
    assert.deepEqual(lmBody.data.currentStepApproverIds, ['approver-3']);

    const reviewerApprove = await fetch(`${baseUrl}/api/payment-requests/${draft.data.id}/approve`, {
      method: 'POST',
      headers: {
        'x-user-id': 'approver-3',
        'x-user-permissions': 'approve_request',
      },
    });
    const reviewerBody = await reviewerApprove.json();
    assert.deepEqual(reviewerBody.data.currentStepApproverIds, ['hod-1']);

    const hodApprove = await fetch(`${baseUrl}/api/payment-requests/${draft.data.id}/approve`, {
      method: 'POST',
      headers: {
        'x-user-id': 'hod-1',
        'x-user-permissions': 'approve_request',
      },
    });
    const hodBody = await hodApprove.json();
    assert.deepEqual(hodBody.data.currentStepApproverIds, ['cfo-1']);

    const cfoApprove = await fetch(`${baseUrl}/api/payment-requests/${draft.data.id}/approve`, {
      method: 'POST',
      headers: {
        'x-user-id': 'cfo-1',
        'x-user-permissions': 'approve_request',
      },
    });
    const cfoBody = await cfoApprove.json();
    assert.equal(cfoBody.data.businessStatus, 'approved');
    assert.equal(cfoBody.data.erpSyncStatus, 'waiting_finance_release');
    assert.deepEqual(cfoBody.data.currentStepApproverIds, []);
  });
});

test('POST /api/payment-requests/:id/reject returns 200 for delegated approver and closes request', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/payment-requests/req-related-only/reject`, {
      method: 'POST',
      headers: {
        'x-user-id': 'delegate-1',
        'x-user-permissions': 'approve_request',
      },
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data.businessStatus, 'rejected');
    assert.deepEqual(body.data.currentStepApproverIds, []);
    assert.equal(body.data.allowedActions?.reject, false);
  });
});

test('POST /api/payment-requests/:id/reject returns 403 for unrelated actor', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/payment-requests/req-related-only/reject`, {
      method: 'POST',
      headers: {
        'x-user-id': 'random-user',
        'x-user-permissions': 'approve_request',
      },
    });

    assert.equal(response.status, 403);
  });
});

test('POST /api/payment-requests/:id/return returns 200 for delegated approver', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/payment-requests/req-related-only/return`, {
      method: 'POST',
      headers: {
        'x-user-id': 'delegate-1',
        'x-user-permissions': 'approve_request',
      },
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data.businessStatus, 'returned');
    assert.deepEqual(body.data.currentStepApproverIds, []);
    assert.equal(body.data.allowedActions?.resubmit, false);
  });
});

test('POST /api/payment-requests/:id/return returns 403 for unrelated actor', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/payment-requests/req-related-only/return`, {
      method: 'POST',
      headers: {
        'x-user-id': 'requester-1',
      },
    });

    assert.equal(response.status, 403);
  });
});

test('POST /api/payment-requests/:id/resubmit returns 200 for requester after return', async () => {
  await withServer(async (baseUrl) => {
    await fetch(`${baseUrl}/api/payment-requests/req-related-only/return`, {
      method: 'POST',
      headers: {
        'x-user-id': 'delegate-1',
        'x-user-permissions': 'approve_request',
      },
    });

    const response = await fetch(`${baseUrl}/api/payment-requests/req-related-only/resubmit`, {
      method: 'POST',
      headers: {
        'x-user-id': 'requester-1',
      },
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data.businessStatus, 'pending_approval');
    assert.deepEqual(body.data.currentStepApproverIds, ['approver-1']);
  });
});

test('POST /api/payment-requests/:id/resubmit returns 403 for non-requester', async () => {
  await withServer(async (baseUrl) => {
    await fetch(`${baseUrl}/api/payment-requests/req-related-only/return`, {
      method: 'POST',
      headers: {
        'x-user-id': 'delegate-1',
        'x-user-permissions': 'approve_request',
      },
    });

    const response = await fetch(`${baseUrl}/api/payment-requests/req-related-only/resubmit`, {
      method: 'POST',
      headers: {
        'x-user-id': 'approver-1',
        'x-user-permissions': 'approve_request',
      },
    });

    assert.equal(response.status, 403);
  });
});
