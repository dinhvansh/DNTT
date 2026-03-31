import crypto from 'node:crypto';

function normalizeAllowedEvents(rawValue) {
  return String(rawValue || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function createWebhookPublisher(config) {
  const webhookUrl = config.webhookUrl ?? '';
  const webhookSecret = config.webhookSecret ?? '';
  const timeoutMs = Number(config.webhookTimeoutMs ?? 5000);
  const allowedEvents = normalizeAllowedEvents(config.webhookEvents);

  return {
    async publish(eventName, payload) {
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
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

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
    },
  };
}
