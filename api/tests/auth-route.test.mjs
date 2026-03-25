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

test('GET /api/me returns 401 when x-user-email header is missing', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/me`);
    assert.equal(response.status, 401);
  });
});

test('POST /api/register creates a local test actor', async () => {
  await withServer(async (baseUrl) => {
    const email = `local-${Date.now()}@example.com`;

    const response = await fetch(`${baseUrl}/api/register`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        fullName: 'Local Tester',
        email,
        password: '1234',
        departmentId: 'dep-a',
        roleCode: 'staff',
      }),
    });

    assert.equal(response.status, 201);
    const body = await response.json();
    assert.equal(body.data.email, email);
    assert.equal(body.data.departmentId, 'dep-a');
  });
});

test('POST /api/register returns 409 for duplicate email', async () => {
  await withServer(async (baseUrl) => {
    const email = `duplicate-${Date.now()}@example.com`;

    const first = await fetch(`${baseUrl}/api/register`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        fullName: 'Duplicate Tester',
        email,
        password: '1234',
        departmentId: 'dep-a',
        roleCode: 'staff',
      }),
    });

    assert.equal(first.status, 201);

    const second = await fetch(`${baseUrl}/api/register`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        fullName: 'Duplicate Tester',
        email,
        password: '1234',
        departmentId: 'dep-a',
        roleCode: 'staff',
      }),
    });

    assert.equal(second.status, 409);
  });
});
