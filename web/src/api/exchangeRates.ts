import type { ApiActorContext } from './paymentRequests';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8080';

function buildHeaders(actor: ApiActorContext) {
  return {
    'x-user-id': actor.userId,
    ...(actor.departmentId ? { 'x-user-department': actor.departmentId } : {}),
    ...(actor.permissions?.length ? { 'x-user-permissions': actor.permissions.join(',') } : {}),
  };
}

async function parseJson<T>(response: Response): Promise<T> {
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.message ?? 'API request failed');
  }

  return payload as T;
}

export interface ExchangeRateEntry {
  currencyCode: string;
  currencyName: string;
  buy: number | null;
  transfer: number | null;
  sell: number | null;
}

export async function getVietcombankExchangeRates(actor: ApiActorContext) {
  const response = await fetch(`${API_BASE_URL}/api/exchange-rates/vietcombank`, {
    headers: buildHeaders(actor),
  });

  return parseJson<{
    data: {
      fetchedAt: string | null;
      source: string;
      rates: ExchangeRateEntry[];
    };
  }>(response);
}
