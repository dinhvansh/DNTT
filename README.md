# DNTT Payment Request Workspace

This repository implements the `Payment Request` module on a layered stack:

- `web`: React + Vite
- `api`: Node.js business API
- `worker`: ERP background worker
- `postgres`: transactional database
- `redis`: job coordination
- `minio`: object storage for attachments
- `docker-compose`: local dev and UAT stack

Business scope follows:

- [solution document](./tai_lieu_giai_phap_payment_request_eoffice.md)
- [development plan](./docs/development-plan.md)

## Repository Layout

```text
.
|-- api/        # API, workflow, authorization, route tests
|-- db/         # PostgreSQL schema, seed, scripts
|-- docs/       # plan and handover
|-- web/        # React frontend
|-- worker/     # ERP worker and retry/reconcile logic
|-- docker-compose.yml
`-- README.md
```

## Current Status

Implemented:

- local sign in / register for testing
- create draft request
- save header, detail, and upload attachments to MinIO
- submit
- approve / reject / return / resubmit / cancel
- reject requires a non-empty reason note
- fixed workflow chain:
  - `Line Manager -> Reviewer -> HOD -> CFO -> CEO`
- approver deduplication
- delegation within validity window
- record-level visibility with `need-to-know`
- finance release queue
- finance review:
  - `Approve Only`
  - `Reject`
  - `Approve & Release ERP`
  - `Hold Sync`
- ERP job list and manual retry
- worker auto retry policy
- worker reconcile job for ERP anomalies
- outbound webhook for request status changes and ERP job updates
- master-data-first org model:
  - create `department`
  - create `position`
  - assign `user -> department + position + line manager`
- requester department is derived from user profile
- approval setup UI and API:
  - create department
  - map reviewer / HOD / fallback by direct user mapping
  - configure local step order for `Line Manager / Reviewer / HOD`
  - set global CFO / CEO positions and thresholds
- request audit timeline
- generic audit log API for admin and auditor

Still open:

- attachment-level visibility
- field masking
- advanced template configuration
- production hardening beyond current local/UAT scope

## Webhook Integration

The stack can publish outbound webhooks for external systems.

API webhook events:

- `payment_request.created`
- `payment_request.submitted`
- `payment_request.approved`
- `payment_request.rejected`
- `payment_request.returned`
- `payment_request.resubmitted`
- `payment_request.cancelled`
- `payment_request.finance_approved`
- `payment_request.finance_rejected`
- `payment_request.erp_released`
- `payment_request.erp_hold`

Worker webhook events:

- `erp.job.updated`

API env:

- `WEBHOOK_URL`
- `WEBHOOK_SECRET`
- `WEBHOOK_EVENTS`
- `WEBHOOK_TIMEOUT_MS`

Worker env:

- `WORKER_WEBHOOK_URL`
- `WORKER_WEBHOOK_SECRET`
- `WORKER_WEBHOOK_EVENTS`
- `WORKER_WEBHOOK_TIMEOUT_MS`

Notes:

- webhook delivery is best-effort and does not rollback the main business action
- when a secret is configured, requests include `x-webhook-signature` as `HMAC-SHA256`

## Requirements

- Docker Desktop
- Node.js 22+ if you want to run commands outside containers
- PowerShell for the bundled backup and restore scripts

## Quick Start

```bash
docker compose up -d
```

Default services:

- Web: `http://localhost:3001`
- API: `http://localhost:18081`
- PostgreSQL: `localhost:5433`
- Redis: `localhost:6380`
- MinIO API: `http://localhost:9000`
- MinIO Console: `http://localhost:9001`

Recreate only web and api:

```bash
docker compose up -d --force-recreate web api
```

Production-style image build:

```bash
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

## Test Accounts

- `requester1@example.com / 1234`
- `approver1@example.com / 1234`
- `financeops@example.com / 1234`
- `sysadmin@example.com / 1234`
- `auditor1@example.com / 1234`

Notes:

- `sysadmin` can access `Approval Setup`
- `auditor` is view-only and can access audit logs

If the running PostgreSQL volume was created before the auditor seed was added, apply:

```powershell
Get-Content db/manual/2026-03-26_seed_auditor.sql | docker compose exec -T postgres psql -U payment_app -d payment_request
```

If the running PostgreSQL volume was created before the `department + position + user` refactor, apply:

```powershell
Get-Content db/manual/2026-03-26_positions_refactor.sql | docker compose exec -T postgres psql -U payment_app -d payment_request
```

## Common Test Flows

### Request flow

1. Sign in with `requester1@example.com`
2. Open `New Request`
3. Create a request and `Save Draft`
4. Open detail and `Submit`

### Approval flow

1. Sign in with the current approver
2. Open `My Approvals`
3. Test `Approve`, `Reject`, or `Return`

### Finance / ERP flow

1. Move a request to final business approval
2. Sign in with `financeops@example.com`
3. Open `ERP Integration Log`
4. Open request detail from finance queue when needed
5. Test `Approve Only`, `Reject`, `Approve & Release ERP`, `Hold Sync`, `Retry`

### Approval setup flow

1. Sign in with `sysadmin@example.com`
2. Open `Master Data`
3. Create or update users with:
   - department
   - position
   - line manager
4. Open `Approval Setup`
5. Create a department if needed
6. Map reviewer / HOD / fallback by position
7. Set local step order
8. Set global CFO / CEO positions and thresholds

### Department-derived request flow

1. Sign in with a requester account
2. Confirm the requester already has a department in `Master Data`
3. Open `New Request`
4. Confirm department is shown from user profile
5. Submit without manually choosing department

### Auditor flow

1. Sign in with `auditor1@example.com`
2. Open request list and request detail
3. Confirm there are no mutation actions
4. Confirm audit timeline loads for new requests

## Environment Templates

- root [`.env.example`](./.env.example): Docker overrides
- [`web/.env.example`](./web/.env.example): frontend env
- [`api/.env.example`](./api/.env.example): API env
- [`worker/.env.example`](./worker/.env.example): worker env

## Useful Commands

```bash
npm run lint
npm run build
npm run api:test
npm run worker:test
```

Direct test commands:

```bash
node --test api/tests/*.mjs
node --test worker/tests/*.mjs
```

## Backup and Restore

Create a PostgreSQL backup:

```powershell
powershell -ExecutionPolicy Bypass -File db/scripts/backup.ps1
```

Restore from a backup file:

```powershell
powershell -ExecutionPolicy Bypass -File db/scripts/restore.ps1 -BackupFile db/backups/payment_request-YYYYMMDD-HHMMSS.sql
```

## Architecture Decisions

- frontend does not write sensitive business data directly
- business status is separate from ERP sync status
- ERP jobs are created only after `Release to ERP`
- workflow remains fixed in the current phase
- approval config is department-based and position-based, not free-form workflow-per-department
- local step order is configurable only for `Line Manager / Reviewer / HOD`
- reconcile logic lives in the worker, not in request approval transactions

## Related Documents

- business: [solution document](./tai_lieu_giai_phap_payment_request_eoffice.md)
- current MVP business flow: [business flow requirement](./docs/business-flow-requirement.md)
- setup and test flow: [setup flow guide](./docs/setup-flow-guide.md)
- delivery tracking: [development plan](./docs/development-plan.md)
- handover: [handover notes](./docs/handover.md)
