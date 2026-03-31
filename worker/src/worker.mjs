import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { decideJobOutcome, getBackoffSeconds } from './policy.mjs';
import { publishWorkerWebhook } from './webhook.mjs';
import {
  detectReconcileActions,
  mapJobStatusToRequestStatus,
  WAITING_FINANCE_RELEASE_THRESHOLD_HOURS,
} from './reconcile.mjs';

const require = createRequire(import.meta.url);
const { Pool } = require('pg');

const pollIntervalMs = Number(process.env.WORKER_POLL_INTERVAL_MS ?? 10000);
const reconcileIntervalMs = Number(process.env.WORKER_RECONCILE_INTERVAL_MS ?? 60000);
const databaseUrl = process.env.DATABASE_URL ?? '';
const pool = new Pool({
  connectionString: databaseUrl,
});

async function claimNextJob() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `
        WITH candidate AS (
          SELECT
            ij.job_id,
            ij.retry_count,
            ij.idempotency_key,
            ij.payload_json,
            pr.request_id,
            pr.request_no,
            pr.total_amount
          FROM integration_jobs ij
          JOIN payment_requests pr ON pr.request_id = ij.ref_id
          WHERE ij.ref_type = 'payment_request'
            AND (
              ij.status = 'pending'
              OR (ij.status = 'failed' AND ij.next_retry_at IS NOT NULL AND ij.next_retry_at <= NOW())
            )
          ORDER BY
            CASE WHEN ij.status = 'pending' THEN 0 ELSE 1 END,
            ij.created_at ASC
          FOR UPDATE SKIP LOCKED
          LIMIT 1
        )
        UPDATE integration_jobs ij
        SET
          status = 'processing',
          updated_at = NOW()
        FROM candidate
        WHERE ij.job_id = candidate.job_id
        RETURNING
          candidate.job_id::text AS "jobId",
          candidate.retry_count AS "retryCount",
          candidate.idempotency_key AS "idempotencyKey",
          candidate.payload_json AS "payload",
          candidate.request_id::text AS "requestId",
          candidate.request_no AS "requestNo",
          candidate.total_amount AS "totalAmount"
      `
    );

    await client.query('COMMIT');
    return result.rows[0] ?? null;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function completeJob(job) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const outcome = decideJobOutcome({
      totalAmount: Number(job.totalAmount),
      retryCount: Number(job.retryCount),
    });

    const nextRetryAt = outcome.shouldRetry
      ? new Date(Date.now() + getBackoffSeconds(Number(job.retryCount)) * 1000).toISOString()
      : null;

    await client.query(
      `
        UPDATE integration_jobs
        SET
          status = $2,
          error_category = $3,
          retry_count = retry_count + $4,
          last_error = $5,
          next_retry_at = $6,
          updated_at = NOW()
        WHERE job_id = $1::uuid
      `,
      [
        job.jobId,
        outcome.jobStatus,
        outcome.errorCategory,
        outcome.shouldRetry ? 1 : 0,
        outcome.errorMessage,
        nextRetryAt,
      ]
    );

    await client.query(
      `
        UPDATE payment_requests
        SET
          erp_sync_status = $2,
          updated_at = NOW()
        WHERE request_id = $1::uuid
      `,
      [job.requestId, outcome.requestStatus]
    );

    await client.query(
      `
        INSERT INTO erp_push_logs (
          request_id,
          payload_json,
          response_json,
          status,
          attempt_no,
          error_message
        )
        VALUES (
          $1::uuid,
          $2::jsonb,
          $3::jsonb,
          $4,
          $5,
          $6
        )
      `,
      [
        job.requestId,
        JSON.stringify({
          requestId: job.requestId,
          requestNo: job.requestNo,
          idempotencyKey: job.idempotencyKey,
          totalAmount: Number(job.totalAmount),
        }),
        JSON.stringify({
          outcome: outcome.jobStatus,
          errorCategory: outcome.errorCategory,
          nextRetryAt,
        }),
        outcome.jobStatus,
        Number(job.retryCount) + 1,
        outcome.errorMessage,
      ]
    );

    await client.query('COMMIT');
    return outcome;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function pollOnce() {
  if (!databaseUrl) {
    console.log('[worker] skipped poll because DATABASE_URL is not configured');
    return;
  }

  const job = await claimNextJob();
  if (!job) {
    return;
  }

  const outcome = await completeJob(job);
  try {
    await publishWorkerWebhook('erp.job.updated', {
      jobId: job.jobId,
      requestId: job.requestId,
      requestNo: job.requestNo,
      retryCount: Number(job.retryCount),
      totalAmount: Number(job.totalAmount),
      idempotencyKey: job.idempotencyKey,
      jobStatus: outcome.jobStatus,
      errorCategory: outcome.errorCategory,
      requestStatus: outcome.requestStatus,
      shouldRetry: outcome.shouldRetry,
      errorMessage: outcome.errorMessage,
    });
  } catch (error) {
    console.warn(`[worker] webhook delivery failed for ${job.jobId}`, error);
  }
  console.log(
    `[worker] processed ${job.jobId} for ${job.requestNo} -> ${outcome.jobStatus}`
  );
}

async function listReconcileCandidates() {
  const result = await pool.query(
    `
      WITH latest_jobs AS (
        SELECT
          ij.ref_id,
          ij.job_id::text AS "jobId",
          ij.status::text AS "jobStatus",
          ij.created_at,
          ROW_NUMBER() OVER (PARTITION BY ij.ref_id ORDER BY ij.created_at DESC, ij.updated_at DESC) AS job_rank
        FROM integration_jobs ij
        WHERE ij.ref_type = 'payment_request'
      )
      SELECT
        pr.request_id::text AS "requestId",
        pr.request_no AS "requestNo",
        pr.business_status::text AS "businessStatus",
        pr.erp_sync_status::text AS "erpSyncStatus",
        pr.finance_release_at AS "erpReleaseAt",
        pr.updated_at AS "updatedAt",
        pr.total_amount AS "totalAmount",
        lj."jobId",
        lj."jobStatus"
      FROM payment_requests pr
      LEFT JOIN latest_jobs lj ON lj.ref_id = pr.request_id AND lj.job_rank = 1
      WHERE pr.business_status = 'approved'
    `
  );

  return result.rows.map((row) => ({
    requestId: row.requestId,
    requestNo: row.requestNo,
    businessStatus: row.businessStatus,
    erpSyncStatus: row.erpSyncStatus,
    erpReleaseAt: row.erpReleaseAt,
    updatedAt: row.updatedAt,
    totalAmount: Number(row.totalAmount),
    latestJob: row.jobId
      ? {
          jobId: row.jobId,
          status: row.jobStatus,
        }
      : null,
  }));
}

async function insertRequestAuditLog(client, { requestId, actionCode, note, metadata = {} }) {
  await client.query(
    `
      INSERT INTO audit_logs (
        entity_type,
        entity_id,
        action_code,
        action_note,
        metadata_json
      )
      VALUES ('payment_request', $1::uuid, $2, $3, $4::jsonb)
    `,
    [requestId, actionCode, note, JSON.stringify(metadata)]
  );
}

async function hasRecentAuditLog(client, { requestId, actionCode, lookbackHours = 24 }) {
  const result = await client.query(
    `
      SELECT 1
      FROM audit_logs
      WHERE entity_type = 'payment_request'
        AND entity_id = $1::uuid
        AND action_code = $2
        AND created_at >= NOW() - ($3::text || ' hours')::interval
      LIMIT 1
    `,
    [requestId, actionCode, String(lookbackHours)]
  );

  return result.rowCount > 0;
}

async function recreateMissingJob(client, candidate) {
  await client.query(
    `
      INSERT INTO integration_jobs (
        ref_type,
        ref_id,
        target_system,
        payload_json,
        status,
        retry_count,
        last_error,
        next_retry_at
      )
      VALUES (
        'payment_request',
        $1::uuid,
        'erp',
        $2::jsonb,
        'pending',
        0,
        NULL,
        NULL
      )
    `,
    [
      candidate.requestId,
      JSON.stringify({
        requestId: candidate.requestId,
        requestNo: candidate.requestNo,
        source: 'reconcile_job',
      }),
    ]
  );

  await client.query(
    `
      UPDATE payment_requests
      SET erp_sync_status = 'pending', updated_at = NOW()
      WHERE request_id = $1::uuid
    `,
    [candidate.requestId]
  );

  await insertRequestAuditLog(client, {
    requestId: candidate.requestId,
    actionCode: 'reconcile_created_integration_job',
    note: `Reconcile recreated missing ERP job for ${candidate.requestNo}.`,
    metadata: {
      requestNo: candidate.requestNo,
    },
  });
}

async function alignRequestStatusWithJob(client, candidate) {
  const expectedStatus = mapJobStatusToRequestStatus(candidate.latestJob?.status);
  if (!expectedStatus || expectedStatus === candidate.erpSyncStatus) {
    return;
  }

  await client.query(
    `
      UPDATE payment_requests
      SET erp_sync_status = $2, updated_at = NOW()
      WHERE request_id = $1::uuid
    `,
    [candidate.requestId, expectedStatus]
  );

  await insertRequestAuditLog(client, {
    requestId: candidate.requestId,
    actionCode: 'reconcile_aligned_erp_status',
    note: `Reconcile aligned ERP status to ${expectedStatus} for ${candidate.requestNo}.`,
    metadata: {
      previousErpSyncStatus: candidate.erpSyncStatus,
      expectedErpSyncStatus: expectedStatus,
      latestJobStatus: candidate.latestJob?.status ?? null,
    },
  });
}

async function flagWaitingFinanceRelease(client, candidate) {
  const alreadyLogged = await hasRecentAuditLog(client, {
    requestId: candidate.requestId,
    actionCode: 'reconcile_waiting_finance_release',
    lookbackHours: WAITING_FINANCE_RELEASE_THRESHOLD_HOURS,
  });

  if (alreadyLogged) {
    return;
  }

  await insertRequestAuditLog(client, {
    requestId: candidate.requestId,
    actionCode: 'reconcile_waiting_finance_release',
    note: `Request ${candidate.requestNo} has been waiting for finance release beyond threshold.`,
    metadata: {
      thresholdHours: WAITING_FINANCE_RELEASE_THRESHOLD_HOURS,
    },
  });
}

export async function runReconcileOnce() {
  if (!databaseUrl) {
    console.log('[worker] skipped reconcile because DATABASE_URL is not configured');
    return [];
  }

  const candidates = await listReconcileCandidates();
  const actionsTaken = [];

  for (const candidate of candidates) {
    const actions = detectReconcileActions({
      request: candidate,
      latestJob: candidate.latestJob,
      now: new Date(),
    });

    if (actions.length === 0) {
      continue;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      if (actions.includes('recreate_missing_job')) {
        await recreateMissingJob(client, candidate);
        actionsTaken.push({ requestId: candidate.requestId, action: 'recreate_missing_job' });
      }

      if (actions.includes('align_request_status_with_job')) {
        await alignRequestStatusWithJob(client, candidate);
        actionsTaken.push({ requestId: candidate.requestId, action: 'align_request_status_with_job' });
      }

      if (actions.includes('flag_waiting_finance_release')) {
        await flagWaitingFinanceRelease(client, candidate);
        actionsTaken.push({ requestId: candidate.requestId, action: 'flag_waiting_finance_release' });
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  if (actionsTaken.length > 0) {
    console.log(`[worker] reconcile applied ${actionsTaken.length} action(s)`);
  }

  return actionsTaken;
}

export async function closeWorkerPool() {
  await pool.end();
}

function startWorker() {
  console.log('payment-request-worker started');
  console.log(`database: ${databaseUrl || 'not-configured'}`);
  console.log(`redis: ${process.env.REDIS_URL ?? 'not-configured'}`);

  setInterval(() => {
    void pollOnce().catch((error) => {
      console.error('[worker] poll failure', error);
    });
  }, pollIntervalMs);

  setInterval(() => {
    void runReconcileOnce().catch((error) => {
      console.error('[worker] reconcile failure', error);
    });
  }, reconcileIntervalMs);

  void pollOnce().catch((error) => {
    console.error('[worker] initial poll failure', error);
  });

  void runReconcileOnce().catch((error) => {
    console.error('[worker] initial reconcile failure', error);
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startWorker();
}
