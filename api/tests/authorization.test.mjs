import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canApproveRequest,
  canHoldErpSync,
  canReleaseToErp,
  canRetryErpPush,
  canViewRequest,
} from '../src/security/authorization.mjs';

function makeActor(overrides = {}) {
  return {
    id: 'user-1',
    departmentId: 'dep-a',
    permissions: [],
    ...overrides,
  };
}

function makeRequest(overrides = {}) {
  return {
    id: 'req-1',
    requesterId: 'requester-1',
    departmentId: 'dep-a',
    requestType: 'payment_request',
    visibilityMode: 'related_only',
    businessStatus: 'pending_approval',
    erpSyncStatus: 'not_ready',
    workflowUserIds: ['approver-1', 'hod-1'],
    currentStepApproverIds: ['approver-1'],
    additionalRelatedUserIds: [],
    ...overrides,
  };
}

test('requester can view own request', () => {
  const actor = makeActor({ id: 'requester-1' });
  const request = makeRequest();
  assert.equal(canViewRequest({ actor, request }), true);
});

test('unrelated user is blocked when visibility is related_only', () => {
  const actor = makeActor({ id: 'random-user', permissions: ['view_department_requests'] });
  const request = makeRequest({ visibilityMode: 'related_only' });
  assert.equal(canViewRequest({ actor, request }), false);
});

test('same department user can view when visibility is related_and_same_department', () => {
  const actor = makeActor({
    id: 'department-member',
    departmentId: 'dep-a',
    permissions: ['view_department_requests'],
  });
  const request = makeRequest({ visibilityMode: 'related_and_same_department' });
  assert.equal(canViewRequest({ actor, request }), true);
});

test('same department user is still blocked when permission is missing', () => {
  const actor = makeActor({
    id: 'department-member',
    departmentId: 'dep-a',
    permissions: [],
  });
  const request = makeRequest({ visibilityMode: 'related_and_same_department' });
  assert.equal(canViewRequest({ actor, request }), false);
});

test('finance user can view only in finance_shared mode', () => {
  const actor = makeActor({
    id: 'finance-user',
    departmentId: 'dep-finance',
    permissions: ['view_finance_scoped'],
  });

  assert.equal(
    canViewRequest({ actor, request: makeRequest({ visibilityMode: 'finance_shared' }) }),
    true
  );
  assert.equal(
    canViewRequest({ actor, request: makeRequest({ visibilityMode: 'related_only' }) }),
    false
  );
});

test('delegated approver can approve within validity window', () => {
  const actor = makeActor({
    id: 'delegate-1',
    permissions: ['approve_request'],
  });
  const request = makeRequest();
  const delegations = [{
    delegatorUserId: 'approver-1',
    delegateUserId: 'delegate-1',
    validFrom: '2026-03-20T00:00:00.000Z',
    validTo: '2026-03-30T23:59:59.000Z',
    scope: { type: 'all' },
    isActive: true,
  }];

  assert.equal(
    canApproveRequest({
      actor,
      request,
      delegations,
      now: new Date('2026-03-25T12:00:00.000Z'),
    }),
    true
  );
});

test('expired delegation cannot approve', () => {
  const actor = makeActor({
    id: 'delegate-1',
    permissions: ['approve_request'],
  });
  const request = makeRequest();
  const delegations = [{
    delegatorUserId: 'approver-1',
    delegateUserId: 'delegate-1',
    validFrom: '2026-03-01T00:00:00.000Z',
    validTo: '2026-03-05T00:00:00.000Z',
    scope: { type: 'all' },
    isActive: true,
  }];

  assert.equal(
    canApproveRequest({
      actor,
      request,
      delegations,
      now: new Date('2026-03-25T12:00:00.000Z'),
    }),
    false
  );
});

test('approver cannot approve without approve_request permission', () => {
  const actor = makeActor({ id: 'approver-1', permissions: [] });
  const request = makeRequest();
  assert.equal(canApproveRequest({ actor, request }), false);
});

test('finance operations can release approved request to ERP', () => {
  const actor = makeActor({
    id: 'finance-ops-1',
    permissions: ['release_to_erp', 'hold_erp_sync'],
  });
  const request = makeRequest({
    businessStatus: 'approved',
    erpSyncStatus: 'waiting_finance_release',
  });

  assert.equal(canReleaseToErp({ actor, request }), true);
  assert.equal(canHoldErpSync({ actor, request }), true);
});

test('business approver cannot release to ERP by default', () => {
  const actor = makeActor({
    id: 'approver-1',
    permissions: ['approve_request'],
  });
  const request = makeRequest({
    businessStatus: 'approved',
    erpSyncStatus: 'waiting_finance_release',
  });

  assert.equal(canReleaseToErp({ actor, request }), false);
});

test('ERP retry is allowed only for valid statuses and proper permission', () => {
  const financeActor = makeActor({
    id: 'finance-ops-1',
    permissions: ['retry_erp_push'],
  });
  const invalidActor = makeActor({
    id: 'approver-1',
    permissions: ['approve_request'],
  });
  const request = makeRequest({
    businessStatus: 'approved',
    erpSyncStatus: 'manual_review_required',
  });

  assert.equal(canRetryErpPush({ actor: financeActor, request }), true);
  assert.equal(canRetryErpPush({ actor: invalidActor, request }), false);
});

test('admin with view_all_requests can always view request', () => {
  const actor = makeActor({
    id: 'sys-admin',
    departmentId: 'dep-admin',
    permissions: ['view_all_requests'],
  });
  const request = makeRequest({ visibilityMode: 'related_only' });

  assert.equal(canViewRequest({ actor, request }), true);
});
