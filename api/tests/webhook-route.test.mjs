import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from '../src/server.mjs';

async function withServer(run) {
  const events = [];
  const webhook = {
    async publish(eventName, payload) {
      events.push({ eventName, payload });
      return { delivered: true, skipped: false };
    },
  };

  const server = createServer({ webhook });
  server.listen(0);
  await once(server, 'listening');
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await run(baseUrl, events);
  } finally {
    server.close();
    await once(server, 'close');
  }
}

test('POST /api/payment-requests publishes payment_request.created webhook', async () => {
  await withServer(async (baseUrl, events) => {
    const response = await fetch(`${baseUrl}/api/payment-requests`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'requester-1',
      },
      body: JSON.stringify({
        payeeName: 'Webhook Vendor',
        paymentType: 'Wire Transfer',
        currency: 'VND',
        totalAmount: 1000,
        priority: 'high',
        reason: 'Webhook smoke test',
        visibilityMode: 'related_only',
        lineItems: [
          {
            description: 'Line 1',
            amount: 1000,
          },
        ],
        attachments: [],
      }),
    });

    assert.equal(response.status, 201);
    assert.equal(events.length, 1);
    assert.equal(events[0].eventName, 'payment_request.created');
    assert.equal(events[0].payload.requestNo.startsWith('PR-2026-'), true);
    assert.equal(events[0].payload.businessStatus, 'draft');
  });
});
