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

function getActorAccessScopes({ actor, request, delegations = [], now = new Date() }) {
  const scopes = new Set();

  if (!actor || !request) {
    return scopes;
  }

  if (actor.id === request.requesterId) {
    scopes.add('requester');
  }

  const relatedIds = getRelatedUserIds({ request, delegations, now });
  if (relatedIds.has(actor.id)) {
    scopes.add('workflow_related');
  }

  if (
    actor.departmentId &&
    actor.departmentId === request.departmentId &&
    hasPermission(actor, 'view_department_requests')
  ) {
    scopes.add('department_viewer');
  }

  if (
    hasPermission(actor, 'view_finance_scoped') ||
    hasPermission(actor, 'release_to_erp') ||
    hasPermission(actor, 'hold_erp_sync') ||
    hasPermission(actor, 'retry_erp_push')
  ) {
    scopes.add('finance');
  }

  if (
    hasPermission(actor, 'view_all_requests') ||
    hasPermission(actor, 'manage_department_setup')
  ) {
    scopes.add('admin');
  }

  return scopes;
}

function isTemplateScopeAllowed(visibleTo, actorScopes) {
  if (!Array.isArray(visibleTo) || visibleTo.length === 0) {
    return false;
  }

  return visibleTo.some((scope) => actorScopes.has(scope));
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

  if (
    hasPermission(actor, 'view_finance_scoped') &&
    (
      request.businessStatus === 'approved' ||
      request.businessStatus === 'rejected' ||
      ERP_RELEASE_ALLOWED_STATUSES.has(request.erpSyncStatus) ||
      ERP_RETRY_ALLOWED_STATUSES.has(request.erpSyncStatus) ||
      request.erpSyncStatus === 'processing' ||
      request.erpSyncStatus === 'success'
    )
  ) {
    return true;
  }

  return false;
}

export function canViewSensitiveFinanceData({
  actor,
  request,
  delegations = [],
  now = new Date(),
  fieldName = 'bankAccountNumber',
}) {
  if (!actor || !request) {
    return false;
  }

  if (!canViewRequest({ actor, request, delegations, now })) {
    return false;
  }

  const fieldMasking = request.templateFormSchema?.fieldMasking?.[fieldName];
  if (fieldMasking) {
    if (fieldMasking.enabled !== true) {
      return true;
    }

    const actorScopes = getActorAccessScopes({ actor, request, delegations, now });
    return isTemplateScopeAllowed(fieldMasking.visibleTo, actorScopes);
  }

  if (hasPermission(actor, 'view_all_requests')) {
    return true;
  }

  if (hasPermission(actor, 'view_finance_scoped')) {
    return true;
  }

  const relatedIds = getRelatedUserIds({ request, delegations, now });
  return relatedIds.has(actor.id);
}

export function canViewAttachment({ actor, request, attachment, delegations = [], now = new Date() }) {
  if (!canViewRequest({ actor, request, delegations, now })) {
    return false;
  }

  const attachmentRule =
    request?.templateAttachmentRules?.visibilityByType?.[String(attachment?.attachmentType ?? '').toLowerCase()] ??
    request?.templateAttachmentRules?.visibilityByType?.[attachment?.attachmentType];

  if (attachmentRule) {
    const actorScopes = getActorAccessScopes({ actor, request, delegations, now });
    return isTemplateScopeAllowed(attachmentRule.visibleTo, actorScopes);
  }

  const sensitiveAttachmentTypes = new Set([
    'bank_proof',
    'bank_statement',
    'id_document',
    'bank_support',
  ]);

  if (!sensitiveAttachmentTypes.has(String(attachment?.attachmentType ?? '').toLowerCase())) {
    return true;
  }

  return canViewSensitiveFinanceData({ actor, request, delegations, now });
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

export function canFinanceApprove({ actor, request }) {
  if (!actor || !request) {
    return false;
  }

  if (request.businessStatus !== 'approved') {
    return false;
  }

  if (!ERP_RELEASE_ALLOWED_STATUSES.has(request.erpSyncStatus)) {
    return false;
  }

  return hasPermission(actor, 'hold_erp_sync') || hasPermission(actor, 'release_to_erp');
}

export function canFinanceReject({ actor, request }) {
  return canFinanceApprove({ actor, request });
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

export function canViewAuditEntries(actor) {
  return hasPermission(actor, 'view_audit_entries') || hasPermission(actor, 'view_all_requests');
}
