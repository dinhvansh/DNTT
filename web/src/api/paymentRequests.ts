import type {
  PaymentRequestErpReadiness,
  PaymentRequestSummary,
  PaymentRequestWorkflowPreview,
  PaymentRequestWorkflowPreviewIssue,
} from '../types/paymentRequest';
import type { ErpIntegrationJob } from '../types/erpJob';
import type { AuditLogEntry } from '../types/auditLog';

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
    const error = new Error(message) as Error & {
      details?: string[] | PaymentRequestWorkflowPreviewIssue[];
    };
    error.details = payload?.details;
    throw error;
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

export async function getAttachmentContent(attachmentId: string, actor: ApiActorContext, options?: { download?: boolean }) {
  const downloadQuery = options?.download ? '?download=1' : '';
  const response = await fetch(`${API_BASE_URL}/api/attachments/${attachmentId}/content${downloadQuery}`, {
    headers: buildHeaders(actor),
  });

  if (!response.ok) {
    let message = 'Attachment request failed';
    try {
      const payload = await response.json();
      message = payload?.message || message;
    } catch {
      // Ignore non-JSON error responses.
    }
    throw new Error(message);
  }

  return {
    blob: await response.blob(),
    contentType: response.headers.get('content-type') ?? 'application/octet-stream',
  };
}

export async function listPaymentRequestAuditLogs(id: string, actor: ApiActorContext) {
  const response = await fetch(`${API_BASE_URL}/api/payment-requests/${id}/audit-logs`, {
    headers: buildHeaders(actor),
  });

  return parseJson<{ data: AuditLogEntry[]; total: number }>(response);
}

export async function getPaymentRequestErpReadiness(id: string, actor: ApiActorContext) {
  const response = await fetch(`${API_BASE_URL}/api/payment-requests/${id}/erp-readiness`, {
    headers: buildHeaders(actor),
  });

  return parseJson<{ data: PaymentRequestErpReadiness }>(response);
}

export async function previewPaymentRequestWorkflow(
  input: {
    totalAmount: number;
    lineManagerOverrideId?: string | null;
  },
  actor: ApiActorContext
) {
  const response = await fetch(`${API_BASE_URL}/api/payment-requests/preview-workflow`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...buildHeaders(actor),
    },
    body: JSON.stringify(input),
  });

  return parseJson<{ data: PaymentRequestWorkflowPreview }>(response);
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
  templateCode?: string;
  vendorCode?: string;
  payeeName: string;
  paymentType: string;
  currency: string;
  totalAmount: number;
  priority: string;
  reason: string;
  visibilityMode: string;
  lineItems: Array<{
    description: string;
    invoiceDate?: string;
    invoiceRef?: string;
    glCode?: string;
    costCenter?: string;
    projectCode?: string;
    expenseTypeCode?: string;
    currency?: string;
    exchangeRate?: number;
    amount: number;
    totalAmount?: number;
    note?: string;
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
    headers: {
      'content-type': 'application/json',
      ...buildHeaders(actor),
    },
    body: JSON.stringify({}),
  });

  return parseJson<{ data: PaymentRequestSummary }>(response);
}

export async function submitPaymentRequestWithOverrides(
  id: string,
  input: {
    lineManagerOverrideId?: string | null;
    lineManagerOverrideReason?: string | null;
  },
  actor: ApiActorContext
) {
  const response = await fetch(`${API_BASE_URL}/api/payment-requests/${id}/submit`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...buildHeaders(actor),
    },
    body: JSON.stringify(input),
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

export async function rejectPaymentRequest(id: string, actor: ApiActorContext, note: string) {
  const response = await fetch(`${API_BASE_URL}/api/payment-requests/${id}/reject`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...buildHeaders(actor),
    },
    body: JSON.stringify({ note }),
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

export async function financeApprovePaymentRequest(id: string, actor: ApiActorContext) {
  const response = await fetch(`${API_BASE_URL}/api/payment-requests/${id}/finance-approve`, {
    method: 'POST',
    headers: buildHeaders(actor),
  });

  return parseJson<{ data: PaymentRequestSummary }>(response);
}

export async function financeRejectPaymentRequest(id: string, actor: ApiActorContext, note: string) {
  const response = await fetch(`${API_BASE_URL}/api/payment-requests/${id}/finance-reject`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...buildHeaders(actor),
    },
    body: JSON.stringify({ note }),
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
