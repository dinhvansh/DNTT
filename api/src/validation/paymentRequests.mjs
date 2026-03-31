export function validateCreatePaymentRequest(payload) {
  const errors = [];

  if (!payload || typeof payload !== 'object') {
    return ['Payload must be a JSON object.'];
  }

  if (!payload.payeeName || typeof payload.payeeName !== 'string') {
    errors.push('payeeName is required.');
  }

  if (payload.templateCode !== undefined && typeof payload.templateCode !== 'string') {
    errors.push('templateCode must be a string when provided.');
  }

  if (payload.vendorCode !== undefined && typeof payload.vendorCode !== 'string') {
    errors.push('vendorCode must be a string when provided.');
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
  } else {
    payload.lineItems.forEach((lineItem, index) => {
      if (!lineItem || typeof lineItem !== 'object') {
        errors.push(`lineItems[${index}] must be an object.`);
        return;
      }

      if (!lineItem.description || typeof lineItem.description !== 'string') {
        errors.push(`lineItems[${index}].description is required.`);
      }

      if (lineItem.invoiceDate !== undefined && typeof lineItem.invoiceDate !== 'string') {
        errors.push(`lineItems[${index}].invoiceDate must be a string when provided.`);
      }

      if (lineItem.invoiceRef !== undefined && typeof lineItem.invoiceRef !== 'string') {
        errors.push(`lineItems[${index}].invoiceRef must be a string when provided.`);
      }

      if (lineItem.glCode !== undefined && typeof lineItem.glCode !== 'string') {
        errors.push(`lineItems[${index}].glCode must be a string when provided.`);
      }

      if (lineItem.costCenter !== undefined && typeof lineItem.costCenter !== 'string') {
        errors.push(`lineItems[${index}].costCenter must be a string when provided.`);
      }

      if (lineItem.projectCode !== undefined && typeof lineItem.projectCode !== 'string') {
        errors.push(`lineItems[${index}].projectCode must be a string when provided.`);
      }

      if (lineItem.expenseTypeCode !== undefined && typeof lineItem.expenseTypeCode !== 'string') {
        errors.push(`lineItems[${index}].expenseTypeCode must be a string when provided.`);
      }

      if (lineItem.currency !== undefined && typeof lineItem.currency !== 'string') {
        errors.push(`lineItems[${index}].currency must be a string when provided.`);
      }

      if (lineItem.exchangeRate !== undefined && (typeof lineItem.exchangeRate !== 'number' || Number.isNaN(lineItem.exchangeRate) || lineItem.exchangeRate <= 0)) {
        errors.push(`lineItems[${index}].exchangeRate must be a positive number when provided.`);
      }

      if (typeof lineItem.amount !== 'number' || Number.isNaN(lineItem.amount) || lineItem.amount < 0) {
        errors.push(`lineItems[${index}].amount must be a non-negative number.`);
      }

      if (lineItem.totalAmount !== undefined && (typeof lineItem.totalAmount !== 'number' || Number.isNaN(lineItem.totalAmount) || lineItem.totalAmount < 0)) {
        errors.push(`lineItems[${index}].totalAmount must be a non-negative number when provided.`);
      }

      if (lineItem.note !== undefined && typeof lineItem.note !== 'string') {
        errors.push(`lineItems[${index}].note must be a string when provided.`);
      }

      if (lineItem.remark !== undefined && typeof lineItem.remark !== 'string') {
        errors.push(`lineItems[${index}].remark must be a string when provided.`);
      }
    });
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
