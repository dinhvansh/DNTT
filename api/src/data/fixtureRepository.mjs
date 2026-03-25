import { devDelegations, devRequests } from '../dev-fixtures.mjs';

export function createFixtureRepository() {
  const users = [
    { id: 'requester-1', fullName: 'Nguyen Van A', email: 'requester1@example.com', departmentId: 'dep-a' },
    { id: 'requester-2', fullName: 'Tran Thi B', email: 'requester2@example.com', departmentId: 'dep-b' },
    { id: 'requester-3', fullName: 'Le Thi C', email: 'requester3@example.com', departmentId: 'dep-a' },
    { id: 'approver-1', fullName: 'Approver One', email: 'approver1@example.com', departmentId: 'dep-a' },
    { id: 'approver-2', fullName: 'Approver Two', email: 'approver2@example.com', departmentId: 'dep-b' },
    { id: 'approver-3', fullName: 'Approver Three', email: 'approver3@example.com', departmentId: 'dep-a' },
    { id: 'hod-1', fullName: 'Head Of Department', email: 'hod1@example.com', departmentId: 'dep-a' },
    { id: 'delegate-1', fullName: 'Delegate User', email: 'delegate1@example.com', departmentId: 'dep-a' },
    { id: 'finance-ops-1', fullName: 'Finance Operations', email: 'financeops@example.com', departmentId: 'dep-finance' },
    { id: 'sys-admin', fullName: 'System Admin', email: 'sysadmin@example.com', departmentId: 'dep-finance' },
    { id: 'cfo-1', fullName: 'Chief Finance Officer', email: 'cfo1@example.com', departmentId: 'dep-finance' },
    { id: 'ceo-1', fullName: 'Chief Executive Officer', email: 'ceo1@example.com', departmentId: 'dep-finance' },
  ];
  const departments = [
    {
      id: 'dep-a',
      code: 'dep-a',
      name: 'Operations Department',
      isActive: true,
      setup: {
        reviewerUserId: 'approver-3',
        hodUserId: 'hod-1',
        fallbackUserId: null,
        effectiveFrom: '2026-01-01T00:00:00.000Z',
        isActive: true,
      },
    },
    {
      id: 'dep-b',
      code: 'dep-b',
      name: 'Tax Department',
      isActive: true,
      setup: {
        reviewerUserId: 'approver-2',
        hodUserId: 'approver-2',
        fallbackUserId: null,
        effectiveFrom: '2026-01-01T00:00:00.000Z',
        isActive: true,
      },
    },
    {
      id: 'dep-finance',
      code: 'dep-finance',
      name: 'Finance Operations',
      isActive: true,
      setup: {
        reviewerUserId: null,
        hodUserId: null,
        fallbackUserId: null,
        effectiveFrom: null,
        isActive: false,
      },
    },
  ];
  const globalApproverConfig = {
    companyCode: 'default',
    cfoUserId: 'cfo-1',
    ceoUserId: 'ceo-1',
    cfoAmountThreshold: 500000,
    ceoAmountThreshold: 1000000,
    isActive: true,
  };
  const requests = devRequests.map((entry) => ({
    ...entry,
    workflowUserIds: [...(entry.workflowUserIds ?? [])],
    currentStepApproverIds: [...(entry.currentStepApproverIds ?? [])],
    additionalRelatedUserIds: [...(entry.additionalRelatedUserIds ?? [])],
    attachments: [...(entry.attachments ?? [])],
  }));
  const delegations = devDelegations.map((entry) => ({ ...entry, scope: { ...(entry.scope ?? {}) } }));
  const integrationJobs = [
    {
      id: 'job-fixture-failed-001',
      requestId: 'req-fixture-job-only',
      requestNo: 'PR-2026-0099',
      targetSystem: 'erp',
      status: 'failed',
      retryCount: 1,
      lastError: 'Validation failed during ERP sync.',
      createdAt: '2026-03-25T09:00:00.000Z',
      updatedAt: '2026-03-25T09:10:00.000Z',
    },
  ];

  function getRequestOrThrow(requestId) {
    const paymentRequest = requests.find((entry) => entry.id === requestId || entry.requestNo === requestId);
    if (!paymentRequest) {
      throw new Error('Payment request does not exist.');
    }

    return paymentRequest;
  }

  function getNextApproverIds(paymentRequest) {
    const currentApproverId = paymentRequest.currentStepApproverIds?.[0];
    const currentIndex = paymentRequest.workflowUserIds.findIndex((entry) => entry === currentApproverId);
    const nextApproverId = currentIndex >= 0
      ? paymentRequest.workflowUserIds[currentIndex + 1]
      : paymentRequest.workflowUserIds[paymentRequest.currentStepApproverIds.length];

    return nextApproverId ? [nextApproverId] : [];
  }

  function resolveFixtureWorkflowChain(paymentRequest) {
    const departmentCode = paymentRequest.departmentId;
    const totalAmount = Number(paymentRequest.totalAmount ?? 0);
    const candidates = [];
    const requester = users.find((entry) => entry.id === paymentRequest.requesterId);
    const department = departments.find((entry) => entry.code === departmentCode);
    const lineManagerId = requester?.id === 'requester-1'
      ? 'approver-1'
      : requester?.id === 'requester-2'
        ? 'approver-2'
        : requester?.id === 'requester-3'
          ? 'approver-3'
          : null;

    if (lineManagerId) {
      candidates.push({ stepCode: 'line_manager', approverId: lineManagerId, priority: 1 });
    }

    if (department?.setup.reviewerUserId) {
      candidates.push({ stepCode: 'reviewer', approverId: department.setup.reviewerUserId, priority: 2 });
    }

    if (department?.setup.hodUserId) {
      candidates.push({ stepCode: 'hod', approverId: department.setup.hodUserId, priority: 3 });
    }

    if (globalApproverConfig.cfoUserId && totalAmount >= globalApproverConfig.cfoAmountThreshold) {
      candidates.push({ stepCode: 'cfo', approverId: globalApproverConfig.cfoUserId, priority: 4 });
    }

    if (globalApproverConfig.ceoUserId && totalAmount >= globalApproverConfig.ceoAmountThreshold) {
      candidates.push({ stepCode: 'ceo', approverId: globalApproverConfig.ceoUserId, priority: 5 });
    }

    const keptByApprover = new Map();
    for (const candidate of candidates) {
      const existing = keptByApprover.get(candidate.approverId);
      if (!existing || candidate.priority > existing.priority) {
        keptByApprover.set(candidate.approverId, candidate);
      }
    }

    return candidates.filter((candidate) => keptByApprover.get(candidate.approverId)?.stepCode === candidate.stepCode);
  }

  return {
    async getApprovalSetupData() {
      return {
        departments,
        users,
        globalConfig: globalApproverConfig,
      };
    },
    async createDepartment({ code, name }) {
      const created = {
        id: code,
        code,
        name,
        isActive: true,
        setup: {
          reviewerUserId: null,
          hodUserId: null,
          fallbackUserId: null,
          effectiveFrom: null,
          isActive: false,
        },
      };

      departments.push(created);
      return created;
    },
    async saveDepartmentApprovalSetup({ departmentCode, reviewerUserId, hodUserId, fallbackUserId }) {
      const department = departments.find((entry) => entry.code === departmentCode);
      if (!department) {
        throw new Error('Department does not exist.');
      }

      department.setup = {
        reviewerUserId,
        hodUserId,
        fallbackUserId,
        effectiveFrom: new Date().toISOString(),
        isActive: Boolean(reviewerUserId || hodUserId || fallbackUserId),
      };

      return department;
    },
    async saveGlobalApproverConfig({ cfoUserId, ceoUserId, cfoAmountThreshold, ceoAmountThreshold }) {
      globalApproverConfig.cfoUserId = cfoUserId;
      globalApproverConfig.ceoUserId = ceoUserId;
      globalApproverConfig.cfoAmountThreshold = cfoAmountThreshold;
      globalApproverConfig.ceoAmountThreshold = ceoAmountThreshold;
      return globalApproverConfig;
    },
    async listPaymentRequests() {
      return requests;
    },
    async getPaymentRequestById(requestId) {
      return requests.find((entry) => entry.id === requestId) ?? null;
    },
    async listDelegations() {
      return delegations;
    },
    async listFinanceReleaseQueue() {
      return requests.filter((entry) =>
        entry.businessStatus === 'approved' &&
        (entry.erpSyncStatus === 'waiting_finance_release' || entry.erpSyncStatus === 'hold_by_finance')
      );
    },
    async listIntegrationJobs() {
      return integrationJobs;
    },
    async createPaymentRequest(input) {
      const nextNumber = String(requests.length + 1).padStart(4, '0');
      const created = {
        id: `req-created-${nextNumber}`,
        requestNo: `PR-2026-${nextNumber}`,
        requesterId: input.requesterId,
        requesterName: input.requesterName,
        departmentId: input.departmentId,
        requestType: 'payment_request',
        payeeName: input.payeeName,
        paymentType: input.paymentType,
        totalAmount: input.totalAmount,
        currency: input.currency,
        priority: input.priority ?? 'medium',
        visibilityMode: input.visibilityMode ?? 'related_only',
        businessStatus: 'draft',
        erpSyncStatus: 'not_ready',
        createdAt: new Date().toISOString(),
        workflowUserIds: [],
        currentStepApproverIds: [],
        attachments: (input.attachments ?? []).map((attachment, index) => ({
          id: `att-${nextNumber}-${index + 1}`,
          attachmentType: attachment.attachmentType,
          fileName: attachment.fileName,
          filePath: attachment.filePath,
          fileSize: attachment.fileSize,
          uploadedAt: new Date().toISOString(),
        })),
      };

      requests.unshift(created);
      return created;
    },
    async submitPaymentRequest({ requestId }) {
      const paymentRequest = getRequestOrThrow(requestId);
      const workflowChain = resolveFixtureWorkflowChain(paymentRequest);
      paymentRequest.businessStatus = 'pending_approval';
      paymentRequest.erpSyncStatus = 'not_ready';
      paymentRequest.workflowUserIds = workflowChain.map((entry) => entry.approverId);
      paymentRequest.currentStepApproverIds = workflowChain.length > 0 ? [workflowChain[0].approverId] : [];
      return paymentRequest;
    },
    async approvePaymentRequest({ requestId }) {
      const paymentRequest = getRequestOrThrow(requestId);
      const nextApproverIds = getNextApproverIds(paymentRequest);

      if (nextApproverIds.length > 0) {
        paymentRequest.currentStepApproverIds = nextApproverIds;
        paymentRequest.businessStatus = 'pending_approval';
      } else {
        paymentRequest.currentStepApproverIds = [];
        paymentRequest.businessStatus = 'approved';
        paymentRequest.erpSyncStatus = 'waiting_finance_release';
      }

      return paymentRequest;
    },
    async rejectPaymentRequest({ requestId }) {
      const paymentRequest = getRequestOrThrow(requestId);
      paymentRequest.currentStepApproverIds = [];
      paymentRequest.businessStatus = 'rejected';
      return paymentRequest;
    },
    async returnPaymentRequest({ requestId }) {
      const paymentRequest = getRequestOrThrow(requestId);
      paymentRequest.currentStepApproverIds = [];
      paymentRequest.businessStatus = 'returned';
      return paymentRequest;
    },
    async cancelPaymentRequest({ requestId }) {
      const paymentRequest = getRequestOrThrow(requestId);
      paymentRequest.currentStepApproverIds = [];
      paymentRequest.businessStatus = 'cancelled';
      paymentRequest.erpSyncStatus = 'not_ready';
      return paymentRequest;
    },
    async resubmitPaymentRequest({ requestId }) {
      const paymentRequest = getRequestOrThrow(requestId);
      paymentRequest.businessStatus = 'pending_approval';
      paymentRequest.currentStepApproverIds = paymentRequest.workflowUserIds.length > 0
        ? [paymentRequest.workflowUserIds[0]]
        : [];
      paymentRequest.erpSyncStatus = 'not_ready';
      return paymentRequest;
    },
    async releaseToErp({ requestId }) {
      const paymentRequest = getRequestOrThrow(requestId);
      paymentRequest.erpSyncStatus = 'pending';
      integrationJobs.unshift({
        id: `job-${paymentRequest.id}-${integrationJobs.length + 1}`,
        requestId: paymentRequest.id,
        requestNo: paymentRequest.requestNo,
        targetSystem: 'erp',
        status: 'pending',
        retryCount: 0,
        lastError: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      return paymentRequest;
    },
    async holdErpSync({ requestId }) {
      const paymentRequest = getRequestOrThrow(requestId);
      paymentRequest.erpSyncStatus = 'hold_by_finance';
      return paymentRequest;
    },
    async retryIntegrationJob({ jobId }) {
      const job = integrationJobs.find((entry) => entry.id === jobId);
      if (!job) {
        throw new Error('ERP integration job does not exist.');
      }

      job.status = 'pending';
      job.retryCount += 1;
      job.lastError = null;
      job.updatedAt = new Date().toISOString();
      return job;
    },
  };
}
