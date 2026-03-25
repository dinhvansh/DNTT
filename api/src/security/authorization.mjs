const RELATED_VISIBILITY = new Set([
  'related_only',
  'related_and_same_department',
  'finance_shared',
]);

const APPROVAL_ALLOWED_STATUSES = new Set(['pending_approval']);
const ERP_RELEASE_ALLOWED_STATUSES = new Set([
  'waiting_finance_release',
  'hold_by_finance',
]);
const ERP_RETRY_ALLOWED_STATUSES = new Set([
  'failed',
  'manual_review_required',
]);
const CANCEL_ALLOWED_STATUSES = new Set(['draft', 'returned']);

export function hasPermission(actor, permissionCode) {
  return Boolean(actor?.permissions?.includes(permissionCode));
}

function parseDate(input) {
  return input instanceof Date ? input : new Date(input);
}

function isActiveDelegation(delegation, now) {
  if (!delegation?.isActive) {
    return false;
  }

  const currentTime = parseDate(now).getTime();
  return currentTime >= parseDate(delegation.validFrom).getTime() &&
    currentTime <= parseDate(delegation.validTo).getTime();
}

function matchesDelegationScope(delegation, request) {
  const scope = delegation?.scope ?? { type: 'all' };

  switch (scope.type) {
    case 'all':
      return true;
    case 'department':
      return scope.departmentId === request.departmentId;
    case 'request_type':
      return scope.requestType === request.requestType;
    case 'request':
      return scope.requestId === request.id;
    default:
      return false;
  }
}

function getDelegatedApproverIds({ request, delegations = [], now }) {
  const approverIds = new Set(request.currentStepApproverIds ?? []);

  for (const delegation of delegations) {
    if (!approverIds.has(delegation.delegatorUserId)) {
      continue;
    }

    if (!isActiveDelegation(delegation, now)) {
      continue;
    }

    if (!matchesDelegationScope(delegation, request)) {
      continue;
    }

    approverIds.add(delegation.delegateUserId);
  }

  return approverIds;
}

export function getRelatedUserIds({ request, delegations = [], now = new Date() }) {
  const relatedIds = new Set([
    request.requesterId,
    ...(request.workflowUserIds ?? []),
    ...(request.currentStepApproverIds ?? []),
    ...(request.additionalRelatedUserIds ?? []),
  ]);

  for (const delegatedId of getDelegatedApproverIds({ request, delegations, now })) {
    relatedIds.add(delegatedId);
  }

  return relatedIds;
}

export function canViewRequest({ actor, request, delegations = [], now = new Date() }) {
  if (!actor || !request) {
    return false;
  }

  if (hasPermission(actor, 'view_all_requests')) {
    return true;
  }

  const visibilityMode = RELATED_VISIBILITY.has(request.visibilityMode)
    ? request.visibilityMode
    : 'related_only';

  const relatedIds = getRelatedUserIds({ request, delegations, now });
  if (relatedIds.has(actor.id)) {
    return true;
  }

  if (
    visibilityMode === 'related_and_same_department' &&
    actor.departmentId &&
    actor.departmentId === request.departmentId &&
    hasPermission(actor, 'view_department_requests')
  ) {
    return true;
  }

  if (
    visibilityMode === 'finance_shared' &&
    hasPermission(actor, 'view_finance_scoped')
  ) {
    return true;
  }

  return false;
}

export function canApproveRequest({ actor, request, delegations = [], now = new Date() }) {
  if (!actor || !request) {
    return false;
  }

  if (!APPROVAL_ALLOWED_STATUSES.has(request.businessStatus)) {
    return false;
  }

  if (!hasPermission(actor, 'approve_request')) {
    return false;
  }

  const effectiveApproverIds = getDelegatedApproverIds({ request, delegations, now });
  return effectiveApproverIds.has(actor.id);
}

export function canSubmitRequest({ actor, request }) {
  if (!actor || !request) {
    return false;
  }

  if (request.businessStatus !== 'draft') {
    return false;
  }

  if (actor.id !== request.requesterId) {
    return false;
  }

  return hasPermission(actor, 'submit_request');
}

export function canRejectRequest({ actor, request, delegations = [], now = new Date() }) {
  return canApproveRequest({ actor, request, delegations, now });
}

export function canReturnRequest({ actor, request, delegations = [], now = new Date() }) {
  return canApproveRequest({ actor, request, delegations, now });
}

export function canResubmitRequest({ actor, request }) {
  if (!actor || !request) {
    return false;
  }

  return request.businessStatus === 'returned' && actor.id === request.requesterId;
}

export function canCancelRequest({ actor, request }) {
  if (!actor || !request) {
    return false;
  }

  if (!CANCEL_ALLOWED_STATUSES.has(request.businessStatus)) {
    return false;
  }

  if (actor.id !== request.requesterId) {
    return false;
  }

  return hasPermission(actor, 'cancel_request');
}

export function canReleaseToErp({ actor, request }) {
  if (!actor || !request) {
    return false;
  }

  if (request.businessStatus !== 'approved') {
    return false;
  }

  if (!ERP_RELEASE_ALLOWED_STATUSES.has(request.erpSyncStatus)) {
    return false;
  }

  return hasPermission(actor, 'release_to_erp');
}

export function canHoldErpSync({ actor, request }) {
  if (!actor || !request) {
    return false;
  }

  if (request.businessStatus !== 'approved') {
    return false;
  }

  return hasPermission(actor, 'hold_erp_sync');
}

export function canRetryErpPush({ actor, request }) {
  if (!actor || !request) {
    return false;
  }

  if (!ERP_RETRY_ALLOWED_STATUSES.has(request.erpSyncStatus)) {
    return false;
  }

  return hasPermission(actor, 'retry_erp_push');
}

export function canManageDepartmentSetup(actor) {
  return hasPermission(actor, 'manage_department_setup');
}
