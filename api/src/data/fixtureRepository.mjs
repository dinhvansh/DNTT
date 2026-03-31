import { devDelegations, devRequests } from '../dev-fixtures.mjs';
import { cloneDefaultTemplates } from './defaultTemplates.mjs';

export function createFixtureRepository() {
  const users = [
    { id: 'requester-1', fullName: 'Nguyen Van A', email: 'requester1@example.com', departmentId: 'dep-a', positionCode: 'staff', lineManagerId: 'approver-1', roleCode: 'staff', isActive: true },
    { id: 'requester-2', fullName: 'Tran Thi B', email: 'requester2@example.com', departmentId: 'dep-b', positionCode: 'staff', lineManagerId: 'approver-2', roleCode: 'staff', isActive: true },
    { id: 'requester-3', fullName: 'Le Thi C', email: 'requester3@example.com', departmentId: 'dep-a', positionCode: 'staff', lineManagerId: 'approver-3', roleCode: 'staff', isActive: true },
    { id: 'approver-1', fullName: 'Approver One', email: 'approver1@example.com', departmentId: 'dep-a', positionCode: 'line_manager', lineManagerId: null, roleCode: 'manager', isActive: true },
    { id: 'approver-2', fullName: 'Approver Two', email: 'approver2@example.com', departmentId: 'dep-b', positionCode: 'reviewer', lineManagerId: null, roleCode: 'manager', isActive: true },
    { id: 'approver-3', fullName: 'Approver Three', email: 'approver3@example.com', departmentId: 'dep-a', positionCode: 'reviewer', lineManagerId: null, roleCode: 'manager', isActive: true },
    { id: 'hod-1', fullName: 'Head Of Department', email: 'hod1@example.com', departmentId: 'dep-a', positionCode: 'hod', lineManagerId: null, roleCode: 'director', isActive: true },
    { id: 'delegate-1', fullName: 'Delegate User', email: 'delegate1@example.com', departmentId: 'dep-a', positionCode: 'staff', lineManagerId: 'approver-1', roleCode: 'staff', isActive: true },
    { id: 'finance-ops-1', fullName: 'Finance Operations', email: 'financeops@example.com', departmentId: 'dep-finance', positionCode: 'finance_operations', lineManagerId: null, roleCode: 'finance_operations', isActive: true },
    { id: 'sys-admin', fullName: 'System Admin', email: 'sysadmin@example.com', departmentId: 'dep-finance', positionCode: 'system_admin', lineManagerId: null, roleCode: 'admin', isActive: true },
    { id: 'auditor-1', fullName: 'Internal Auditor', email: 'auditor1@example.com', departmentId: 'dep-finance', positionCode: 'auditor', lineManagerId: null, roleCode: 'auditor', isActive: true },
    { id: 'cfo-1', fullName: 'Chief Finance Officer', email: 'cfo1@example.com', departmentId: 'dep-finance', positionCode: 'cfo', lineManagerId: null, roleCode: 'director', isActive: true },
    { id: 'ceo-1', fullName: 'Chief Executive Officer', email: 'ceo1@example.com', departmentId: 'dep-finance', positionCode: 'ceo', lineManagerId: null, roleCode: 'director', isActive: true },
  ];
  const positions = [
    { code: 'staff', name: 'Staff', isGlobal: false },
    { code: 'line_manager', name: 'Line Manager', isGlobal: false },
    { code: 'reviewer', name: 'Reviewer', isGlobal: false },
    { code: 'hod', name: 'Head Of Department', isGlobal: false },
    { code: 'finance_operations', name: 'Finance Operations', isGlobal: true },
    { code: 'auditor', name: 'Auditor', isGlobal: true },
    { code: 'system_admin', name: 'System Admin', isGlobal: true },
    { code: 'cfo', name: 'Chief Financial Officer', isGlobal: true },
    { code: 'ceo', name: 'Chief Executive Officer', isGlobal: true },
  ];
  const roleOptions = [
    { code: 'staff', name: 'Staff' },
    { code: 'manager', name: 'Manager' },
    { code: 'director', name: 'Director' },
    { code: 'finance_operations', name: 'Finance Operations' },
    { code: 'admin', name: 'System Admin' },
    { code: 'auditor', name: 'Auditor' },
  ];
  const vendors = [
    {
      id: 'vendor-1',
      code: 'VEND-GLI',
      name: 'Global Logistics Inc.',
      currency: 'VND',
      bankAccountName: 'Global Logistics Inc.',
      bankAccountNumber: '001122334455',
      bankName: 'ACB',
      syncSource: 'manual',
      lastSyncedAt: new Date().toISOString(),
      isActive: true,
    },
    {
      id: 'vendor-2',
      code: 'VEND-AWS',
      name: 'Amazon Web Services',
      currency: 'USD',
      bankAccountName: 'Amazon Web Services',
      bankAccountNumber: '998877665544',
      bankName: 'HSBC',
      syncSource: 'erp_seed',
      lastSyncedAt: new Date().toISOString(),
      isActive: true,
    },
  ];
  const erpReferences = [
    { id: 'erp-ref-1', referenceType: 'expense_type', code: 'service_fee', name: 'Service Fee', isActive: true, syncSource: 'seed', lastSyncedAt: new Date().toISOString() },
    { id: 'erp-ref-2', referenceType: 'expense_type', code: 'vendor_invoice', name: 'Vendor Invoice', isActive: true, syncSource: 'seed', lastSyncedAt: new Date().toISOString() },
    { id: 'erp-ref-3', referenceType: 'expense_type', code: 'tax_payment', name: 'Tax Payment', isActive: true, syncSource: 'seed', lastSyncedAt: new Date().toISOString() },
    { id: 'erp-ref-4', referenceType: 'expense_type', code: 'travel_expense', name: 'Travel Expense', isActive: true, syncSource: 'seed', lastSyncedAt: new Date().toISOString() },
    { id: 'erp-ref-5', referenceType: 'expense_type', code: 'advance_settlement', name: 'Advance Settlement', isActive: true, syncSource: 'seed', lastSyncedAt: new Date().toISOString() },
    { id: 'erp-ref-6', referenceType: 'gl_account', code: '6100-IT', name: 'IT Service Expense', isActive: true, syncSource: 'seed', lastSyncedAt: new Date().toISOString() },
    { id: 'erp-ref-7', referenceType: 'gl_account', code: '6200-OPS', name: 'Operations Expense', isActive: true, syncSource: 'seed', lastSyncedAt: new Date().toISOString() },
    { id: 'erp-ref-8', referenceType: 'gl_account', code: '6300-TAX', name: 'Tax Expense', isActive: true, syncSource: 'seed', lastSyncedAt: new Date().toISOString() },
    { id: 'erp-ref-9', referenceType: 'cost_center', code: 'CC-OPS', name: 'Operations Cost Center', isActive: true, syncSource: 'seed', lastSyncedAt: new Date().toISOString() },
    { id: 'erp-ref-10', referenceType: 'cost_center', code: 'CC-FIN', name: 'Finance Cost Center', isActive: true, syncSource: 'seed', lastSyncedAt: new Date().toISOString() },
    { id: 'erp-ref-11', referenceType: 'project', code: 'PRJ-DNTT', name: 'DNTT Transformation Program', isActive: true, syncSource: 'seed', lastSyncedAt: new Date().toISOString() },
    { id: 'erp-ref-12', referenceType: 'project', code: 'PRJ-ERP', name: 'ERP Stabilization', isActive: true, syncSource: 'seed', lastSyncedAt: new Date().toISOString() },
  ];
  const departments = [
    {
      id: 'dep-a',
      code: 'dep-a',
      name: 'Operations Department',
      isActive: true,
      setup: {
        reviewerUserId: 'approver-3',
        reviewerPositionCode: 'reviewer',
        hodUserId: 'hod-1',
        hodPositionCode: 'hod',
        fallbackUserId: null,
        fallbackPositionCode: null,
        stepOrder: ['line_manager', 'reviewer', 'hod'],
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
        reviewerPositionCode: 'reviewer',
        hodUserId: null,
        hodPositionCode: 'hod',
        fallbackUserId: null,
        fallbackPositionCode: null,
        stepOrder: ['reviewer', 'line_manager', 'hod'],
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
        reviewerPositionCode: null,
        hodUserId: null,
        hodPositionCode: null,
        fallbackUserId: null,
        fallbackPositionCode: null,
        stepOrder: ['line_manager', 'reviewer', 'hod'],
        effectiveFrom: null,
        isActive: false,
      },
    },
  ];
  const globalApproverConfig = {
    companyCode: 'default',
    cfoPositionCode: 'cfo',
    ceoPositionCode: 'ceo',
    cfoAmountThreshold: 500000,
    ceoAmountThreshold: 1000000,
    isActive: true,
  };
  const requests = devRequests.map((entry) => ({
    ...entry,
    details: [...(entry.details ?? [])],
    workflowUserIds: [...(entry.workflowUserIds ?? [])],
    currentStepApproverIds: [...(entry.currentStepApproverIds ?? [])],
    workflowSteps: [...(entry.workflowSteps ?? [])],
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
      idempotencyKey: 'payment_request:req-fixture-job-only',
      status: 'failed',
      errorCategory: 'transient',
      retryCount: 1,
      lastError: 'Validation failed during ERP sync.',
      createdAt: '2026-03-25T09:00:00.000Z',
      updatedAt: '2026-03-25T09:10:00.000Z',
    },
    {
      id: 'job-fixture-business-001',
      requestId: 'req-fixture-business-job',
      requestNo: 'PR-2026-0100',
      targetSystem: 'erp',
      idempotencyKey: 'payment_request:req-fixture-business-job',
      status: 'manual_review_required',
      errorCategory: 'business',
      retryCount: 0,
      lastError: 'Vendor code does not exist in ERP.',
      createdAt: '2026-03-25T10:00:00.000Z',
      updatedAt: '2026-03-25T10:05:00.000Z',
    },
  ];
  const auditLogs = requests.flatMap((request) => ([
    {
      id: `audit-${request.id}-created`,
      entityType: 'payment_request',
      entityId: request.id,
      actionCode: 'create_request',
      actorId: request.requesterId,
      actorName: request.requesterName,
      note: `Request ${request.requestNo} was created.`,
      createdAt: request.createdAt,
    },
  ]));
  const erpSyncRuns = [];
  const requestTemplates = cloneDefaultTemplates().map((template, index) => ({
    id: `template-${index + 1}`,
    ...template,
  }));

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

  function resolveActorName(actorId) {
    return users.find((entry) => entry.id === actorId)?.fullName ?? actorId;
  }

  function listFixtureLineManagerOverrideCandidates({ requesterId, departmentId }) {
    const requester = users.find((entry) => entry.id === requesterId);
    return users
      .filter((entry) =>
        entry.isActive &&
        entry.departmentId === departmentId &&
        entry.id !== requesterId &&
        entry.id !== requester?.lineManagerId &&
        (
          ['line_manager', 'reviewer', 'hod'].includes(entry.positionCode ?? '') ||
          ['manager', 'director', 'admin'].includes(entry.roleCode ?? '')
        )
      )
      .sort((left, right) => left.fullName.localeCompare(right.fullName))
      .map((entry) => ({
        approverId: entry.id,
        approverName: entry.fullName,
        positionCode: entry.positionCode ?? null,
        roleCode: entry.roleCode ?? null,
      }));
  }

  function formatFixtureStepCode(positionCode, actorId) {
    switch (positionCode) {
      case 'line_manager':
        return 'line_manager';
      case 'reviewer':
        return 'reviewer';
      case 'hod':
        return 'hod';
      case 'cfo':
        return 'cfo';
      case 'ceo':
        return 'ceo';
      default:
        return actorId;
    }
  }

  function buildFixtureWorkflowSteps(paymentRequest) {
    return (paymentRequest.workflowUserIds ?? []).map((actorId, index) => {
      const user = users.find((entry) => entry.id === actorId);
      const currentApproverId = paymentRequest.currentStepApproverIds?.[0] ?? null;
      let status = 'approved';
      if (paymentRequest.businessStatus === 'rejected' && currentApproverId === null && index === (paymentRequest.workflowUserIds?.length ?? 1) - 1) {
        status = 'rejected';
      } else if (paymentRequest.businessStatus === 'returned' && currentApproverId === null && index === (paymentRequest.workflowUserIds?.length ?? 1) - 1) {
        status = 'returned';
      } else if (currentApproverId === actorId) {
        status = 'pending';
      } else if ((paymentRequest.currentStepApproverIds?.length ?? 0) === 0 && paymentRequest.businessStatus !== 'approved') {
        status = index === (paymentRequest.workflowUserIds?.length ?? 1) - 1 ? paymentRequest.businessStatus : 'approved';
      }

      return {
        stepNo: index + 1,
        stepCode: formatFixtureStepCode(user?.positionCode, actorId),
        approverId: actorId,
        approverName: user?.fullName ?? actorId,
        actingApproverId: null,
        actingApproverName: null,
        status,
        actionAt: null,
      };
    });
  }

  function appendAuditLog({ entityType = 'payment_request', entityId = null, actionCode, actorId, note }) {
    auditLogs.unshift({
      id: `audit-${entityType}-${entityId ?? 'none'}-${actionCode}-${auditLogs.length + 1}`,
      entityType,
      entityId,
      actionCode,
      actorId,
      actorName: resolveActorName(actorId),
      note,
      createdAt: new Date().toISOString(),
    });
  }

  function getTemplateByCode(templateCode) {
    return requestTemplates.find((entry) => entry.code === templateCode) ?? null;
  }

  function enrichFixtureRequest(request) {
    const vendor = vendors.find((entry) => entry.code === request.vendorCode) ?? null;
    const template =
      getTemplateByCode(request.templateCode) ??
      getTemplateByCode(request.visibilityMode === 'finance_shared' ? 'finance_sensitive' : 'vendor_standard');
    return {
      ...request,
      templateCode: template?.code ?? null,
      templateName: template?.name ?? null,
      templateVersion: template?.version ?? null,
      templateFormSchema: structuredClone(template?.formSchema ?? {}),
      templateDetailSchema: structuredClone(template?.detailSchema ?? {}),
      templateAttachmentRules: structuredClone(template?.attachmentRules ?? {}),
      bankAccountName: vendor?.bankAccountName ?? null,
      bankAccountNumber: vendor?.bankAccountNumber ?? null,
      bankName: vendor?.bankName ?? null,
      details: [...(request.details ?? [])],
      attachments: [...(request.attachments ?? [])],
      workflowSteps: request.workflowSteps?.length ? request.workflowSteps : buildFixtureWorkflowSteps(request),
    };
  }

  function resolveFixtureWorkflowChain(paymentRequest, { lineManagerOverrideId = null } = {}) {
    const departmentCode = paymentRequest.departmentId;
    const totalAmount = Number(paymentRequest.totalAmount ?? 0);
    const requester = users.find((entry) => entry.id === paymentRequest.requesterId);
    const department = departments.find((entry) => entry.code === departmentCode);
    const basePriority = {
      line_manager: 1,
      reviewer: 2,
      hod: 3,
      cfo: 4,
      ceo: 5,
    };
    const stepOrder = department?.setup.stepOrder ?? ['line_manager', 'reviewer', 'hod'];
    const candidates = [];
    const lineManagerOverride = lineManagerOverrideId
      ? listFixtureLineManagerOverrideCandidates({
          requesterId: paymentRequest.requesterId,
          departmentId: departmentCode,
        }).find((entry) => entry.approverId === lineManagerOverrideId) ?? null
      : null;

    if (lineManagerOverrideId && !lineManagerOverride) {
      throw new Error('Line manager override is not valid for this requester.');
    }

    for (const stepCode of stepOrder) {
      let approverId = null;
      let defaultApproverId = null;
      if (stepCode === 'line_manager') {
        defaultApproverId = requester?.lineManagerId ?? null;
        approverId = lineManagerOverride?.approverId ?? defaultApproverId;
      } else if (stepCode === 'reviewer') {
        approverId = department?.setup.reviewerUserId ?? users.find((entry) =>
          entry.departmentId === departmentCode &&
          entry.positionCode === department?.setup.reviewerPositionCode &&
          entry.isActive
        )?.id ?? null;
      } else if (stepCode === 'hod') {
        approverId = department?.setup.hodUserId ?? users.find((entry) =>
          entry.departmentId === departmentCode &&
          entry.positionCode === department?.setup.hodPositionCode &&
          entry.isActive
        )?.id ?? null;
      }

      if (approverId && approverId !== requester?.id) {
        candidates.push({
          stepCode,
          approverId,
          priority: basePriority[stepCode],
          defaultApproverId,
          isOverridden: stepCode === 'line_manager' && Boolean(lineManagerOverride && lineManagerOverride.approverId !== defaultApproverId),
        });
      }
    }

    if (globalApproverConfig.cfoPositionCode && totalAmount >= globalApproverConfig.cfoAmountThreshold) {
      const cfoApproverId = users.find((entry) => entry.positionCode === globalApproverConfig.cfoPositionCode && entry.isActive)?.id ?? null;
      if (cfoApproverId && cfoApproverId !== requester?.id) {
        candidates.push({ stepCode: 'cfo', approverId: cfoApproverId, priority: basePriority.cfo, defaultApproverId: null, isOverridden: false });
      }
    }

    if (globalApproverConfig.ceoPositionCode && totalAmount >= globalApproverConfig.ceoAmountThreshold) {
      const ceoApproverId = users.find((entry) => entry.positionCode === globalApproverConfig.ceoPositionCode && entry.isActive)?.id ?? null;
      if (ceoApproverId && ceoApproverId !== requester?.id) {
        candidates.push({ stepCode: 'ceo', approverId: ceoApproverId, priority: basePriority.ceo, defaultApproverId: null, isOverridden: false });
      }
    }

    const keptByApprover = new Map();
    for (const candidate of candidates) {
      const existing = keptByApprover.get(candidate.approverId);
      if (!existing || candidate.priority > existing.priority) {
        keptByApprover.set(candidate.approverId, candidate);
      }
    }

    return {
      candidates,
      workflowChain: candidates.filter((candidate) => keptByApprover.get(candidate.approverId)?.stepCode === candidate.stepCode),
      lineManagerOverride,
      defaultLineManagerId: requester?.lineManagerId ?? null,
    };
  }

  return {
    async getApprovalSetupData() {
      return {
        departments,
        positions,
        users,
        globalConfig: globalApproverConfig,
      };
    },
    async getMasterData() {
      return {
        departments: departments.map((entry) => ({
          id: entry.id,
          code: entry.code,
          name: entry.name,
          isActive: entry.isActive,
        })),
        roles: roleOptions,
        positions,
        vendors,
        erpReferences,
        users: users.map((entry) => ({
          id: entry.id,
          fullName: entry.fullName,
          email: entry.email,
          departmentId: entry.departmentId,
          positionCode: entry.positionCode,
          lineManagerId: entry.lineManagerId,
          roleCode: entry.roleCode,
          isActive: entry.isActive,
        })),
      };
    },
    async listVendors() {
      return vendors;
    },
    async listRequestTemplates() {
      return requestTemplates.map((entry) => ({
        ...entry,
        formSchema: structuredClone(entry.formSchema),
        detailSchema: structuredClone(entry.detailSchema),
        attachmentRules: structuredClone(entry.attachmentRules),
      }));
    },
    async createRequestTemplate({ code, name, requestType, description, visibilityMode, formSchema, detailSchema, attachmentRules, actorId }) {
      if (getTemplateByCode(code)) {
        throw new Error('Template code already exists.');
      }

      const created = {
        id: `template-${requestTemplates.length + 1}`,
        code,
        name,
        requestType,
        description: description ?? '',
        version: 1,
        visibilityMode: visibilityMode ?? 'related_only',
        isActive: true,
        formSchema: structuredClone(formSchema ?? {}),
        detailSchema: structuredClone(detailSchema ?? {}),
        attachmentRules: structuredClone(attachmentRules ?? {}),
      };
      requestTemplates.push(created);
      appendAuditLog({
        entityType: 'request_template',
        entityId: created.id,
        actionCode: 'create_request_template',
        actorId: actorId ?? 'sys-admin',
        note: `Template ${created.code} was created.`,
      });
      return created;
    },
    async updateRequestTemplate({ templateCode, name, description, visibilityMode, isActive, formSchema, detailSchema, attachmentRules, actorId }) {
      const template = getTemplateByCode(templateCode);
      if (!template) {
        return null;
      }

      template.name = name;
      template.description = description ?? '';
      template.visibilityMode = visibilityMode ?? template.visibilityMode;
      template.isActive = isActive;
      template.version += 1;
      template.formSchema = structuredClone(formSchema ?? template.formSchema ?? {});
      template.detailSchema = structuredClone(detailSchema ?? template.detailSchema ?? {});
      template.attachmentRules = structuredClone(attachmentRules ?? template.attachmentRules ?? {});
      appendAuditLog({
        entityType: 'request_template',
        entityId: template.id,
        actionCode: 'update_request_template',
        actorId: actorId ?? 'sys-admin',
        note: `Template ${template.code} was updated.`,
      });
      return {
        ...template,
        formSchema: structuredClone(template.formSchema),
        detailSchema: structuredClone(template.detailSchema),
        attachmentRules: structuredClone(template.attachmentRules),
      };
    },
    async listErpReferenceValues() {
      return erpReferences;
    },
    async listErpSyncRuns() {
      return erpSyncRuns;
    },
    async syncErpReferenceValues({ referenceType, values, actorId }) {
      const normalizedType = referenceType || 'all';
      const incomingValues = Array.isArray(values) ? values : [];
      let upserted = 0;

      for (const value of incomingValues) {
        if (!value?.referenceType || !value?.code || !value?.name) {
          continue;
        }

        const existing = erpReferences.find((entry) =>
          entry.referenceType === value.referenceType && entry.code === value.code
        );

        if (existing) {
          existing.name = value.name;
          existing.isActive = value.isActive !== false;
          existing.syncSource = value.syncSource ?? 'manual_sync';
          existing.lastSyncedAt = new Date().toISOString();
        } else {
          erpReferences.push({
            id: `erp-ref-${erpReferences.length + 1}`,
            referenceType: value.referenceType,
            code: value.code,
            name: value.name,
            isActive: value.isActive !== false,
            syncSource: value.syncSource ?? 'manual_sync',
            lastSyncedAt: new Date().toISOString(),
          });
        }
        upserted += 1;
      }

      const syncRun = {
        id: `erp-sync-run-${erpSyncRuns.length + 1}`,
        referenceType: normalizedType,
        syncMode: 'manual',
        status: 'success',
        recordsUpserted: upserted,
        errorMessage: null,
        triggeredBy: actorId ?? 'sys-admin',
        triggeredByName: resolveActorName(actorId ?? 'sys-admin'),
        createdAt: new Date().toISOString(),
      };
      erpSyncRuns.unshift(syncRun);

      appendAuditLog({
        entityType: 'erp_reference',
        entityId: null,
        actionCode: 'sync_erp_reference_values',
        actorId: actorId ?? 'sys-admin',
        note: `ERP reference sync completed for ${normalizedType}.`,
      });

      return {
        referenceType: syncRun.referenceType,
        syncMode: syncRun.syncMode,
        status: syncRun.status,
        recordsUpserted: syncRun.recordsUpserted,
        createdAt: syncRun.createdAt,
      };
    },
    async createMasterDataVendor({ code, name, currency, bankAccountName, bankAccountNumber, bankName, actorId }) {
      if (vendors.some((entry) => entry.code === code)) {
        throw new Error('Vendor code is already registered.');
      }

      const created = {
        id: `vendor-${vendors.length + 1}`,
        code,
        name,
        currency,
        bankAccountName: bankAccountName ?? null,
        bankAccountNumber: bankAccountNumber ?? null,
        bankName: bankName ?? null,
        syncSource: 'manual',
        lastSyncedAt: null,
        isActive: true,
      };

      vendors.push(created);
      appendAuditLog({
        entityType: 'vendor',
        entityId: null,
        actionCode: 'create_vendor',
        actorId: actorId ?? 'sys-admin',
        note: `Vendor ${created.code} was created.`,
      });
      return created;
    },
    async createDepartment({ code, name, actorId }) {
      if (departments.some((entry) => entry.code === code)) {
        throw new Error('Department code already exists.');
      }

      const created = {
        id: code,
        code,
        name,
        isActive: true,
        setup: {
          reviewerUserId: null,
          reviewerPositionCode: null,
          hodUserId: null,
          hodPositionCode: null,
          fallbackUserId: null,
          fallbackPositionCode: null,
          stepOrder: ['line_manager', 'reviewer', 'hod'],
          effectiveFrom: null,
          isActive: false,
        },
      };

      departments.push(created);
      appendAuditLog({
        entityType: 'department',
        entityId: created.id,
        actionCode: 'create_department',
        actorId: actorId ?? 'sys-admin',
        note: `Department ${created.code} was created.`,
      });
      return created;
    },
    async updateDepartment({ departmentCode, name, isActive, actorId }) {
      const department = departments.find((entry) => entry.code === departmentCode);
      if (!department) {
        return null;
      }

      department.name = name;
      department.isActive = isActive;
      appendAuditLog({
        entityType: 'department',
        entityId: department.id,
        actionCode: 'update_department',
        actorId: actorId ?? 'sys-admin',
        note: `Department ${department.code} was updated.`,
      });
      return {
        id: department.id,
        code: department.code,
        name: department.name,
        isActive: department.isActive,
      };
    },
    async deleteDepartment({ departmentCode, actorId }) {
      const departmentIndex = departments.findIndex((entry) => entry.code === departmentCode);
      if (departmentIndex === -1) {
        return false;
      }

      const department = departments[departmentIndex];
      const isUsedByUsers = users.some((entry) => entry.departmentId === departmentCode);
      const isUsedBySetup = Boolean(department.setup?.isActive);
      const isUsedByRequests = requests.some((entry) => entry.departmentId === departmentCode);

      if (isUsedByUsers || isUsedBySetup || isUsedByRequests) {
        throw new Error('Department is still referenced by users, approval setup, or requests. Disable it instead of deleting.');
      }

      departments.splice(departmentIndex, 1);
      appendAuditLog({
        entityType: 'department',
        entityId: department.id,
        actionCode: 'delete_department',
        actorId: actorId ?? 'sys-admin',
        note: `Department ${department.code} was deleted.`,
      });
      return true;
    },
    async createPosition({ code, name, isGlobal = false, actorId }) {
      if (positions.some((entry) => entry.code === code)) {
        throw new Error('Position code already exists.');
      }

      const created = {
        code,
        name,
        isGlobal,
        isActive: true,
      };

      positions.push(created);
      appendAuditLog({
        entityType: 'position',
        entityId: code,
        actionCode: 'create_position',
        actorId: actorId ?? 'sys-admin',
        note: `Position ${code} was created.`,
      });

      return created;
    },
    async updatePosition({ positionCode, name, isGlobal = false, isActive, actorId }) {
      const position = positions.find((entry) => entry.code === positionCode);
      if (!position) {
        return null;
      }

      position.name = name;
      position.isGlobal = isGlobal;
      position.isActive = isActive;
      appendAuditLog({
        entityType: 'position',
        entityId: position.code,
        actionCode: 'update_position',
        actorId: actorId ?? 'sys-admin',
        note: `Position ${position.code} was updated.`,
      });
      return {
        code: position.code,
        name: position.name,
        isGlobal: position.isGlobal,
        isActive: position.isActive,
      };
    },
    async deletePosition({ positionCode, actorId }) {
      const positionIndex = positions.findIndex((entry) => entry.code === positionCode);
      if (positionIndex === -1) {
        return false;
      }

      const position = positions[positionIndex];
      const isUsedByUsers = users.some((entry) => entry.positionCode === positionCode);
      const isUsedByDepartmentSetup = departments.some((entry) =>
        entry.setup?.reviewerPositionCode === positionCode ||
        entry.setup?.hodPositionCode === positionCode ||
        entry.setup?.fallbackPositionCode === positionCode
      );
      const isUsedByGlobalSetup =
        globalApproverConfig.cfoPositionCode === positionCode ||
        globalApproverConfig.ceoPositionCode === positionCode;

      if (isUsedByUsers || isUsedByDepartmentSetup || isUsedByGlobalSetup) {
        throw new Error('Position is still referenced by users or workflow setup. Disable it instead of deleting.');
      }

      positions.splice(positionIndex, 1);
      appendAuditLog({
        entityType: 'position',
        entityId: position.code,
        actionCode: 'delete_position',
        actorId: actorId ?? 'sys-admin',
        note: `Position ${position.code} was deleted.`,
      });
      return true;
    },
    async createMasterDataUser({ fullName, email, departmentCode, positionCode, lineManagerId, roleCode, actorId }) {
      if (users.some((entry) => entry.email === email)) {
        throw new Error('Email is already registered.');
      }

      const created = {
        id: `user-${users.length + 1}`,
        fullName,
        email,
        departmentId: departmentCode,
        positionCode,
        lineManagerId,
        roleCode,
        isActive: true,
      };

      users.push(created);
      appendAuditLog({
        entityType: 'user',
        entityId: created.id,
        actionCode: 'create_user',
        actorId: actorId ?? 'sys-admin',
        note: `User ${created.email} was created.`,
      });
      return created;
    },
    async updateMasterDataUser({ userId, fullName, departmentCode, positionCode, lineManagerId, roleCode, isActive, actorId }) {
      const user = users.find((entry) => entry.id === userId);
      if (!user) {
        return null;
      }

      user.fullName = fullName;
      user.departmentId = departmentCode;
      user.positionCode = positionCode;
      user.lineManagerId = lineManagerId;
      user.roleCode = roleCode;
      user.isActive = isActive;
      appendAuditLog({
        entityType: 'user',
        entityId: user.id,
        actionCode: 'update_user',
        actorId: actorId ?? 'sys-admin',
        note: `User ${user.email} was updated.`,
      });
      return {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        departmentId: user.departmentId,
        positionCode: user.positionCode,
        lineManagerId: user.lineManagerId,
        roleCode: user.roleCode,
        isActive: user.isActive,
      };
    },
    async deleteMasterDataUser({ userId, actorId }) {
      const index = users.findIndex((entry) => entry.id === userId);
      if (index === -1) {
        return false;
      }

      if (!userId.startsWith('user-')) {
        throw new Error('Only managed users can be deleted from master data.');
      }

      const [removed] = users.splice(index, 1);
      appendAuditLog({
        entityType: 'user',
        entityId: removed.id,
        actionCode: 'delete_user',
        actorId: actorId ?? 'sys-admin',
        note: `User ${removed.email} was deleted.`,
      });
      return true;
    },
    async saveDepartmentApprovalSetup({
      departmentCode,
      reviewerUserId,
      reviewerPositionCode,
      hodUserId,
      hodPositionCode,
      fallbackUserId,
      fallbackPositionCode,
      stepOrder,
      actorId,
    }) {
      const department = departments.find((entry) => entry.code === departmentCode);
      if (!department) {
        throw new Error('Department does not exist.');
      }

      department.setup = {
        reviewerUserId,
        reviewerPositionCode,
        hodUserId,
        hodPositionCode,
        fallbackUserId,
        fallbackPositionCode,
        stepOrder,
        effectiveFrom: new Date().toISOString(),
        isActive: Boolean(reviewerUserId || reviewerPositionCode || hodUserId || hodPositionCode || fallbackUserId || fallbackPositionCode),
      };

      appendAuditLog({
        entityType: 'department_approval_setup',
        entityId: department.id,
        actionCode: 'update_department_approval_setup',
        actorId: actorId ?? 'sys-admin',
        note: `Approval setup for ${department.code} was updated.`,
      });
      return department;
    },
    async saveGlobalApproverConfig({ cfoPositionCode, ceoPositionCode, cfoAmountThreshold, ceoAmountThreshold, actorId }) {
      globalApproverConfig.cfoPositionCode = cfoPositionCode;
      globalApproverConfig.ceoPositionCode = ceoPositionCode;
      globalApproverConfig.cfoAmountThreshold = cfoAmountThreshold;
      globalApproverConfig.ceoAmountThreshold = ceoAmountThreshold;
      appendAuditLog({
        entityType: 'global_approver_config',
        entityId: globalApproverConfig.companyCode,
        actionCode: 'update_global_approver_config',
        actorId: actorId ?? 'sys-admin',
        note: 'Global approver configuration was updated.',
      });
      return globalApproverConfig;
    },
    async listPaymentRequests() {
      return requests.map(enrichFixtureRequest);
    },
    async getPaymentRequestById(requestId) {
      const request = requests.find((entry) => entry.id === requestId) ?? null;
      if (!request) {
        return null;
      }

      return enrichFixtureRequest(request);
    },
    async getAttachmentById(attachmentId) {
      for (const request of requests) {
        const attachment = (request.attachments ?? []).find((entry) => entry.id === attachmentId);
        if (attachment) {
          return {
            ...attachment,
            requestId: request.id,
          };
        }
      }

      return null;
    },
    async listDelegations() {
      return delegations;
    },
    async listFinanceReleaseQueue() {
      return requests.filter((entry) =>
        entry.businessStatus === 'approved' &&
        (entry.erpSyncStatus === 'waiting_finance_release' || entry.erpSyncStatus === 'hold_by_finance')
      ).map(enrichFixtureRequest);
    },
    async listIntegrationJobs() {
      return integrationJobs;
    },
    async listPaymentRequestAuditLogs(requestId) {
      return auditLogs.filter((entry) => entry.entityType === 'payment_request' && entry.entityId === requestId);
    },
    async listAuditLogs({ entityType = null, entityId = null } = {}) {
      return auditLogs.filter((entry) => {
        if (entityType && entry.entityType !== entityType) {
          return false;
        }
        if (entityId && entry.entityId !== entityId) {
          return false;
        }
        return true;
      });
    },
    async createPaymentRequest(input) {
      const requester = users.find((entry) => entry.id === input.requesterId);
      const departmentId = requester?.departmentId ?? input.departmentId;
      const nextNumber = String(requests.length + 1).padStart(4, '0');
      const created = {
        id: `req-created-${nextNumber}`,
        requestNo: `PR-2026-${nextNumber}`,
        requesterId: input.requesterId,
        requesterName: input.requesterName,
        departmentId,
        templateCode: input.templateCode ?? null,
        templateName: getTemplateByCode(input.templateCode ?? '')?.name ?? null,
        templateVersion: getTemplateByCode(input.templateCode ?? '')?.version ?? null,
        templateFormSchema: structuredClone(getTemplateByCode(input.templateCode ?? '')?.formSchema ?? {}),
        templateDetailSchema: structuredClone(getTemplateByCode(input.templateCode ?? '')?.detailSchema ?? {}),
        templateAttachmentRules: structuredClone(getTemplateByCode(input.templateCode ?? '')?.attachmentRules ?? {}),
        vendorCode: input.vendorCode ?? null,
        requestType: 'payment_request',
        payeeName: input.payeeName,
        paymentType: input.paymentType,
        totalAmount: input.totalAmount,
        currency: input.currency,
        priority: input.priority ?? 'medium',
        visibilityMode: getTemplateByCode(input.templateCode ?? '')?.visibilityMode ?? input.visibilityMode ?? 'related_only',
        businessStatus: 'draft',
        erpSyncStatus: 'not_ready',
        createdAt: new Date().toISOString(),
        workflowUserIds: [],
        currentStepApproverIds: [],
        details: (input.lineItems ?? []).map((lineItem, index) => ({
          id: `detail-${nextNumber}-${index + 1}`,
          lineNo: index + 1,
          description: lineItem.description,
          invoiceDate: lineItem.invoiceDate ?? null,
          invoiceRef: lineItem.invoiceRef ?? null,
          glCode: lineItem.glCode ?? null,
          costCenter: lineItem.costCenter ?? null,
          projectCode: lineItem.projectCode ?? null,
          expenseTypeCode: lineItem.expenseTypeCode ?? null,
          currency: lineItem.currency ?? input.currency,
          exchangeRate: lineItem.exchangeRate ?? 1,
          amount: lineItem.amount,
          totalAmount: lineItem.totalAmount ?? lineItem.amount,
          note: lineItem.note ?? null,
          remark: lineItem.remark ?? null,
        })),
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
      appendAuditLog({
        entityId: created.id,
        actionCode: 'create_request',
        actorId: input.requesterId,
        note: `Request ${created.requestNo} was created.`,
      });
      return created;
    },
    async previewWorkflow({ requesterId, totalAmount, lineManagerOverrideId = null }) {
      const requester = users.find((entry) => entry.id === requesterId);
      if (!requester) {
        throw new Error('Actor identity does not map to a user record.');
      }

      const previewRequest = {
        requesterId,
        departmentId: requester.departmentId,
        totalAmount,
      };
      const workflowResolution = resolveFixtureWorkflowChain(previewRequest, { lineManagerOverrideId });

      return {
        departmentId: requester.departmentId,
        steps: workflowResolution.candidates.map((entry) => ({
          stepCode: entry.stepCode,
          approverId: entry.approverId,
          approverName: resolveActorName(entry.approverId),
          defaultApproverId: entry.defaultApproverId ?? entry.approverId,
          defaultApproverName: resolveActorName(entry.defaultApproverId ?? entry.approverId),
          isOverridden: entry.isOverridden ?? false,
          willBeSkipped: !workflowResolution.workflowChain.some(
            (keptEntry) => keptEntry.stepCode === entry.stepCode && keptEntry.approverId === entry.approverId
          ),
          skippedReason: !workflowResolution.workflowChain.some(
            (keptEntry) => keptEntry.stepCode === entry.stepCode && keptEntry.approverId === entry.approverId
          )
            ? 'This approver is duplicated by a higher-priority step and will be skipped after submit.'
            : null,
        })),
        lineManagerOverride: {
          defaultApproverId: workflowResolution.defaultLineManagerId,
          defaultApproverName: workflowResolution.defaultLineManagerId ? resolveActorName(workflowResolution.defaultLineManagerId) : null,
          selectedApproverId: workflowResolution.lineManagerOverride?.approverId ?? null,
          selectedApproverName: workflowResolution.lineManagerOverride?.approverName ?? null,
          candidates: listFixtureLineManagerOverrideCandidates({
            requesterId,
            departmentId: requester.departmentId,
          }),
        },
      };
    },
    async submitPaymentRequest({ requestId, actorId, lineManagerOverrideId = null, lineManagerOverrideReason = null }) {
      const paymentRequest = getRequestOrThrow(requestId);
      const workflowResolution = resolveFixtureWorkflowChain(paymentRequest, { lineManagerOverrideId });
      const workflowChain = workflowResolution.workflowChain;
      paymentRequest.businessStatus = 'pending_approval';
      paymentRequest.erpSyncStatus = 'not_ready';
      paymentRequest.workflowUserIds = workflowChain.map((entry) => entry.approverId);
      paymentRequest.currentStepApproverIds = workflowChain.length > 0 ? [workflowChain[0].approverId] : [];
      paymentRequest.workflowSteps = workflowChain.map((entry, index) => ({
        stepNo: index + 1,
        stepCode: entry.stepCode,
        approverId: entry.approverId,
        approverName: resolveActorName(entry.approverId),
        actingApproverId: null,
        actingApproverName: null,
        status: index === 0 ? 'pending' : 'queued',
        actionAt: null,
      }));
      appendAuditLog({
        entityId: paymentRequest.id,
        actionCode: 'submit_request',
        actorId: actorId ?? paymentRequest.requesterId,
        note: `Request ${paymentRequest.requestNo} moved to pending approval.`,
      });
      if (workflowResolution.lineManagerOverride && workflowResolution.defaultLineManagerId) {
        appendAuditLog({
          entityId: paymentRequest.id,
          actionCode: 'override_line_manager',
          actorId: actorId ?? paymentRequest.requesterId,
          note: `Line Manager overridden from ${resolveActorName(workflowResolution.defaultLineManagerId)} to ${workflowResolution.lineManagerOverride.approverName}. Reason: ${lineManagerOverrideReason ?? ''}`,
        });
      }
      return paymentRequest;
    },
    async approvePaymentRequest({ requestId, actorId }) {
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

      paymentRequest.workflowSteps = (paymentRequest.workflowSteps ?? buildFixtureWorkflowSteps(paymentRequest)).map((step) => {
        if (step.approverId === actorId) {
          return { ...step, status: 'approved', actionAt: new Date().toISOString() };
        }
        if (nextApproverIds.includes(step.approverId)) {
          return { ...step, status: 'pending' };
        }
        return step;
      });

      appendAuditLog({
        entityId: paymentRequest.id,
        actionCode: 'approve_request',
        actorId,
        note: `Request ${paymentRequest.requestNo} was approved.`,
      });
      return paymentRequest;
    },
    async rejectPaymentRequest({ requestId, actorId, note }) {
      const paymentRequest = getRequestOrThrow(requestId);
      paymentRequest.currentStepApproverIds = [];
      paymentRequest.businessStatus = 'rejected';
      paymentRequest.workflowSteps = (paymentRequest.workflowSteps ?? buildFixtureWorkflowSteps(paymentRequest)).map((step) =>
        step.approverId === actorId ? { ...step, status: 'rejected', actionAt: new Date().toISOString() } : step
      );
      appendAuditLog({
        entityId: paymentRequest.id,
        actionCode: 'reject_request',
        actorId,
        note: `Request ${paymentRequest.requestNo} was rejected. Reason: ${note}`,
      });
      return paymentRequest;
    },
    async returnPaymentRequest({ requestId, actorId }) {
      const paymentRequest = getRequestOrThrow(requestId);
      paymentRequest.currentStepApproverIds = [];
      paymentRequest.businessStatus = 'returned';
      paymentRequest.workflowSteps = (paymentRequest.workflowSteps ?? buildFixtureWorkflowSteps(paymentRequest)).map((step) =>
        step.approverId === actorId ? { ...step, status: 'returned', actionAt: new Date().toISOString() } : step
      );
      appendAuditLog({
        entityId: paymentRequest.id,
        actionCode: 'return_request',
        actorId,
        note: `Request ${paymentRequest.requestNo} was returned for revision.`,
      });
      return paymentRequest;
    },
    async cancelPaymentRequest({ requestId, actorId }) {
      const paymentRequest = getRequestOrThrow(requestId);
      paymentRequest.currentStepApproverIds = [];
      paymentRequest.businessStatus = 'cancelled';
      paymentRequest.erpSyncStatus = 'not_ready';
      appendAuditLog({
        entityId: paymentRequest.id,
        actionCode: 'cancel_request',
        actorId,
        note: `Request ${paymentRequest.requestNo} was cancelled.`,
      });
      return paymentRequest;
    },
    async resubmitPaymentRequest({ requestId, actorId }) {
      const paymentRequest = getRequestOrThrow(requestId);
      paymentRequest.businessStatus = 'pending_approval';
      paymentRequest.currentStepApproverIds = paymentRequest.workflowUserIds.length > 0
        ? [paymentRequest.workflowUserIds[0]]
        : [];
      paymentRequest.erpSyncStatus = 'not_ready';
      paymentRequest.workflowSteps = (paymentRequest.workflowSteps ?? buildFixtureWorkflowSteps(paymentRequest)).map((step, index) => ({
        ...step,
        status: index === 0 ? 'pending' : 'queued',
        actionAt: null,
      }));
      appendAuditLog({
        entityId: paymentRequest.id,
        actionCode: 'resubmit_request',
        actorId,
        note: `Request ${paymentRequest.requestNo} was resubmitted.`,
      });
      return paymentRequest;
    },
    async releaseToErp({ requestId, actorId }) {
      const paymentRequest = getRequestOrThrow(requestId);
      paymentRequest.erpSyncStatus = 'pending';
      const idempotencyKey = `payment_request:${paymentRequest.id}`;
      const existingJob = integrationJobs.find((entry) => entry.idempotencyKey === idempotencyKey && entry.targetSystem === 'erp');
      if (!existingJob) {
        integrationJobs.unshift({
          id: `job-${paymentRequest.id}-${integrationJobs.length + 1}`,
          requestId: paymentRequest.id,
          requestNo: paymentRequest.requestNo,
          targetSystem: 'erp',
          idempotencyKey,
          status: 'pending',
          errorCategory: null,
          retryCount: 0,
          lastError: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
      appendAuditLog({
        entityId: paymentRequest.id,
        actionCode: 'release_to_erp',
        actorId,
        note: `Request ${paymentRequest.requestNo} was released to ERP.`,
      });
      return paymentRequest;
    },
    async financeApprove({ requestId, actorId }) {
      const paymentRequest = getRequestOrThrow(requestId);
      paymentRequest.erpSyncStatus = 'hold_by_finance';
      appendAuditLog({
        entityType: 'payment_request',
        entityId: paymentRequest.id,
        actionCode: 'finance_approve',
        actorId,
        note: `Finance approved ${paymentRequest.requestNo} without ERP release.`,
      });
      return paymentRequest;
    },
    async financeReject({ requestId, actorId, note }) {
      const paymentRequest = getRequestOrThrow(requestId);
      paymentRequest.businessStatus = 'rejected';
      paymentRequest.erpSyncStatus = 'not_ready';
      paymentRequest.currentStepApproverIds = [];
      appendAuditLog({
        entityType: 'payment_request',
        entityId: paymentRequest.id,
        actionCode: 'finance_reject',
        actorId,
        note: `Finance rejected ${paymentRequest.requestNo}. Reason: ${note}`,
      });
      return paymentRequest;
    },
    async holdErpSync({ requestId, actorId }) {
      const paymentRequest = getRequestOrThrow(requestId);
      paymentRequest.erpSyncStatus = 'hold_by_finance';
      appendAuditLog({
        entityId: paymentRequest.id,
        actionCode: 'hold_erp_sync',
        actorId,
        note: `ERP sync for ${paymentRequest.requestNo} was put on hold.`,
      });
      return paymentRequest;
    },
    async retryIntegrationJob({ jobId, actorId }) {
      const job = integrationJobs.find((entry) => entry.id === jobId);
      if (!job) {
        throw new Error('ERP integration job does not exist.');
      }

      job.status = 'pending';
      job.retryCount += 1;
      job.lastError = null;
      job.updatedAt = new Date().toISOString();
      if (job.requestId) {
        appendAuditLog({
          entityId: job.requestId,
          actionCode: 'retry_erp_job',
          actorId,
          note: `ERP job for ${job.requestNo} was retried.`,
        });
      }
      return job;
    },
  };
}
