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

test('POST /api/uploads/attachments returns 401 when actor headers are missing', async () => {
  await withServer(async (baseUrl) => {
    const formData = new FormData();
    formData.set('attachmentType', 'invoice');
    formData.set('file', new Blob(['invoice']), 'invoice.txt');

    const response = await fetch(`${baseUrl}/api/uploads/attachments`, {
      method: 'POST',
      body: formData,
    });

    assert.equal(response.status, 401);
  });
});

test('POST /api/uploads/attachments returns attachment metadata for authenticated actor', async () => {
  await withServer(async (baseUrl) => {
    const formData = new FormData();
    formData.set('attachmentType', 'invoice');
    formData.set('file', new Blob(['invoice payload'], { type: 'text/plain' }), 'invoice-q1.txt');

    const response = await fetch(`${baseUrl}/api/uploads/attachments`, {
      method: 'POST',
      headers: {
        'x-user-id': 'requester-1',
      },
      body: formData,
    });

    assert.equal(response.status, 201);
    const body = await response.json();
    assert.equal(body.data.attachmentType, 'invoice');
    assert.equal(body.data.fileName, 'invoice-q1.txt');
    assert.equal(body.data.fileSize, 15);
    assert.match(body.data.filePath, /invoice-q1\.txt$/);
  });
});
