import { createRequire } from 'node:module';

function mapRowToPaymentRequest(row) {
  return {
    id: row.id,
    requestNo: row.requestNo,
    requesterId: row.requesterId,
    requesterName: row.requesterName,
    departmentId: row.departmentId,
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
    attachments: row.attachments ?? [],
  };
}

function mapRowToIntegrationJob(row) {
  return {
    id: row.id,
    requestId: row.requestId,
    requestNo: row.requestNo,
    targetSystem: row.targetSystem,
    status: row.status,
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
  };
}

function mapRowToDepartmentSetup(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    isActive: row.isActive,
    setup: {
      reviewerUserId: row.reviewerUserId,
      hodUserId: row.hodUserId,
      fallbackUserId: row.fallbackUserId,
      effectiveFrom: row.effectiveFrom ? row.effectiveFrom.toISOString() : null,
      isActive: row.setupIsActive ?? false,
    },
  };
}

function mapRowToGlobalApproverConfig(row) {
  return {
    companyCode: row.companyCode,
    cfoUserId: row.cfoUserId,
    ceoUserId: row.ceoUserId,
    cfoAmountThreshold: row.cfoAmountThreshold === null ? null : Number(row.cfoAmountThreshold),
    ceoAmountThreshold: row.ceoAmountThreshold === null ? null : Number(row.ceoAmountThreshold),
    isActive: row.isActive,
  };
}

function mapIdentityToDepartmentUuid(departmentId) {
  switch (departmentId) {
    case 'dep-a':
      return '10000000-0000-0000-0000-000000000001';
    case 'dep-b':
      return '10000000-0000-0000-0000-000000000002';
    case 'dep-finance':
      return '10000000-0000-0000-0000-000000000003';
    default:
      return null;
  }
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

async function resolveWorkflowChain(queryable, { requesterUserId, departmentUuid, totalAmount }) {
  const requesterResult = await queryable.query(
    `
      SELECT
        requester.user_id::text AS "requesterUserId",
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
        COALESCE(reviewer.identity_subject, das.reviewer_user_id::text) AS "reviewerId",
        COALESCE(hod.identity_subject, das.hod_user_id::text) AS "hodId"
      FROM department_approval_setup das
      LEFT JOIN users reviewer ON reviewer.user_id = das.reviewer_user_id
      LEFT JOIN users hod ON hod.user_id = das.hod_user_id
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
        COALESCE(cfo.identity_subject, gac.cfo_user_id::text) AS "cfoId",
        COALESCE(ceo.identity_subject, gac.ceo_user_id::text) AS "ceoId",
        gac.cfo_amount_threshold AS "cfoThreshold",
        gac.ceo_amount_threshold AS "ceoThreshold"
      FROM global_approver_config gac
      LEFT JOIN users cfo ON cfo.user_id = gac.cfo_user_id
      LEFT JOIN users ceo ON ceo.user_id = gac.ceo_user_id
      WHERE gac.is_active = TRUE
      ORDER BY gac.updated_at DESC
      LIMIT 1
    `
  );

  const requester = requesterResult.rows[0] ?? null;
  const departmentSetup = departmentSetupResult.rows[0] ?? null;
  const globalConfig = globalConfigResult.rows[0] ?? null;
  const candidates = [];

  if (requester?.lineManagerId) {
    candidates.push({ stepCode: 'line_manager', approverId: requester.lineManagerId, priority: 1 });
  }

  if (departmentSetup?.reviewerId) {
    candidates.push({ stepCode: 'reviewer', approverId: departmentSetup.reviewerId, priority: 2 });
  }

  if (departmentSetup?.hodId) {
    candidates.push({ stepCode: 'hod', approverId: departmentSetup.hodId, priority: 3 });
  }

  if (
    globalConfig?.cfoId &&
    globalConfig?.cfoThreshold !== null &&
    Number(totalAmount) >= Number(globalConfig.cfoThreshold)
  ) {
    candidates.push({ stepCode: 'cfo', approverId: globalConfig.cfoId, priority: 4 });
  }

  if (
    globalConfig?.ceoId &&
    globalConfig?.ceoThreshold !== null &&
    Number(totalAmount) >= Number(globalConfig.ceoThreshold)
  ) {
    candidates.push({ stepCode: 'ceo', approverId: globalConfig.ceoId, priority: 5 });
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
    LEFT JOIN request_workflow_instances rwi ON rwi.request_id = pr.request_id
  `;
  const integrationJobSelect = `
    SELECT
      ij.job_id::text AS "id",
      ij.ref_id::text AS "requestId",
      pr.request_no AS "requestNo",
      ij.target_system AS "targetSystem",
      ij.status::text AS "status",
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

  async function fetchApprovalSetupData(queryable) {
    const [departmentsResult, usersResult, globalConfigResult] = await Promise.all([
      queryable.query(
        `
          SELECT
            d.department_id::text AS "id",
            d.department_code AS "code",
            d.department_name AS "name",
            d.is_active AS "isActive",
            COALESCE(reviewer.identity_subject, das.reviewer_user_id::text) AS "reviewerUserId",
            COALESCE(hod.identity_subject, das.hod_user_id::text) AS "hodUserId",
            COALESCE(fallback.identity_subject, das.fallback_user_id::text) AS "fallbackUserId",
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
          LEFT JOIN users reviewer ON reviewer.user_id = das.reviewer_user_id
          LEFT JOIN users hod ON hod.user_id = das.hod_user_id
          LEFT JOIN users fallback ON fallback.user_id = das.fallback_user_id
          ORDER BY d.department_name ASC
        `
      ),
      queryable.query(
        `
          SELECT
            COALESCE(u.identity_subject, u.user_id::text) AS "id",
            u.full_name AS "fullName",
            u.email AS "email",
            COALESCE(d.department_code, u.department_id::text) AS "departmentId"
          FROM users u
          LEFT JOIN departments d ON d.department_id = u.department_id
          WHERE u.is_active = TRUE
          ORDER BY u.full_name ASC
        `
      ),
      queryable.query(
        `
          SELECT
            company_code AS "companyCode",
            COALESCE(cfo.identity_subject, gac.cfo_user_id::text) AS "cfoUserId",
            COALESCE(ceo.identity_subject, gac.ceo_user_id::text) AS "ceoUserId",
            cfo_amount_threshold AS "cfoAmountThreshold",
            ceo_amount_threshold AS "ceoAmountThreshold",
            gac.is_active AS "isActive"
          FROM global_approver_config gac
          LEFT JOIN users cfo ON cfo.user_id = gac.cfo_user_id
          LEFT JOIN users ceo ON ceo.user_id = gac.ceo_user_id
          ORDER BY gac.updated_at DESC
          LIMIT 1
        `
      ),
    ]);

    return {
      departments: departmentsResult.rows.map(mapRowToDepartmentSetup),
      users: usersResult.rows.map(mapRowToSetupUser),
      globalConfig: globalConfigResult.rows[0] ? mapRowToGlobalApproverConfig(globalConfigResult.rows[0]) : null,
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
            reviewerUserId: null,
            hodUserId: null,
            fallbackUserId: null,
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
    async saveDepartmentApprovalSetup({ departmentCode, reviewerUserId, hodUserId, fallbackUserId, actorId }) {
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

        const [reviewerUuid, hodUuid, fallbackUuid] = await Promise.all([
          resolveOptionalUserUuid(client, reviewerUserId),
          resolveOptionalUserUuid(client, hodUserId),
          resolveOptionalUserUuid(client, fallbackUserId),
        ]);

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
                reviewer_user_id = $2::uuid,
                hod_user_id = $3::uuid,
                fallback_user_id = $4::uuid,
                effective_from = NOW(),
                is_active = $5,
                updated_at = NOW()
              WHERE department_approval_setup_id = $1::uuid
            `,
            [existingSetup.rows[0].setupId, reviewerUuid, hodUuid, fallbackUuid, Boolean(reviewerUuid || hodUuid || fallbackUuid)]
          );
        } else {
          await client.query(
            `
              INSERT INTO department_approval_setup (
                department_id,
                reviewer_user_id,
                hod_user_id,
                fallback_user_id,
                effective_from,
                is_active
              )
              VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, NOW(), $5)
            `,
            [departmentId, reviewerUuid, hodUuid, fallbackUuid, Boolean(reviewerUuid || hodUuid || fallbackUuid)]
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
              hodUserId,
              fallbackUserId,
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
    async saveGlobalApproverConfig({ cfoUserId, ceoUserId, cfoAmountThreshold, ceoAmountThreshold, actorId }) {
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        const actor = await resolveUserByIdentity(client, actorId);
        if (!actor) {
          throw new Error('Actor identity does not map to a user record.');
        }

        const [cfoUuid, ceoUuid] = await Promise.all([
          resolveOptionalUserUuid(client, cfoUserId),
          resolveOptionalUserUuid(client, ceoUserId),
        ]);

        await client.query(
          `
            INSERT INTO global_approver_config (
              company_code,
              cfo_user_id,
              ceo_user_id,
              cfo_amount_threshold,
              ceo_amount_threshold,
              is_active
            )
            VALUES ('default', $1::uuid, $2::uuid, $3, $4, TRUE)
            ON CONFLICT (company_code)
            DO UPDATE SET
              cfo_user_id = EXCLUDED.cfo_user_id,
              ceo_user_id = EXCLUDED.ceo_user_id,
              cfo_amount_threshold = EXCLUDED.cfo_amount_threshold,
              ceo_amount_threshold = EXCLUDED.ceo_amount_threshold,
              is_active = TRUE,
              updated_at = NOW()
          `,
          [cfoUuid, ceoUuid, cfoAmountThreshold, ceoAmountThreshold]
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
              cfoUserId,
              ceoUserId,
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
    async createPaymentRequest(input) {
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        const requester = await resolveUserByIdentity(client, input.requesterId);
        if (!requester) {
          throw new Error('Requester identity does not map to a user record.');
        }
        const departmentUuid = mapIdentityToDepartmentUuid(input.departmentId);
        if (!departmentUuid) {
          throw new Error('Department is not supported by seed mapping.');
        }

        const requestNoResult = await client.query(
          `SELECT CONCAT('PR-', TO_CHAR(NOW(), 'YYYY'), '-', LPAD((COUNT(*) + 1)::text, 4, '0')) AS "requestNo" FROM payment_requests`
        );
        const requestNo = requestNoResult.rows[0].requestNo;

        const insertedRequest = await client.query(
          `
            INSERT INTO payment_requests (
              request_no,
              requester_id,
              department_id,
              request_date,
              request_type,
              payment_type,
              payee_type,
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
              $3::uuid,
              CURRENT_DATE,
              'payment_request',
              $4,
              'vendor',
              $5,
              $6,
              $7,
              $8,
              $9,
              $10,
              'draft',
              'not_ready'
            )
            RETURNING request_id::text AS "requestId", created_at AS "createdAt"
          `,
          [
            requestNo,
            requester.userId,
            departmentUuid,
            input.paymentType,
            input.priority ?? 'medium',
            input.payeeName,
            input.currency,
            input.totalAmount,
            input.reason ?? null,
            input.visibilityMode ?? 'related_only',
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
                gl_account,
                amount,
                total_amount,
                remark
              )
              VALUES ($1::uuid, $2, $3, $4, $5, $5, $6)
            `,
            [
              requestId,
              index + 1,
              item.description,
              item.glCode ?? null,
              item.amount,
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

        await client.query('COMMIT');

        return {
          id: requestId,
          requestNo,
          requesterId: requester.identitySubject,
          requesterName: requester.fullName,
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
    async submitPaymentRequest({ requestId, actorId }) {
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

        const workflowChain = await resolveWorkflowChain(client, {
          requesterUserId: requestRecord.requesterUserId,
          departmentUuid: requestRecord.departmentUuid,
          totalAmount: requestRecord.totalAmount,
        });

        if (workflowChain.length === 0) {
          throw new Error('No approver chain could be resolved for this request.');
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
              })),
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
    async rejectPaymentRequest({ requestId, actorId }) {
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
              metadata_json
            )
            VALUES ($1::uuid, 'payment_request', $2::uuid, 'reject_request', $3::jsonb)
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
              payload_json,
              status
            )
            VALUES ('payment_request', $1::uuid, 'erp', $2::jsonb, 'pending')
          `,
          [
            requestContext.requestId,
            JSON.stringify({
              requestId: requestContext.requestId,
              requestNo: requestContext.requestNo,
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
