import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectReconcileActions,
  mapJobStatusToRequestStatus,
  WAITING_FINANCE_RELEASE_THRESHOLD_HOURS,
} from '../src/reconcile.mjs';

test('mapJobStatusToRequestStatus normalizes ERP job statuses', () => {
  assert.equal(mapJobStatusToRequestStatus('pending'), 'pending');
  assert.equal(mapJobStatusToRequestStatus('processing'), 'processing');
  assert.equal(mapJobStatusToRequestStatus('success'), 'success');
  assert.equal(mapJobStatusToRequestStatus('failed'), 'failed');
  assert.equal(mapJobStatusToRequestStatus('manual_review_required'), 'manual_review_required');
  assert.equal(mapJobStatusToRequestStatus('unknown'), null);
});

test('detectReconcileActions flags waiting finance release beyond threshold', () => {
  const actions = detectReconcileActions({
    request: {
      businessStatus: 'approved',
      erpSyncStatus: 'waiting_finance_release',
      updatedAt: '2026-03-24T00:00:00.000Z',
      erpReleaseAt: null,
    },
    latestJob: null,
    now: new Date('2026-03-25T01:00:00.000Z'),
  });

  assert.deepEqual(actions, ['flag_waiting_finance_release']);
});

test('detectReconcileActions recreates missing integration job after finance release', () => {
  const actions = detectReconcileActions({
    request: {
      businessStatus: 'approved',
      erpSyncStatus: 'pending',
      updatedAt: '2026-03-26T00:00:00.000Z',
      erpReleaseAt: '2026-03-26T00:01:00.000Z',
    },
    latestJob: null,
    now: new Date('2026-03-26T01:00:00.000Z'),
  });

  assert.deepEqual(actions, ['recreate_missing_job']);
});

test('detectReconcileActions aligns request status with latest job status', () => {
  const actions = detectReconcileActions({
    request: {
      businessStatus: 'approved',
      erpSyncStatus: 'pending',
      updatedAt: '2026-03-26T00:00:00.000Z',
      erpReleaseAt: '2026-03-26T00:01:00.000Z',
    },
    latestJob: {
      status: 'success',
    },
    now: new Date('2026-03-26T01:00:00.000Z'),
  });

  assert.deepEqual(actions, ['align_request_status_with_job']);
});

test('detectReconcileActions returns no action for non-approved requests', () => {
  const actions = detectReconcileActions({
    request: {
      businessStatus: 'pending_approval',
      erpSyncStatus: 'not_ready',
      updatedAt: '2026-03-26T00:00:00.000Z',
      erpReleaseAt: null,
    },
    latestJob: null,
    now: new Date('2026-03-26T01:00:00.000Z'),
  });

  assert.deepEqual(actions, []);
});
