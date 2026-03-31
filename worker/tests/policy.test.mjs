import test from 'node:test';
import assert from 'node:assert/strict';
import { decideJobOutcome, getBackoffSeconds, MAX_AUTO_RETRIES } from '../src/policy.mjs';

test('small amount job succeeds immediately', () => {
  const result = decideJobOutcome({
    totalAmount: 120000,
    retryCount: 0,
  });

  assert.equal(result.jobStatus, 'success');
  assert.equal(result.requestStatus, 'success');
  assert.equal(result.errorCategory, null);
  assert.equal(result.shouldRetry, false);
});

test('transient ERP failure schedules retry before max retries', () => {
  const result = decideJobOutcome({
    totalAmount: 820000,
    retryCount: 1,
  });

  assert.equal(result.jobStatus, 'failed');
  assert.equal(result.requestStatus, 'failed');
  assert.equal(result.errorCategory, 'transient');
  assert.equal(result.shouldRetry, true);
});

test('transient ERP failure moves to manual review after max retries', () => {
  const result = decideJobOutcome({
    totalAmount: 820000,
    retryCount: MAX_AUTO_RETRIES,
  });

  assert.equal(result.jobStatus, 'manual_review_required');
  assert.equal(result.requestStatus, 'manual_review_required');
  assert.equal(result.errorCategory, 'transient');
  assert.equal(result.shouldRetry, false);
});

test('business ERP failure does not auto retry', () => {
  const result = decideJobOutcome({
    totalAmount: 950000,
    retryCount: 0,
  });

  assert.equal(result.jobStatus, 'manual_review_required');
  assert.equal(result.requestStatus, 'manual_review_required');
  assert.equal(result.errorCategory, 'business');
  assert.equal(result.shouldRetry, false);
});

test('backoff seconds increase with retry count and cap at 60', () => {
  assert.equal(getBackoffSeconds(0), 5);
  assert.equal(getBackoffSeconds(1), 10);
  assert.equal(getBackoffSeconds(20), 60);
});
