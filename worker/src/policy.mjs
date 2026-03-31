export const MAX_AUTO_RETRIES = 2;

export function getBackoffSeconds(retryCount) {
  return Math.min(60, 5 * Math.max(1, retryCount + 1));
}

export function decideJobOutcome({ totalAmount, retryCount }) {
  if (totalAmount >= 900000) {
    return {
      jobStatus: 'manual_review_required',
      requestStatus: 'manual_review_required',
      errorCategory: 'business',
      shouldRetry: false,
      errorMessage: 'ERP business validation failed. Manual finance review is required.',
    };
  }

  if (totalAmount >= 750000) {
    if (retryCount >= MAX_AUTO_RETRIES) {
      return {
        jobStatus: 'manual_review_required',
        requestStatus: 'manual_review_required',
        errorCategory: 'transient',
        shouldRetry: false,
        errorMessage: 'ERP transient failure exceeded auto-retry threshold. Manual finance review is required.',
      };
    }

    return {
      jobStatus: 'failed',
      requestStatus: 'failed',
      errorCategory: 'transient',
      shouldRetry: true,
      errorMessage: 'ERP transient failure detected. Worker scheduled automatic retry.',
    };
  }

  return {
    jobStatus: 'success',
    requestStatus: 'success',
    errorCategory: null,
    shouldRetry: false,
    errorMessage: null,
  };
}
