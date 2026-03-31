import { createRequire } from 'node:module';
import { DEFAULT_REQUEST_TEMPLATES } from './defaultTemplates.mjs';

function mapRowToPaymentRequest(row) {
  return {
    id: row.id,
    requestNo: row.requestNo,
    requesterId: row.requesterId,
    requesterName: row.requesterName,
    departmentId: row.departmentId,
    templateCode: row.templateCode ?? null,
    templateName: row.templateName ?? null,
    templateVersion: row.templateVersion ?? null,
    templateFormSchema: row.templateFormSchema ?? {},
    templateDetailSchema: row.templateDetailSchema ?? {},
    templateAttachmentRules: row.templateAttachmentRules ?? {},
    vendorCode: row.vendorCode ?? null,
    bankAccountName: row.bankAccountName ?? null,
    bankAccountNumber: row.bankAccountNumber ?? null,
    bankName: row.bankName ?? null,
    requestType: row.requestType,
    payeeName: row.payeeName,
    paymentType: row.paymentType,
    totalAmount: Number(row.totalAmount),
    currency: row.currency,
    priority: row.priority ?? 'medium',
    visibilityMode: row.visibilityMode,
    businessStatus: row.businessStatus,
    erpSyncStatus: row.erpSyncStatus,
    createdAt: row.createdAt.toISOString(),
    workflowUserIds: row.workflowUserIds ?? [],
    currentStepApproverIds: row.currentStepApproverIds ?? [],
    details: row.details ?? [],
    workflowSteps: row.workflowSteps ?? [],
    attachments: row.attachments ?? [],
  };
}

function mapRowToRequestTemplate(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    requestType: row.requestType,
    description: row.description ?? '',
    version: Number(row.version ?? 1),
    visibilityMode: row.visibilityMode ?? 'related_only',
    isActive: row.isActive ?? true,
    formSchema: row.formSchema ?? {},
    detailSchema: row.detailSchema ?? {},
    attachmentRules: row.attachmentRules ?? {},
  };
}

function mapRowToIntegrationJob(row) {
  return {
    id: row.id,
    requestId: row.requestId,
    requestNo: row.requestNo,
    targetSystem: row.targetSystem,
    idempotencyKey: row.idempotencyKey ?? null,
    status: row.status,
    errorCategory: row.errorCategory ?? null,
    retryCount: Number(row.retryCount ?? 0),
    lastError: row.lastError,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapRowToSetupUser(row) {
  return {
    id: row.id,
    fullName: row.fullName,
    email: row.email,
    departmentId: row.departmentId,
    positionCode: row.positionCode ?? null,
    lineManagerId: row.lineManagerId ?? null,
    roleCode: row.roleCode ?? null,
    isActive: row.isActive ?? true,
  };
}

function mapRowToDepartmentSetup(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    isActive: row.isActive,
    setup: {
      reviewerUserId: row.reviewerUserId ?? null,
      reviewerPositionCode: row.reviewerPositionCode,
      hodUserId: row.hodUserId ?? null,
      hodPositionCode: row.hodPositionCode,
      fallbackUserId: row.fallbackUserId ?? null,
      fallbackPositionCode: row.fallbackPositionCode,
      stepOrder: Array.isArray(row.stepOrder) ? row.stepOrder : ['line_manager', 'reviewer', 'hod'],
      effectiveFrom: row.effectiveFrom ? row.effectiveFrom.toISOString() : null,
      isActive: row.setupIsActive ?? false,
    },
  };
}

function mapRowToGlobalApproverConfig(row) {
  return {
    companyCode: row.companyCode,
    cfoPositionCode: row.cfoPositionCode,
    ceoPositionCode: row.ceoPositionCode,
    cfoAmountThreshold: row.cfoAmountThreshold === null ? null : Number(row.cfoAmountThreshold),
    ceoAmountThreshold: row.ceoAmountThreshold === null ? null : Number(row.ceoAmountThreshold),
    isActive: row.isActive,
  };
}

function mapRowToAuditLog(row) {
  return {
    id: row.id,
    entityType: row.entityType,
    entityId: row.entityId,
    actionCode: row.actionCode,
    actorId: row.actorId,
    actorName: row.actorName,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
  };
}

function mapRowToErpReferenceValue(row) {
  return {
    id: row.id,
    referenceType: row.referenceType,
    code: row.code,
    name: row.name,
    parentCode: row.parentCode ?? null,
    currency: row.currency ?? null,
    syncSource: row.syncSource,
    lastSyncedAt: row.lastSyncedAt ? row.lastSyncedAt.toISOString() : null,
    isActive: row.isActive ?? true,
  };
}

async function resolveUserByIdentity(queryable, identitySubject) {
  const result = await queryable.query(
    `
      SELECT
        user_id::text AS "userId",
        full_name AS "fullName",
        COALESCE(identity_subject, user_id::text) AS "identitySubject",
        COALESCE(dept.department_code, users.department_id::text) AS "departmentCode"
      FROM users
      LEFT JOIN departments dept ON dept.department_id = users.department_id
      WHERE identity_subject = $1
      LIMIT 1
    `,
    [identitySubject]
  );

  return result.rows[0] ?? null;
}

async function resolveActiveUserByIdentity(queryable, identitySubject) {
  if (!identitySubject) {
    return null;
  }

  const result = await queryable.query(
    `
      SELECT
        u.user_id::text AS "userId",
        u.full_name AS "fullName",
        COALESCE(u.identity_subject, u.user_id::text) AS "identitySubject",
        COALESCE(dept.department_code, u.department_id::text) AS "departmentCode",
        p.position_code AS "positionCode",
        (
          SELECT STRING_AGG(ur.role_code, ',' ORDER BY ur.role_code)
          FROM user_roles ur
          WHERE ur.user_id = u.user_id
        ) AS "roleCodes"
      FROM users u
      LEFT JOIN departments dept ON dept.department_id = u.department_id
      LEFT JOIN positions p ON p.position_id = u.position_id
      WHERE COALESCE(u.identity_subject, u.user_id::text) = $1
        AND u.is_active = TRUE
      LIMIT 1
    `,
    [identitySubject]
  );

  if (!result.rows[0]) {
    return null;
  }

  return {
    ...result.rows[0],
    roleCodes: String(result.rows[0].roleCodes ?? '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean),
  };
}

async function listEligibleLineManagerOverrides(queryable, { requesterUserId, departmentUuid }) {
  const result = await queryable.query(
    `
      SELECT
        COALESCE(u.identity_subject, u.user_id::text) AS "approverId",
        u.full_name AS "approverName",
        p.position_code AS "positionCode",
        (
          SELECT STRING_AGG(ur.role_code, ',' ORDER BY ur.role_code)
          FROM user_roles ur
          WHERE ur.user_id = u.user_id
        ) AS "roleCodes"
      FROM users u
      LEFT JOIN positions p ON p.position_id = u.position_id
      WHERE u.is_active = TRUE
        AND u.department_id = $1::uuid
        AND u.user_id <> $2::uuid
        AND u.user_id <> COALESCE((SELECT line_manager_id FROM users WHERE user_id = $2::uuid), '00000000-0000-0000-0000-000000000000'::uuid)
        AND (
          p.position_code IN ('line_manager', 'reviewer', 'hod')
          OR EXISTS (
            SELECT 1
            FROM user_roles ur
            WHERE ur.user_id = u.user_id
              AND ur.role_code IN ('manager', 'director', 'admin')
          )
        )
      ORDER BY u.full_name ASC
    `,
    [departmentUuid, requesterUserId]
  );

  return result.rows.map((row) => ({
    approverId: row.approverId,
    approverName: row.approverName,
    positionCode: row.positionCode ?? null,
    roleCode: String(row.roleCodes ?? '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)[0] ?? null,
  }));
}

async function resolveLineManagerOverride(queryable, { requesterUserId, departmentUuid, overrideActorId }) {
  if (!overrideActorId) {
    return null;
  }

  const candidates = await listEligibleLineManagerOverrides(queryable, {
    requesterUserId,
    departmentUuid,
  });

  return candidates.find((candidate) => candidate.approverId === overrideActorId) ?? null;
}

async function resolvePositionByCode(queryable, positionCode) {
  if (!positionCode) {
    return null;
  }

  const result = await queryable.query(
    `
      SELECT position_id::text AS "positionId"
      FROM positions
      WHERE position_code = $1
      LIMIT 1
    `,
    [positionCode]
  );

  return result.rows[0]?.positionId ?? null;
}

async function resolveDepartmentUuidByCode(queryable, departmentCode) {
  if (!departmentCode) {
    return null;
  }

  const result = await queryable.query(
    `
      SELECT department_id::text AS "departmentId"
      FROM departments
      WHERE department_code = $1
      LIMIT 1
    `,
    [departmentCode]
  );

  return result.rows[0]?.departmentId ?? null;
}

async function ensureDefaultTemplates(queryable) {
  const countResult = await queryable.query(`SELECT COUNT(*)::int AS "count" FROM request_templates`);
  if ((countResult.rows[0]?.count ?? 0) > 0) {
    return;
  }

  for (const template of DEFAULT_REQUEST_TEMPLATES) {
    await queryable.query(
      `
        INSERT INTO request_templates (
          template_code,
          template_name,
          request_type,
          description,
          version,
          form_schema_json,
          detail_schema_json,
          attachment_rules_json,
          visibility_mode,
          is_active
        )
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9, $10)
      `,
      [
        template.code,
        template.name,
        template.requestType,
        template.description,
        template.version,
        JSON.stringify(template.formSchema ?? {}),
        JSON.stringify(template.detailSchema ?? {}),
        JSON.stringify(template.attachmentRules ?? {}),
        template.visibilityMode ?? 'related_only',
        template.isActive !== false,
      ]
    );
  }
}

async function resolveActiveUserByPosition(queryable, { positionCode, departmentUuid = null }) {
  if (!positionCode) {
    return null;
  }

  const result = await queryable.query(
    `
      SELECT
        COALESCE(u.identity_subject, u.user_id::text) AS "identitySubject"
      FROM users u
      INNER JOIN positions p ON p.position_id = u.position_id
      WHERE p.position_code = $1
        AND u.is_active = TRUE
        AND ($2::uuid IS NULL OR u.department_id = $2::uuid)
      ORDER BY u.updated_at DESC, u.created_at ASC
      LIMIT 1
    `,
    [positionCode, departmentUuid]
  );

  return result.rows[0]?.identitySubject ?? null;
}

async function resolveWorkflowChain(queryable, { requesterUserId, departmentUuid, totalAmount, lineManagerOverrideId = null }) {
  const requesterResult = await queryable.query(
    `
      SELECT
        requester.user_id::text AS "requesterUserId",
        COALESCE(requester.identity_subject, requester.user_id::text) AS "requesterActorId",
        COALESCE(line_manager.identity_subject, requester.line_manager_id::text) AS "lineManagerId"
      FROM users requester
      LEFT JOIN users line_manager ON line_manager.user_id = requester.line_manager_id
      WHERE requester.user_id = $1::uuid
      LIMIT 1
    `,
    [requesterUserId]
  );

  const departmentSetupResult = await queryable.query(
    `
      SELECT
        COALESCE(reviewer_user.identity_subject, das.reviewer_user_id::text) AS "reviewerUserId",
        reviewer_position.position_code AS "reviewerPositionCode",
        COALESCE(hod_user.identity_subject, das.hod_user_id::text) AS "hodUserId",
        hod_position.position_code AS "hodPositionCode",
        COALESCE(fallback_user.identity_subject, das.fallback_user_id::text) AS "fallbackUserId",
        fallback_position.position_code AS "fallbackPositionCode",
        das.step_order_json AS "stepOrder"
      FROM department_approval_setup das
      LEFT JOIN users reviewer_user ON reviewer_user.user_id = das.reviewer_user_id
      LEFT JOIN positions reviewer_position ON reviewer_position.position_id = das.reviewer_position_id
      LEFT JOIN users hod_user ON hod_user.user_id = das.hod_user_id
      LEFT JOIN positions hod_position ON hod_position.position_id = das.hod_position_id
      LEFT JOIN users fallback_user ON fallback_user.user_id = das.fallback_user_id
      LEFT JOIN positions fallback_position ON fallback_position.position_id = das.fallback_position_id
      WHERE das.department_id = $1::uuid
        AND das.is_active = TRUE
      ORDER BY das.effective_from DESC NULLS LAST, das.created_at DESC
      LIMIT 1
    `,
    [departmentUuid]
  );

  const globalConfigResult = await queryable.query(
    `
      SELECT
        cfo_position.position_code AS "cfoPositionCode",
        ceo_position.position_code AS "ceoPositionCode",
        gac.cfo_amount_threshold AS "cfoThreshold",
        gac.ceo_amount_threshold AS "ceoThreshold"
      FROM global_approver_config gac
      LEFT JOIN positions cfo_position ON cfo_position.position_id = gac.cfo_position_id
      LEFT JOIN positions ceo_position ON ceo_position.position_id = gac.ceo_position_id
      WHERE gac.is_active = TRUE
      ORDER BY gac.updated_at DESC
      LIMIT 1
    `
  );

  const requester = requesterResult.rows[0] ?? null;
  const departmentSetup = departmentSetupResult.rows[0] ?? null;
  const globalConfig = globalConfigResult.rows[0] ?? null;
  const candidates = [];
  const issues = [];
  const basePriority = {
    line_manager: 1,
    reviewer: 2,
    hod: 3,
    cfo: 4,
    ceo: 5,
  };
  const stepOrder = Array.isArray(departmentSetup?.stepOrder) && departmentSetup.stepOrder.length > 0
    ? departmentSetup.stepOrder
    : ['line_manager', 'reviewer', 'hod'];

  const resolvedLineManagerOverride = await resolveLineManagerOverride(queryable, {
    requesterUserId,
    departmentUuid,
    overrideActorId: lineManagerOverrideId,
  });
  if (lineManagerOverrideId && !resolvedLineManagerOverride) {
    throw new Error('Line manager override is not valid for this requester.');
  }

  for (const stepCode of stepOrder) {
    let approverId = null;
    let defaultApproverId = null;
    let issue = null;

    if (stepCode === 'line_manager') {
      defaultApproverId = requester?.lineManagerId ?? null;
      approverId = resolvedLineManagerOverride?.approverId ?? defaultApproverId;
      if (!defaultApproverId && !resolvedLineManagerOverride) {
        issue = {
          code: 'line_manager_missing',
          stepCode,
          severity: 'error',
          message: 'Requester does not have a line manager configured in Master Data.',
        };
      }
    } else if (stepCode === 'reviewer') {
      approverId = departmentSetup?.reviewerUserId
        ? departmentSetup.reviewerUserId
        : await resolveActiveUserByPosition(queryable, {
            positionCode: departmentSetup?.reviewerPositionCode ?? null,
            departmentUuid,
          });
      if (!approverId) {
        issue = {
          code: 'reviewer_optional_missing',
          stepCode,
          severity: 'warning',
          message: 'Reviewer is optional and is not configured for this department.',
        };
      }
    } else if (stepCode === 'hod') {
      approverId = departmentSetup?.hodUserId
        ? departmentSetup.hodUserId
        : await resolveActiveUserByPosition(queryable, {
            positionCode: departmentSetup?.hodPositionCode ?? null,
            departmentUuid,
          });
      if (!approverId) {
        issue = {
          code: 'hod_missing',
          stepCode,
          severity: 'error',
          message: 'Department HOD is not configured or no active HOD user could be resolved.',
        };
      }
    }

    if (issue) {
      issues.push(issue);
    }

    if (approverId && approverId !== requester?.requesterActorId) {
      candidates.push({
        stepCode,
        approverId,
        priority: basePriority[stepCode],
        defaultApproverId,
        isOverridden: stepCode === 'line_manager' && Boolean(resolvedLineManagerOverride && resolvedLineManagerOverride.approverId !== defaultApproverId),
      });
    } else if (approverId && approverId === requester?.requesterActorId) {
      issues.push({
        code: 'self_approval_skipped',
        stepCode,
        severity: 'warning',
        message: `${stepCode.replace(/_/g, ' ')} is assigned to the requester and will be skipped.`,
      });
    }
  }

  if (
    globalConfig?.cfoPositionCode &&
    globalConfig?.cfoThreshold !== null &&
    Number(totalAmount) >= Number(globalConfig.cfoThreshold)
  ) {
    const cfoId = await resolveActiveUserByPosition(queryable, {
      positionCode: globalConfig.cfoPositionCode,
    });
    if (cfoId && cfoId !== requester?.requesterActorId) {
      candidates.push({ stepCode: 'cfo', approverId: cfoId, priority: 4, defaultApproverId: null, isOverridden: false });
    } else if (!cfoId) {
      issues.push({
        code: 'cfo_missing',
        stepCode: 'cfo',
        severity: 'error',
        message: 'Request amount requires CFO approval, but no active CFO user is configured.',
      });
    } else {
      issues.push({
        code: 'self_approval_skipped',
        stepCode: 'cfo',
        severity: 'warning',
        message: 'CFO step resolves to the requester and will be skipped.',
      });
    }
  }

  if (
    globalConfig?.ceoPositionCode &&
    globalConfig?.ceoThreshold !== null &&
    Number(totalAmount) >= Number(globalConfig.ceoThreshold)
  ) {
    const ceoId = await resolveActiveUserByPosition(queryable, {
      positionCode: globalConfig.ceoPositionCode,
    });
    if (ceoId && ceoId !== requester?.requesterActorId) {
      candidates.push({ stepCode: 'ceo', approverId: ceoId, priority: 5, defaultApproverId: null, isOverridden: false });
    } else if (!ceoId) {
      issues.push({
        code: 'ceo_missing',
        stepCode: 'ceo',
        severity: 'error',
        message: 'Request amount requires CEO approval, but no active CEO user is configured.',
      });
    } else {
      issues.push({
        code: 'self_approval_skipped',
        stepCode: 'ceo',
        severity: 'warning',
        message: 'CEO step resolves to the requester and will be skipped.',
      });
    }
  }

  const keptByApprover = new Map();
  for (const candidate of candidates) {
    const existing = keptByApprover.get(candidate.approverId);
    if (!existing || candidate.priority > existing.priority) {
      keptByApprover.set(candidate.approverId, candidate);
    }
  }

  const workflowChain = candidates.filter((candidate) => keptByApprover.get(candidate.approverId)?.stepCode === candidate.stepCode);

  if (workflowChain.length === 0) {
    issues.push({
      code: 'workflow_chain_empty',
      stepCode: null,
      severity: 'error',
      message: 'No effective approver remains after applying setup, self-approval skip, and deduplication.',
    });
  }

  return {
    candidates,
    workflowChain,
    issues,
    lineManagerOverride: resolvedLineManagerOverride
      ? {
          approverId: resolvedLineManagerOverride.approverId,
          approverName: resolvedLineManagerOverride.approverName,
          positionCode: resolvedLineManagerOverride.positionCode ?? null,
          roleCode: resolvedLineManagerOverride.roleCode ?? null,
        }
      : null,
    defaultLineManagerId: requester?.lineManagerId ?? null,
  };
}

async function buildWorkflowPreview(queryable, { requesterUserId, departmentUuid, totalAmount, lineManagerOverrideId = null }) {
  const workflowResolution = await resolveWorkflowChain(queryable, {
    requesterUserId,
    departmentUuid,
    totalAmount,
    lineManagerOverrideId,
  });
  const approverIds = Array.from(
    new Set(
      workflowResolution.candidates
        .flatMap((entry) => [entry.approverId, entry.defaultApproverId])
        .filter(Boolean)
    )
  );
  const approverMap = new Map();

  for (const approverId of approverIds) {
    const approver = await resolveActiveUserByIdentity(queryable, approverId);
    if (approver) {
      approverMap.set(approverId, approver);
    }
  }

  const lineManagerCandidates = await listEligibleLineManagerOverrides(queryable, {
    requesterUserId,
    departmentUuid,
  });

  return {
    steps: workflowResolution.candidates.map((entry) => ({
      stepCode: entry.stepCode,
      approverId: entry.approverId,
      approverName: approverMap.get(entry.approverId)?.fullName ?? entry.approverId,
      defaultApproverId: entry.defaultApproverId ?? entry.approverId,
      defaultApproverName: entry.defaultApproverId
        ? approverMap.get(entry.defaultApproverId)?.fullName ?? entry.defaultApproverId
        : approverMap.get(entry.approverId)?.fullName ?? entry.approverId,
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
    issues: workflowResolution.issues,
    lineManagerOverride: {
      defaultApproverId: workflowResolution.defaultLineManagerId,
      defaultApproverName: workflowResolution.defaultLineManagerId
        ? approverMap.get(workflowResolution.defaultLineManagerId)?.fullName ?? workflowResolution.defaultLineManagerId
        : null,
      selectedApproverId: workflowResolution.lineManagerOverride?.approverId ?? null,
      selectedApproverName: workflowResolution.lineManagerOverride?.approverName ?? null,
      candidates: lineManagerCandidates,
    },
  };
}

export function createPostgresRepository({ databaseUrl }) {
  const require = createRequire(import.meta.url);
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: databaseUrl,
  });

  const paymentRequestSelect = `
    SELECT
      pr.request_id::text AS "id",
      pr.request_no AS "requestNo",
      COALESCE(requester.identity_subject, pr.requester_id::text) AS "requesterId",
      requester.full_name AS "requesterName",
      COALESCE(dept.department_code, pr.department_id::text) AS "departmentId",
      template.template_code AS "templateCode",
      template.template_name AS "templateName",
      pr.template_version AS "templateVersion",
      template.form_schema_json AS "templateFormSchema",
      template.detail_schema_json AS "templateDetailSchema",
      template.attachment_rules_json AS "templateAttachmentRules",
      pr.vendor_code AS "vendorCode",
      vendor.bank_account_name AS "bankAccountName",
      vendor.bank_account_number AS "bankAccountNumber",
      vendor.bank_name AS "bankName",
      pr.request_type AS "requestType",
      pr.payee_name AS "payeeName",
      COALESCE(pr.payment_type, 'Vendor Payment') AS "paymentType",
      pr.total_amount AS "totalAmount",
      pr.currency AS "currency",
      pr.priority AS "priority",
      pr.visibility_mode AS "visibilityMode",
      pr.business_status::text AS "businessStatus",
      pr.erp_sync_status::text AS "erpSyncStatus",
      pr.created_at AS "createdAt",
      COALESCE(ARRAY(
        SELECT COALESCE(step_user.identity_subject, rws_all.original_user_id::text)
        FROM request_workflow_steps rws_all
        LEFT JOIN users step_user ON step_user.user_id = rws_all.original_user_id
        WHERE rws_all.workflow_instance_id = rwi.workflow_instance_id
        ORDER BY rws_all.step_no
      ), ARRAY[]::text[]) AS "workflowUserIds",
      COALESCE(ARRAY(
        SELECT COALESCE(assignee_user.identity_subject, COALESCE(rws_pending.acting_user_id, rws_pending.original_user_id)::text)
        FROM request_workflow_steps rws_pending
        LEFT JOIN users assignee_user ON assignee_user.user_id = COALESCE(rws_pending.acting_user_id, rws_pending.original_user_id)
        WHERE rws_pending.workflow_instance_id = rwi.workflow_instance_id
          AND rws_pending.step_no = rwi.current_step_no
          AND rws_pending.status = 'pending'
        ORDER BY rws_pending.step_no
      ), ARRAY[]::text[]) AS "currentStepApproverIds",
      COALESCE((
        SELECT JSONB_AGG(JSONB_BUILD_OBJECT(
          'stepNo', rws_all.step_no,
          'stepCode', rws_all.step_code,
          'approverId', COALESCE(step_user.identity_subject, rws_all.original_user_id::text),
          'approverName', step_user.full_name,
          'actingApproverId', CASE
            WHEN rws_all.acting_user_id IS NULL THEN NULL
            ELSE COALESCE(acting_user.identity_subject, rws_all.acting_user_id::text)
          END,
          'actingApproverName', acting_user.full_name,
          'status', rws_all.status,
          'actionAt', CASE
            WHEN rws_all.action_at IS NULL THEN NULL
            ELSE TO_CHAR(rws_all.action_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
          END
        ) ORDER BY rws_all.step_no)
        FROM request_workflow_steps rws_all
        LEFT JOIN users step_user ON step_user.user_id = rws_all.original_user_id
        LEFT JOIN users acting_user ON acting_user.user_id = rws_all.acting_user_id
        WHERE rws_all.workflow_instance_id = rwi.workflow_instance_id
      ), '[]'::jsonb) AS "workflowSteps",
      COALESCE((
        SELECT JSONB_AGG(JSONB_BUILD_OBJECT(
          'id', prd.detail_id::text,
          'lineNo', prd.line_no,
          'description', prd.description,
          'invoiceDate', CASE
            WHEN prd.invoice_date IS NULL THEN NULL
            ELSE TO_CHAR(prd.invoice_date, 'YYYY-MM-DD')
          END,
          'invoiceRef', prd.invoice_no,
          'glCode', prd.gl_account,
          'costCenter', prd.cost_center,
          'projectCode', prd.project_code,
          'expenseTypeCode', prd.expense_type_code,
          'currency', prd.currency,
          'exchangeRate', prd.exchange_rate,
          'amount', prd.amount,
          'totalAmount', prd.total_amount,
          'note', prd.note,
          'remark', prd.remark
        ) ORDER BY prd.line_no)
        FROM payment_request_details prd
        WHERE prd.request_id = pr.request_id
      ), '[]'::jsonb) AS "details",
      COALESCE((
        SELECT JSONB_AGG(JSONB_BUILD_OBJECT(
          'id', pra.attachment_id::text,
          'attachmentType', pra.attachment_type,
          'fileName', pra.file_name,
          'filePath', pra.file_path,
          'fileSize', pra.file_size,
          'uploadedAt', TO_CHAR(pra.uploaded_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')
        ) ORDER BY pra.uploaded_at DESC)
        FROM payment_request_attachments pra
        WHERE pra.request_id = pr.request_id
      ), '[]'::jsonb) AS "attachments"
    FROM payment_requests pr
    LEFT JOIN users requester ON requester.user_id = pr.requester_id
    LEFT JOIN departments dept ON dept.department_id = pr.department_id
    LEFT JOIN request_templates template ON template.template_id = pr.template_id
    LEFT JOIN vendors vendor ON vendor.vendor_code = pr.vendor_code
    LEFT JOIN request_workflow_instances rwi ON rwi.request_id = pr.request_id
  `;
  const integrationJobSelect = `
    SELECT
      ij.job_id::text AS "id",
      ij.ref_id::text AS "requestId",
      pr.request_no AS "requestNo",
      ij.target_system AS "targetSystem",
      ij.idempotency_key AS "idempotencyKey",
      ij.status::text AS "status",
      ij.error_category AS "errorCategory",
      ij.retry_count AS "retryCount",
      ij.last_error AS "lastError",
      ij.created_at AS "createdAt",
      ij.updated_at AS "updatedAt"
    FROM integration_jobs ij
    LEFT JOIN payment_requests pr ON pr.request_id = ij.ref_id
    WHERE ij.ref_type = 'payment_request'
  `;

  async function fetchPaymentRequest(queryable, requestId) {
    const result = await queryable.query(
      `${paymentRequestSelect} WHERE pr.request_id::text = $1 OR pr.request_no = $1 LIMIT 1`,
      [requestId]
    );

    return result.rows[0] ? mapRowToPaymentRequest(result.rows[0]) : null;
  }

  async function fetchRequestContext(queryable, requestId) {
    const result = await queryable.query(
      `
        SELECT
          pr.request_id::text AS "requestId",
          pr.request_no AS "requestNo",
          pr.business_status::text AS "businessStatus",
          pr.erp_sync_status::text AS "erpSyncStatus",
          rwi.workflow_instance_id::text AS "workflowInstanceId",
          rwi.current_step_no AS "currentStepNo"
        FROM payment_requests pr
        LEFT JOIN request_workflow_instances rwi ON rwi.request_id = pr.request_id
        WHERE pr.request_id::text = $1 OR pr.request_no = $1
        LIMIT 1
      `,
      [requestId]
    );

    return result.rows[0] ?? null;
  }

  async function fetchIntegrationJob(queryable, jobId) {
    const result = await queryable.query(
      `${integrationJobSelect} AND ij.job_id::text = $1 LIMIT 1`,
      [jobId]
    );

    return result.rows[0] ? mapRowToIntegrationJob(result.rows[0]) : null;
  }

  async function fetchPaymentRequestAuditLogs(queryable, requestId) {
    const result = await queryable.query(
      `
        SELECT
          al.audit_id::text AS "id",
          al.entity_type AS "entityType",
          al.entity_id::text AS "entityId",
          al.action_code AS "actionCode",
          COALESCE(actor.identity_subject, al.actor_user_id::text) AS "actorId",
          actor.full_name AS "actorName",
          COALESCE(al.action_note, al.metadata_json->>'note', '') AS "note",
          al.created_at AS "createdAt"
        FROM audit_logs al
        LEFT JOIN users actor ON actor.user_id = al.actor_user_id
        WHERE al.entity_type = 'payment_request'
          AND al.entity_id = $1::uuid
        ORDER BY al.created_at DESC
      `,
      [requestId]
    );

    return result.rows.map(mapRowToAuditLog);
  }

  async function fetchAuditLogs(queryable, { entityType = null, entityId = null, limit = 100 } = {}) {
    const result = await queryable.query(
      `
        SELECT
          al.audit_id::text AS "id",
          al.entity_type AS "entityType",
          al.entity_id::text AS "entityId",
          al.action_code AS "actionCode",
          COALESCE(actor.identity_subject, al.actor_user_id::text) AS "actorId",
          actor.full_name AS "actorName",
          COALESCE(al.action_note, al.metadata_json->>'note', '') AS "note",
          al.created_at AS "createdAt"
        FROM audit_logs al
        LEFT JOIN users actor ON actor.user_id = al.actor_user_id
        WHERE ($1::text IS NULL OR al.entity_type = $1)
          AND ($2::text IS NULL OR al.entity_id::text = $2)
        ORDER BY al.created_at DESC
        LIMIT $3
      `,
      [entityType, entityId, limit]
    );

    return result.rows.map(mapRowToAuditLog);
  }

async function fetchApprovalSetupData(queryable) {
  const [departmentsResult, positionsResult, usersResult, globalConfigResult] = await Promise.all([
    queryable.query(
      `
          SELECT
            d.department_id::text AS "id",
            d.department_code AS "code",
            d.department_name AS "name",
            d.is_active AS "isActive",
            COALESCE(reviewer_user.identity_subject, das.reviewer_user_id::text) AS "reviewerUserId",
            reviewer_position.position_code AS "reviewerPositionCode",
            COALESCE(hod_user.identity_subject, das.hod_user_id::text) AS "hodUserId",
            hod_position.position_code AS "hodPositionCode",
            COALESCE(fallback_user.identity_subject, das.fallback_user_id::text) AS "fallbackUserId",
            fallback_position.position_code AS "fallbackPositionCode",
            das.step_order_json AS "stepOrder",
            das.effective_from AS "effectiveFrom",
            das.is_active AS "setupIsActive"
          FROM departments d
          LEFT JOIN LATERAL (
            SELECT *
            FROM department_approval_setup
            WHERE department_id = d.department_id
            ORDER BY effective_from DESC NULLS LAST, updated_at DESC
            LIMIT 1
          ) das ON TRUE
          LEFT JOIN users reviewer_user ON reviewer_user.user_id = das.reviewer_user_id
          LEFT JOIN positions reviewer_position ON reviewer_position.position_id = das.reviewer_position_id
          LEFT JOIN users hod_user ON hod_user.user_id = das.hod_user_id
          LEFT JOIN positions hod_position ON hod_position.position_id = das.hod_position_id
          LEFT JOIN users fallback_user ON fallback_user.user_id = das.fallback_user_id
          LEFT JOIN positions fallback_position ON fallback_position.position_id = das.fallback_position_id
        ORDER BY d.department_name ASC
      `
    ),
    queryable.query(
      `
        SELECT
          position_code AS "code",
          position_name AS "name",
          is_global AS "isGlobal",
          is_active AS "isActive"
        FROM positions
        ORDER BY is_global ASC, position_name ASC
      `
    ),
    queryable.query(
      `
          SELECT
            COALESCE(u.identity_subject, u.user_id::text) AS "id",
            u.full_name AS "fullName",
            u.email AS "email",
            COALESCE(d.department_code, u.department_id::text) AS "departmentId",
            p.position_code AS "positionCode",
            COALESCE(line_manager.identity_subject, u.line_manager_id::text) AS "lineManagerId",
            MIN(ur.role_code) AS "roleCode",
            u.is_active AS "isActive"
          FROM users u
          LEFT JOIN departments d ON d.department_id = u.department_id
          LEFT JOIN positions p ON p.position_id = u.position_id
          LEFT JOIN users line_manager ON line_manager.user_id = u.line_manager_id
          LEFT JOIN user_roles ur ON ur.user_id = u.user_id
          WHERE u.is_active = TRUE
          GROUP BY u.user_id, u.identity_subject, u.full_name, u.email, d.department_code, u.department_id, p.position_code, line_manager.identity_subject, u.line_manager_id, u.is_active
          ORDER BY u.full_name ASC
        `
      ),
      queryable.query(
        `
          SELECT
            company_code AS "companyCode",
            cfo_position.position_code AS "cfoPositionCode",
            ceo_position.position_code AS "ceoPositionCode",
            cfo_amount_threshold AS "cfoAmountThreshold",
            ceo_amount_threshold AS "ceoAmountThreshold",
            gac.is_active AS "isActive"
          FROM global_approver_config gac
          LEFT JOIN positions cfo_position ON cfo_position.position_id = gac.cfo_position_id
          LEFT JOIN positions ceo_position ON ceo_position.position_id = gac.ceo_position_id
          ORDER BY gac.updated_at DESC
          LIMIT 1
        `
      ),
    ]);

  return {
    departments: departmentsResult.rows.map(mapRowToDepartmentSetup),
    positions: positionsResult.rows,
    users: usersResult.rows.map(mapRowToSetupUser),
    globalConfig: globalConfigResult.rows[0] ? mapRowToGlobalApproverConfig(globalConfigResult.rows[0]) : null,
  };
}

  async function fetchMasterData(queryable) {
    const [departmentsResult, rolesResult, positionsResult, usersResult, vendorsResult, erpReferencesResult] = await Promise.all([
      queryable.query(
        `
          SELECT
            department_id::text AS "id",
            department_code AS "code",
            department_name AS "name",
            is_active AS "isActive"
          FROM departments
          ORDER BY department_name ASC
        `
      ),
      queryable.query(
        `
          SELECT
            role_code AS "code",
            role_name AS "name"
          FROM roles
          WHERE role_code IN ('staff', 'manager', 'director', 'finance_operations', 'admin', 'auditor')
          ORDER BY role_name ASC
        `
      ),
      queryable.query(
        `
          SELECT
            position_code AS "code",
            position_name AS "name",
            is_global AS "isGlobal",
            is_active AS "isActive"
          FROM positions
          ORDER BY is_global ASC, position_name ASC
        `
      ),
      queryable.query(
        `
          SELECT
            COALESCE(u.identity_subject, u.user_id::text) AS "id",
            u.full_name AS "fullName",
            u.email AS "email",
            COALESCE(d.department_code, u.department_id::text) AS "departmentId",
            p.position_code AS "positionCode",
            COALESCE(line_manager.identity_subject, u.line_manager_id::text) AS "lineManagerId",
            MIN(ur.role_code) AS "roleCode",
            u.is_active AS "isActive"
          FROM users u
          LEFT JOIN departments d ON d.department_id = u.department_id
          LEFT JOIN positions p ON p.position_id = u.position_id
          LEFT JOIN users line_manager ON line_manager.user_id = u.line_manager_id
          LEFT JOIN user_roles ur ON ur.user_id = u.user_id
          GROUP BY u.user_id, u.identity_subject, u.full_name, u.email, d.department_code, u.department_id, p.position_code, line_manager.identity_subject, u.line_manager_id, u.is_active
          ORDER BY u.full_name ASC
        `
      ),
      queryable.query(
        `
          SELECT
            vendor_id::text AS "id",
            vendor_code AS "code",
            vendor_name AS "name",
            currency,
            bank_account_name AS "bankAccountName",
            bank_account_number AS "bankAccountNumber",
            bank_name AS "bankName",
            sync_source AS "syncSource",
            last_synced_at AS "lastSyncedAt",
            is_active AS "isActive"
          FROM vendors
          ORDER BY vendor_name ASC
        `
      ),
      queryable.query(
        `
          SELECT
            erp_reference_value_id::text AS "id",
            reference_type AS "referenceType",
            reference_code AS "code",
            reference_name AS "name",
            parent_code AS "parentCode",
            currency,
            sync_source AS "syncSource",
            last_synced_at AS "lastSyncedAt",
            is_active AS "isActive"
          FROM erp_reference_values
          ORDER BY reference_type ASC, reference_name ASC
        `
      ),
    ]);

    return {
      departments: departmentsResult.rows,
      roles: rolesResult.rows,
      positions: positionsResult.rows,
      users: usersResult.rows.map(mapRowToSetupUser),
      vendors: vendorsResult.rows,
      erpReferences: erpReferencesResult.rows.map(mapRowToErpReferenceValue),
    };
  }

  async function resolveOptionalUserUuid(queryable, identitySubject) {
    if (!identitySubject) {
      return null;
    }

    const result = await queryable.query(
      `SELECT user_id::text AS "userId" FROM users WHERE identity_subject = $1 LIMIT 1`,
      [identitySubject]
    );

    if (!result.rows[0]) {
      throw new Error(`User ${identitySubject} does not exist.`);
    }

    return result.rows[0].userId;
  }

  return {
    async getApprovalSetupData() {
      return fetchApprovalSetupData(pool);
    },
    async getMasterData() {
      return fetchMasterData(pool);
    },
    async listRequestTemplates() {
      await ensureDefaultTemplates(pool);
      const result = await pool.query(
        `
          SELECT
            template_id::text AS "id",
            template_code AS "code",
            template_name AS "name",
            request_type AS "requestType",
            description,
            version,
            visibility_mode AS "visibilityMode",
            is_active AS "isActive",
            form_schema_json AS "formSchema",
            detail_schema_json AS "detailSchema",
            attachment_rules_json AS "attachmentRules"
          FROM request_templates
          ORDER BY template_name ASC
        `
      );

      return result.rows.map(mapRowToRequestTemplate);
    },
    async createRequestTemplate({ code, name, requestType, description, visibilityMode, formSchema, detailSchema, attachmentRules, actorId }) {
      const client = await pool.connect();

      try {
        await client.query('BEGIN');
        await ensureDefaultTemplates(client);

        const actor = await resolveUserByIdentity(client, actorId);
        if (!actor) {
          throw new Error('Actor identity does not map to a user record.');
        }

        const inserted = await client.query(
          `
            INSERT INTO request_templates (
              template_code,
              template_name,
              request_type,
              description,
              version,
              form_schema_json,
              detail_schema_json,
              attachment_rules_json,
              visibility_mode,
              is_active
            )
            VALUES ($1, $2, $3, $4, 1, $5::jsonb, $6::jsonb, $7::jsonb, $8, TRUE)
            RETURNING
              template_id::text AS "id",
              template_code AS "code",
              template_name AS "name",
              request_type AS "requestType",
              description,
              version,
              visibility_mode AS "visibilityMode",
              is_active AS "isActive",
              form_schema_json AS "formSchema",
              detail_schema_json AS "detailSchema",
              attachment_rules_json AS "attachmentRules"
          `,
          [
            code,
            name,
            requestType,
            description ?? '',
            JSON.stringify(formSchema ?? {}),
            JSON.stringify(detailSchema ?? {}),
            JSON.stringify(attachmentRules ?? {}),
            visibilityMode ?? 'related_only',
          ]
        );

        await client.query(
          `
            INSERT INTO audit_logs (
              actor_user_id,
              entity_type,
              entity_id,
              action_code,
              metadata_json
            )
            VALUES ($1::uuid, 'request_template', $2::uuid, 'create_request_template', $3::jsonb)
          `,
          [
            actor.userId,
            inserted.rows[0].id,
            JSON.stringify({
              templateCode: code,
              templateName: name,
            }),
          ]
        );

        await client.query('COMMIT');
        return mapRowToRequestTemplate(inserted.rows[0]);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    async updateRequestTemplate({ templateCode, name, description, visibilityMode, isActive, formSchema, detailSchema, attachmentRules, actorId }) {
      const client = await pool.connect();

      try {
        await client.query('BEGIN');
        await ensureDefaultTemplates(client);

        const actor = await resolveUserByIdentity(client, actorId);
        if (!actor) {
          throw new Error('Actor identity does not map to a user record.');
        }

        const updated = await client.query(
          `
            UPDATE request_templates
            SET
              template_name = $2,
              description = $3,
              version = version + 1,
              form_schema_json = $4::jsonb,
              detail_schema_json = $5::jsonb,
              attachment_rules_json = $6::jsonb,
              visibility_mode = $7,
              is_active = $8,
              updated_at = NOW()
            WHERE template_code = $1
            RETURNING
              template_id::text AS "id",
              template_code AS "code",
              template_name AS "name",
              request_type AS "requestType",
              description,
              version,
              visibility_mode AS "visibilityMode",
              is_active AS "isActive",
              form_schema_json AS "formSchema",
              detail_schema_json AS "detailSchema",
              attachment_rules_json AS "attachmentRules"
          `,
          [
            templateCode,
            name,
            description ?? '',
            JSON.stringify(formSchema ?? {}),
            JSON.stringify(detailSchema ?? {}),
            JSON.stringify(attachmentRules ?? {}),
            visibilityMode ?? 'related_only',
            isActive !== false,
          ]
        );

        if (!updated.rows[0]) {
          await client.query('ROLLBACK');
          return null;
        }

        await client.query(
          `
            INSERT INTO audit_logs (
              actor_user_id,
              entity_type,
              entity_id,
              action_code,
              metadata_json
            )
            VALUES ($1::uuid, 'request_template', $2::uuid, 'update_request_template', $3::jsonb)
          `,
          [
            actor.userId,
            updated.rows[0].id,
            JSON.stringify({
              templateCode,
              templateName: name,
            }),
          ]
        );

        await client.query('COMMIT');
        return mapRowToRequestTemplate(updated.rows[0]);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    async listVendors() {
      const result = await pool.query(
        `
          SELECT
            vendor_id::text AS "id",
            vendor_code AS "code",
            vendor_name AS "name",
            currency,
            bank_account_name AS "bankAccountName",
            bank_account_number AS "bankAccountNumber",
            bank_name AS "bankName",
            sync_source AS "syncSource",
            last_synced_at AS "lastSyncedAt",
            is_active AS "isActive"
          FROM vendors
          WHERE is_active = TRUE
          ORDER BY vendor_name ASC
        `
      );

      return result.rows;
    },
    async listErpReferenceValues() {
      const result = await pool.query(
        `
          SELECT
            erp_reference_value_id::text AS "id",
            reference_type AS "referenceType",
            reference_code AS "code",
            reference_name AS "name",
            parent_code AS "parentCode",
            currency,
            sync_source AS "syncSource",
            last_synced_at AS "lastSyncedAt",
            is_active AS "isActive"
          FROM erp_reference_values
          ORDER BY reference_type ASC, reference_name ASC
        `
      );

      return result.rows.map(mapRowToErpReferenceValue);
    },
    async listErpSyncRuns(limit = 20) {
      const result = await pool.query(
        `
          SELECT
            esr.erp_sync_run_id::text AS "id",
            esr.reference_type AS "referenceType",
            esr.sync_mode AS "syncMode",
            esr.status,
            esr.records_upserted AS "recordsUpserted",
            esr.error_message AS "errorMessage",
            COALESCE(actor.identity_subject, esr.triggered_by::text) AS "triggeredBy",
            actor.full_name AS "triggeredByName",
            esr.created_at AS "createdAt"
          FROM erp_sync_runs esr
          LEFT JOIN users actor ON actor.user_id = esr.triggered_by
          ORDER BY esr.created_at DESC
          LIMIT $1
        `,
        [limit]
      );

      return result.rows;
    },
    async syncErpReferenceValues({ referenceType, values, actorId }) {
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        const actor = await resolveUserByIdentity(client, actorId);
        if (!actor) {
          throw new Error('Actor identity does not map to a user record.');
        }

        let recordsUpserted = 0;
        for (const value of values ?? []) {
          if (!value?.referenceType || !value?.code || !value?.name) {
            continue;
          }

          await client.query(
            `
              INSERT INTO erp_reference_values (
                reference_type,
                reference_code,
                reference_name,
                parent_code,
                currency,
                metadata_json,
                sync_source,
                last_synced_at,
                is_active
              )
              VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, NOW(), $8)
              ON CONFLICT (reference_type, reference_code)
              DO UPDATE SET
                reference_name = EXCLUDED.reference_name,
                parent_code = EXCLUDED.parent_code,
                currency = EXCLUDED.currency,
                metadata_json = EXCLUDED.metadata_json,
                sync_source = EXCLUDED.sync_source,
                last_synced_at = EXCLUDED.last_synced_at,
                is_active = EXCLUDED.is_active,
                updated_at = NOW()
            `,
            [
              value.referenceType,
              value.code,
              value.name,
              value.parentCode ?? null,
              value.currency ?? null,
              JSON.stringify(value.metadata ?? {}),
              value.syncSource ?? 'manual_sync',
              value.isActive !== false,
            ]
          );
          recordsUpserted += 1;
        }

        await client.query(
          `
            INSERT INTO erp_sync_runs (
              reference_type,
              sync_mode,
              status,
              records_upserted,
              triggered_by
            )
            VALUES ($1, 'manual', 'success', $2, $3::uuid)
          `,
          [referenceType ?? 'all', recordsUpserted, actor.userId]
        );

        await client.query(
          `
            INSERT INTO audit_logs (
              actor_user_id,
              entity_type,
              action_code,
              metadata_json
            )
            VALUES ($1::uuid, 'erp_reference', 'sync_erp_reference_values', $2::jsonb)
          `,
          [
            actor.userId,
            JSON.stringify({
              referenceType: referenceType ?? 'all',
              recordsUpserted,
            }),
          ]
        );

        await client.query('COMMIT');
        return {
          referenceType: referenceType ?? 'all',
          syncMode: 'manual',
          status: 'success',
          recordsUpserted,
          createdAt: new Date().toISOString(),
        };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    async createDepartment({ code, name, actorId }) {
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        const actor = await resolveUserByIdentity(client, actorId);
        if (!actor) {
          throw new Error('Actor identity does not map to a user record.');
        }

        const inserted = await client.query(
          `
            INSERT INTO departments (
              department_code,
              department_name,
              is_active
            )
            VALUES ($1, $2, TRUE)
            RETURNING
              department_id::text AS "id",
              department_code AS "code",
              department_name AS "name",
              is_active AS "isActive"
          `,
          [code, name]
        );

        await client.query(
          `
            INSERT INTO audit_logs (
              actor_user_id,
              entity_type,
              entity_id,
              action_code,
              metadata_json
            )
            VALUES ($1::uuid, 'department', $2::uuid, 'create_department', $3::jsonb)
          `,
          [
            actor.userId,
            inserted.rows[0].id,
            JSON.stringify({
              departmentCode: inserted.rows[0].code,
              departmentName: inserted.rows[0].name,
            }),
          ]
        );

        await client.query('COMMIT');
        return {
          ...inserted.rows[0],
          setup: {
            reviewerPositionCode: null,
            hodPositionCode: null,
            fallbackPositionCode: null,
            stepOrder: ['line_manager', 'reviewer', 'hod'],
            effectiveFrom: null,
            isActive: false,
          },
        };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
          client.release();
        }
      },
      async updateDepartment({ departmentCode, name, isActive, actorId }) {
        const client = await pool.connect();

        try {
          await client.query('BEGIN');

          const actor = await resolveUserByIdentity(client, actorId);
          if (!actor) {
            throw new Error('Actor identity does not map to a user record.');
          }

          const updated = await client.query(
            `
              UPDATE departments
              SET
                department_name = $2,
                is_active = $3,
                updated_at = NOW()
              WHERE department_code = $1
              RETURNING
                department_id::text AS "id",
                department_code AS "code",
                department_name AS "name",
                is_active AS "isActive"
            `,
            [departmentCode, name, isActive]
          );

          if (updated.rowCount === 0) {
            await client.query('ROLLBACK');
            return null;
          }

          await client.query(
            `
              INSERT INTO audit_logs (
                actor_user_id,
                entity_type,
                entity_id,
                action_code,
                metadata_json
              )
              VALUES ($1::uuid, 'department', $2::uuid, 'update_department', $3::jsonb)
            `,
            [
              actor.userId,
              updated.rows[0].id,
              JSON.stringify({
                departmentCode: updated.rows[0].code,
                departmentName: updated.rows[0].name,
                isActive: updated.rows[0].isActive,
              }),
            ]
          );

          await client.query('COMMIT');
          return updated.rows[0];
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }
      },
      async deleteDepartment({ departmentCode, actorId }) {
        const client = await pool.connect();

        try {
          await client.query('BEGIN');

          const actor = await resolveUserByIdentity(client, actorId);
          if (!actor) {
            throw new Error('Actor identity does not map to a user record.');
          }

          const department = await client.query(
            `
              SELECT department_id::text AS "id", department_code AS "code", department_name AS "name"
              FROM departments
              WHERE department_code = $1
              LIMIT 1
            `,
            [departmentCode]
          );

          if (department.rowCount === 0) {
            await client.query('ROLLBACK');
            return false;
          }

          const departmentId = department.rows[0].id;
          const usage = await client.query(
            `
              SELECT
                (SELECT COUNT(*)::int FROM users WHERE department_id = $1::uuid) AS "userCount",
                (SELECT COUNT(*)::int FROM department_approval_setup WHERE department_id = $1::uuid) AS "setupCount",
                (SELECT COUNT(*)::int FROM payment_requests WHERE department_id = $1::uuid) AS "requestCount"
            `,
            [departmentId]
          );

          const { userCount, setupCount, requestCount } = usage.rows[0];
          if (userCount > 0 || setupCount > 0 || requestCount > 0) {
            throw new Error('Department is still referenced by users, approval setup, or requests. Disable it instead of deleting.');
          }

          await client.query(
            `DELETE FROM departments WHERE department_id = $1::uuid`,
            [departmentId]
          );

          await client.query(
            `
              INSERT INTO audit_logs (
                actor_user_id,
                entity_type,
                entity_id,
                action_code,
                metadata_json
              )
              VALUES ($1::uuid, 'department', $2::uuid, 'delete_department', $3::jsonb)
            `,
            [
              actor.userId,
              departmentId,
              JSON.stringify({
                departmentCode: department.rows[0].code,
                departmentName: department.rows[0].name,
              }),
            ]
          );

          await client.query('COMMIT');
          return true;
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }
      },
      async createPosition({ code, name, isGlobal = false, actorId }) {
        const client = await pool.connect();

        try {
          await client.query('BEGIN');

          const actor = await resolveUserByIdentity(client, actorId);
          if (!actor) {
            throw new Error('Actor identity does not map to a user record.');
          }

          const inserted = await client.query(
            `
              INSERT INTO positions (
                position_code,
                position_name,
                is_global,
                is_active
              )
              VALUES ($1, $2, $3, TRUE)
              RETURNING
                position_code AS "code",
                position_name AS "name",
                is_global AS "isGlobal",
                is_active AS "isActive"
            `,
            [code, name, isGlobal]
          );

          await client.query(
            `
              INSERT INTO audit_logs (
                actor_user_id,
                entity_type,
                entity_id,
                action_code,
                metadata_json
              )
              VALUES ($1::uuid, 'position', $2, 'create_position', $3::jsonb)
            `,
            [
              actor.userId,
              inserted.rows[0].code,
              JSON.stringify({
                positionCode: inserted.rows[0].code,
                positionName: inserted.rows[0].name,
                isGlobal: inserted.rows[0].isGlobal,
              }),
            ]
          );

          await client.query('COMMIT');
          return inserted.rows[0];
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }
      },
    async updatePosition({ positionCode, name, isGlobal = false, isActive, actorId }) {
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        const actor = await resolveUserByIdentity(client, actorId);
        if (!actor) {
          throw new Error('Actor identity does not map to a user record.');
        }

        const updated = await client.query(
          `
            UPDATE positions
            SET
              position_name = $2,
              is_global = $3,
              is_active = $4,
              updated_at = NOW()
            WHERE position_code = $1
            RETURNING
              position_code AS "code",
              position_name AS "name",
              is_global AS "isGlobal",
              is_active AS "isActive"
          `,
          [positionCode, name, isGlobal, isActive]
        );

        if (updated.rowCount === 0) {
          await client.query('ROLLBACK');
          return null;
        }

        await client.query(
          `
            INSERT INTO audit_logs (
              actor_user_id,
              entity_type,
              entity_id,
              action_code,
              metadata_json
            )
            VALUES ($1::uuid, 'position', $2, 'update_position', $3::jsonb)
          `,
          [
            actor.userId,
            updated.rows[0].code,
            JSON.stringify({
              positionCode: updated.rows[0].code,
              positionName: updated.rows[0].name,
              isGlobal: updated.rows[0].isGlobal,
              isActive: updated.rows[0].isActive,
            }),
          ]
        );

        await client.query('COMMIT');
        return updated.rows[0];
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    async deletePosition({ positionCode, actorId }) {
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        const actor = await resolveUserByIdentity(client, actorId);
        if (!actor) {
          throw new Error('Actor identity does not map to a user record.');
        }

        const position = await client.query(
          `
            SELECT position_id::text AS "id", position_code AS "code", position_name AS "name"
            FROM positions
            WHERE position_code = $1
            LIMIT 1
          `,
          [positionCode]
        );

        if (position.rowCount === 0) {
          await client.query('ROLLBACK');
          return false;
        }

        const positionId = position.rows[0].id;
        const usage = await client.query(
          `
            SELECT
              (SELECT COUNT(*)::int FROM users WHERE position_id = $1::uuid) AS "userCount",
              (SELECT COUNT(*)::int FROM department_approval_setup WHERE reviewer_position_id = $1::uuid OR hod_position_id = $1::uuid OR fallback_position_id = $1::uuid) AS "setupCount",
              (SELECT COUNT(*)::int FROM global_approver_config WHERE cfo_position_id = $1::uuid OR ceo_position_id = $1::uuid) AS "globalCount"
          `,
          [positionId]
        );

        const { userCount, setupCount, globalCount } = usage.rows[0];
        if (userCount > 0 || setupCount > 0 || globalCount > 0) {
          throw new Error('Position is still referenced by users or workflow setup. Disable it instead of deleting.');
        }

        await client.query(
          `DELETE FROM positions WHERE position_id = $1::uuid`,
          [positionId]
        );

        await client.query(
          `
            INSERT INTO audit_logs (
              actor_user_id,
              entity_type,
              entity_id,
              action_code,
              metadata_json
            )
            VALUES ($1::uuid, 'position', $2, 'delete_position', $3::jsonb)
          `,
          [
            actor.userId,
            position.rows[0].code,
            JSON.stringify({
              positionCode: position.rows[0].code,
              positionName: position.rows[0].name,
            }),
          ]
        );

        await client.query('COMMIT');
        return true;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    async createMasterDataUser({ fullName, email, departmentCode, positionCode, lineManagerId, roleCode, actorId }) {
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        const actor = await resolveUserByIdentity(client, actorId);
        if (!actor) {
          throw new Error('Actor identity does not map to a user record.');
        }

        const departmentId = await resolveDepartmentUuidByCode(client, departmentCode);
        if (!departmentId) {
          throw new Error('Department does not exist.');
        }
        const positionId = await resolvePositionByCode(client, positionCode);
        if (!positionId) {
          throw new Error('Position does not exist.');
        }

        const existing = await client.query(
          `SELECT user_id::text AS "userId" FROM users WHERE email = $1 LIMIT 1`,
          [email]
        );
        if (existing.rowCount > 0) {
          throw new Error('Email is already registered.');
        }

        const lineManagerUserId = await resolveOptionalUserUuid(client, lineManagerId);
        const identitySubject = `managed-${email.split('@')[0].toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}`;

        const inserted = await client.query(
          `
            INSERT INTO users (
              full_name,
              email,
              department_id,
              position_id,
              line_manager_id,
              identity_subject,
              is_active
            )
            VALUES ($1, $2, $3::uuid, $4::uuid, $5::uuid, $6, TRUE)
            RETURNING COALESCE(identity_subject, user_id::text) AS "id"
          `,
          [fullName, email, departmentId, positionId, lineManagerUserId, identitySubject]
        );

        await client.query(
          `
            INSERT INTO user_roles (
              user_id,
              role_code
            )
            VALUES (
              (SELECT user_id FROM users WHERE identity_subject = $1 LIMIT 1),
              $2
            )
          `,
          [inserted.rows[0].id, roleCode]
        );

        await client.query(
          `
            INSERT INTO audit_logs (
              actor_user_id,
              entity_type,
              entity_id,
              action_code,
              metadata_json
            )
            VALUES (
              $1::uuid,
              'user',
              (SELECT user_id FROM users WHERE identity_subject = $2 LIMIT 1),
              'create_user',
              $3::jsonb
            )
          `,
          [
            actor.userId,
            inserted.rows[0].id,
            JSON.stringify({ email, departmentCode, positionCode, roleCode }),
          ]
        );

        await client.query('COMMIT');

        const masterData = await fetchMasterData(pool);
        return masterData.users.find((entry) => entry.id === inserted.rows[0].id) ?? null;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    async updateMasterDataUser({ userId, fullName, departmentCode, positionCode, lineManagerId, roleCode, isActive, actorId }) {
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        const actor = await resolveUserByIdentity(client, actorId);
        if (!actor) {
          throw new Error('Actor identity does not map to a user record.');
        }

        const targetUser = await resolveUserByIdentity(client, userId);
        if (!targetUser) {
          await client.query('ROLLBACK');
          return null;
        }

        const departmentId = await resolveDepartmentUuidByCode(client, departmentCode);
        if (!departmentId) {
          throw new Error('Department does not exist.');
        }
        const positionId = await resolvePositionByCode(client, positionCode);
        if (!positionId) {
          throw new Error('Position does not exist.');
        }

        const lineManagerUserId = await resolveOptionalUserUuid(client, lineManagerId);

        await client.query(
          `
            UPDATE users
            SET
              full_name = $2,
              department_id = $3::uuid,
              position_id = $4::uuid,
              line_manager_id = $5::uuid,
              is_active = $6,
              updated_at = NOW()
            WHERE identity_subject = $1
          `,
          [userId, fullName, departmentId, positionId, lineManagerUserId, isActive]
        );

        await client.query(
          `DELETE FROM user_roles WHERE user_id = (SELECT user_id FROM users WHERE identity_subject = $1 LIMIT 1)`,
          [userId]
        );
        await client.query(
          `
            INSERT INTO user_roles (
              user_id,
              role_code
            )
            VALUES (
              (SELECT user_id FROM users WHERE identity_subject = $1 LIMIT 1),
              $2
            )
          `,
          [userId, roleCode]
        );

        await client.query(
          `
            INSERT INTO audit_logs (
              actor_user_id,
              entity_type,
              entity_id,
              action_code,
              metadata_json
            )
            VALUES (
              $1::uuid,
              'user',
              (SELECT user_id FROM users WHERE identity_subject = $2 LIMIT 1),
              'update_user',
              $3::jsonb
            )
          `,
          [
            actor.userId,
            userId,
            JSON.stringify({ departmentCode, positionCode, roleCode, isActive }),
          ]
        );

        await client.query('COMMIT');

        const masterData = await fetchMasterData(pool);
        return masterData.users.find((entry) => entry.id === userId) ?? null;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    async deleteMasterDataUser({ userId, actorId }) {
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        const actor = await resolveUserByIdentity(client, actorId);
        if (!actor) {
          throw new Error('Actor identity does not map to a user record.');
        }

        const target = await client.query(
          `
            SELECT
              user_id::text AS "userId",
              email,
              identity_subject AS "identitySubject"
            FROM users
            WHERE identity_subject = $1
            LIMIT 1
          `,
          [userId]
        );

        const user = target.rows[0];
        if (!user) {
          await client.query('ROLLBACK');
          return false;
        }

        if (!String(user.identitySubject ?? '').startsWith('managed-')) {
          throw new Error('Only managed users can be deleted from master data.');
        }

        await client.query(`DELETE FROM user_roles WHERE user_id = $1::uuid`, [user.userId]);
        await client.query(`DELETE FROM users WHERE user_id = $1::uuid`, [user.userId]);

        await client.query(
          `
            INSERT INTO audit_logs (
              actor_user_id,
              entity_type,
              entity_id,
              action_code,
              metadata_json
            )
            VALUES ($1::uuid, 'user', $2::uuid, 'delete_user', $3::jsonb)
          `,
          [actor.userId, user.userId, JSON.stringify({ email: user.email })]
        );

        await client.query('COMMIT');
        return true;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    async createMasterDataVendor({ code, name, currency, bankAccountName, bankAccountNumber, bankName, actorId }) {
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        const actor = await resolveUserByIdentity(client, actorId);
        if (!actor) {
          throw new Error('Actor identity does not map to a user record.');
        }

        const inserted = await client.query(
          `
            INSERT INTO vendors (
              vendor_code,
              vendor_name,
              currency,
              bank_account_name,
              bank_account_number,
              bank_name,
              sync_source,
              is_active
            )
            VALUES ($1, $2, $3, $4, $5, $6, 'manual', TRUE)
            RETURNING
              vendor_id::text AS "id",
              vendor_code AS "code",
              vendor_name AS "name",
              currency,
              bank_account_name AS "bankAccountName",
              bank_account_number AS "bankAccountNumber",
              bank_name AS "bankName",
              sync_source AS "syncSource",
              last_synced_at AS "lastSyncedAt",
              is_active AS "isActive"
          `,
          [code, name, currency, bankAccountName, bankAccountNumber, bankName]
        );

        await client.query(
          `
            INSERT INTO audit_logs (
              actor_user_id,
              entity_type,
              action_code,
              metadata_json
            )
            VALUES ($1::uuid, 'vendor', 'create_vendor', $2::jsonb)
          `,
          [actor.userId, JSON.stringify({ vendorCode: code, vendorName: name, currency })]
        );

        await client.query('COMMIT');
        return inserted.rows[0];
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
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
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        const actor = await resolveUserByIdentity(client, actorId);
        if (!actor) {
          throw new Error('Actor identity does not map to a user record.');
        }

        const departmentResult = await client.query(
          `
            SELECT department_id::text AS "departmentId"
            FROM departments
            WHERE department_code = $1
            LIMIT 1
          `,
          [departmentCode]
        );

        const departmentId = departmentResult.rows[0]?.departmentId;
        if (!departmentId) {
          throw new Error('Department does not exist.');
        }

        const [
          reviewerPositionId,
          hodPositionId,
          fallbackPositionId,
          reviewerUserRecord,
          hodUserRecord,
          fallbackUserRecord,
        ] = await Promise.all([
          resolvePositionByCode(client, reviewerPositionCode),
          resolvePositionByCode(client, hodPositionCode),
          resolvePositionByCode(client, fallbackPositionCode),
          reviewerUserId ? resolveUserByIdentity(client, reviewerUserId) : Promise.resolve(null),
          hodUserId ? resolveUserByIdentity(client, hodUserId) : Promise.resolve(null),
          fallbackUserId ? resolveUserByIdentity(client, fallbackUserId) : Promise.resolve(null),
        ]);

        const reviewerUserUuid = reviewerUserRecord?.userId ?? null;
        const hodUserUuid = hodUserRecord?.userId ?? null;
        const fallbackUserUuid = fallbackUserRecord?.userId ?? null;

        const existingSetup = await client.query(
          `
            SELECT department_approval_setup_id::text AS "setupId"
            FROM department_approval_setup
            WHERE department_id = $1::uuid
            ORDER BY effective_from DESC NULLS LAST, updated_at DESC
            LIMIT 1
          `,
          [departmentId]
        );

        if (existingSetup.rows[0]?.setupId) {
          await client.query(
            `
              UPDATE department_approval_setup
              SET
                reviewer_position_id = $2::uuid,
                hod_position_id = $3::uuid,
                fallback_position_id = $4::uuid,
                reviewer_user_id = $5::uuid,
                hod_user_id = $6::uuid,
                fallback_user_id = $7::uuid,
                step_order_json = $8::jsonb,
                effective_from = NOW(),
                is_active = $9,
                updated_at = NOW()
              WHERE department_approval_setup_id = $1::uuid
            `,
            [
              existingSetup.rows[0].setupId,
              reviewerPositionId,
              hodPositionId,
              fallbackPositionId,
              reviewerUserUuid,
              hodUserUuid,
              fallbackUserUuid,
              JSON.stringify(stepOrder ?? ['line_manager', 'reviewer', 'hod']),
              Boolean(reviewerUserUuid || reviewerPositionId || hodUserUuid || hodPositionId || fallbackUserUuid || fallbackPositionId),
            ]
          );
        } else {
          await client.query(
            `
              INSERT INTO department_approval_setup (
                department_id,
                reviewer_position_id,
                hod_position_id,
                fallback_position_id,
                reviewer_user_id,
                hod_user_id,
                fallback_user_id,
                step_order_json,
                effective_from,
                is_active
              )
              VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::uuid, $7::uuid, $8::jsonb, NOW(), $9)
            `,
            [
              departmentId,
              reviewerPositionId,
              hodPositionId,
              fallbackPositionId,
              reviewerUserUuid,
              hodUserUuid,
              fallbackUserUuid,
              JSON.stringify(stepOrder ?? ['line_manager', 'reviewer', 'hod']),
              Boolean(reviewerUserUuid || reviewerPositionId || hodUserUuid || hodPositionId || fallbackUserUuid || fallbackPositionId),
            ]
          );
        }

        await client.query(
          `
            INSERT INTO audit_logs (
              actor_user_id,
              entity_type,
              entity_id,
              action_code,
              metadata_json
            )
            VALUES ($1::uuid, 'department_approval_setup', $2::uuid, 'update_department_approval_setup', $3::jsonb)
          `,
          [
            actor.userId,
            departmentId,
            JSON.stringify({
              departmentCode,
              reviewerUserId,
              reviewerPositionCode,
              hodUserId,
              hodPositionCode,
              fallbackUserId,
              fallbackPositionCode,
              stepOrder,
            }),
          ]
        );

        await client.query('COMMIT');
        const data = await fetchApprovalSetupData(pool);
        return data.departments.find((entry) => entry.code === departmentCode) ?? null;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    async saveGlobalApproverConfig({ cfoPositionCode, ceoPositionCode, cfoAmountThreshold, ceoAmountThreshold, actorId }) {
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        const actor = await resolveUserByIdentity(client, actorId);
        if (!actor) {
          throw new Error('Actor identity does not map to a user record.');
        }

        const [cfoPositionId, ceoPositionId] = await Promise.all([
          resolvePositionByCode(client, cfoPositionCode),
          resolvePositionByCode(client, ceoPositionCode),
        ]);

        await client.query(
          `
            INSERT INTO global_approver_config (
              company_code,
              cfo_position_id,
              ceo_position_id,
              cfo_user_id,
              ceo_user_id,
              cfo_amount_threshold,
              ceo_amount_threshold,
              is_active
            )
            VALUES ('default', $1::uuid, $2::uuid, NULL, NULL, $3, $4, TRUE)
            ON CONFLICT (company_code)
            DO UPDATE SET
              cfo_position_id = EXCLUDED.cfo_position_id,
              ceo_position_id = EXCLUDED.ceo_position_id,
              cfo_user_id = NULL,
              ceo_user_id = NULL,
              cfo_amount_threshold = EXCLUDED.cfo_amount_threshold,
              ceo_amount_threshold = EXCLUDED.ceo_amount_threshold,
              is_active = TRUE,
              updated_at = NOW()
          `,
          [cfoPositionId, ceoPositionId, cfoAmountThreshold, ceoAmountThreshold]
        );

        await client.query(
          `
            INSERT INTO audit_logs (
              actor_user_id,
              entity_type,
              entity_id,
              action_code,
              metadata_json
            )
            VALUES ($1::uuid, 'global_approver_config', NULL, 'update_global_approver_config', $2::jsonb)
          `,
          [
            actor.userId,
            JSON.stringify({
              cfoPositionCode,
              ceoPositionCode,
              cfoAmountThreshold,
              ceoAmountThreshold,
            }),
          ]
        );

        await client.query('COMMIT');
        return (await fetchApprovalSetupData(pool)).globalConfig;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    async listPaymentRequests() {
      const result = await pool.query(`${paymentRequestSelect} ORDER BY pr.created_at DESC`);
      return result.rows.map(mapRowToPaymentRequest);
    },
    async getPaymentRequestById(requestId) {
      return fetchPaymentRequest(pool, requestId);
    },
    async getAttachmentById(attachmentId) {
      const result = await pool.query(
        `
          SELECT
            pra.attachment_id::text AS "id",
            pra.request_id::text AS "requestId",
            pra.attachment_type AS "attachmentType",
            pra.file_name AS "fileName",
            pra.file_path AS "filePath",
            pra.file_size AS "fileSize",
            pra.uploaded_at AS "uploadedAt"
          FROM payment_request_attachments pra
          WHERE pra.attachment_id::text = $1
          LIMIT 1
        `,
        [attachmentId]
      );

      if (!result.rows[0]) {
        return null;
      }

      return result.rows[0];
    },
    async listDelegations() {
      const result = await pool.query(`
        SELECT
          COALESCE(delegator.identity_subject, d.delegator_user_id::text) AS "delegatorUserId",
          COALESCE(delegate.identity_subject, d.delegate_user_id::text) AS "delegateUserId",
          d.valid_from AS "validFrom",
          d.valid_to AS "validTo",
          d.scope AS "scope",
          d.is_active AS "isActive"
        FROM delegations d
        LEFT JOIN users delegator ON delegator.user_id = d.delegator_user_id
        LEFT JOIN users delegate ON delegate.user_id = d.delegate_user_id
      `);

      return result.rows;
    },
    async listFinanceReleaseQueue() {
      const result = await pool.query(
        `${paymentRequestSelect}
         WHERE pr.business_status = 'approved'
           AND pr.erp_sync_status IN ('waiting_finance_release', 'hold_by_finance')
         ORDER BY pr.updated_at DESC`
      );
      return result.rows.map(mapRowToPaymentRequest);
    },
    async listIntegrationJobs() {
      const result = await pool.query(`${integrationJobSelect} ORDER BY ij.updated_at DESC`);
      return result.rows.map(mapRowToIntegrationJob);
    },
    async listPaymentRequestAuditLogs(requestId) {
      const requestContext = await fetchRequestContext(pool, requestId);
      if (!requestContext) {
        return [];
      }

      return fetchPaymentRequestAuditLogs(pool, requestContext.requestId);
    },
    async listAuditLogs(options = {}) {
      return fetchAuditLogs(pool, options);
    },
    async createPaymentRequest(input) {
      const client = await pool.connect();

      try {
        await client.query('BEGIN');
        await ensureDefaultTemplates(client);

        const requester = await resolveUserByIdentity(client, input.requesterId);
        if (!requester) {
          throw new Error('Requester identity does not map to a user record.');
        }
        const departmentUuid = await resolveDepartmentUuidByCode(client, requester.departmentCode);
        if (!departmentUuid) {
          throw new Error('Requester department does not exist.');
        }

        const templateCode = input.templateCode ?? 'vendor_standard';
        const templateResult = await client.query(
          `
            SELECT
              template_id::text AS "id",
              template_code AS "code",
              template_name AS "name",
              version,
              visibility_mode AS "visibilityMode"
            FROM request_templates
            WHERE template_code = $1
              AND is_active = TRUE
            LIMIT 1
          `,
          [templateCode]
        );
        const selectedTemplate = templateResult.rows[0] ?? null;
        if (!selectedTemplate) {
          throw new Error('Selected request template does not exist or is inactive.');
        }

        const requestNoResult = await client.query(
          `SELECT CONCAT('PR-', TO_CHAR(NOW(), 'YYYY'), '-', LPAD((COUNT(*) + 1)::text, 4, '0')) AS "requestNo" FROM payment_requests`
        );
        const requestNo = requestNoResult.rows[0].requestNo;

        const insertedRequest = await client.query(
          `
            INSERT INTO payment_requests (
              request_no,
              template_id,
              template_version,
              requester_id,
              department_id,
              request_date,
              request_type,
              payment_type,
              payee_type,
              vendor_code,
              priority,
              payee_name,
              currency,
              total_amount,
              reason,
              visibility_mode,
              business_status,
              erp_sync_status
            )
            VALUES (
              $1,
              $2::uuid,
              $3,
              $4::uuid,
              $5::uuid,
              CURRENT_DATE,
              'payment_request',
              $6,
              'vendor',
              $7,
              $8,
              $9,
              $10,
              $11,
              $12,
              $13,
              'draft',
              'not_ready'
            )
            RETURNING request_id::text AS "requestId", created_at AS "createdAt"
          `,
          [
            requestNo,
            selectedTemplate.id,
            selectedTemplate.version,
            requester.userId,
            departmentUuid,
            input.paymentType,
            input.vendorCode ?? null,
            input.priority ?? 'medium',
            input.payeeName,
            input.currency,
            input.totalAmount,
            input.reason ?? null,
            selectedTemplate.visibilityMode ?? input.visibilityMode ?? 'related_only',
          ]
        );

        const requestId = insertedRequest.rows[0].requestId;
        const createdAt = insertedRequest.rows[0].createdAt;

        for (const [index, item] of input.lineItems.entries()) {
          await client.query(
            `
              INSERT INTO payment_request_details (
                request_id,
                line_no,
                description,
                invoice_no,
                invoice_date,
                cost_center,
                gl_account,
                project_code,
                expense_type_code,
                currency,
                amount,
                exchange_rate,
                total_amount,
                note,
                remark
              )
              VALUES ($1::uuid, $2, $3, $4, $5::date, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            `,
            [
              requestId,
              index + 1,
              item.description,
              item.invoiceRef ?? null,
              item.invoiceDate ?? null,
              item.costCenter ?? null,
              item.glCode ?? null,
              item.projectCode ?? null,
              item.expenseTypeCode ?? null,
              item.currency ?? input.currency ?? 'VND',
              item.amount,
              item.exchangeRate ?? 1,
              item.totalAmount ?? item.amount,
              item.note ?? null,
              item.remark ?? null,
            ]
          );
        }

        for (const attachment of input.attachments ?? []) {
          await client.query(
            `
              INSERT INTO payment_request_attachments (
                request_id,
                attachment_type,
                file_name,
                file_path,
                file_size,
                uploaded_by
              )
              VALUES ($1::uuid, $2, $3, $4, $5, $6::uuid)
            `,
            [
              requestId,
              attachment.attachmentType,
              attachment.fileName,
              attachment.filePath,
              attachment.fileSize,
              requester.userId,
            ]
          );
        }

        await client.query(
          `
            INSERT INTO audit_logs (
              actor_user_id,
              entity_type,
              entity_id,
              action_code,
              action_note,
              metadata_json
            )
            VALUES ($1::uuid, 'payment_request', $2::uuid, 'create_request', $3, $4::jsonb)
          `,
          [
            requester.userId,
            requestId,
            `Request ${requestNo} was created.`,
            JSON.stringify({
              requestNo,
              note: `Request ${requestNo} was created.`,
            }),
          ]
        );

        await client.query('COMMIT');

        return {
          id: requestId,
          requestNo,
          requesterId: requester.identitySubject,
          requesterName: requester.fullName,
          departmentId: requester.departmentCode,
          requestType: 'payment_request',
          payeeName: input.payeeName,
          paymentType: input.paymentType,
          totalAmount: input.totalAmount,
          currency: input.currency,
          priority: input.priority ?? 'medium',
          visibilityMode: input.visibilityMode ?? 'related_only',
          businessStatus: 'draft',
          erpSyncStatus: 'not_ready',
          createdAt: createdAt.toISOString(),
          workflowUserIds: [],
          currentStepApproverIds: [],
          attachments: (input.attachments ?? []).map((attachment, index) => ({
            id: `pending-${requestId}-${index + 1}`,
            attachmentType: attachment.attachmentType,
            fileName: attachment.fileName,
            filePath: attachment.filePath,
            fileSize: attachment.fileSize,
          })),
        };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    async previewWorkflow({ requesterId, totalAmount, lineManagerOverrideId = null }) {
      const requester = await resolveUserByIdentity(pool, requesterId);
      if (!requester) {
        throw new Error('Actor identity does not map to a user record.');
      }

      const requesterRecordResult = await pool.query(
        `
          SELECT
            COALESCE(dept.department_code, users.department_id::text) AS "departmentId",
            users.department_id::text AS "departmentUuid"
          FROM users
          LEFT JOIN departments dept ON dept.department_id = users.department_id
          WHERE users.user_id = $1::uuid
          LIMIT 1
        `,
        [requester.userId]
      );
      const requesterRecord = requesterRecordResult.rows[0] ?? null;
      if (!requesterRecord) {
        throw new Error('Actor identity does not map to a user record.');
      }

      const preview = await buildWorkflowPreview(pool, {
        requesterUserId: requester.userId,
        departmentUuid: requesterRecord.departmentUuid,
        totalAmount,
        lineManagerOverrideId,
      });

      return {
        departmentId: requesterRecord.departmentId,
        ...preview,
      };
    },
    async submitPaymentRequest({ requestId, actorId, lineManagerOverrideId = null, lineManagerOverrideReason = null }) {
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        const actor = await resolveUserByIdentity(client, actorId);
        if (!actor) {
          throw new Error('Actor identity does not map to a user record.');
        }

        const requestContext = await fetchRequestContext(client, requestId);
        if (!requestContext) {
          throw new Error('Payment request does not exist.');
        }

        const requestRecordResult = await client.query(
          `
            SELECT
              COALESCE(dept.department_code, pr.department_id::text) AS "departmentId",
              pr.request_no AS "requestNo",
              pr.requester_id::text AS "requesterUserId",
              pr.department_id::text AS "departmentUuid",
              pr.total_amount AS "totalAmount"
            FROM payment_requests pr
            LEFT JOIN departments dept ON dept.department_id = pr.department_id
            WHERE pr.request_id::text = $1 OR pr.request_no = $1
            LIMIT 1
          `,
          [requestId]
        );

        const requestRecord = requestRecordResult.rows[0];
        if (!requestRecord) {
          throw new Error('Payment request does not exist.');
        }

        const workflowResolution = await resolveWorkflowChain(client, {
          requesterUserId: requestRecord.requesterUserId,
          departmentUuid: requestRecord.departmentUuid,
          totalAmount: requestRecord.totalAmount,
          lineManagerOverrideId,
        });
        const workflowChain = workflowResolution.workflowChain;

        if (workflowChain.length === 0) {
          const workflowError = new Error('No approver chain could be resolved for this request.');
          workflowError.issues = workflowResolution.issues;
          throw workflowError;
        }

        const workflowInstanceResult = await client.query(
          `
            INSERT INTO request_workflow_instances (
              request_id,
              current_step_no,
              snapshot_json,
              status
            )
            VALUES ($1::uuid, 1, $2::jsonb, 'pending')
            ON CONFLICT (request_id)
            DO UPDATE SET
              current_step_no = 1,
              snapshot_json = EXCLUDED.snapshot_json,
              status = 'pending',
              updated_at = NOW()
            RETURNING workflow_instance_id::text AS "workflowInstanceId"
          `,
          [
            requestContext.requestId,
            JSON.stringify({
              approvalChain: workflowChain.map((entry) => ({
                stepCode: entry.stepCode,
                approverId: entry.approverId,
                defaultApproverId: entry.defaultApproverId ?? entry.approverId,
                isOverridden: entry.isOverridden ?? false,
              })),
              lineManagerOverride: workflowResolution.lineManagerOverride
                ? {
                    approverId: workflowResolution.lineManagerOverride.approverId,
                    approverName: workflowResolution.lineManagerOverride.approverName,
                    defaultApproverId: workflowResolution.defaultLineManagerId,
                    reason: lineManagerOverrideReason ?? '',
                  }
                : null,
            }),
          ]
        );

        const workflowInstanceId = workflowInstanceResult.rows[0].workflowInstanceId;

        await client.query(
          `
            DELETE FROM request_workflow_steps
            WHERE workflow_instance_id = $1::uuid
          `,
          [workflowInstanceId]
        );

        for (const [index, step] of workflowChain.entries()) {
          const approverResult = await client.query(
            `SELECT user_id::text AS "userId" FROM users WHERE identity_subject = $1 LIMIT 1`,
            [step.approverId]
          );
          const approverUserId = approverResult.rows[0]?.userId ?? null;

          if (!approverUserId) {
            throw new Error(`Approver ${step.approverId} could not be resolved to a user.`);
          }

          await client.query(
            `
              INSERT INTO request_workflow_steps (
                workflow_instance_id,
                step_no,
                step_code,
                original_user_id,
                status
              )
              VALUES ($1::uuid, $2, $3, $4::uuid, 'pending')
            `,
            [workflowInstanceId, index + 1, step.stepCode, approverUserId]
          );
        }

        await client.query(
          `
            UPDATE payment_requests
            SET
              business_status = 'pending_approval',
              erp_sync_status = 'not_ready',
              updated_at = NOW()
            WHERE request_id = $1::uuid
          `,
          [requestContext.requestId]
        );

        await client.query(
          `
            INSERT INTO audit_logs (
              actor_user_id,
              entity_type,
              entity_id,
              action_code,
              metadata_json
            )
            VALUES ($1::uuid, 'payment_request', $2::uuid, 'submit_request', $3::jsonb)
          `,
          [
            actor.userId,
            requestContext.requestId,
            JSON.stringify({
              requestNo: requestRecord.requestNo,
              lineManagerOverrideApplied: Boolean(workflowResolution.lineManagerOverride),
            }),
          ]
        );

        if (workflowResolution.lineManagerOverride && workflowResolution.defaultLineManagerId) {
          const defaultLineManager = await resolveActiveUserByIdentity(client, workflowResolution.defaultLineManagerId);
          await client.query(
            `
              INSERT INTO audit_logs (
                actor_user_id,
                entity_type,
                entity_id,
                action_code,
                action_note,
                metadata_json
              )
              VALUES ($1::uuid, 'payment_request', $2::uuid, 'override_line_manager', $3, $4::jsonb)
            `,
            [
              actor.userId,
              requestContext.requestId,
              lineManagerOverrideReason,
              JSON.stringify({
                requestNo: requestRecord.requestNo,
                defaultApproverId: workflowResolution.defaultLineManagerId,
                defaultApproverName: defaultLineManager?.fullName ?? workflowResolution.defaultLineManagerId,
                overrideApproverId: workflowResolution.lineManagerOverride.approverId,
                overrideApproverName: workflowResolution.lineManagerOverride.approverName,
                reason: lineManagerOverrideReason ?? '',
              }),
            ]
          );
        }

        await client.query('COMMIT');
        return fetchPaymentRequest(pool, requestContext.requestId);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    async approvePaymentRequest({ requestId, actorId }) {
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        const actor = await resolveUserByIdentity(client, actorId);
        if (!actor) {
          throw new Error('Actor identity does not map to a user record.');
        }

        const requestContext = await fetchRequestContext(client, requestId);
        if (!requestContext) {
          throw new Error('Payment request does not exist.');
        }

        if (!requestContext.workflowInstanceId || !requestContext.currentStepNo) {
          throw new Error('Payment request has no pending approval step.');
        }

        await client.query(
          `
            UPDATE request_workflow_steps
            SET
              status = 'approved',
              acting_user_id = $2::uuid,
              action_at = NOW(),
              updated_at = NOW()
            WHERE workflow_instance_id = $1::uuid
              AND step_no = $3
              AND status = 'pending'
          `,
          [requestContext.workflowInstanceId, actor.userId, requestContext.currentStepNo]
        );

        const nextStepResult = await client.query(
          `
            SELECT step_no AS "stepNo"
            FROM request_workflow_steps
            WHERE workflow_instance_id = $1::uuid
              AND step_no > $2
              AND status = 'pending'
            ORDER BY step_no
            LIMIT 1
          `,
          [requestContext.workflowInstanceId, requestContext.currentStepNo]
        );

        if (nextStepResult.rowCount > 0) {
          const nextStepNo = nextStepResult.rows[0].stepNo;

          await client.query(
            `
              UPDATE request_workflow_instances
              SET
                current_step_no = $2,
                status = 'pending',
                updated_at = NOW()
              WHERE workflow_instance_id = $1::uuid
            `,
            [requestContext.workflowInstanceId, nextStepNo]
          );

          await client.query(
            `
              UPDATE payment_requests
              SET
                business_status = 'pending_approval',
                updated_at = NOW()
              WHERE request_id = $1::uuid
            `,
            [requestContext.requestId]
          );
        } else {
          await client.query(
            `
              UPDATE request_workflow_instances
              SET
                current_step_no = NULL,
                status = 'approved',
                updated_at = NOW()
              WHERE workflow_instance_id = $1::uuid
            `,
            [requestContext.workflowInstanceId]
          );

          await client.query(
            `
              UPDATE payment_requests
              SET
                business_status = 'approved',
                erp_sync_status = 'waiting_finance_release',
                updated_at = NOW()
              WHERE request_id = $1::uuid
            `,
            [requestContext.requestId]
          );
        }

        await client.query(
          `
            INSERT INTO audit_logs (
              actor_user_id,
              entity_type,
              entity_id,
              action_code,
              metadata_json
            )
            VALUES ($1::uuid, 'payment_request', $2::uuid, 'approve_request', $3::jsonb)
          `,
          [
            actor.userId,
            requestContext.requestId,
            JSON.stringify({
              requestNo: requestContext.requestNo,
            }),
          ]
        );

        await client.query('COMMIT');
        return fetchPaymentRequest(pool, requestContext.requestId);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    async rejectPaymentRequest({ requestId, actorId, note }) {
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        const actor = await resolveUserByIdentity(client, actorId);
        if (!actor) {
          throw new Error('Actor identity does not map to a user record.');
        }

        const requestContext = await fetchRequestContext(client, requestId);
        if (!requestContext) {
          throw new Error('Payment request does not exist.');
        }

        if (!requestContext.workflowInstanceId || !requestContext.currentStepNo) {
          throw new Error('Payment request has no pending approval step.');
        }

        await client.query(
          `
            UPDATE request_workflow_steps
            SET
              status = 'rejected',
              acting_user_id = $2::uuid,
              action_note = $4,
              action_at = NOW(),
              updated_at = NOW()
            WHERE workflow_instance_id = $1::uuid
              AND step_no = $3
              AND status = 'pending'
          `,
          [requestContext.workflowInstanceId, actor.userId, requestContext.currentStepNo, note]
        );

        await client.query(
          `
            UPDATE request_workflow_instances
            SET
              current_step_no = NULL,
              status = 'rejected',
              updated_at = NOW()
            WHERE workflow_instance_id = $1::uuid
          `,
          [requestContext.workflowInstanceId]
        );

        await client.query(
          `
            UPDATE payment_requests
            SET
              business_status = 'rejected',
              updated_at = NOW()
            WHERE request_id = $1::uuid
          `,
          [requestContext.requestId]
        );

        await client.query(
          `
            INSERT INTO audit_logs (
              actor_user_id,
              entity_type,
              entity_id,
              action_code,
              action_note,
              metadata_json
            )
            VALUES ($1::uuid, 'payment_request', $2::uuid, 'reject_request', $3, $4::jsonb)
          `,
          [
            actor.userId,
            requestContext.requestId,
            note,
            JSON.stringify({
              requestNo: requestContext.requestNo,
              note,
            }),
          ]
        );

        await client.query('COMMIT');
        return fetchPaymentRequest(pool, requestContext.requestId);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    async returnPaymentRequest({ requestId, actorId }) {
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        const actor = await resolveUserByIdentity(client, actorId);
        if (!actor) {
          throw new Error('Actor identity does not map to a user record.');
        }

        const requestContext = await fetchRequestContext(client, requestId);
        if (!requestContext) {
          throw new Error('Payment request does not exist.');
        }

        if (!requestContext.workflowInstanceId || !requestContext.currentStepNo) {
          throw new Error('Payment request has no pending approval step.');
        }

        await client.query(
          `
            UPDATE request_workflow_steps
            SET
              status = 'returned',
              acting_user_id = $2::uuid,
              action_at = NOW(),
              updated_at = NOW()
            WHERE workflow_instance_id = $1::uuid
              AND step_no = $3
              AND status = 'pending'
          `,
          [requestContext.workflowInstanceId, actor.userId, requestContext.currentStepNo]
        );

        await client.query(
          `
            UPDATE request_workflow_instances
            SET
              current_step_no = NULL,
              status = 'returned',
              updated_at = NOW()
            WHERE workflow_instance_id = $1::uuid
          `,
          [requestContext.workflowInstanceId]
        );

        await client.query(
          `
            UPDATE payment_requests
            SET
              business_status = 'returned',
              erp_sync_status = 'not_ready',
              updated_at = NOW()
            WHERE request_id = $1::uuid
          `,
          [requestContext.requestId]
        );

        await client.query(
          `
            INSERT INTO audit_logs (
              actor_user_id,
              entity_type,
              entity_id,
              action_code,
              metadata_json
            )
            VALUES ($1::uuid, 'payment_request', $2::uuid, 'return_request', $3::jsonb)
          `,
          [
            actor.userId,
            requestContext.requestId,
            JSON.stringify({
              requestNo: requestContext.requestNo,
            }),
          ]
        );

        await client.query('COMMIT');
        return fetchPaymentRequest(pool, requestContext.requestId);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    async cancelPaymentRequest({ requestId, actorId }) {
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        const actor = await resolveUserByIdentity(client, actorId);
        if (!actor) {
          throw new Error('Actor identity does not map to a user record.');
        }

        const requestContext = await fetchRequestContext(client, requestId);
        if (!requestContext) {
          throw new Error('Payment request does not exist.');
        }

        if (requestContext.workflowInstanceId) {
          await client.query(
            `
              UPDATE request_workflow_steps
              SET
                status = 'cancelled',
                acting_user_id = $2::uuid,
                action_at = NOW(),
                updated_at = NOW()
              WHERE workflow_instance_id = $1::uuid
                AND status = 'pending'
            `,
            [requestContext.workflowInstanceId, actor.userId]
          );

          await client.query(
            `
              UPDATE request_workflow_instances
              SET
                current_step_no = NULL,
                status = 'cancelled',
                updated_at = NOW()
              WHERE workflow_instance_id = $1::uuid
            `,
            [requestContext.workflowInstanceId]
          );
        }

        await client.query(
          `
            UPDATE payment_requests
            SET
              business_status = 'cancelled',
              erp_sync_status = 'not_ready',
              updated_at = NOW()
            WHERE request_id = $1::uuid
          `,
          [requestContext.requestId]
        );

        await client.query(
          `
            INSERT INTO audit_logs (
              actor_user_id,
              entity_type,
              entity_id,
              action_code,
              metadata_json
            )
            VALUES ($1::uuid, 'payment_request', $2::uuid, 'cancel_request', $3::jsonb)
          `,
          [
            actor.userId,
            requestContext.requestId,
            JSON.stringify({
              requestNo: requestContext.requestNo,
            }),
          ]
        );

        await client.query('COMMIT');
        return fetchPaymentRequest(pool, requestContext.requestId);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    async resubmitPaymentRequest({ requestId, actorId }) {
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        const actor = await resolveUserByIdentity(client, actorId);
        if (!actor) {
          throw new Error('Actor identity does not map to a user record.');
        }

        const requestContext = await fetchRequestContext(client, requestId);
        if (!requestContext) {
          throw new Error('Payment request does not exist.');
        }

        if (!requestContext.workflowInstanceId) {
          throw new Error('Payment request has no workflow instance.');
        }

        await client.query(
          `
            UPDATE request_workflow_steps
            SET
              status = 'pending',
              acting_user_id = NULL,
              action_at = NULL,
              updated_at = NOW()
            WHERE workflow_instance_id = $1::uuid
              AND step_no = (
                SELECT MIN(step_no)
                FROM request_workflow_steps
                WHERE workflow_instance_id = $1::uuid
              )
          `,
          [requestContext.workflowInstanceId]
        );

        await client.query(
          `
            UPDATE request_workflow_steps
            SET
              status = 'pending',
              acting_user_id = NULL,
              action_at = NULL,
              updated_at = NOW()
            WHERE workflow_instance_id = $1::uuid
              AND step_no > (
                SELECT MIN(step_no)
                FROM request_workflow_steps
                WHERE workflow_instance_id = $1::uuid
              )
          `,
          [requestContext.workflowInstanceId]
        );

        const firstStepResult = await client.query(
          `
            SELECT MIN(step_no) AS "firstStepNo"
            FROM request_workflow_steps
            WHERE workflow_instance_id = $1::uuid
          `,
          [requestContext.workflowInstanceId]
        );

        const firstStepNo = firstStepResult.rows[0]?.firstStepNo;
        if (!firstStepNo) {
          throw new Error('Payment request workflow has no steps.');
        }

        await client.query(
          `
            UPDATE request_workflow_instances
            SET
              current_step_no = $2,
              status = 'pending',
              updated_at = NOW()
            WHERE workflow_instance_id = $1::uuid
          `,
          [requestContext.workflowInstanceId, firstStepNo]
        );

        await client.query(
          `
            UPDATE payment_requests
            SET
              business_status = 'pending_approval',
              erp_sync_status = 'not_ready',
              updated_at = NOW()
            WHERE request_id = $1::uuid
          `,
          [requestContext.requestId]
        );

        await client.query(
          `
            INSERT INTO audit_logs (
              actor_user_id,
              entity_type,
              entity_id,
              action_code,
              metadata_json
            )
            VALUES ($1::uuid, 'payment_request', $2::uuid, 'resubmit_request', $3::jsonb)
          `,
          [
            actor.userId,
            requestContext.requestId,
            JSON.stringify({
              requestNo: requestContext.requestNo,
            }),
          ]
        );

        await client.query('COMMIT');
        return fetchPaymentRequest(pool, requestContext.requestId);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    async releaseToErp({ requestId, actorId }) {
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        const actor = await resolveUserByIdentity(client, actorId);
        if (!actor) {
          throw new Error('Actor identity does not map to a user record.');
        }

        const requestContext = await fetchRequestContext(client, requestId);
        if (!requestContext) {
          throw new Error('Payment request does not exist.');
        }

        await client.query(
          `
            UPDATE payment_requests
            SET
              erp_sync_status = 'pending',
              finance_release_by = $2::uuid,
              finance_release_at = NOW(),
              updated_at = NOW()
            WHERE request_id = $1::uuid
          `,
          [requestContext.requestId, actor.userId]
        );

        await client.query(
          `
            INSERT INTO integration_jobs (
              ref_type,
              ref_id,
              target_system,
              idempotency_key,
              payload_json,
              status
            )
            VALUES ('payment_request', $1::uuid, 'erp', $2, $3::jsonb, 'pending')
            ON CONFLICT (target_system, idempotency_key)
            WHERE idempotency_key IS NOT NULL
            DO NOTHING
          `,
          [
            requestContext.requestId,
            `payment_request:${requestContext.requestId}`,
            JSON.stringify({
              requestId: requestContext.requestId,
              requestNo: requestContext.requestNo,
              idempotencyKey: `payment_request:${requestContext.requestId}`,
            }),
          ]
        );

        await client.query(
          `
            INSERT INTO audit_logs (
              actor_user_id,
              entity_type,
              entity_id,
              action_code,
              metadata_json
            )
            VALUES ($1::uuid, 'payment_request', $2::uuid, 'release_to_erp', $3::jsonb)
          `,
          [
            actor.userId,
            requestContext.requestId,
            JSON.stringify({
              requestNo: requestContext.requestNo,
            }),
          ]
        );

        await client.query('COMMIT');
        return fetchPaymentRequest(pool, requestContext.requestId);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    async financeApprove({ requestId, actorId }) {
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        const actor = await resolveUserByIdentity(client, actorId);
        if (!actor) {
          throw new Error('Actor identity does not map to a user record.');
        }

        const requestContext = await fetchRequestContext(client, requestId);
        if (!requestContext) {
          throw new Error('Payment request does not exist.');
        }

        await client.query(
          `
            UPDATE payment_requests
            SET
              erp_sync_status = 'hold_by_finance',
              updated_at = NOW()
            WHERE request_id = $1::uuid
          `,
          [requestContext.requestId]
        );

        await client.query(
          `
            INSERT INTO audit_logs (
              actor_user_id,
              entity_type,
              entity_id,
              action_code,
              metadata_json
            )
            VALUES ($1::uuid, 'payment_request', $2::uuid, 'finance_approve', $3::jsonb)
          `,
          [
            actor.userId,
            requestContext.requestId,
            JSON.stringify({
              requestNo: requestContext.requestNo,
            }),
          ]
        );

        await client.query('COMMIT');
        return fetchPaymentRequest(pool, requestContext.requestId);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    async financeReject({ requestId, actorId, note }) {
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        const actor = await resolveUserByIdentity(client, actorId);
        if (!actor) {
          throw new Error('Actor identity does not map to a user record.');
        }

        const requestContext = await fetchRequestContext(client, requestId);
        if (!requestContext) {
          throw new Error('Payment request does not exist.');
        }

        await client.query(
          `
            UPDATE payment_requests
            SET
              business_status = 'rejected',
              erp_sync_status = 'not_ready',
              updated_at = NOW()
            WHERE request_id = $1::uuid
          `,
          [requestContext.requestId]
        );

        await client.query(
          `
            INSERT INTO audit_logs (
              actor_user_id,
              entity_type,
              entity_id,
              action_code,
              action_note,
              metadata_json
            )
            VALUES ($1::uuid, 'payment_request', $2::uuid, 'finance_reject', $3, $4::jsonb)
          `,
          [
            actor.userId,
            requestContext.requestId,
            note,
            JSON.stringify({
              requestNo: requestContext.requestNo,
              note,
            }),
          ]
        );

        await client.query('COMMIT');
        return fetchPaymentRequest(pool, requestContext.requestId);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    async holdErpSync({ requestId, actorId }) {
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        const actor = await resolveUserByIdentity(client, actorId);
        if (!actor) {
          throw new Error('Actor identity does not map to a user record.');
        }

        const requestContext = await fetchRequestContext(client, requestId);
        if (!requestContext) {
          throw new Error('Payment request does not exist.');
        }

        await client.query(
          `
            UPDATE payment_requests
            SET
              erp_sync_status = 'hold_by_finance',
              updated_at = NOW()
            WHERE request_id = $1::uuid
          `,
          [requestContext.requestId]
        );

        await client.query(
          `
            INSERT INTO audit_logs (
              actor_user_id,
              entity_type,
              entity_id,
              action_code,
              metadata_json
            )
            VALUES ($1::uuid, 'payment_request', $2::uuid, 'hold_erp_sync', $3::jsonb)
          `,
          [
            actor.userId,
            requestContext.requestId,
            JSON.stringify({
              requestNo: requestContext.requestNo,
            }),
          ]
        );

        await client.query('COMMIT');
        return fetchPaymentRequest(pool, requestContext.requestId);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    async retryIntegrationJob({ jobId, actorId }) {
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        const actor = await resolveUserByIdentity(client, actorId);
        if (!actor) {
          throw new Error('Actor identity does not map to a user record.');
        }

        const job = await fetchIntegrationJob(client, jobId);
        if (!job) {
          throw new Error('ERP integration job does not exist.');
        }

        await client.query(
          `
            UPDATE integration_jobs
            SET
              status = 'pending',
              retry_count = retry_count + 1,
              last_error = NULL,
              next_retry_at = NULL,
              updated_at = NOW()
            WHERE job_id = $1::uuid
          `,
          [jobId]
        );

        if (job.requestId) {
          await client.query(
            `
              UPDATE payment_requests
              SET
                erp_sync_status = 'pending',
                updated_at = NOW()
              WHERE request_id = $1::uuid
            `,
            [job.requestId]
          );
        }

        await client.query(
          `
            INSERT INTO audit_logs (
              actor_user_id,
              entity_type,
              entity_id,
              action_code,
              metadata_json
            )
            VALUES ($1::uuid, 'integration_job', $2::uuid, 'retry_erp_job', $3::jsonb)
          `,
          [
            actor.userId,
            jobId,
            JSON.stringify({
              requestNo: job.requestNo,
            }),
          ]
        );

        await client.query('COMMIT');
        return fetchIntegrationJob(pool, jobId);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    async close() {
      await pool.end();
    },
  };
}
