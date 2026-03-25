import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { getConfig } from './config.mjs';
import { createRepository } from './data/index.mjs';
import {
  canApproveRequest,
  canHoldErpSync,
  canCancelRequest,
  canManageDepartmentSetup,
  canRejectRequest,
  canReleaseToErp,
  canResubmitRequest,
  canSubmitRequest,
  canReturnRequest,
  canRetryErpPush,
  canViewRequest,
  hasPermission,
} from './security/authorization.mjs';
import { validateCreatePaymentRequest } from './validation/paymentRequests.mjs';
import { registerActor, resolveActorByEmail } from './data/actorResolver.mjs';

const config = getConfig();
const FIXED_NOW = new Date('2026-03-25T12:00:00.000Z');

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
    },
  };
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

function canRetryJob(actor, job, request) {
  if (!actor || !job) {
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
  const hodUserId = parseSetupPayloadString(payload.hodUserId) || null;
  const fallbackUserId = parseSetupPayloadString(payload.fallbackUserId) || null;

  const updatedDepartment = await repository.saveDepartmentApprovalSetup({
    departmentCode,
    reviewerUserId,
    hodUserId,
    fallbackUserId,
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
  const cfoUserId = parseSetupPayloadString(payload.cfoUserId) || null;
  const ceoUserId = parseSetupPayloadString(payload.ceoUserId) || null;
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
    cfoUserId,
    ceoUserId,
    cfoAmountThreshold,
    ceoAmountThreshold,
    actorId: actor.id,
  });

  json(response, 200, { data: updated });
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

  json(response, 200, { data: withAllowedActions(paymentRequest, actor, delegations) });
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

  const visibleRequests = paymentRequests.filter((paymentRequest) =>
    canViewRequest({
      actor,
      request: paymentRequest,
      delegations,
      now: FIXED_NOW,
    })
  );

  json(response, 200, {
    data: visibleRequests.map((paymentRequest) => withAllowedActions(paymentRequest, actor, delegations)),
    total: visibleRequests.length,
  });
}

async function handleApprovePaymentRequest(request, response, repository) {
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

  json(response, 200, { data: withAllowedActions(updatedRequest, actor, delegations) });
}

async function handleSubmitPaymentRequest(request, response, repository) {
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

  const updatedRequest = await repository.submitPaymentRequest({
    requestId: paymentRequest.id,
    actorId: actor.id,
  });

  const delegations = await repository.listDelegations();
  json(response, 200, { data: withAllowedActions(updatedRequest, actor, delegations) });
}

async function handleRejectPaymentRequest(request, response, repository) {
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

  const updatedRequest = await repository.rejectPaymentRequest({
    requestId: paymentRequest.id,
    actorId: actor.id,
  });

  json(response, 200, { data: withAllowedActions(updatedRequest, actor, delegations) });
}

async function handleCancelPaymentRequest(request, response, repository) {
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
  json(response, 200, { data: withAllowedActions(updatedRequest, actor, delegations) });
}

async function handleReleaseToErp(request, response, repository) {
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

  const updatedRequest = await repository.releaseToErp({
    requestId: paymentRequest.id,
    actorId: actor.id,
  });

  json(response, 200, { data: withAllowedActions(updatedRequest, actor) });
}

async function handleReturnPaymentRequest(request, response, repository) {
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

  json(response, 200, { data: withAllowedActions(updatedRequest, actor, delegations) });
}

async function handleResubmitPaymentRequest(request, response, repository) {
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
    })
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
  json(response, 200, {
    data: requests.map((paymentRequest) => withAllowedActions(paymentRequest, actor)),
    total: requests.length,
  });
}

async function handleHoldErpSync(request, response, repository) {
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

async function handleCreatePaymentRequest(request, response, repository) {
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

  if (
    actor.departmentId &&
    actor.departmentId !== payload.departmentId &&
    !hasPermission(actor, 'view_all_requests')
  ) {
    json(response, 403, {
      error: 'forbidden',
      message: 'You do not have permission to create requests for another department.',
    });
    return;
  }

  const created = await repository.createPaymentRequest({
    requesterId: actor.id,
    requesterName: payload.requesterName ?? actor.id,
    departmentId: payload.departmentId,
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

      if (request.method === 'POST' && request.url === '/api/setup/departments') {
        await handleCreateDepartment(request, response, repository);
        return;
      }

      if (request.method === 'PUT' && request.url?.startsWith('/api/setup/departments/')) {
        await handleUpdateDepartmentApprovalSetup(request, response, repository);
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

      if (request.method === 'POST' && request.url === '/api/payment-requests') {
        await handleCreatePaymentRequest(request, response, repository);
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
        await handleApprovePaymentRequest(request, response, repository);
        return;
      }

      if (request.method === 'POST' && request.url?.endsWith('/submit')) {
        await handleSubmitPaymentRequest(request, response, repository);
        return;
      }

      if (request.method === 'POST' && request.url?.endsWith('/reject')) {
        await handleRejectPaymentRequest(request, response, repository);
        return;
      }

      if (request.method === 'POST' && request.url?.endsWith('/cancel')) {
        await handleCancelPaymentRequest(request, response, repository);
        return;
      }

      if (request.method === 'POST' && request.url?.endsWith('/release-to-erp')) {
        await handleReleaseToErp(request, response, repository);
        return;
      }

      if (request.method === 'POST' && request.url?.endsWith('/return')) {
        await handleReturnPaymentRequest(request, response, repository);
        return;
      }

      if (request.method === 'POST' && request.url?.endsWith('/resubmit')) {
        await handleResubmitPaymentRequest(request, response, repository);
        return;
      }

      if (request.method === 'POST' && request.url?.endsWith('/hold-erp-sync')) {
        await handleHoldErpSync(request, response, repository);
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
