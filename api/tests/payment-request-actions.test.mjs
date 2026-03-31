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

test('POST /api/payment-requests/:id/submit skips self-approval when requester is line manager', async () => {
  await withServer(async (baseUrl) => {
    const createUser = await fetch(`${baseUrl}/api/setup/users`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'sys-admin',
        'x-user-permissions': 'manage_department_setup',
      },
      body: JSON.stringify({
        fullName: 'Requester Line Manager',
        email: 'requester.lm@example.com',
        departmentId: 'dep-a',
        positionCode: 'line_manager',
        lineManagerId: null,
        roleCode: 'manager',
      }),
    });
    const createdUser = await createUser.json();

    await fetch(`${baseUrl}/api/setup/users/${createdUser.data.id}`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'sys-admin',
        'x-user-permissions': 'manage_department_setup',
      },
      body: JSON.stringify({
        fullName: 'Requester Line Manager',
        departmentId: 'dep-a',
        positionCode: 'line_manager',
        lineManagerId: createdUser.data.id,
        roleCode: 'manager',
        isActive: true,
      }),
    });

    const draft = await fetch(`${baseUrl}/api/payment-requests`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-user-id': createdUser.data.id,
        'x-user-permissions': 'create_request,submit_request',
      },
      body: JSON.stringify({
        payeeName: 'Self Approval Skip LM',
        paymentType: 'Wire Transfer',
        currency: 'VND',
        totalAmount: 120000,
        priority: 'medium',
        reason: 'Line manager requester should not self-approve.',
        visibilityMode: 'related_only',
        lineItems: [
          {
            description: 'Service Fee',
            glCode: '6100-IT',
            amount: 120000,
            remark: 'ERP Expense Type: service_fee | ERP Cost Center: CC-OPS | ERP Project: PRJ-DNTT',
          },
        ],
      }),
    });
    const draftBody = await draft.json();

    const submitResponse = await fetch(`${baseUrl}/api/payment-requests/${draftBody.data.id}/submit`, {
      method: 'POST',
      headers: {
        'x-user-id': createdUser.data.id,
        'x-user-permissions': 'create_request,submit_request',
      },
    });

    assert.equal(submitResponse.status, 200);
    const body = await submitResponse.json();
    assert.deepEqual(body.data.workflowUserIds, ['approver-3', 'hod-1']);
  });
});

test('POST /api/payment-requests/:id/submit skips self-approval when requester is HOD', async () => {
  await withServer(async (baseUrl) => {
    const draft = await fetch(`${baseUrl}/api/payment-requests`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'hod-1',
        'x-user-permissions': 'create_request,submit_request',
      },
      body: JSON.stringify({
        payeeName: 'Self Approval Skip HOD',
        paymentType: 'Wire Transfer',
        currency: 'VND',
        totalAmount: 120000,
        priority: 'medium',
        reason: 'HOD requester should not self-approve.',
        visibilityMode: 'related_only',
        lineItems: [
          {
            description: 'Service Fee',
            glCode: '6100-IT',
            amount: 120000,
            remark: 'ERP Expense Type: service_fee | ERP Cost Center: CC-OPS | ERP Project: PRJ-DNTT',
          },
        ],
      }),
    });
    const draftBody = await draft.json();

    const submitResponse = await fetch(`${baseUrl}/api/payment-requests/${draftBody.data.id}/submit`, {
      method: 'POST',
      headers: {
        'x-user-id': 'hod-1',
        'x-user-permissions': 'create_request,submit_request',
      },
    });

    assert.equal(submitResponse.status, 200);
    const body = await submitResponse.json();
    assert.deepEqual(body.data.workflowUserIds, ['approver-3']);
  });
});

test('POST /api/payment-requests/preview-workflow returns default chain and eligible line manager overrides', async () => {
  await withServer(async (baseUrl) => {
    const createUser = await fetch(`${baseUrl}/api/setup/users`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'sys-admin',
        'x-user-permissions': 'manage_department_setup',
      },
      body: JSON.stringify({
        fullName: 'Override Manager',
        email: 'override.manager@example.com',
        departmentId: 'dep-a',
        positionCode: 'line_manager',
        lineManagerId: null,
        roleCode: 'manager',
      }),
    });
    assert.equal(createUser.status, 201);

    const response = await fetch(`${baseUrl}/api/payment-requests/preview-workflow`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'requester-1',
        'x-user-permissions': 'create_request,submit_request',
      },
      body: JSON.stringify({
        totalAmount: 120000,
      }),
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(
      body.data.steps.map((entry) => entry.stepCode),
      ['line_manager', 'reviewer', 'hod']
    );
    assert.equal(body.data.lineManagerOverride.defaultApproverId, 'approver-1');
    assert.equal(
      body.data.lineManagerOverride.candidates.some((entry) => entry.approverId === 'approver-1'),
      false
    );
    assert.equal(
      body.data.lineManagerOverride.candidates.some((entry) => entry.approverName === 'Override Manager'),
      true
    );
  });
});

test('POST /api/payment-requests/:id/submit applies line manager override and removes original approver from chain', async () => {
  await withServer(async (baseUrl) => {
    const createUser = await fetch(`${baseUrl}/api/setup/users`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'sys-admin',
        'x-user-permissions': 'manage_department_setup',
      },
      body: JSON.stringify({
        fullName: 'Override Manager',
        email: 'override.manager@example.com',
        departmentId: 'dep-a',
        positionCode: 'line_manager',
        lineManagerId: null,
        roleCode: 'manager',
      }),
    });
    const createdUser = await createUser.json();

    const createResponse = await fetch(`${baseUrl}/api/payment-requests`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'requester-1',
        'x-user-permissions': 'submit_request',
      },
      body: JSON.stringify({
        payeeName: 'Override Vendor',
        paymentType: 'Wire Transfer',
        currency: 'VND',
        totalAmount: 100000,
        priority: 'medium',
        reason: 'Line manager override test',
        visibilityMode: 'related_only',
        lineItems: [
          {
            description: 'Service Fee',
            glCode: '6100-IT',
            amount: 100000,
            remark: 'ERP Expense Type: service_fee | ERP Cost Center: CC-OPS | ERP Project: PRJ-DNTT',
          },
        ],
      }),
    });
    const draft = await createResponse.json();

    const response = await fetch(`${baseUrl}/api/payment-requests/${draft.data.id}/submit`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'requester-1',
        'x-user-permissions': 'submit_request',
      },
      body: JSON.stringify({
        lineManagerOverrideId: createdUser.data.id,
        lineManagerOverrideReason: 'Direct sponsor should review this request.',
      }),
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.data.workflowUserIds, [createdUser.data.id, 'approver-3', 'hod-1']);
    assert.equal(body.data.workflowUserIds.includes('approver-1'), false);
    assert.deepEqual(body.data.currentStepApproverIds, [createdUser.data.id]);
  });
});

test('POST /api/payment-requests/:id/submit skips reviewer when requester is the reviewer', async () => {
  await withServer(async (baseUrl) => {
    const createResponse = await fetch(`${baseUrl}/api/payment-requests`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'approver-3',
        'x-user-permissions': 'create_request,submit_request',
      },
      body: JSON.stringify({
        payeeName: 'Reviewer Self Skip Vendor',
        paymentType: 'Wire Transfer',
        currency: 'VND',
        totalAmount: 120000,
        priority: 'medium',
        reason: 'Reviewer requester should not self-approve.',
        visibilityMode: 'related_only',
        lineItems: [
          {
            description: 'Service Fee',
            glCode: '6100-IT',
            amount: 120000,
            remark: 'ERP Expense Type: service_fee | ERP Cost Center: CC-OPS | ERP Project: PRJ-DNTT',
          },
        ],
      }),
    });
    const draft = await createResponse.json();

    const response = await fetch(`${baseUrl}/api/payment-requests/${draft.data.id}/submit`, {
      method: 'POST',
      headers: {
        'x-user-id': 'approver-3',
        'x-user-permissions': 'create_request,submit_request',
      },
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.data.workflowUserIds, ['hod-1']);
  });
});

test('POST /api/payment-requests/:id/submit skips CFO when requester is the CFO', async () => {
  await withServer(async (baseUrl) => {
    const createLineManager = await fetch(`${baseUrl}/api/setup/users`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'sys-admin',
        'x-user-permissions': 'manage_department_setup',
      },
      body: JSON.stringify({
        fullName: 'Finance Line Manager',
        email: 'finance.lm@example.com',
        departmentId: 'dep-finance',
        positionCode: 'line_manager',
        lineManagerId: null,
        roleCode: 'manager',
      }),
    });
    const financeLineManager = await createLineManager.json();

    const createReviewer = await fetch(`${baseUrl}/api/setup/users`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'sys-admin',
        'x-user-permissions': 'manage_department_setup',
      },
      body: JSON.stringify({
        fullName: 'Finance Reviewer',
        email: 'finance.reviewer@example.com',
        departmentId: 'dep-finance',
        positionCode: 'reviewer',
        lineManagerId: null,
        roleCode: 'manager',
      }),
    });
    const financeReviewer = await createReviewer.json();

    const createHod = await fetch(`${baseUrl}/api/setup/users`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'sys-admin',
        'x-user-permissions': 'manage_department_setup',
      },
      body: JSON.stringify({
        fullName: 'Finance HOD',
        email: 'finance.hod@example.com',
        departmentId: 'dep-finance',
        positionCode: 'hod',
        lineManagerId: null,
        roleCode: 'director',
      }),
    });
    const financeHod = await createHod.json();

    await fetch(`${baseUrl}/api/setup/users/cfo-1`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'sys-admin',
        'x-user-permissions': 'manage_department_setup',
      },
      body: JSON.stringify({
        departmentId: 'dep-finance',
        positionCode: 'cfo',
        lineManagerId: financeLineManager.data.id,
        roleCode: 'director',
        isActive: true,
      }),
    });

    await fetch(`${baseUrl}/api/setup/departments/dep-finance`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'sys-admin',
        'x-user-permissions': 'manage_department_setup',
      },
      body: JSON.stringify({
        reviewerUserId: financeReviewer.data.id,
        hodUserId: financeHod.data.id,
        fallbackUserId: null,
        stepOrder: ['line_manager', 'reviewer', 'hod'],
      }),
    });

    const createResponse = await fetch(`${baseUrl}/api/payment-requests`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'cfo-1',
        'x-user-permissions': 'create_request,submit_request',
      },
      body: JSON.stringify({
        payeeName: 'CFO Self Skip Vendor',
        paymentType: 'Wire Transfer',
        currency: 'VND',
        totalAmount: 750000,
        priority: 'high',
        reason: 'CFO requester should not self-approve.',
        visibilityMode: 'related_only',
        lineItems: [
          {
            description: 'Service Fee',
            glCode: '6100-IT',
            amount: 750000,
            remark: 'ERP Expense Type: service_fee | ERP Cost Center: CC-FIN | ERP Project: PRJ-ERP',
          },
        ],
      }),
    });
    const draft = await createResponse.json();

    const response = await fetch(`${baseUrl}/api/payment-requests/${draft.data.id}/submit`, {
      method: 'POST',
      headers: {
        'x-user-id': 'cfo-1',
        'x-user-permissions': 'create_request,submit_request',
      },
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.data.workflowUserIds, [
      financeReviewer.data.id,
      financeHod.data.id,
    ]);
    assert.equal(body.data.workflowUserIds.includes('cfo-1'), false);
  });
});

test('POST /api/payment-requests/:id/submit skips CEO when requester is the CEO', async () => {
  await withServer(async (baseUrl) => {
    const createLineManager = await fetch(`${baseUrl}/api/setup/users`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'sys-admin',
        'x-user-permissions': 'manage_department_setup',
      },
      body: JSON.stringify({
        fullName: 'Finance Line Manager',
        email: 'finance.lm@example.com',
        departmentId: 'dep-finance',
        positionCode: 'line_manager',
        lineManagerId: null,
        roleCode: 'manager',
      }),
    });
    const financeLineManager = await createLineManager.json();

    const createReviewer = await fetch(`${baseUrl}/api/setup/users`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'sys-admin',
        'x-user-permissions': 'manage_department_setup',
      },
      body: JSON.stringify({
        fullName: 'Finance Reviewer',
        email: 'finance.reviewer@example.com',
        departmentId: 'dep-finance',
        positionCode: 'reviewer',
        lineManagerId: null,
        roleCode: 'manager',
      }),
    });
    const financeReviewer = await createReviewer.json();

    const createHod = await fetch(`${baseUrl}/api/setup/users`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'sys-admin',
        'x-user-permissions': 'manage_department_setup',
      },
      body: JSON.stringify({
        fullName: 'Finance HOD',
        email: 'finance.hod@example.com',
        departmentId: 'dep-finance',
        positionCode: 'hod',
        lineManagerId: null,
        roleCode: 'director',
      }),
    });
    const financeHod = await createHod.json();

    await fetch(`${baseUrl}/api/setup/users/ceo-1`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'sys-admin',
        'x-user-permissions': 'manage_department_setup',
      },
      body: JSON.stringify({
        departmentId: 'dep-finance',
        positionCode: 'ceo',
        lineManagerId: financeLineManager.data.id,
        roleCode: 'director',
        isActive: true,
      }),
    });

    await fetch(`${baseUrl}/api/setup/departments/dep-finance`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'sys-admin',
        'x-user-permissions': 'manage_department_setup',
      },
      body: JSON.stringify({
        reviewerUserId: financeReviewer.data.id,
        hodUserId: financeHod.data.id,
        fallbackUserId: null,
        stepOrder: ['line_manager', 'reviewer', 'hod'],
      }),
    });

    const createResponse = await fetch(`${baseUrl}/api/payment-requests`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'ceo-1',
        'x-user-permissions': 'create_request,submit_request',
      },
      body: JSON.stringify({
        payeeName: 'CEO Self Skip Vendor',
        paymentType: 'Wire Transfer',
        currency: 'VND',
        totalAmount: 1200000,
        priority: 'critical',
        reason: 'CEO requester should not self-approve.',
        visibilityMode: 'related_only',
        lineItems: [
          {
            description: 'Service Fee',
            glCode: '6100-IT',
            amount: 1200000,
            remark: 'ERP Expense Type: service_fee | ERP Cost Center: CC-FIN | ERP Project: PRJ-ERP',
          },
        ],
      }),
    });
    const draft = await createResponse.json();

    const response = await fetch(`${baseUrl}/api/payment-requests/${draft.data.id}/submit`, {
      method: 'POST',
      headers: {
        'x-user-id': 'ceo-1',
        'x-user-permissions': 'create_request,submit_request',
      },
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.data.workflowUserIds, [
      financeReviewer.data.id,
      financeHod.data.id,
      'cfo-1',
    ]);
    assert.equal(body.data.workflowUserIds.includes('ceo-1'), false);
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

test('POST /api/payment-requests/:id/release-to-erp returns 400 when ERP readiness validation fails', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/payment-requests/req-finance-shared/release-to-erp`, {
      method: 'POST',
      headers: {
        'x-user-id': 'finance-ops-1',
        'x-user-permissions': 'release_to_erp',
      },
    });

    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.error, 'erp_readiness_failed');
    assert.equal(Array.isArray(body.details), true);
    assert.equal(body.details.some((entry) => entry.code === 'detail_missing'), true);
  });
});

test('GET /api/payment-requests/:id/erp-readiness returns validation issues for incomplete finance request', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/payment-requests/req-finance-shared/erp-readiness`, {
      headers: {
        'x-user-id': 'finance-ops-1',
        'x-user-permissions': 'view_finance_scoped,release_to_erp',
      },
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data.isReady, false);
    assert.equal(body.data.errors.some((entry) => entry.code === 'detail_missing'), true);
  });
});

test('POST /api/payment-requests/:id/release-to-erp returns 200 for finance operations when readiness passes', async () => {
  await withServer(async (baseUrl) => {
    const createResponse = await fetch(`${baseUrl}/api/payment-requests`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'requester-1',
        'x-user-permissions': 'submit_request',
      },
      body: JSON.stringify({
        payeeName: 'ERP Ready Vendor',
        vendorCode: 'VEND-GLI',
        paymentType: 'Wire Transfer',
        currency: 'VND',
        totalAmount: 100000,
        priority: 'high',
        reason: 'ERP readiness success path',
        visibilityMode: 'related_only',
        lineItems: [
          {
            description: 'Service Fee',
            glCode: '6100-IT',
            amount: 100000,
            remark: 'Invoice date: 2026-03-27 | Invoice ref: INV-ERP-001 | ERP Expense Type: service_fee | ERP Cost Center: CC-OPS | ERP Project: PRJ-DNTT | Implementation service',
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

    await fetch(`${baseUrl}/api/payment-requests/${draft.data.id}/approve`, {
      method: 'POST',
      headers: {
        'x-user-id': 'approver-1',
        'x-user-permissions': 'approve_request',
      },
    });

    await fetch(`${baseUrl}/api/payment-requests/${draft.data.id}/approve`, {
      method: 'POST',
      headers: {
        'x-user-id': 'approver-3',
        'x-user-permissions': 'approve_request',
      },
    });

    await fetch(`${baseUrl}/api/payment-requests/${draft.data.id}/approve`, {
      method: 'POST',
      headers: {
        'x-user-id': 'hod-1',
        'x-user-permissions': 'approve_request',
      },
    });

    const response = await fetch(`${baseUrl}/api/payment-requests/${draft.data.id}/release-to-erp`, {
      method: 'POST',
      headers: {
        'x-user-id': 'finance-ops-1',
        'x-user-permissions': 'release_to_erp',
      },
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data.erpSyncStatus, 'pending');
  });
});

test('POST /api/payment-requests/:id/finance-approve returns 200 for finance operations', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/payment-requests/req-finance-shared/finance-approve`, {
      method: 'POST',
      headers: {
        'x-user-id': 'finance-ops-1',
        'x-user-permissions': 'release_to_erp,hold_erp_sync',
      },
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data.erpSyncStatus, 'hold_by_finance');
    assert.equal(body.data.allowedActions?.releaseToErp, true);
  });
});

test('POST /api/payment-requests/:id/finance-reject returns 200 for finance operations with note', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/payment-requests/req-finance-shared/finance-reject`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'finance-ops-1',
        'x-user-permissions': 'release_to_erp,hold_erp_sync',
      },
      body: JSON.stringify({ note: 'Missing supporting documents.' }),
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data.businessStatus, 'rejected');
    assert.equal(body.data.erpSyncStatus, 'not_ready');
  });
});

test('POST /api/payment-requests/:id/finance-reject returns 400 when note is missing', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/payment-requests/req-finance-shared/finance-reject`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'finance-ops-1',
        'x-user-permissions': 'release_to_erp,hold_erp_sync',
      },
      body: JSON.stringify({ note: '' }),
    });

    assert.equal(response.status, 400);
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

test('POST /api/payment-requests/:id/finance-approve returns 403 for business approver', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/payment-requests/req-finance-shared/finance-approve`, {
      method: 'POST',
      headers: {
        'x-user-id': 'approver-2',
        'x-user-permissions': 'approve_request',
      },
    });

    assert.equal(response.status, 403);
  });
});

test('POST /api/payment-requests/:id/finance-reject returns 403 for business approver', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/payment-requests/req-finance-shared/finance-reject`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'approver-2',
        'x-user-permissions': 'approve_request',
      },
      body: JSON.stringify({ note: 'Not in finance scope.' }),
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
        'content-type': 'application/json',
        'x-user-id': 'delegate-1',
        'x-user-permissions': 'approve_request',
      },
      body: JSON.stringify({
        note: 'Rejected due to missing supporting documents.',
      }),
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data.businessStatus, 'rejected');
    assert.deepEqual(body.data.currentStepApproverIds, []);
    assert.equal(body.data.allowedActions?.reject, false);
  });
});

test('POST /api/payment-requests/:id/reject returns 400 when reject note is missing', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/payment-requests/req-related-only/reject`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'delegate-1',
        'x-user-permissions': 'approve_request',
      },
      body: JSON.stringify({
        note: '',
      }),
    });

    assert.equal(response.status, 400);
  });
});

test('POST /api/payment-requests/:id/reject returns 403 for unrelated actor', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/payment-requests/req-related-only/reject`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'random-user',
        'x-user-permissions': 'approve_request',
      },
      body: JSON.stringify({
        note: 'I should not be able to reject this.',
      }),
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
