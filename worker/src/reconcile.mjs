export const WAITING_FINANCE_RELEASE_THRESHOLD_HOURS = 24;

export function mapJobStatusToRequestStatus(jobStatus) {
  switch (jobStatus) {
    case 'pending':
      return 'pending';
    case 'processing':
      return 'processing';
    case 'success':
      return 'success';
    case 'failed':
      return 'failed';
    case 'manual_review_required':
      return 'manual_review_required';
    default:
      return null;
  }
}

function toDate(input) {
  return input instanceof Date ? input : new Date(input);
}

export function detectReconcileActions({
  request,
  latestJob = null,
  now = new Date(),
  waitingFinanceReleaseThresholdHours = WAITING_FINANCE_RELEASE_THRESHOLD_HOURS,
}) {
  const actions = [];

  if (!request || request.businessStatus !== 'approved') {
    return actions;
  }

  if (
    request.erpSyncStatus === 'waiting_finance_release' &&
    request.updatedAt
  ) {
    const ageMs = toDate(now).getTime() - toDate(request.updatedAt).getTime();
    const thresholdMs = waitingFinanceReleaseThresholdHours * 60 * 60 * 1000;
    if (ageMs >= thresholdMs) {
      actions.push('flag_waiting_finance_release');
    }
  }

  if (
    request.erpReleaseAt &&
    ['pending', 'processing', 'failed', 'manual_review_required'].includes(request.erpSyncStatus) &&
    !latestJob
  ) {
    actions.push('recreate_missing_job');
  }

  if (latestJob) {
    const expectedRequestStatus = mapJobStatusToRequestStatus(latestJob.status);
    if (expectedRequestStatus && expectedRequestStatus !== request.erpSyncStatus) {
      actions.push('align_request_status_with_job');
    }
  }

  return actions;
}
