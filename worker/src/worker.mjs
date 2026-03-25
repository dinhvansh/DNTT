import { createRequire } from 'node:module';
import { decideJobOutcome, getBackoffSeconds } from './policy.mjs';

const require = createRequire(import.meta.url);
const { Pool } = require('pg');

const pollIntervalMs = Number(process.env.WORKER_POLL_INTERVAL_MS ?? 10000);
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
          retry_count = retry_count + $3,
          last_error = $4,
          next_retry_at = $5,
          updated_at = NOW()
        WHERE job_id = $1::uuid
      `,
      [
        job.jobId,
        outcome.jobStatus,
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
          totalAmount: Number(job.totalAmount),
        }),
        JSON.stringify({
          outcome: outcome.jobStatus,
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
  console.log(
    `[worker] processed ${job.jobId} for ${job.requestNo} -> ${outcome.jobStatus}`
  );
}

console.log('payment-request-worker started');
console.log(`database: ${databaseUrl || 'not-configured'}`);
console.log(`redis: ${process.env.REDIS_URL ?? 'not-configured'}`);

setInterval(() => {
  void pollOnce().catch((error) => {
    console.error('[worker] poll failure', error);
  });
}, pollIntervalMs);

void pollOnce().catch((error) => {
  console.error('[worker] initial poll failure', error);
});
