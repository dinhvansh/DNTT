import type { ApiActorContext } from './paymentRequests';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8080';

export interface MasterDataDepartment {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

export interface MasterDataRole {
  code: string;
  name: string;
}

export interface MasterDataPosition {
  code: string;
  name: string;
  isGlobal: boolean;
  isActive: boolean;
}

export interface MasterDataUser {
  id: string;
  fullName: string;
  email: string;
  departmentId: string | null;
  positionCode: string | null;
  lineManagerId: string | null;
  roleCode: string | null;
  isActive: boolean;
}

export interface MasterDataVendor {
  id: string;
  code: string;
  name: string;
  currency: string;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankName: string | null;
  syncSource: string;
  lastSyncedAt: string | null;
  isActive: boolean;
}

export interface ErpReferenceValue {
  id: string;
  referenceType: string;
  code: string;
  name: string;
  parentCode?: string | null;
  currency?: string | null;
  syncSource: string;
  lastSyncedAt: string | null;
  isActive: boolean;
}

export interface ErpSyncRun {
  id: string;
  referenceType: string;
  syncMode: string;
  status: string;
  recordsUpserted: number;
  errorMessage?: string | null;
  triggeredBy?: string | null;
  triggeredByName?: string | null;
  createdAt: string;
}

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

export async function getMasterData(actor: ApiActorContext) {
  const response = await fetch(`${API_BASE_URL}/api/setup/master-data`, {
    headers: buildHeaders(actor),
  });

  return parseJson<{
    data: {
      users: MasterDataUser[];
      departments: MasterDataDepartment[];
      roles: MasterDataRole[];
      positions: MasterDataPosition[];
      vendors: MasterDataVendor[];
      erpReferences: ErpReferenceValue[];
    };
  }>(response);
}

export async function listErpReferenceValues(actor: ApiActorContext) {
  const response = await fetch(`${API_BASE_URL}/api/setup/erp-reference-data`, {
    headers: buildHeaders(actor),
  });

  return parseJson<{ data: ErpReferenceValue[]; total: number }>(response);
}

export async function listErpSyncRuns(actor: ApiActorContext) {
  const response = await fetch(`${API_BASE_URL}/api/setup/erp-reference-sync-runs`, {
    headers: buildHeaders(actor),
  });

  return parseJson<{ data: ErpSyncRun[]; total: number }>(response);
}

export async function listPublicErpReferenceValues(actor: ApiActorContext) {
  const response = await fetch(`${API_BASE_URL}/api/erp-reference-data`, {
    headers: buildHeaders(actor),
  });

  return parseJson<{ data: ErpReferenceValue[]; total: number }>(response);
}

export async function syncErpReferenceValues(
  input: {
    referenceType: string;
    values: Array<{
      referenceType: string;
      code: string;
      name: string;
      parentCode?: string | null;
      currency?: string | null;
      isActive?: boolean;
      syncSource?: string;
    }>;
  },
  actor: ApiActorContext
) {
  const response = await fetch(`${API_BASE_URL}/api/setup/erp-reference-data/sync`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...buildHeaders(actor),
    },
    body: JSON.stringify(input),
  });

  return parseJson<{ data: { referenceType: string; syncMode: string; status: string; recordsUpserted: number; createdAt: string } }>(response);
}

export async function createMasterDataVendor(
  input: {
    code: string;
    name: string;
    currency: string;
    bankAccountName?: string | null;
    bankAccountNumber?: string | null;
    bankName?: string | null;
  },
  actor: ApiActorContext
) {
  const response = await fetch(`${API_BASE_URL}/api/setup/vendors`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...buildHeaders(actor),
    },
    body: JSON.stringify(input),
  });

  return parseJson<{ data: MasterDataVendor }>(response);
}

export async function listVendors(actor: ApiActorContext) {
  const response = await fetch(`${API_BASE_URL}/api/vendors`, {
    headers: buildHeaders(actor),
  });

  return parseJson<{ data: MasterDataVendor[]; total: number }>(response);
}

export async function createMasterDataUser(
  input: {
    fullName: string;
    email: string;
    departmentId: string;
    positionCode: string;
    lineManagerId: string | null;
    roleCode: string;
  },
  actor: ApiActorContext
) {
  const response = await fetch(`${API_BASE_URL}/api/setup/users`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...buildHeaders(actor),
    },
    body: JSON.stringify(input),
  });

  return parseJson<{ data: MasterDataUser }>(response);
}

export async function createMasterDataDepartment(
  input: {
    code: string;
    name: string;
  },
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

  return parseJson<{ data: MasterDataDepartment }>(response);
}

export async function createMasterDataPosition(
  input: {
    code: string;
    name: string;
    isGlobal?: boolean;
  },
  actor: ApiActorContext
) {
  const response = await fetch(`${API_BASE_URL}/api/setup/positions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...buildHeaders(actor),
    },
    body: JSON.stringify(input),
  });

  return parseJson<{ data: MasterDataPosition }>(response);
}

export async function updateMasterDataDepartment(
  departmentCode: string,
  input: {
    name: string;
    isActive: boolean;
  },
  actor: ApiActorContext
) {
  const response = await fetch(`${API_BASE_URL}/api/setup/master-data/departments/${departmentCode}`, {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      ...buildHeaders(actor),
    },
    body: JSON.stringify(input),
  });

  return parseJson<{ data: MasterDataDepartment }>(response);
}

export async function updateMasterDataPosition(
  positionCode: string,
  input: {
    name: string;
    isGlobal: boolean;
    isActive: boolean;
  },
  actor: ApiActorContext
) {
  const response = await fetch(`${API_BASE_URL}/api/setup/master-data/positions/${positionCode}`, {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      ...buildHeaders(actor),
    },
    body: JSON.stringify(input),
  });

  return parseJson<{ data: MasterDataPosition }>(response);
}

export async function updateMasterDataUser(
  userId: string,
  input: {
    fullName: string;
    departmentId: string;
    positionCode: string;
    lineManagerId: string | null;
    roleCode: string;
    isActive: boolean;
  },
  actor: ApiActorContext
) {
  const response = await fetch(`${API_BASE_URL}/api/setup/users/${userId}`, {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      ...buildHeaders(actor),
    },
    body: JSON.stringify(input),
  });

  return parseJson<{ data: MasterDataUser }>(response);
}

export async function deleteMasterDataUser(userId: string, actor: ApiActorContext) {
  const response = await fetch(`${API_BASE_URL}/api/setup/users/${userId}`, {
    method: 'DELETE',
    headers: buildHeaders(actor),
  });

  return parseJson<{ success: true }>(response);
}

export async function deleteMasterDataDepartment(departmentCode: string, actor: ApiActorContext) {
  const response = await fetch(`${API_BASE_URL}/api/setup/master-data/departments/${departmentCode}`, {
    method: 'DELETE',
    headers: buildHeaders(actor),
  });

  return parseJson<{ success: true }>(response);
}

export async function deleteMasterDataPosition(positionCode: string, actor: ApiActorContext) {
  const response = await fetch(`${API_BASE_URL}/api/setup/master-data/positions/${positionCode}`, {
    method: 'DELETE',
    headers: buildHeaders(actor),
  });

  return parseJson<{ success: true }>(response);
}
