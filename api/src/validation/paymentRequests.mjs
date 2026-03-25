export function validateCreatePaymentRequest(payload) {
  const errors = [];

  if (!payload || typeof payload !== 'object') {
    return ['Payload must be a JSON object.'];
  }

  if (!payload.departmentId || typeof payload.departmentId !== 'string') {
    errors.push('departmentId is required.');
  }

  if (!payload.payeeName || typeof payload.payeeName !== 'string') {
    errors.push('payeeName is required.');
  }

  if (!payload.paymentType || typeof payload.paymentType !== 'string') {
    errors.push('paymentType is required.');
  }

  if (!payload.currency || typeof payload.currency !== 'string') {
    errors.push('currency is required.');
  }

  if (typeof payload.totalAmount !== 'number' || Number.isNaN(payload.totalAmount) || payload.totalAmount <= 0) {
    errors.push('totalAmount must be a positive number.');
  }

  if (!Array.isArray(payload.lineItems) || payload.lineItems.length === 0) {
    errors.push('At least one line item is required.');
  }

  if (payload.attachments !== undefined) {
    if (!Array.isArray(payload.attachments)) {
      errors.push('attachments must be an array when provided.');
    } else {
      payload.attachments.forEach((attachment, index) => {
        if (!attachment || typeof attachment !== 'object') {
          errors.push(`attachments[${index}] must be an object.`);
          return;
        }

        if (!attachment.attachmentType || typeof attachment.attachmentType !== 'string') {
          errors.push(`attachments[${index}].attachmentType is required.`);
        }

        if (!attachment.fileName || typeof attachment.fileName !== 'string') {
          errors.push(`attachments[${index}].fileName is required.`);
        }

        if (!attachment.filePath || typeof attachment.filePath !== 'string') {
          errors.push(`attachments[${index}].filePath is required.`);
        }

        if (
          typeof attachment.fileSize !== 'number' ||
          Number.isNaN(attachment.fileSize) ||
          attachment.fileSize < 0
        ) {
          errors.push(`attachments[${index}].fileSize must be a non-negative number.`);
        }
      });
    }
  }

  return errors;
}
