import crypto from 'node:crypto';

function normalizeAllowedEvents(rawValue) {
  return String(rawValue || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

const webhookUrl = process.env.WORKER_WEBHOOK_URL ?? process.env.WEBHOOK_URL ?? '';
const webhookSecret = process.env.WORKER_WEBHOOK_SECRET ?? process.env.WEBHOOK_SECRET ?? '';
const webhookTimeoutMs = Number(process.env.WORKER_WEBHOOK_TIMEOUT_MS ?? process.env.WEBHOOK_TIMEOUT_MS ?? 5000);
const allowedEvents = normalizeAllowedEvents(process.env.WORKER_WEBHOOK_EVENTS ?? process.env.WEBHOOK_EVENTS ?? '');

export async function publishWorkerWebhook(eventName, payload) {
  if (!webhookUrl) {
    return { delivered: false, skipped: true, reason: 'webhook_url_not_configured' };
  }

  if (allowedEvents.length > 0 && !allowedEvents.includes(eventName)) {
    return { delivered: false, skipped: true, reason: 'event_filtered' };
  }

  const eventId = crypto.randomUUID();
  const body = JSON.stringify({
    id: eventId,
    event: eventName,
    occurredAt: new Date().toISOString(),
    payload,
  });
  const signature = webhookSecret
    ? crypto.createHmac('sha256', webhookSecret).update(body).digest('hex')
    : '';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), webhookTimeoutMs);

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-webhook-event': eventName,
        'x-webhook-id': eventId,
        ...(signature ? { 'x-webhook-signature': signature } : {}),
      },
      body,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Webhook responded with status ${response.status}.`);
    }

    return { delivered: true, skipped: false };
  } finally {
    clearTimeout(timeout);
  }
}
