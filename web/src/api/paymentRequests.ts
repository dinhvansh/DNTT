import type { PaymentRequestSummary } from '../types/paymentRequest';
import type { ErpIntegrationJob } from '../types/erpJob';

export interface ApiActorContext {
  userId: string;
  departmentId?: string | null;
  permissions?: string[];
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8080';

function getDevActorOverride() {
  return {
    userId: import.meta.env.VITE_DEV_ACTOR_ID as string | undefined,
    departmentId: import.meta.env.VITE_DEV_ACTOR_DEPARTMENT_ID as string | undefined,
    permissions: ((import.meta.env.VITE_DEV_ACTOR_PERMISSIONS as string | undefined) ?? '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean),
  };
}

export function createActorContext(input: ApiActorContext): ApiActorContext {
  const override = getDevActorOverride();

  return {
    userId: override.userId || input.userId,
    departmentId: override.departmentId || input.departmentId,
    permissions: override.permissions.length > 0 ? override.permissions : (input.permissions ?? []),
  };
}

function buildHeaders(actor: ApiActorContext) {
  return {
    'x-user-id': actor.userId,
    ...(actor.departmentId ? { 'x-user-department': actor.departmentId } : {}),
    ...(actor.permissions && actor.permissions.length > 0
      ? { 'x-user-permissions': actor.permissions.join(',') }
      : {}),
  };
}

async function parseJson<T>(response: Response): Promise<T> {
  const payload = await response.json();
  if (!response.ok) {
    const message = payload?.message || 'API request failed';
    throw new Error(message);
  }

  return payload as T;
}

export async function listPaymentRequests(actor: ApiActorContext) {
  const response = await fetch(`${API_BASE_URL}/api/payment-requests`, {
    headers: buildHeaders(actor),
  });

  return parseJson<{ data: PaymentRequestSummary[]; total: number }>(response);
}

export async function getPaymentRequestById(id: string, actor: ApiActorContext) {
  const response = await fetch(`${API_BASE_URL}/api/payment-requests/${id}`, {
    headers: buildHeaders(actor),
  });

  return parseJson<{ data: PaymentRequestSummary }>(response);
}

export async function listMyApprovals(actor: ApiActorContext) {
  const response = await fetch(`${API_BASE_URL}/api/my-approvals`, {
    headers: buildHeaders(actor),
  });

  return parseJson<{ data: PaymentRequestSummary[]; total: number }>(response);
}

export async function listFinanceReleaseQueue(actor: ApiActorContext) {
  const response = await fetch(`${API_BASE_URL}/api/finance-release-queue`, {
    headers: buildHeaders(actor),
  });

  return parseJson<{ data: PaymentRequestSummary[]; total: number }>(response);
}

export async function listErpJobs(actor: ApiActorContext) {
  const response = await fetch(`${API_BASE_URL}/api/erp-jobs`, {
    headers: buildHeaders(actor),
  });

  return parseJson<{ data: ErpIntegrationJob[]; total: number }>(response);
}

export interface CreatePaymentRequestInput {
  departmentId: string;
  payeeName: string;
  paymentType: string;
  currency: string;
  totalAmount: number;
  priority: string;
  reason: string;
  visibilityMode: string;
  lineItems: Array<{
    description: string;
    glCode?: string;
    amount: number;
    remark?: string;
  }>;
  attachments?: Array<{
    attachmentType: string;
    fileName: string;
    filePath: string;
    fileSize: number;
  }>;
}

export async function createPaymentRequest(input: CreatePaymentRequestInput, actor: ApiActorContext) {
  const response = await fetch(`${API_BASE_URL}/api/payment-requests`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...buildHeaders(actor),
    },
    body: JSON.stringify(input),
  });

  return parseJson<{ data: PaymentRequestSummary }>(response);
}

export async function approvePaymentRequest(id: string, actor: ApiActorContext) {
  const response = await fetch(`${API_BASE_URL}/api/payment-requests/${id}/approve`, {
    method: 'POST',
    headers: buildHeaders(actor),
  });

  return parseJson<{ data: PaymentRequestSummary }>(response);
}

export async function submitPaymentRequest(id: string, actor: ApiActorContext) {
  const response = await fetch(`${API_BASE_URL}/api/payment-requests/${id}/submit`, {
    method: 'POST',
    headers: buildHeaders(actor),
  });

  return parseJson<{ data: PaymentRequestSummary }>(response);
}

export async function cancelPaymentRequest(id: string, actor: ApiActorContext) {
  const response = await fetch(`${API_BASE_URL}/api/payment-requests/${id}/cancel`, {
    method: 'POST',
    headers: buildHeaders(actor),
  });

  return parseJson<{ data: PaymentRequestSummary }>(response);
}

export async function rejectPaymentRequest(id: string, actor: ApiActorContext) {
  const response = await fetch(`${API_BASE_URL}/api/payment-requests/${id}/reject`, {
    method: 'POST',
    headers: buildHeaders(actor),
  });

  return parseJson<{ data: PaymentRequestSummary }>(response);
}

export async function returnPaymentRequest(id: string, actor: ApiActorContext) {
  const response = await fetch(`${API_BASE_URL}/api/payment-requests/${id}/return`, {
    method: 'POST',
    headers: buildHeaders(actor),
  });

  return parseJson<{ data: PaymentRequestSummary }>(response);
}

export async function resubmitPaymentRequest(id: string, actor: ApiActorContext) {
  const response = await fetch(`${API_BASE_URL}/api/payment-requests/${id}/resubmit`, {
    method: 'POST',
    headers: buildHeaders(actor),
  });

  return parseJson<{ data: PaymentRequestSummary }>(response);
}

export async function releasePaymentRequestToErp(id: string, actor: ApiActorContext) {
  const response = await fetch(`${API_BASE_URL}/api/payment-requests/${id}/release-to-erp`, {
    method: 'POST',
    headers: buildHeaders(actor),
  });

  return parseJson<{ data: PaymentRequestSummary }>(response);
}

export async function holdPaymentRequestSync(id: string, actor: ApiActorContext) {
  const response = await fetch(`${API_BASE_URL}/api/payment-requests/${id}/hold-erp-sync`, {
    method: 'POST',
    headers: buildHeaders(actor),
  });

  return parseJson<{ data: PaymentRequestSummary }>(response);
}

export async function retryErpJob(id: string, actor: ApiActorContext) {
  const response = await fetch(`${API_BASE_URL}/api/erp-jobs/${id}/retry`, {
    method: 'POST',
    headers: buildHeaders(actor),
  });

  return parseJson<{ data: ErpIntegrationJob }>(response);
}
