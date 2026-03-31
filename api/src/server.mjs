import http from 'node:http';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import Busboy from 'busboy';
import { getConfig } from './config.mjs';
import { createRepository } from './data/index.mjs';
import { createWebhookPublisher } from './integration/webhook.mjs';
import { getAttachmentBinary, uploadAttachmentBinary } from './storage/objectStorage.mjs';
import {
  canApproveRequest,
  canFinanceApprove,
  canFinanceReject,
  canHoldErpSync,
  canCancelRequest,
  canManageDepartmentSetup,
  canRejectRequest,
  canReleaseToErp,
  canResubmitRequest,
  canSubmitRequest,
  canReturnRequest,
  canRetryErpPush,
  canViewAttachment,
  canViewSensitiveFinanceData,
  canViewAuditEntries,
  canViewRequest,
  hasPermission,
} from './security/authorization.mjs';
import { validateCreatePaymentRequest } from './validation/paymentRequests.mjs';
import { registerActor, resolveActorByEmail } from './data/actorResolver.mjs';

const config = getConfig();
const FIXED_NOW = new Date('2026-03-25T12:00:00.000Z');
const VCB_EXCHANGE_RATE_URL = 'https://portal.vietcombank.com.vn/Usercontrols/TVPortal.TyGia/pXML.aspx';

function json(response, statusCode, payload) {
  response.writeHead(statusCode, { 'content-type': 'application/json' });
  response.end(JSON.stringify(payload));
}

function getActorFromHeaders(request) {
  const userId = request.headers['x-user-id'];
  if (!userId || Array.isArray(userId)) {
    return null;
  }

  const departmentId = request.headers['x-user-department'];
  const rawPermissions = request.headers['x-user-permissions'];
  const permissions = Array.isArray(rawPermissions)
    ? rawPermissions
    : (rawPermissions ?? '')
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);

  return {
    id: userId,
    departmentId: Array.isArray(departmentId) ? departmentId[0] : (departmentId ?? null),
    permissions,
  };
}

async function readJsonBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function readMultipartAttachmentBody(request) {
  return new Promise((resolve, reject) => {
    const contentType = request.headers['content-type'] ?? '';
    if (!String(contentType).toLowerCase().includes('multipart/form-data')) {
      reject(new Error('Request must be multipart/form-data.'));
      return;
    }

    const busboy = Busboy({
      headers: request.headers,
      limits: {
        files: 1,
        fileSize: 25 * 1024 * 1024,
      },
    });

    let attachmentType = 'supporting_document';
    let fileName = '';
    let mimeType = 'application/octet-stream';
    const chunks = [];
    let size = 0;
    let rejected = false;

    busboy.on('field', (name, value) => {
      if (name === 'attachmentType' && typeof value === 'string' && value.trim()) {
        attachmentType = value.trim();
      }
    });

    busboy.on('file', (_fieldName, file, info) => {
      fileName = info.filename || 'attachment.bin';
      mimeType = info.mimeType || 'application/octet-stream';

      file.on('data', (chunk) => {
        chunks.push(chunk);
        size += chunk.length;
      });

      file.on('limit', () => {
        rejected = true;
        reject(new Error('File exceeds maximum allowed size of 25 MB.'));
      });
    });

    busboy.on('error', reject);
    busboy.on('finish', () => {
      if (rejected) {
        return;
      }

      if (!fileName) {
        reject(new Error('Attachment file is required.'));
        return;
      }

      resolve({
        attachmentType,
        fileName,
        contentType: mimeType,
        fileSize: size,
        data: Buffer.concat(chunks),
      });
    });

    request.pipe(busboy);
  });
}

function withAllowedActions(paymentRequest, actor, delegations = []) {
  return {
    ...paymentRequest,
    allowedActions: {
      approve: canApproveRequest({
        actor,
        request: paymentRequest,
        delegations,
        now: FIXED_NOW,
      }),
      reject: canRejectRequest({
        actor,
        request: paymentRequest,
        delegations,
        now: FIXED_NOW,
      }),
      returnRequest: canReturnRequest({
        actor,
        request: paymentRequest,
        delegations,
        now: FIXED_NOW,
      }),
      cancel: canCancelRequest({
        actor,
        request: paymentRequest,
      }),
      submit: canSubmitRequest({
        actor,
        request: paymentRequest,
      }),
      resubmit: canResubmitRequest({
        actor,
        request: paymentRequest,
      }),
      releaseToErp: canReleaseToErp({
        actor,
        request: paymentRequest,
      }),
      holdSync: canHoldErpSync({
        actor,
        request: paymentRequest,
      }),
      retryErpPush: canRetryErpPush({
        actor,
        request: paymentRequest,
      }),
      financeApprove: canFinanceApprove({
        actor,
        request: paymentRequest,
      }),
      financeReject: canFinanceReject({
        actor,
        request: paymentRequest,
      }),
    },
  };
}

function isSensitiveAttachmentType(attachmentType) {
  return new Set(['bank_proof', 'bank_statement', 'id_document', 'bank_support']).has(
    String(attachmentType ?? '').toLowerCase()
  );
}

function maskBankAccountNumber(value) {
  if (!value) {
    return value ?? null;
  }

  const digits = String(value).replace(/\D/g, '');
  if (digits.length <= 4) {
    return digits;
  }

  const maskedDigits = `${'*'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
  let digitIndex = 0;
  return String(value).replace(/\d/g, () => maskedDigits[digitIndex++] ?? '*');
}

function maskTextValue(value) {
  if (!value) {
    return value ?? null;
  }

  return 'Restricted';
}

function parseTemplateCode(input) {
  return typeof input === 'string' ? input.trim().toLowerCase() : '';
}

function applyRequestVisibility(paymentRequest, actor, delegations = []) {
  const canViewBankAccountNumber = canViewSensitiveFinanceData({
    actor,
    request: paymentRequest,
    delegations,
    now: FIXED_NOW,
    fieldName: 'bankAccountNumber',
  });
  const canViewBankAccountName = canViewSensitiveFinanceData({
    actor,
    request: paymentRequest,
    delegations,
    now: FIXED_NOW,
    fieldName: 'bankAccountName',
  });
  const canViewBankName = canViewSensitiveFinanceData({
    actor,
    request: paymentRequest,
    delegations,
    now: FIXED_NOW,
    fieldName: 'bankName',
  });

  return {
    ...paymentRequest,
    bankAccountNumber: canViewBankAccountNumber
      ? paymentRequest.bankAccountNumber ?? null
      : maskBankAccountNumber(paymentRequest.bankAccountNumber ?? null),
    bankAccountName: canViewBankAccountName
      ? paymentRequest.bankAccountName ?? null
      : maskTextValue(paymentRequest.bankAccountName ?? null),
    bankName: canViewBankName
      ? paymentRequest.bankName ?? null
      : maskTextValue(paymentRequest.bankName ?? null),
    canViewBankDetails: canViewBankAccountNumber && canViewBankAccountName && canViewBankName,
    attachments: (paymentRequest.attachments ?? [])
      .filter((attachment) =>
        canViewAttachment({
          actor,
          request: paymentRequest,
          attachment,
          delegations,
          now: FIXED_NOW,
        })
      )
      .map((attachment) => ({
        ...attachment,
        isSensitive: isSensitiveAttachmentType(attachment.attachmentType),
      })),
  };
}

async function handleListRequestTemplates(request, response, repository) {
  const actor = getActorFromHeaders(request);
  if (!actor) {
    json(response, 401, {
      error: 'unauthorized',
      message: 'Missing x-user-id header.',
    });
    return;
  }

  const data = await repository.listRequestTemplates?.() ?? [];
  const visibleTemplates = canManageDepartmentSetup(actor)
    ? data
    : data.filter((template) => template.isActive !== false);
  json(response, 200, { data: visibleTemplates, total: visibleTemplates.length });
}

async function handleCreateRequestTemplate(request, response, repository) {
  const actor = getActorFromHeaders(request);
  if (!actor) {
    json(response, 401, {
      error: 'unauthorized',
      message: 'Missing x-user-id header.',
    });
    return;
  }

  if (!canManageDepartmentSetup(actor)) {
    json(response, 403, {
      error: 'forbidden',
      message: 'You do not have permission to manage request templates.',
    });
    return;
  }

  const payload = await readJsonBody(request);
  const code = parseTemplateCode(payload.code);
  const name = parseSetupPayloadString(payload.name);
  const requestType = parseSetupPayloadString(payload.requestType) || 'payment_request';
  const description = parseSetupPayloadString(payload.description);
  const visibilityMode = parseSetupPayloadString(payload.visibilityMode) || 'related_only';

  const errors = [];
  if (!code) {
    errors.push('code is required.');
  }
  if (!/^[a-z0-9-_]+$/.test(code)) {
    errors.push('code must contain only lowercase letters, numbers, hyphens, or underscores.');
  }
  if (!name) {
    errors.push('name is required.');
  }

  if (errors.length > 0) {
    json(response, 400, {
      error: 'validation_error',
      message: 'Template payload is invalid.',
      details: errors,
    });
    return;
  }

  try {
    const created = await repository.createRequestTemplate({
      code,
      name,
      requestType,
      description,
      visibilityMode,
      formSchema: payload.formSchema ?? {},
      detailSchema: payload.detailSchema ?? {},
      attachmentRules: payload.attachmentRules ?? {},
      actorId: actor.id,
    });

    json(response, 201, { data: created });
  } catch (error) {
    json(response, 409, {
      error: 'conflict',
      message: error instanceof Error ? error.message : 'Template could not be created.',
    });
  }
}

async function handleUpdateRequestTemplate(request, response, repository) {
  const actor = getActorFromHeaders(request);
  if (!actor) {
    json(response, 401, {
      error: 'unauthorized',
      message: 'Missing x-user-id header.',
    });
    return;
  }

  if (!canManageDepartmentSetup(actor)) {
    json(response, 403, {
      error: 'forbidden',
      message: 'You do not have permission to manage request templates.',
    });
    return;
  }

  const templateCode = parseTemplateCode(getLastPathSegment(request));
  const payload = await readJsonBody(request);
  const name = parseSetupPayloadString(payload.name);

  if (!templateCode || !name) {
    json(response, 400, {
      error: 'validation_error',
      message: 'Template code and name are required.',
    });
    return;
  }

  try {
    const updated = await repository.updateRequestTemplate({
      templateCode,
      name,
      description: parseSetupPayloadString(payload.description),
      visibilityMode: parseSetupPayloadString(payload.visibilityMode) || 'related_only',
      isActive: payload.isActive !== false,
      formSchema: payload.formSchema ?? {},
      detailSchema: payload.detailSchema ?? {},
      attachmentRules: payload.attachmentRules ?? {},
      actorId: actor.id,
    });

    if (!updated) {
      json(response, 404, {
        error: 'not_found',
        message: 'Template does not exist.',
      });
      return;
    }

    json(response, 200, { data: updated });
  } catch (error) {
    json(response, 409, {
      error: 'conflict',
      message: error instanceof Error ? error.message : 'Template could not be updated.',
    });
  }
}

function canAccessFinanceReleaseQueue(actor) {
  return Boolean(
    actor &&
    (
      hasPermission(actor, 'view_all_requests') ||
      hasPermission(actor, 'release_to_erp') ||
      hasPermission(actor, 'hold_erp_sync')
    )
  );
}

function canAccessErpJobs(actor) {
  return Boolean(
    actor &&
    (
      hasPermission(actor, 'view_all_requests') ||
      hasPermission(actor, 'release_to_erp') ||
      hasPermission(actor, 'retry_erp_push')
    )
  );
}

async function publishRequestWebhook(webhook, eventName, paymentRequest, extra = {}) {
  try {
    await webhook.publish(eventName, {
      requestId: paymentRequest.id,
      requestNo: paymentRequest.requestNo,
      requesterId: paymentRequest.requesterId,
      departmentId: paymentRequest.departmentId,
      businessStatus: paymentRequest.businessStatus,
      erpSyncStatus: paymentRequest.erpSyncStatus,
      totalAmount: paymentRequest.totalAmount,
      currency: paymentRequest.currency,
      ...extra,
    });
  } catch (error) {
    console.warn(`[webhook] failed to deliver ${eventName}`, error);
  }
}

async function validateErpReadiness(repository, paymentRequest) {
  const errors = [];
  const references = await repository.listErpReferenceValues?.() ?? [];
  const activeReference = (referenceType, code) =>
    references.find((entry) =>
      entry.referenceType === referenceType &&
      entry.code === code &&
      entry.isActive !== false
    );
  const extractDetailMetadataCode = (detail, prefix) => {
    const remark = typeof detail?.remark === 'string' ? detail.remark : '';
    const match = remark
      .split('|')
      .map((entry) => entry.trim())
      .find((entry) => entry.toLowerCase().startsWith(prefix.toLowerCase()));

    return match ? match.slice(prefix.length).trim() : '';
  };
  const extractExpenseTypeCode = (detail) => {
    if (typeof detail?.expenseTypeCode === 'string' && detail.expenseTypeCode.trim()) {
      return detail.expenseTypeCode.trim().toLowerCase();
    }

    const codeFromRemark = extractDetailMetadataCode(detail, 'ERP Expense Type:');

    if (codeFromRemark) {
      return codeFromRemark.toLowerCase();
    }

    return String(detail?.description ?? '')
      .toLowerCase()
      .replace(/\s+/g, '_');
  };

  if (!paymentRequest.vendorCode) {
    errors.push({
      level: 'header',
      code: 'vendor_missing',
      message: 'Vendor code is required before ERP release.',
    });
  } else {
    const vendors = await repository.listVendors();
    const vendor = vendors.find((entry) => entry.code === paymentRequest.vendorCode && entry.isActive !== false);
    if (!vendor) {
      errors.push({
        level: 'header',
        code: 'vendor_not_found',
        message: `Vendor code ${paymentRequest.vendorCode} does not exist in ERP reference master.`,
      });
    }
  }

  if (!paymentRequest.details || paymentRequest.details.length === 0) {
    errors.push({
      level: 'header',
      code: 'detail_missing',
      message: 'At least one payment detail line is required for ERP release.',
    });
  }

  for (const detail of paymentRequest.details ?? []) {
    const linePrefix = `Line ${detail.lineNo}`;
    const expenseTypeCode = extractExpenseTypeCode(detail);
    const costCenterCode = detail?.costCenter || extractDetailMetadataCode(detail, 'ERP Cost Center:');
    const projectCode = detail?.projectCode || extractDetailMetadataCode(detail, 'ERP Project:');
    if (!detail.description) {
      errors.push({
        level: 'detail',
        lineNo: detail.lineNo,
        code: 'expense_type_missing',
        message: `${linePrefix}: expense type is required.`,
      });
    } else if (!activeReference('expense_type', expenseTypeCode)) {
      errors.push({
        level: 'detail',
        lineNo: detail.lineNo,
        code: 'expense_type_invalid',
        message: `${linePrefix}: expense type "${detail.description}" is not active in ERP reference master.`,
      });
    }

    if (!detail.glCode) {
      errors.push({
        level: 'detail',
        lineNo: detail.lineNo,
        code: 'gl_account_missing',
        message: `${linePrefix}: GL code is required.`,
      });
    } else if (!activeReference('gl_account', detail.glCode)) {
      errors.push({
        level: 'detail',
        lineNo: detail.lineNo,
        code: 'gl_account_invalid',
        message: `${linePrefix}: GL code "${detail.glCode}" is not active in ERP reference master.`,
      });
    }

    if (!costCenterCode) {
      errors.push({
        level: 'detail',
        lineNo: detail.lineNo,
        code: 'cost_center_missing',
        message: `${linePrefix}: cost center is required.`,
      });
    } else if (!activeReference('cost_center', costCenterCode)) {
      errors.push({
        level: 'detail',
        lineNo: detail.lineNo,
        code: 'cost_center_invalid',
        message: `${linePrefix}: cost center "${costCenterCode}" is not active in ERP reference master.`,
      });
    }

    if (!projectCode) {
      errors.push({
        level: 'detail',
        lineNo: detail.lineNo,
        code: 'project_missing',
        message: `${linePrefix}: project code is required.`,
      });
    } else if (!activeReference('project', projectCode)) {
      errors.push({
        level: 'detail',
        lineNo: detail.lineNo,
        code: 'project_invalid',
        message: `${linePrefix}: project code "${projectCode}" is not active in ERP reference master.`,
      });
    }
  }

  return {
    isReady: errors.length === 0,
    errors,
    validatedAt: new Date().toISOString(),
  };
}

function toErpReadinessSummary(readiness) {
  return {
    isReady: readiness.isReady,
    errorCount: readiness.errors.length,
    firstErrorMessage: readiness.errors[0]?.message ?? null,
    validatedAt: readiness.validatedAt,
  };
}

function isFinanceInboxRequest(actor, paymentRequest) {
  if (!actor || !paymentRequest) {
    return false;
  }

  const hasFinancePermission =
    hasPermission(actor, 'view_finance_scoped') ||
    hasPermission(actor, 'release_to_erp') ||
    hasPermission(actor, 'hold_erp_sync') ||
    hasPermission(actor, 'retry_erp_push');

  if (!hasFinancePermission) {
    return false;
  }

  return (
    paymentRequest.businessStatus === 'approved' ||
    paymentRequest.businessStatus === 'rejected' ||
    paymentRequest.erpSyncStatus === 'waiting_finance_release' ||
    paymentRequest.erpSyncStatus === 'hold_by_finance' ||
    paymentRequest.erpSyncStatus === 'pending' ||
    paymentRequest.erpSyncStatus === 'processing' ||
    paymentRequest.erpSyncStatus === 'success' ||
    paymentRequest.erpSyncStatus === 'failed' ||
    paymentRequest.erpSyncStatus === 'manual_review_required'
  );
}

function canRetryJob(actor, job, request) {
  if (!actor || !job) {
    return false;
  }

  if (job.errorCategory === 'business') {
    return false;
  }

  if (request) {
    return canRetryErpPush({ actor, request });
  }

  return ['failed', 'manual_review_required'].includes(job.status) && hasPermission(actor, 'retry_erp_push');
}

function withJobAllowedActions(job, actor, request) {
  return {
    ...job,
    allowedActions: {
      retry: canRetryJob(actor, job, request),
    },
  };
}

function parseSetupPayloadString(input) {
  return typeof input === 'string' ? input.trim() : '';
}

function parseNullableNumber(input) {
  if (input === null || input === undefined || input === '') {
    return null;
  }

  const parsed = Number(input);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function getLastPathSegment(request) {
  const url = new URL(request.url, 'http://localhost');
  const segments = url.pathname.split('/').filter(Boolean);
  return segments[segments.length - 1] ?? null;
}

function parseRateValue(input) {
  if (!input || input === '-') {
    return null;
  }

  const parsed = Number(String(input).replace(/,/g, '').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

async function fetchVietcombankExchangeRates() {
  const response = await fetch(VCB_EXCHANGE_RATE_URL, {
    headers: {
      'user-agent': 'DNTT Payment Request Local Runtime',
    },
  });

  if (!response.ok) {
    throw new Error(`Unable to fetch Vietcombank exchange rates (${response.status}).`);
  }

  const xml = await response.text();
  const fetchedAt = xml.match(/<DateTime>([^<]+)<\/DateTime>/i)?.[1] ?? null;
  const source = xml.match(/<Source>([^<]+)<\/Source>/i)?.[1] ?? 'Vietcombank';
  const entries = [];

  for (const match of xml.matchAll(/<Exrate\s+([^>]+?)\/>/gi)) {
    const attributes = Object.fromEntries(
      Array.from(match[1].matchAll(/(\w+)="([^"]*)"/g)).map((attributeMatch) => [attributeMatch[1], attributeMatch[2]])
    );

    entries.push({
      currencyCode: attributes.CurrencyCode,
      currencyName: attributes.CurrencyName?.trim() ?? attributes.CurrencyCode,
      buy: parseRateValue(attributes.Buy),
      transfer: parseRateValue(attributes.Transfer),
      sell: parseRateValue(attributes.Sell),
    });
  }

  return {
    fetchedAt,
    source,
    rates: entries,
  };
}

async function handleGetApprovalSetup(request, response, repository) {
  const actor = getActorFromHeaders(request);
  if (!actor) {
    json(response, 401, {
      error: 'unauthorized',
      message: 'Missing x-user-id header.',
    });
    return;
  }

  if (!canManageDepartmentSetup(actor)) {
    json(response, 403, {
      error: 'forbidden',
      message: 'You do not have permission to manage approval setup.',
    });
    return;
  }

  const data = await repository.getApprovalSetupData();
  json(response, 200, { data });
}

async function handleGetMasterData(request, response, repository) {
  const actor = getActorFromHeaders(request);
  if (!actor) {
    json(response, 401, {
      error: 'unauthorized',
      message: 'Missing x-user-id header.',
    });
    return;
  }

  if (!canManageDepartmentSetup(actor)) {
    json(response, 403, {
      error: 'forbidden',
      message: 'You do not have permission to manage master data.',
    });
    return;
  }

  const data = await repository.getMasterData();
  json(response, 200, { data });
}

async function handleGetErpReferenceData(request, response, repository) {
  const actor = getActorFromHeaders(request);
  if (!actor) {
    json(response, 401, {
      error: 'unauthorized',
      message: 'Missing x-user-id header.',
    });
    return;
  }

  if (!canManageDepartmentSetup(actor)) {
    json(response, 403, {
      error: 'forbidden',
      message: 'You do not have permission to manage ERP reference data.',
    });
    return;
  }

  const data = await repository.listErpReferenceValues();
  json(response, 200, { data, total: data.length });
}

async function handleGetErpReferenceSyncRuns(request, response, repository) {
  const actor = getActorFromHeaders(request);
  if (!actor) {
    json(response, 401, {
      error: 'unauthorized',
      message: 'Missing x-user-id header.',
    });
    return;
  }

  if (!canManageDepartmentSetup(actor)) {
    json(response, 403, {
      error: 'forbidden',
      message: 'You do not have permission to manage ERP reference data.',
    });
    return;
  }

  const data = await repository.listErpSyncRuns?.(20) ?? [];
  json(response, 200, { data, total: data.length });
}

async function handleListPublicErpReferenceData(request, response, repository) {
  const actor = getActorFromHeaders(request);
  if (!actor) {
    json(response, 401, {
      error: 'unauthorized',
      message: 'Missing x-user-id header.',
    });
    return;
  }

  const data = await repository.listErpReferenceValues();
  json(response, 200, { data, total: data.length });
}

async function handleSyncErpReferenceData(request, response, repository) {
  const actor = getActorFromHeaders(request);
  if (!actor) {
    json(response, 401, {
      error: 'unauthorized',
      message: 'Missing x-user-id header.',
    });
    return;
  }

  if (!canManageDepartmentSetup(actor)) {
    json(response, 403, {
      error: 'forbidden',
      message: 'You do not have permission to sync ERP reference data.',
    });
    return;
  }

  const payload = await readJsonBody(request);
  const referenceType = parseSetupPayloadString(payload.referenceType) || 'all';
  const values = Array.isArray(payload.values) ? payload.values : [];
  const result = await repository.syncErpReferenceValues({
    referenceType,
    values,
    actorId: actor.id,
  });

  json(response, 200, { data: result });
}

async function handleListVendors(request, response, repository) {
  const actor = getActorFromHeaders(request);
  if (!actor) {
    json(response, 401, {
      error: 'unauthorized',
      message: 'Missing x-user-id header.',
    });
    return;
  }

  const data = await repository.listVendors();
  json(response, 200, { data, total: data.length });
}

async function handleGetVietcombankExchangeRates(request, response) {
  const actor = getActorFromHeaders(request);
  if (!actor) {
    json(response, 401, {
      error: 'unauthorized',
      message: 'Missing x-user-id header.',
    });
    return;
  }

  const data = await fetchVietcombankExchangeRates();
  json(response, 200, { data });
}

async function handleUploadAttachment(request, response, storage) {
  const actor = getActorFromHeaders(request);
  if (!actor) {
    json(response, 401, {
      error: 'unauthorized',
      message: 'Missing x-user-id header.',
    });
    return;
  }

  let payload;
  try {
    payload = await readMultipartAttachmentBody(request);
  } catch (error) {
    json(response, 400, {
      error: 'validation_error',
      message: error instanceof Error ? error.message : 'Invalid upload payload.',
    });
    return;
  }

  const uploaded = await storage.uploadAttachmentBinary({
    config,
    actorId: actor.id,
    fileName: payload.fileName,
    contentType: payload.contentType,
    data: payload.data,
  });

  json(response, 201, {
    data: {
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`,
      attachmentType: payload.attachmentType,
      fileName: uploaded.fileName,
      filePath: uploaded.filePath,
      fileSize: uploaded.fileSize,
      uploadedAt: uploaded.uploadedAt,
    },
  });
}

function getAttachmentIdFromPath(request) {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  const segments = pathname.split('/');
  return segments[3] ?? null;
}

async function handleGetAttachmentContent(request, response, repository, storage) {
  const actor = getActorFromHeaders(request);
  if (!actor) {
    json(response, 401, {
      error: 'unauthorized',
      message: 'Missing x-user-id header.',
    });
    return;
  }

  const attachmentId = getAttachmentIdFromPath(request);
  if (!attachmentId) {
    json(response, 400, {
      error: 'validation_error',
      message: 'Attachment id is required.',
    });
    return;
  }

  const attachment = await repository.getAttachmentById?.(attachmentId);
  if (!attachment) {
    json(response, 404, {
      error: 'not_found',
      message: 'Attachment does not exist.',
    });
    return;
  }

  const paymentRequest = await repository.getPaymentRequestById(attachment.requestId);
  if (!paymentRequest) {
    json(response, 404, {
      error: 'not_found',
      message: 'Payment request does not exist.',
    });
    return;
  }

  const delegations = await repository.listDelegations();
  if (!canViewAttachment({
    actor,
    request: paymentRequest,
    attachment,
    delegations,
    now: FIXED_NOW,
  })) {
    json(response, 403, {
      error: 'forbidden',
      message: 'You do not have permission to view this attachment.',
    });
    return;
  }

  try {
    const asset = await storage.getAttachmentBinary({
      config,
      filePath: attachment.filePath,
      fileName: attachment.fileName,
    });
    const url = new URL(request.url, 'http://localhost');
    const shouldDownload = url.searchParams.get('download') === '1';
    const safeFileName = String(attachment.fileName || 'attachment.bin').replace(/"/g, '');

    response.writeHead(200, {
      'content-type': asset.contentType || 'application/octet-stream',
      'content-length': String(asset.data.length),
      'content-disposition': `${shouldDownload ? 'attachment' : 'inline'}; filename="${safeFileName}"`,
      'cache-control': 'no-store',
    });
    response.end(asset.data);
  } catch (error) {
    json(response, 422, {
      error: 'attachment_unavailable',
      message: error instanceof Error ? error.message : 'Attachment content is unavailable.',
    });
  }
}

async function handleCreateDepartment(request, response, repository) {
  const actor = getActorFromHeaders(request);
  if (!actor) {
    json(response, 401, {
      error: 'unauthorized',
      message: 'Missing x-user-id header.',
    });
    return;
  }

  if (!canManageDepartmentSetup(actor)) {
    json(response, 403, {
      error: 'forbidden',
      message: 'You do not have permission to manage approval setup.',
    });
    return;
  }

  const payload = await readJsonBody(request);
  const code = parseSetupPayloadString(payload.code).toLowerCase();
  const name = parseSetupPayloadString(payload.name);

  const errors = [];
  if (!code) {
    errors.push('code is required.');
  }
  if (!/^[a-z0-9-]+$/.test(code)) {
    errors.push('code must contain only lowercase letters, numbers, and hyphens.');
  }
  if (!name) {
    errors.push('name is required.');
  }

  if (errors.length > 0) {
    json(response, 400, {
      error: 'validation_error',
      message: 'Department payload is invalid.',
      details: errors,
    });
    return;
  }

  const department = await repository.createDepartment({
    code,
    name,
    actorId: actor.id,
  });
  json(response, 201, { data: department });
}

async function handleCreatePosition(request, response, repository) {
  const actor = getActorFromHeaders(request);
  if (!actor) {
    json(response, 401, {
      error: 'unauthorized',
      message: 'Missing x-user-id header.',
    });
    return;
  }

  if (!canManageDepartmentSetup(actor)) {
    json(response, 403, {
      error: 'forbidden',
      message: 'You do not have permission to manage approval setup.',
    });
    return;
  }

  const payload = await readJsonBody(request);
  const code = parseSetupPayloadString(payload.code).toLowerCase();
  const name = parseSetupPayloadString(payload.name);
  const isGlobal = Boolean(payload.isGlobal);

  const errors = [];
  if (!code) {
    errors.push('code is required.');
  }
  if (!/^[a-z0-9_-]+$/.test(code)) {
    errors.push('code must contain only lowercase letters, numbers, underscores, and hyphens.');
  }
  if (!name) {
    errors.push('name is required.');
  }

  if (errors.length > 0) {
    json(response, 400, {
      error: 'validation_error',
      message: 'Position payload is invalid.',
      details: errors,
    });
    return;
  }

  const position = await repository.createPosition({
    code,
    name,
    isGlobal,
    actorId: actor.id,
  });

  json(response, 201, { data: position });
}

async function handleUpdateMasterDataDepartment(request, response, repository) {
  const actor = getActorFromHeaders(request);
  if (!actor) {
    json(response, 401, {
      error: 'unauthorized',
      message: 'Missing x-user-id header.',
    });
    return;
  }

  if (!canManageDepartmentSetup(actor)) {
    json(response, 403, {
      error: 'forbidden',
      message: 'You do not have permission to manage master data.',
    });
    return;
  }

  const payload = await readJsonBody(request);
  const departmentCode = getLastPathSegment(request);
  const name = parseSetupPayloadString(payload.name);
  const isActive = payload.isActive !== false;

  if (!departmentCode || !name) {
    json(response, 400, {
      error: 'validation_error',
      message: 'Department payload is invalid.',
      details: ['department code and name are required.'],
    });
    return;
  }

  const department = await repository.updateDepartment({
    departmentCode,
    name,
    isActive,
    actorId: actor.id,
  });

  if (!department) {
    json(response, 404, {
      error: 'not_found',
      message: 'Department does not exist.',
    });
    return;
  }

  json(response, 200, { data: department });
}

async function handleUpdateMasterDataPosition(request, response, repository) {
  const actor = getActorFromHeaders(request);
  if (!actor) {
    json(response, 401, {
      error: 'unauthorized',
      message: 'Missing x-user-id header.',
    });
    return;
  }

  if (!canManageDepartmentSetup(actor)) {
    json(response, 403, {
      error: 'forbidden',
      message: 'You do not have permission to manage master data.',
    });
    return;
  }

  const payload = await readJsonBody(request);
  const positionCode = getLastPathSegment(request);
  const name = parseSetupPayloadString(payload.name);
  const isGlobal = Boolean(payload.isGlobal);
  const isActive = payload.isActive !== false;

  if (!positionCode || !name) {
    json(response, 400, {
      error: 'validation_error',
      message: 'Position payload is invalid.',
      details: ['position code and name are required.'],
    });
    return;
  }

  const position = await repository.updatePosition({
    positionCode,
    name,
    isGlobal,
    isActive,
    actorId: actor.id,
  });

  if (!position) {
    json(response, 404, {
      error: 'not_found',
      message: 'Position does not exist.',
    });
    return;
  }

  json(response, 200, { data: position });
}

async function handleUpdateDepartmentApprovalSetup(request, response, repository) {
  const actor = getActorFromHeaders(request);
  if (!actor) {
    json(response, 401, {
      error: 'unauthorized',
      message: 'Missing x-user-id header.',
    });
    return;
  }

  if (!canManageDepartmentSetup(actor)) {
    json(response, 403, {
      error: 'forbidden',
      message: 'You do not have permission to manage approval setup.',
    });
    return;
  }

  const payload = await readJsonBody(request);
  const departmentCode = getLastPathSegment(request);
  const reviewerUserId = parseSetupPayloadString(payload.reviewerUserId) || null;
  const reviewerPositionCode = parseSetupPayloadString(payload.reviewerPositionCode) || null;
  const hodUserId = parseSetupPayloadString(payload.hodUserId) || null;
  const hodPositionCode = parseSetupPayloadString(payload.hodPositionCode) || null;
  const fallbackUserId = parseSetupPayloadString(payload.fallbackUserId) || null;
  const fallbackPositionCode = parseSetupPayloadString(payload.fallbackPositionCode) || null;
  const stepOrder = Array.isArray(payload.stepOrder)
    ? payload.stepOrder.filter((entry) => ['line_manager', 'reviewer', 'hod'].includes(entry))
    : ['line_manager', 'reviewer', 'hod'];

  const updatedDepartment = await repository.saveDepartmentApprovalSetup({
    departmentCode,
    reviewerUserId,
    reviewerPositionCode,
    hodUserId,
    hodPositionCode,
    fallbackUserId,
    fallbackPositionCode,
    stepOrder,
    actorId: actor.id,
  });

  if (!updatedDepartment) {
    json(response, 404, {
      error: 'not_found',
      message: 'Department does not exist.',
    });
    return;
  }

  json(response, 200, { data: updatedDepartment });
}

async function handleUpdateGlobalApproverConfig(request, response, repository) {
  const actor = getActorFromHeaders(request);
  if (!actor) {
    json(response, 401, {
      error: 'unauthorized',
      message: 'Missing x-user-id header.',
    });
    return;
  }

  if (!canManageDepartmentSetup(actor)) {
    json(response, 403, {
      error: 'forbidden',
      message: 'You do not have permission to manage approval setup.',
    });
    return;
  }

  const payload = await readJsonBody(request);
  const cfoPositionCode = parseSetupPayloadString(payload.cfoPositionCode) || null;
  const ceoPositionCode = parseSetupPayloadString(payload.ceoPositionCode) || null;
  const cfoAmountThreshold = parseNullableNumber(payload.cfoAmountThreshold);
  const ceoAmountThreshold = parseNullableNumber(payload.ceoAmountThreshold);

  const errors = [];
  if (Number.isNaN(cfoAmountThreshold)) {
    errors.push('cfoAmountThreshold must be a number or empty.');
  }
  if (Number.isNaN(ceoAmountThreshold)) {
    errors.push('ceoAmountThreshold must be a number or empty.');
  }
  if (
    cfoAmountThreshold !== null &&
    ceoAmountThreshold !== null &&
    ceoAmountThreshold < cfoAmountThreshold
  ) {
    errors.push('ceoAmountThreshold must be greater than or equal to cfoAmountThreshold.');
  }

  if (errors.length > 0) {
    json(response, 400, {
      error: 'validation_error',
      message: 'Global approver payload is invalid.',
      details: errors,
    });
    return;
  }

  const updated = await repository.saveGlobalApproverConfig({
    cfoPositionCode,
    ceoPositionCode,
    cfoAmountThreshold,
    ceoAmountThreshold,
    actorId: actor.id,
  });

  json(response, 200, { data: updated });
}

async function handleCreateMasterDataUser(request, response, repository) {
  const actor = getActorFromHeaders(request);
  if (!actor) {
    json(response, 401, {
      error: 'unauthorized',
      message: 'Missing x-user-id header.',
    });
    return;
  }

  if (!canManageDepartmentSetup(actor)) {
    json(response, 403, {
      error: 'forbidden',
      message: 'You do not have permission to manage master data.',
    });
    return;
  }

  const payload = await readJsonBody(request);
  const fullName = parseSetupPayloadString(payload.fullName);
  const email = parseSetupPayloadString(payload.email).toLowerCase();
  const departmentCode = parseSetupPayloadString(payload.departmentId);
  const positionCode = parseSetupPayloadString(payload.positionCode);
  const lineManagerId = parseSetupPayloadString(payload.lineManagerId) || null;
  const roleCode = parseSetupPayloadString(payload.roleCode);

  const errors = [];
  if (!fullName) errors.push('fullName is required.');
  if (!email || !email.includes('@')) errors.push('Valid email is required.');
  if (!departmentCode) errors.push('departmentId is required.');
  if (!positionCode) errors.push('positionCode is required.');
  if (!roleCode) errors.push('roleCode is required.');

  if (errors.length > 0) {
    json(response, 400, {
      error: 'validation_error',
      message: 'User payload is invalid.',
      details: errors,
    });
    return;
  }

  const user = await repository.createMasterDataUser({
    fullName,
    email,
    departmentCode,
    positionCode,
    lineManagerId,
    roleCode,
    actorId: actor.id,
  });

  json(response, 201, { data: user });
}

async function handleCreateMasterDataVendor(request, response, repository) {
  const actor = getActorFromHeaders(request);
  if (!actor) {
    json(response, 401, {
      error: 'unauthorized',
      message: 'Missing x-user-id header.',
    });
    return;
  }

  if (!canManageDepartmentSetup(actor)) {
    json(response, 403, {
      error: 'forbidden',
      message: 'You do not have permission to manage master data.',
    });
    return;
  }

  const payload = await readJsonBody(request);
  const code = parseSetupPayloadString(payload.code).toUpperCase();
  const name = parseSetupPayloadString(payload.name);
  const currency = parseSetupPayloadString(payload.currency) || 'VND';
  const bankAccountName = parseSetupPayloadString(payload.bankAccountName) || null;
  const bankAccountNumber = parseSetupPayloadString(payload.bankAccountNumber) || null;
  const bankName = parseSetupPayloadString(payload.bankName) || null;

  const errors = [];
  if (!code) errors.push('code is required.');
  if (!name) errors.push('name is required.');
  if (!currency) errors.push('currency is required.');

  if (errors.length > 0) {
    json(response, 400, {
      error: 'validation_error',
      message: 'Vendor payload is invalid.',
      details: errors,
    });
    return;
  }

  const vendor = await repository.createMasterDataVendor({
    code,
    name,
    currency,
    bankAccountName,
    bankAccountNumber,
    bankName,
    actorId: actor.id,
  });

  json(response, 201, { data: vendor });
}

async function handleUpdateMasterDataUser(request, response, repository) {
  const actor = getActorFromHeaders(request);
  if (!actor) {
    json(response, 401, {
      error: 'unauthorized',
      message: 'Missing x-user-id header.',
    });
    return;
  }

  if (!canManageDepartmentSetup(actor)) {
    json(response, 403, {
      error: 'forbidden',
      message: 'You do not have permission to manage master data.',
    });
    return;
  }

  const payload = await readJsonBody(request);
  const userId = getLastPathSegment(request);
  const fullName = parseSetupPayloadString(payload.fullName);
  const departmentCode = parseSetupPayloadString(payload.departmentId);
  const positionCode = parseSetupPayloadString(payload.positionCode);
  const lineManagerId = parseSetupPayloadString(payload.lineManagerId) || null;
  const roleCode = parseSetupPayloadString(payload.roleCode);
  const isActive = payload.isActive !== false;

  const errors = [];
  if (!fullName) errors.push('fullName is required.');
  if (!departmentCode) errors.push('departmentId is required.');
  if (!positionCode) errors.push('positionCode is required.');
  if (!roleCode) errors.push('roleCode is required.');

  if (errors.length > 0) {
    json(response, 400, {
      error: 'validation_error',
      message: 'User payload is invalid.',
      details: errors,
    });
    return;
  }

  const user = await repository.updateMasterDataUser({
    userId,
    fullName,
    departmentCode,
    positionCode,
    lineManagerId,
    roleCode,
    isActive,
    actorId: actor.id,
  });

  if (!user) {
    json(response, 404, {
      error: 'not_found',
      message: 'User does not exist.',
    });
    return;
  }

  json(response, 200, { data: user });
}

async function handleDeleteMasterDataUser(request, response, repository) {
  const actor = getActorFromHeaders(request);
  if (!actor) {
    json(response, 401, {
      error: 'unauthorized',
      message: 'Missing x-user-id header.',
    });
    return;
  }

  if (!canManageDepartmentSetup(actor)) {
    json(response, 403, {
      error: 'forbidden',
      message: 'You do not have permission to manage master data.',
    });
    return;
  }

  const userId = getLastPathSegment(request);
  const deleted = await repository.deleteMasterDataUser({
    userId,
    actorId: actor.id,
  });

  if (!deleted) {
    json(response, 404, {
      error: 'not_found',
      message: 'User does not exist.',
    });
    return;
  }

  json(response, 200, { success: true });
}

async function handleDeleteMasterDataDepartment(request, response, repository) {
  const actor = getActorFromHeaders(request);
  if (!actor) {
    json(response, 401, {
      error: 'unauthorized',
      message: 'Missing x-user-id header.',
    });
    return;
  }

  if (!canManageDepartmentSetup(actor)) {
    json(response, 403, {
      error: 'forbidden',
      message: 'You do not have permission to manage master data.',
    });
    return;
  }

  try {
    const deleted = await repository.deleteDepartment({
      departmentCode: getLastPathSegment(request),
      actorId: actor.id,
    });

    if (!deleted) {
      json(response, 404, {
        error: 'not_found',
        message: 'Department does not exist.',
      });
      return;
    }

    json(response, 200, { success: true });
  } catch (error) {
    json(response, 409, {
      error: 'conflict',
      message: error instanceof Error ? error.message : 'Department cannot be deleted.',
    });
  }
}

async function handleDeleteMasterDataPosition(request, response, repository) {
  const actor = getActorFromHeaders(request);
  if (!actor) {
    json(response, 401, {
      error: 'unauthorized',
      message: 'Missing x-user-id header.',
    });
    return;
  }

  if (!canManageDepartmentSetup(actor)) {
    json(response, 403, {
      error: 'forbidden',
      message: 'You do not have permission to manage master data.',
    });
    return;
  }

  try {
    const deleted = await repository.deletePosition({
      positionCode: getLastPathSegment(request),
      actorId: actor.id,
    });

    if (!deleted) {
      json(response, 404, {
        error: 'not_found',
        message: 'Position does not exist.',
      });
      return;
    }

    json(response, 200, { success: true });
  } catch (error) {
    json(response, 409, {
      error: 'conflict',
      message: error instanceof Error ? error.message : 'Position cannot be deleted.',
    });
  }
}

async function handleGetPaymentRequest(request, response, repository) {
  const actor = getActorFromHeaders(request);
  if (!actor) {
    json(response, 401, {
      error: 'unauthorized',
      message: 'Missing x-user-id header.',
    });
    return;
  }

  const url = new URL(request.url, 'http://localhost');
  const requestId = url.pathname.split('/').pop();
  const paymentRequest = await repository.getPaymentRequestById(requestId);

  if (!paymentRequest) {
    json(response, 404, {
      error: 'not_found',
      message: 'Payment request does not exist.',
    });
    return;
  }

  const delegations = await repository.listDelegations();
  const allowed = canViewRequest({
    actor,
    request: paymentRequest,
    delegations,
    now: FIXED_NOW,
  });

  if (!allowed) {
    json(response, 403, {
      error: 'forbidden',
      message: 'You do not have permission to view this payment request.',
    });
    return;
  }

  const visibleRequest = applyRequestVisibility(paymentRequest, actor, delegations);
  json(response, 200, { data: withAllowedActions(visibleRequest, actor, delegations) });
}

async function handleGetPaymentRequestAuditLogs(request, response, repository) {
  const actor = getActorFromHeaders(request);
  if (!actor) {
    json(response, 401, {
      error: 'unauthorized',
      message: 'Missing x-user-id header.',
    });
    return;
  }

  const paymentRequest = await getPaymentRequestOrRespond(request, response, repository);
  if (!paymentRequest) {
    return;
  }

  const delegations = await repository.listDelegations();
  if (!canViewRequest({
    actor,
    request: paymentRequest,
    delegations,
    now: FIXED_NOW,
  })) {
    json(response, 403, {
      error: 'forbidden',
      message: 'You do not have permission to view audit entries for this payment request.',
    });
    return;
  }

  const data = await repository.listPaymentRequestAuditLogs(paymentRequest.id);
  json(response, 200, { data, total: data.length });
}

async function handleGetPaymentRequestErpReadiness(request, response, repository) {
  const actor = getActorFromHeaders(request);
  if (!actor) {
    json(response, 401, {
      error: 'unauthorized',
      message: 'Missing x-user-id header.',
    });
    return;
  }

  const paymentRequest = await getPaymentRequestOrRespond(request, response, repository);
  if (!paymentRequest) {
    return;
  }

  const delegations = await repository.listDelegations();
  if (!canViewRequest({
    actor,
    request: paymentRequest,
    delegations,
    now: FIXED_NOW,
  })) {
    json(response, 403, {
      error: 'forbidden',
      message: 'You do not have permission to validate ERP readiness for this payment request.',
    });
    return;
  }

  const data = await validateErpReadiness(repository, paymentRequest);
  json(response, 200, { data });
}

async function handleListAuditLogs(request, response, repository) {
  const actor = getActorFromHeaders(request);
  if (!actor) {
    json(response, 401, {
      error: 'unauthorized',
      message: 'Missing x-user-id header.',
    });
    return;
  }

  if (!canViewAuditEntries(actor)) {
    json(response, 403, {
      error: 'forbidden',
      message: 'You do not have permission to view audit entries.',
    });
    return;
  }

  const url = new URL(request.url, 'http://localhost');
  const entityType = typeof url.searchParams.get('entityType') === 'string'
    ? url.searchParams.get('entityType')?.trim() || null
    : null;
  const entityId = typeof url.searchParams.get('entityId') === 'string'
    ? url.searchParams.get('entityId')?.trim() || null
    : null;
  const rawLimit = url.searchParams.get('limit');
  const parsedLimit = Number(rawLimit);
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0
    ? Math.min(parsedLimit, 200)
    : 100;

  const data = await repository.listAuditLogs({ entityType, entityId, limit });
  json(response, 200, { data, total: data.length });
}

async function getPaymentRequestOrRespond(request, response, repository) {
  const url = new URL(request.url, 'http://localhost');
  const requestId = url.pathname.split('/')[3];
  const paymentRequest = await repository.getPaymentRequestById(requestId);

  if (!paymentRequest) {
    json(response, 404, {
      error: 'not_found',
      message: 'Payment request does not exist.',
    });
    return null;
  }

  return paymentRequest;
}

async function handleListPaymentRequests(request, response, repository) {
  const actor = getActorFromHeaders(request);
  if (!actor) {
    json(response, 401, {
      error: 'unauthorized',
      message: 'Missing x-user-id header.',
    });
    return;
  }

  const [paymentRequests, delegations] = await Promise.all([
    repository.listPaymentRequests(),
    repository.listDelegations(),
  ]);

  const visibleRequests = paymentRequests.filter((paymentRequest) => paymentRequest.requesterId === actor.id);

  json(response, 200, {
    data: visibleRequests.map((paymentRequest) => withAllowedActions(paymentRequest, actor, delegations)),
    total: visibleRequests.length,
  });
}

async function handleApprovePaymentRequest(request, response, repository, webhook) {
  const actor = getActorFromHeaders(request);
  if (!actor) {
    json(response, 401, {
      error: 'unauthorized',
      message: 'Missing x-user-id header.',
    });
    return;
  }

  const paymentRequest = await getPaymentRequestOrRespond(request, response, repository);
  if (!paymentRequest) {
    return;
  }

  const delegations = await repository.listDelegations();
  if (!canApproveRequest({
    actor,
    request: paymentRequest,
    delegations,
    now: FIXED_NOW,
  })) {
    json(response, 403, {
      error: 'forbidden',
      message: 'You do not have permission to approve this payment request.',
    });
    return;
  }

  const updatedRequest = await repository.approvePaymentRequest({
    requestId: paymentRequest.id,
    actorId: actor.id,
  });

  await publishRequestWebhook(webhook, 'payment_request.approved', updatedRequest, {
    actorId: actor.id,
    action: 'approve',
  });

  json(response, 200, { data: withAllowedActions(updatedRequest, actor, delegations) });
}

async function handleSubmitPaymentRequest(request, response, repository, webhook) {
  const actor = getActorFromHeaders(request);
  if (!actor) {
    json(response, 401, {
      error: 'unauthorized',
      message: 'Missing x-user-id header.',
    });
    return;
  }

  const paymentRequest = await getPaymentRequestOrRespond(request, response, repository);
  if (!paymentRequest) {
    return;
  }

  if (!canSubmitRequest({ actor, request: paymentRequest })) {
    json(response, 403, {
      error: 'forbidden',
      message: 'You do not have permission to submit this payment request.',
    });
    return;
  }

  const payload = await readJsonBody(request);
  const lineManagerOverrideId = parseSetupPayloadString(payload.lineManagerOverrideId) || null;
  const lineManagerOverrideReason = parseSetupPayloadString(payload.lineManagerOverrideReason) || null;

  if (lineManagerOverrideId && !lineManagerOverrideReason) {
    json(response, 400, {
      error: 'validation_error',
      message: 'Line manager override reason is required.',
      details: ['lineManagerOverrideReason is required when override is selected.'],
    });
    return;
  }

  let updatedRequest;
  try {
    updatedRequest = await repository.submitPaymentRequest({
      requestId: paymentRequest.id,
      actorId: actor.id,
      lineManagerOverrideId,
      lineManagerOverrideReason,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'No approver chain could be resolved for this request.') {
      const issues = Array.isArray(error.issues) ? error.issues : [];
      const firstBlockingIssue = issues.find((entry) => entry?.severity === 'error')?.message;
      json(response, 400, {
        error: 'workflow_resolution_failed',
        message:
          firstBlockingIssue ??
          'Cannot submit because no approver chain could be resolved. Check line manager, department approval setup, and CFO/CEO configuration for this requester department.',
        details: issues,
      });
      return;
    }
    if (error instanceof Error && error.message === 'Line manager override is not valid for this requester.') {
      json(response, 400, {
        error: 'workflow_override_invalid',
        message: 'Selected line manager override is not allowed for this requester.',
      });
      return;
    }

    throw error;
  }

  const delegations = await repository.listDelegations();
  await publishRequestWebhook(webhook, 'payment_request.submitted', updatedRequest, {
    actorId: actor.id,
    action: 'submit',
  });
  json(response, 200, { data: withAllowedActions(updatedRequest, actor, delegations) });
}

async function handlePreviewPaymentRequestWorkflow(request, response, repository) {
  const actor = getActorFromHeaders(request);
  if (!actor) {
    json(response, 401, {
      error: 'unauthorized',
      message: 'Missing x-user-id header.',
    });
    return;
  }

  const payload = await readJsonBody(request);
  const totalAmount = Number(payload.totalAmount ?? 0);
  const lineManagerOverrideId = parseSetupPayloadString(payload.lineManagerOverrideId) || null;

  if (!Number.isFinite(totalAmount) || totalAmount < 0) {
    json(response, 400, {
      error: 'validation_error',
      message: 'totalAmount must be a valid non-negative number.',
    });
    return;
  }

  try {
    const preview = await repository.previewWorkflow({
      requesterId: actor.id,
      totalAmount,
      lineManagerOverrideId,
    });
    json(response, 200, { data: preview });
  } catch (error) {
    if (error instanceof Error && error.message === 'Line manager override is not valid for this requester.') {
      json(response, 400, {
        error: 'workflow_override_invalid',
        message: 'Selected line manager override is not allowed for this requester.',
      });
      return;
    }

    throw error;
  }
}

async function handleRejectPaymentRequest(request, response, repository, webhook) {
  const actor = getActorFromHeaders(request);
  if (!actor) {
    json(response, 401, {
      error: 'unauthorized',
      message: 'Missing x-user-id header.',
    });
    return;
  }

  const paymentRequest = await getPaymentRequestOrRespond(request, response, repository);
  if (!paymentRequest) {
    return;
  }

  const delegations = await repository.listDelegations();
  if (!canRejectRequest({
    actor,
    request: paymentRequest,
    delegations,
    now: FIXED_NOW,
  })) {
    json(response, 403, {
      error: 'forbidden',
      message: 'You do not have permission to reject this payment request.',
    });
    return;
  }

  const payload = await readJsonBody(request);
  const note = parseSetupPayloadString(payload.note);
  if (!note) {
    json(response, 400, {
      error: 'validation_error',
      message: 'Reject reason is required.',
      details: ['note is required.'],
    });
    return;
  }

  const updatedRequest = await repository.rejectPaymentRequest({
    requestId: paymentRequest.id,
    actorId: actor.id,
    note,
  });

  await publishRequestWebhook(webhook, 'payment_request.rejected', updatedRequest, {
    actorId: actor.id,
    action: 'reject',
    note,
  });

  json(response, 200, { data: withAllowedActions(updatedRequest, actor, delegations) });
}

async function handleCancelPaymentRequest(request, response, repository, webhook) {
  const actor = getActorFromHeaders(request);
  if (!actor) {
    json(response, 401, {
      error: 'unauthorized',
      message: 'Missing x-user-id header.',
    });
    return;
  }

  const paymentRequest = await getPaymentRequestOrRespond(request, response, repository);
  if (!paymentRequest) {
    return;
  }

  if (!canCancelRequest({ actor, request: paymentRequest })) {
    json(response, 403, {
      error: 'forbidden',
      message: 'You do not have permission to cancel this payment request.',
    });
    return;
  }

  const updatedRequest = await repository.cancelPaymentRequest({
    requestId: paymentRequest.id,
    actorId: actor.id,
  });

  const delegations = await repository.listDelegations();
  await publishRequestWebhook(webhook, 'payment_request.cancelled', updatedRequest, {
    actorId: actor.id,
    action: 'cancel',
  });
  json(response, 200, { data: withAllowedActions(updatedRequest, actor, delegations) });
}

async function handleReleaseToErp(request, response, repository, webhook) {
  const actor = getActorFromHeaders(request);
  if (!actor) {
    json(response, 401, {
      error: 'unauthorized',
      message: 'Missing x-user-id header.',
    });
    return;
  }

  const paymentRequest = await getPaymentRequestOrRespond(request, response, repository);
  if (!paymentRequest) {
    return;
  }

  if (!canReleaseToErp({ actor, request: paymentRequest })) {
    json(response, 403, {
      error: 'forbidden',
      message: 'You do not have permission to release this payment request to ERP.',
    });
    return;
  }

  const readiness = await validateErpReadiness(repository, paymentRequest);
  if (!readiness.isReady) {
    json(response, 400, {
      error: 'erp_readiness_failed',
      message: 'Cannot release to ERP because reference validation failed.',
      details: readiness.errors,
    });
    return;
  }

  const updatedRequest = await repository.releaseToErp({
    requestId: paymentRequest.id,
    actorId: actor.id,
  });

  await publishRequestWebhook(webhook, 'payment_request.erp_released', updatedRequest, {
    actorId: actor.id,
    action: 'release_to_erp',
  });

  json(response, 200, { data: withAllowedActions(updatedRequest, actor) });
}

async function handleFinanceApprove(request, response, repository, webhook) {
  const actor = getActorFromHeaders(request);
  if (!actor) {
    json(response, 401, {
      error: 'unauthorized',
      message: 'Missing x-user-id header.',
    });
    return;
  }

  const paymentRequest = await getPaymentRequestOrRespond(request, response, repository);
  if (!paymentRequest) {
    return;
  }

  if (!canFinanceApprove({ actor, request: paymentRequest })) {
    json(response, 403, {
      error: 'forbidden',
      message: 'You do not have permission to finance-approve this payment request.',
    });
    return;
  }

  const updatedRequest = await repository.financeApprove({
    requestId: paymentRequest.id,
    actorId: actor.id,
  });

  await publishRequestWebhook(webhook, 'payment_request.finance_approved', updatedRequest, {
    actorId: actor.id,
    action: 'finance_approve',
  });

  json(response, 200, { data: withAllowedActions(updatedRequest, actor) });
}

async function handleFinanceReject(request, response, repository, webhook) {
  const actor = getActorFromHeaders(request);
  if (!actor) {
    json(response, 401, {
      error: 'unauthorized',
      message: 'Missing x-user-id header.',
    });
    return;
  }

  const paymentRequest = await getPaymentRequestOrRespond(request, response, repository);
  if (!paymentRequest) {
    return;
  }

  if (!canFinanceReject({ actor, request: paymentRequest })) {
    json(response, 403, {
      error: 'forbidden',
      message: 'You do not have permission to finance-reject this payment request.',
    });
    return;
  }

  const payload = await readJsonBody(request);
  const note = parseSetupPayloadString(payload.note);
  if (!note) {
    json(response, 400, {
      error: 'validation_error',
      message: 'Finance reject reason is required.',
      details: ['note is required.'],
    });
    return;
  }

  const updatedRequest = await repository.financeReject({
    requestId: paymentRequest.id,
    actorId: actor.id,
    note,
  });

  await publishRequestWebhook(webhook, 'payment_request.finance_rejected', updatedRequest, {
    actorId: actor.id,
    action: 'finance_reject',
    note,
  });

  json(response, 200, { data: withAllowedActions(updatedRequest, actor) });
}

async function handleReturnPaymentRequest(request, response, repository, webhook) {
  const actor = getActorFromHeaders(request);
  if (!actor) {
    json(response, 401, {
      error: 'unauthorized',
      message: 'Missing x-user-id header.',
    });
    return;
  }

  const paymentRequest = await getPaymentRequestOrRespond(request, response, repository);
  if (!paymentRequest) {
    return;
  }

  const delegations = await repository.listDelegations();
  if (!canReturnRequest({
    actor,
    request: paymentRequest,
    delegations,
    now: FIXED_NOW,
  })) {
    json(response, 403, {
      error: 'forbidden',
      message: 'You do not have permission to return this payment request.',
    });
    return;
  }

  const updatedRequest = await repository.returnPaymentRequest({
    requestId: paymentRequest.id,
    actorId: actor.id,
  });

  await publishRequestWebhook(webhook, 'payment_request.returned', updatedRequest, {
    actorId: actor.id,
    action: 'return',
  });

  json(response, 200, { data: withAllowedActions(updatedRequest, actor, delegations) });
}

async function handleResubmitPaymentRequest(request, response, repository, webhook) {
  const actor = getActorFromHeaders(request);
  if (!actor) {
    json(response, 401, {
      error: 'unauthorized',
      message: 'Missing x-user-id header.',
    });
    return;
  }

  const paymentRequest = await getPaymentRequestOrRespond(request, response, repository);
  if (!paymentRequest) {
    return;
  }

  if (!canResubmitRequest({ actor, request: paymentRequest })) {
    json(response, 403, {
      error: 'forbidden',
      message: 'You do not have permission to resubmit this payment request.',
    });
    return;
  }

  const updatedRequest = await repository.resubmitPaymentRequest({
    requestId: paymentRequest.id,
    actorId: actor.id,
  });

  const delegations = await repository.listDelegations();
  await publishRequestWebhook(webhook, 'payment_request.resubmitted', updatedRequest, {
    actorId: actor.id,
    action: 'resubmit',
  });
  json(response, 200, { data: withAllowedActions(updatedRequest, actor, delegations) });
}

async function handleMyApprovals(request, response, repository) {
  const actor = getActorFromHeaders(request);
  if (!actor) {
    json(response, 401, {
      error: 'unauthorized',
      message: 'Missing x-user-id header.',
    });
    return;
  }

  const [paymentRequests, delegations] = await Promise.all([
    repository.listPaymentRequests(),
    repository.listDelegations(),
  ]);

  const approvals = paymentRequests.filter((paymentRequest) =>
    canApproveRequest({
      actor,
      request: paymentRequest,
      delegations,
      now: FIXED_NOW,
    }) ||
    canFinanceApprove({
      actor,
      request: paymentRequest,
    }) ||
    canFinanceReject({
      actor,
      request: paymentRequest,
    }) ||
    canReleaseToErp({
      actor,
      request: paymentRequest,
    }) ||
    canHoldErpSync({
      actor,
      request: paymentRequest,
    }) ||
    isFinanceInboxRequest(actor, paymentRequest)
  );

  json(response, 200, {
    data: approvals.map((paymentRequest) => withAllowedActions(paymentRequest, actor, delegations)),
    total: approvals.length,
  });
}

async function handleFinanceReleaseQueue(request, response, repository) {
  const actor = getActorFromHeaders(request);
  if (!actor) {
    json(response, 401, {
      error: 'unauthorized',
      message: 'Missing x-user-id header.',
    });
    return;
  }

  if (!canAccessFinanceReleaseQueue(actor)) {
    json(response, 403, {
      error: 'forbidden',
      message: 'You do not have permission to access the finance release queue.',
    });
    return;
  }

  const requests = await repository.listFinanceReleaseQueue();
  const data = await Promise.all(
    requests.map(async (paymentRequest) => {
      const readiness = await validateErpReadiness(repository, paymentRequest);
      return {
        ...withAllowedActions(paymentRequest, actor),
        erpReadinessSummary: toErpReadinessSummary(readiness),
      };
    })
  );

  json(response, 200, {
    data,
    total: data.length,
  });
}

async function handleHoldErpSync(request, response, repository, webhook) {
  const actor = getActorFromHeaders(request);
  if (!actor) {
    json(response, 401, {
      error: 'unauthorized',
      message: 'Missing x-user-id header.',
    });
    return;
  }

  const paymentRequest = await getPaymentRequestOrRespond(request, response, repository);
  if (!paymentRequest) {
    return;
  }

  if (!canHoldErpSync({ actor, request: paymentRequest })) {
    json(response, 403, {
      error: 'forbidden',
      message: 'You do not have permission to hold ERP sync for this payment request.',
    });
    return;
  }

  const updatedRequest = await repository.holdErpSync({
    requestId: paymentRequest.id,
    actorId: actor.id,
  });

  await publishRequestWebhook(webhook, 'payment_request.erp_hold', updatedRequest, {
    actorId: actor.id,
    action: 'hold_erp_sync',
  });

  json(response, 200, { data: withAllowedActions(updatedRequest, actor) });
}

async function handleListErpJobs(request, response, repository) {
  const actor = getActorFromHeaders(request);
  if (!actor) {
    json(response, 401, {
      error: 'unauthorized',
      message: 'Missing x-user-id header.',
    });
    return;
  }

  if (!canAccessErpJobs(actor)) {
    json(response, 403, {
      error: 'forbidden',
      message: 'You do not have permission to access ERP jobs.',
    });
    return;
  }

  const [jobs, paymentRequests] = await Promise.all([
    repository.listIntegrationJobs(),
    repository.listPaymentRequests(),
  ]);

  const requestsById = new Map(paymentRequests.map((entry) => [entry.id, entry]));
  json(response, 200, {
    data: jobs.map((job) => withJobAllowedActions(job, actor, job.requestId ? requestsById.get(job.requestId) ?? null : null)),
    total: jobs.length,
  });
}

async function handleRetryErpJob(request, response, repository) {
  const actor = getActorFromHeaders(request);
  if (!actor) {
    json(response, 401, {
      error: 'unauthorized',
      message: 'Missing x-user-id header.',
    });
    return;
  }

  const url = new URL(request.url, 'http://localhost');
  const jobId = url.pathname.split('/')[3];
  const [job] = (await repository.listIntegrationJobs()).filter((entry) => entry.id === jobId);

  if (!job) {
    json(response, 404, {
      error: 'not_found',
      message: 'ERP integration job does not exist.',
    });
    return;
  }

  const paymentRequest = job.requestId ? await repository.getPaymentRequestById(job.requestId) : null;
  if (!canRetryJob(actor, job, paymentRequest)) {
    json(response, 403, {
      error: 'forbidden',
      message: 'You do not have permission to retry this ERP job.',
    });
    return;
  }

  const updatedJob = await repository.retryIntegrationJob({
    jobId,
    actorId: actor.id,
  });

  const updatedRequest = updatedJob.requestId ? await repository.getPaymentRequestById(updatedJob.requestId) : null;
  json(response, 200, { data: withJobAllowedActions(updatedJob, actor, updatedRequest) });
}

async function handleCreatePaymentRequest(request, response, repository, webhook) {
  const actor = getActorFromHeaders(request);
  if (!actor) {
    json(response, 401, {
      error: 'unauthorized',
      message: 'Missing x-user-id header.',
    });
    return;
  }

  const payload = await readJsonBody(request);
  const errors = validateCreatePaymentRequest(payload);
  if (errors.length > 0) {
    json(response, 400, {
      error: 'validation_error',
      message: 'Payment request payload is invalid.',
      details: errors,
    });
    return;
  }

  const created = await repository.createPaymentRequest({
    requesterId: actor.id,
    requesterName: payload.requesterName ?? actor.id,
    templateCode: payload.templateCode ?? null,
    vendorCode: payload.vendorCode ?? null,
    payeeName: payload.payeeName,
    paymentType: payload.paymentType,
    currency: payload.currency,
    totalAmount: payload.totalAmount,
    priority: payload.priority ?? 'medium',
    reason: payload.reason ?? '',
    visibilityMode: payload.visibilityMode ?? 'related_only',
    lineItems: payload.lineItems,
    attachments: payload.attachments ?? [],
  });

  await publishRequestWebhook(webhook, 'payment_request.created', created, {
    actorId: actor.id,
    action: 'create',
  });

  json(response, 201, { data: withAllowedActions(created, actor) });
}

async function handleGetMe(request, response) {
  const email = request.headers['x-user-email'];
  if (!email || Array.isArray(email)) {
    json(response, 401, { error: 'unauthorized', message: 'Missing x-user-email header.' });
    return;
  }

  const actor = await resolveActorByEmail(config, email);
  if (!actor) {
    json(response, 404, { error: 'not_found', message: 'No user record found for this email.' });
    return;
  }

  json(response, 200, { data: actor });
}

async function handleRegister(request, response) {
  const payload = await readJsonBody(request);
  const fullName = typeof payload.fullName === 'string' ? payload.fullName.trim() : '';
  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
  const password = typeof payload.password === 'string' ? payload.password : '';
  const departmentId = typeof payload.departmentId === 'string' ? payload.departmentId.trim() : '';
  const roleCode = typeof payload.roleCode === 'string' ? payload.roleCode.trim() : 'staff';

  const errors = [];
  if (!fullName) errors.push('fullName is required.');
  if (!email || !email.includes('@')) errors.push('Valid email is required.');
  if (password.length < 4) errors.push('Password must be at least 4 characters.');
  if (!departmentId) errors.push('departmentId is required.');

  if (errors.length > 0) {
    json(response, 400, {
      error: 'validation_error',
      message: 'Registration payload is invalid.',
      details: errors,
    });
    return;
  }

  try {
    const actor = await registerActor(config, {
      fullName,
      email,
      departmentId,
      roleCode,
    });

    json(response, 201, { data: actor });
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes('already registered')) {
      json(response, 409, {
        error: 'conflict',
        message: error.message,
      });
      return;
    }

    throw error;
  }
}

export function createServer(options = {}) {
  const repository = options.repository ?? createRepository(config);
  const storage = options.storage ?? { uploadAttachmentBinary, getAttachmentBinary };
  const webhook = options.webhook ?? createWebhookPublisher(config);

  return http.createServer(async (request, response) => {
    try {
      // CORS headers for browser requests
      response.setHeader('Access-Control-Allow-Origin', '*');
      response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      response.setHeader('Access-Control-Allow-Headers', 'content-type, x-user-id, x-user-department, x-user-permissions, x-user-email');

      if (request.method === 'OPTIONS') {
        response.writeHead(204);
        response.end();
        return;
      }

      if (request.method === 'GET' && request.url === '/healthz') {
        json(response, 200, {
          status: 'ok',
          service: 'payment-request-api',
          nodeEnv: config.nodeEnv,
          dataSource: config.apiDataSource,
        });
        return;
      }

      if (request.method === 'GET' && request.url === '/api/me') {
        await handleGetMe(request, response);
        return;
      }

      if (request.method === 'POST' && request.url === '/api/register') {
        await handleRegister(request, response);
        return;
      }

      if (request.method === 'GET' && request.url === '/api/setup/approval') {
        await handleGetApprovalSetup(request, response, repository);
        return;
      }

      if (request.method === 'GET' && request.url === '/api/setup/master-data') {
        await handleGetMasterData(request, response, repository);
        return;
      }

      if (request.method === 'GET' && request.url === '/api/setup/erp-reference-data') {
        await handleGetErpReferenceData(request, response, repository);
        return;
      }

      if (request.method === 'GET' && request.url === '/api/setup/erp-reference-sync-runs') {
        await handleGetErpReferenceSyncRuns(request, response, repository);
        return;
      }

      if (request.method === 'POST' && request.url === '/api/setup/erp-reference-data/sync') {
        await handleSyncErpReferenceData(request, response, repository);
        return;
      }

      if (request.method === 'GET' && request.url === '/api/vendors') {
        await handleListVendors(request, response, repository);
        return;
      }

      if (request.method === 'GET' && request.url === '/api/erp-reference-data') {
        await handleListPublicErpReferenceData(request, response, repository);
        return;
      }

      if (request.method === 'GET' && request.url === '/api/templates') {
        await handleListRequestTemplates(request, response, repository);
        return;
      }

      if (request.method === 'POST' && request.url === '/api/templates') {
        await handleCreateRequestTemplate(request, response, repository);
        return;
      }

      if (request.method === 'PUT' && request.url?.startsWith('/api/templates/')) {
        await handleUpdateRequestTemplate(request, response, repository);
        return;
      }

      if (request.method === 'GET' && request.url === '/api/exchange-rates/vietcombank') {
        await handleGetVietcombankExchangeRates(request, response);
        return;
      }

      if (request.method === 'POST' && request.url === '/api/uploads/attachments') {
        await handleUploadAttachment(request, response, storage);
        return;
      }

      if (request.method === 'GET' && request.url?.startsWith('/api/attachments/') && request.url?.includes('/content')) {
        await handleGetAttachmentContent(request, response, repository, storage);
        return;
      }

        if (request.method === 'POST' && request.url === '/api/setup/departments') {
          await handleCreateDepartment(request, response, repository);
          return;
        }

        if (request.method === 'POST' && request.url === '/api/setup/positions') {
          await handleCreatePosition(request, response, repository);
          return;
        }

        if (request.method === 'POST' && request.url === '/api/setup/users') {
          await handleCreateMasterDataUser(request, response, repository);
          return;
        }

      if (request.method === 'POST' && request.url === '/api/setup/vendors') {
        await handleCreateMasterDataVendor(request, response, repository);
        return;
      }

      if (request.method === 'PUT' && request.url?.startsWith('/api/setup/departments/')) {
        await handleUpdateDepartmentApprovalSetup(request, response, repository);
        return;
      }

      if (request.method === 'PUT' && request.url?.startsWith('/api/setup/master-data/departments/')) {
        await handleUpdateMasterDataDepartment(request, response, repository);
        return;
      }

      if (request.method === 'PUT' && request.url?.startsWith('/api/setup/master-data/positions/')) {
        await handleUpdateMasterDataPosition(request, response, repository);
        return;
      }

      if (request.method === 'PUT' && request.url?.startsWith('/api/setup/users/')) {
        await handleUpdateMasterDataUser(request, response, repository);
        return;
      }

      if (request.method === 'DELETE' && request.url?.startsWith('/api/setup/users/')) {
        await handleDeleteMasterDataUser(request, response, repository);
        return;
      }

      if (request.method === 'DELETE' && request.url?.startsWith('/api/setup/master-data/departments/')) {
        await handleDeleteMasterDataDepartment(request, response, repository);
        return;
      }

      if (request.method === 'DELETE' && request.url?.startsWith('/api/setup/master-data/positions/')) {
        await handleDeleteMasterDataPosition(request, response, repository);
        return;
      }

      if (request.method === 'PUT' && request.url === '/api/setup/global-approvers') {
        await handleUpdateGlobalApproverConfig(request, response, repository);
        return;
      }

      if (request.method === 'GET' && request.url === '/api/payment-requests') {
        await handleListPaymentRequests(request, response, repository);
        return;
      }

      if (request.method === 'GET' && request.url?.startsWith('/api/audit-logs')) {
        await handleListAuditLogs(request, response, repository);
        return;
      }

      if (request.method === 'GET' && request.url?.endsWith('/audit-logs')) {
        await handleGetPaymentRequestAuditLogs(request, response, repository);
        return;
      }

      if (request.method === 'GET' && request.url?.endsWith('/erp-readiness')) {
        await handleGetPaymentRequestErpReadiness(request, response, repository);
        return;
      }

      if (request.method === 'POST' && request.url === '/api/payment-requests') {
        await handleCreatePaymentRequest(request, response, repository, webhook);
        return;
      }

      if (request.method === 'POST' && request.url === '/api/payment-requests/preview-workflow') {
        await handlePreviewPaymentRequestWorkflow(request, response, repository);
        return;
      }

      if (request.method === 'GET' && request.url === '/api/my-approvals') {
        await handleMyApprovals(request, response, repository);
        return;
      }

      if (request.method === 'GET' && request.url === '/api/finance-release-queue') {
        await handleFinanceReleaseQueue(request, response, repository);
        return;
      }

      if (request.method === 'GET' && request.url === '/api/erp-jobs') {
        await handleListErpJobs(request, response, repository);
        return;
      }

      if (request.method === 'GET' && request.url?.startsWith('/api/payment-requests/')) {
        await handleGetPaymentRequest(request, response, repository);
        return;
      }

      if (request.method === 'POST' && request.url?.endsWith('/approve')) {
        await handleApprovePaymentRequest(request, response, repository, webhook);
        return;
      }

      if (request.method === 'POST' && request.url?.endsWith('/submit')) {
        await handleSubmitPaymentRequest(request, response, repository, webhook);
        return;
      }

      if (request.method === 'POST' && request.url?.endsWith('/reject')) {
        await handleRejectPaymentRequest(request, response, repository, webhook);
        return;
      }

      if (request.method === 'POST' && request.url?.endsWith('/cancel')) {
        await handleCancelPaymentRequest(request, response, repository, webhook);
        return;
      }

      if (request.method === 'POST' && request.url?.endsWith('/release-to-erp')) {
        await handleReleaseToErp(request, response, repository, webhook);
        return;
      }

      if (request.method === 'POST' && request.url?.endsWith('/finance-approve')) {
        await handleFinanceApprove(request, response, repository, webhook);
        return;
      }

      if (request.method === 'POST' && request.url?.endsWith('/finance-reject')) {
        await handleFinanceReject(request, response, repository, webhook);
        return;
      }

      if (request.method === 'POST' && request.url?.endsWith('/return')) {
        await handleReturnPaymentRequest(request, response, repository, webhook);
        return;
      }

      if (request.method === 'POST' && request.url?.endsWith('/resubmit')) {
        await handleResubmitPaymentRequest(request, response, repository, webhook);
        return;
      }

      if (request.method === 'POST' && request.url?.endsWith('/hold-erp-sync')) {
        await handleHoldErpSync(request, response, repository, webhook);
        return;
      }

      if (request.method === 'POST' && request.url?.endsWith('/retry')) {
        await handleRetryErpJob(request, response, repository);
        return;
      }

      json(response, 404, {
        error: 'not_found',
        message: 'Route has not been implemented yet.',
      });
    } catch (error) {
      console.error('Unhandled API error', error);
      json(response, 500, {
        error: 'internal_error',
        message: 'An unexpected error occurred.',
      });
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = createServer();
  server.listen(config.port, () => {
    console.log(`payment-request-api listening on :${config.port}`);
  });
}
