export const MAX_AUTO_RETRIES = 2;

export function getBackoffSeconds(retryCount) {
  return Math.min(60, 5 * Math.max(1, retryCount + 1));
}

export function decideJobOutcome({ totalAmount, retryCount }) {
  if (totalAmount >= 750000) {
    if (retryCount >= MAX_AUTO_RETRIES) {
      return {
        jobStatus: 'manual_review_required',
        requestStatus: 'manual_review_required',
        shouldRetry: false,
        errorMessage: 'ERP validation requires manual finance review.',
      };
    }

    return {
      jobStatus: 'failed',
      requestStatus: 'failed',
      shouldRetry: true,
      errorMessage: 'ERP validation failed. Worker scheduled automatic retry.',
    };
  }

  return {
    jobStatus: 'success',
    requestStatus: 'success',
    shouldRetry: false,
    errorMessage: null,
  };
}
