import type { ApiActorContext } from './paymentRequests';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8080';

export interface SetupUser {
  id: string;
  fullName: string;
  email: string;
  departmentId: string | null;
  positionCode?: string | null;
}

export interface SetupPosition {
  code: string;
  name: string;
  isGlobal: boolean;
  isActive: boolean;
}

export interface DepartmentApprovalSetup {
  reviewerUserId: string | null;
  reviewerPositionCode: string | null;
  hodUserId: string | null;
  hodPositionCode: string | null;
  fallbackUserId: string | null;
  fallbackPositionCode: string | null;
  stepOrder: string[];
  effectiveFrom: string | null;
  isActive: boolean;
}

export interface ApprovalDepartment {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  setup: DepartmentApprovalSetup;
}

export interface GlobalApproverConfig {
  companyCode: string;
  cfoPositionCode: string | null;
  ceoPositionCode: string | null;
  cfoAmountThreshold: number | null;
  ceoAmountThreshold: number | null;
  isActive: boolean;
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
    throw new Error(payload?.message ?? 'API request failed');
  }

  return payload as T;
}

export async function getApprovalSetup(actor: ApiActorContext) {
  const response = await fetch(`${API_BASE_URL}/api/setup/approval`, {
    headers: buildHeaders(actor),
  });

  return parseJson<{
    data: {
      departments: ApprovalDepartment[];
      users: SetupUser[];
      positions: SetupPosition[];
      globalConfig: GlobalApproverConfig | null;
    };
  }>(response);
}

export async function createDepartment(
  input: { code: string; name: string },
  actor: ApiActorContext
) {
  const response = await fetch(`${API_BASE_URL}/api/setup/departments`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...buildHeaders(actor),
    },
    body: JSON.stringify(input),
  });

  return parseJson<{ data: ApprovalDepartment }>(response);
}

export async function updateDepartmentApprovalSetup(
  departmentCode: string,
  input: {
    reviewerUserId: string | null;
    reviewerPositionCode: string | null;
    hodUserId: string | null;
    hodPositionCode: string | null;
    fallbackUserId: string | null;
    fallbackPositionCode: string | null;
    stepOrder: string[];
  },
  actor: ApiActorContext
) {
  const response = await fetch(`${API_BASE_URL}/api/setup/departments/${departmentCode}`, {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      ...buildHeaders(actor),
    },
    body: JSON.stringify(input),
  });

  return parseJson<{ data: ApprovalDepartment }>(response);
}

export async function updateGlobalApproverConfig(
  input: {
    cfoPositionCode: string | null;
    ceoPositionCode: string | null;
    cfoAmountThreshold: number | null;
    ceoAmountThreshold: number | null;
  },
  actor: ApiActorContext
) {
  const response = await fetch(`${API_BASE_URL}/api/setup/global-approvers`, {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      ...buildHeaders(actor),
    },
    body: JSON.stringify(input),
  });

  return parseJson<{ data: GlobalApproverConfig }>(response);
}
