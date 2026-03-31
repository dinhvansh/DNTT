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

export interface RequestTemplate {
  id: string;
  code: string;
  name: string;
  requestType: string;
  description: string;
  version: number;
  visibilityMode: string;
  isActive: boolean;
  formSchema: {
    fieldMasking?: Record<string, { enabled: boolean; visibleTo: string[] }>;
  };
  detailSchema: {
    columns?: Record<string, { visible: boolean; required: boolean }>;
  };
  attachmentRules: {
    visibilityByType?: Record<string, { sensitive: boolean; visibleTo: string[] }>;
    requiredTypes?: string[];
  };
}

export async function listRequestTemplates(actor: ApiActorContext) {
  const response = await fetch(`${API_BASE_URL}/api/templates`, {
    headers: buildHeaders(actor),
  });

  return parseJson<{ data: RequestTemplate[]; total: number }>(response);
}

export async function createRequestTemplate(
  input: Omit<RequestTemplate, 'id' | 'version'>,
  actor: ApiActorContext
) {
  const response = await fetch(`${API_BASE_URL}/api/templates`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...buildHeaders(actor),
    },
    body: JSON.stringify(input),
  });

  return parseJson<{ data: RequestTemplate }>(response);
}

export async function updateRequestTemplate(
  templateCode: string,
  input: Partial<Omit<RequestTemplate, 'id' | 'code' | 'version'>> & Pick<RequestTemplate, 'name' | 'visibilityMode' | 'isActive' | 'description' | 'formSchema' | 'detailSchema' | 'attachmentRules'>,
  actor: ApiActorContext
) {
  const response = await fetch(`${API_BASE_URL}/api/templates/${templateCode}`, {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      ...buildHeaders(actor),
    },
    body: JSON.stringify(input),
  });

  return parseJson<{ data: RequestTemplate }>(response);
}
