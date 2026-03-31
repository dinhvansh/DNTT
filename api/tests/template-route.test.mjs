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

test('GET /api/templates returns active templates for authenticated requester', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/templates`, {
      headers: {
        'x-user-id': 'requester-1',
      },
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.total >= 2, true);
    assert.equal(body.data.every((entry) => entry.isActive !== false), true);
  });
});

test('POST /api/templates creates template for admin', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/templates`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...adminHeaders(),
      },
      body: JSON.stringify({
        code: 'dept_locked',
        name: 'Department Locked',
        requestType: 'payment_request',
        description: 'Template for internal department-only visibility.',
        visibilityMode: 'related_and_same_department',
        formSchema: {
          fieldMasking: {
            bankAccountNumber: {
              enabled: true,
              visibleTo: ['finance', 'admin'],
            },
          },
        },
        detailSchema: {
          columns: {
            invoiceDate: { visible: true, required: true },
          },
        },
        attachmentRules: {
          visibilityByType: {
            invoice: {
              sensitive: false,
              visibleTo: ['requester', 'workflow_related', 'finance', 'admin'],
            },
          },
          requiredTypes: ['invoice'],
        },
      }),
    });

    assert.equal(response.status, 201);
    const body = await response.json();
    assert.equal(body.data.code, 'dept_locked');
    assert.equal(body.data.visibilityMode, 'related_and_same_department');
  });
});

test('PUT /api/templates/:code updates template and increments version', async () => {
  await withServer(async (baseUrl) => {
    await fetch(`${baseUrl}/api/templates`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...adminHeaders(),
      },
      body: JSON.stringify({
        code: 'ops_template',
        name: 'Ops Template',
        requestType: 'payment_request',
        description: 'Initial template',
        visibilityMode: 'related_only',
        formSchema: { fieldMasking: {} },
        detailSchema: { columns: {} },
        attachmentRules: { visibilityByType: {}, requiredTypes: [] },
      }),
    });

    const response = await fetch(`${baseUrl}/api/templates/ops_template`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        ...adminHeaders(),
      },
      body: JSON.stringify({
        name: 'Ops Template Updated',
        description: 'Updated description',
        visibilityMode: 'finance_shared',
        isActive: false,
        formSchema: {
          fieldMasking: {
            bankName: {
              enabled: true,
              visibleTo: ['finance', 'admin'],
            },
          },
        },
        detailSchema: { columns: { note: { visible: true, required: false } } },
        attachmentRules: { visibilityByType: {}, requiredTypes: ['invoice'] },
      }),
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data.name, 'Ops Template Updated');
    assert.equal(body.data.visibilityMode, 'finance_shared');
    assert.equal(body.data.isActive, false);
    assert.equal(body.data.version, 2);
  });
});
