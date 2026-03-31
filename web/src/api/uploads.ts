import type { PaymentRequestAttachment } from '../types/paymentRequest';
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

export async function uploadAttachment(
  file: File,
  attachmentType: string,
  actor: ApiActorContext
) {
  const formData = new FormData();
  formData.set('attachmentType', attachmentType);
  formData.set('file', file);

  const response = await fetch(`${API_BASE_URL}/api/uploads/attachments`, {
    method: 'POST',
    headers: buildHeaders(actor),
    body: formData,
  });

  return parseJson<{ data: PaymentRequestAttachment }>(response);
}
