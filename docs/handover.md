# Handover

## Project Goal

This repo is being migrated from a Firebase prototype to a layered stack:

- `web`: React/Vite UI
- `api`: Node business API
- `worker`: ERP integration worker
- `postgres`: transactional source of truth
- `redis`: background coordination
- `minio`: object storage
- `docker-compose`: local dev and UAT stack

Business scope follows:

- [solution document](../tai_lieu_giai_phap_payment_request_eoffice.md)
- [development plan](./development-plan.md)
- [workflow business rules](./workflow-business-rules.md)

## Current Status

Most of Phase 1 to Phase 5 is in place:

- local auth for testing, old Google sign-in removed
- create draft payment request
- save header, detail, and upload attachments to MinIO
- submit
- approve / reject / return / resubmit / cancel
- reject requires a non-empty reason note
- fixed workflow chain:
  - `Line Manager -> Reviewer -> HOD -> CFO -> CEO`
- approver deduplication
- delegation within validity window
- record-level visibility
- finance release queue
- finance review with:
  - `Approve Only`
  - `Reject`
  - `Approve & Release ERP`
- `Release to ERP`
- `Hold Sync`
- integration jobs, ERP logs, manual retry
- worker retry policy
- worker reconcile job for ERP anomalies
- production Dockerfiles and `docker-compose.prod.yml`
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
- auditor role seed and view-only coverage
- audit log APIs:
  - request-specific audit logs
  - generic audit log listing for config and request entities
- PostgreSQL backup and restore scripts
- attachment binary upload to MinIO is live
- attachment preview / download from MinIO is live
- attachment-level visibility is enforced
  - currently by attachment type, with template-specific override support
- field masking is enforced
  - currently covers bank fields and can be controlled per template
- request templates are now real config objects instead of mock UI
  - admin can create/update templates
  - requester can pick a template at request creation
  - template controls:
    - request visibility mode
    - field masking
    - attachment visibility
    - required attachment types
    - detail column visible/required flags
- print action on request detail is working
  - prints summary, payment details, attachments, and audit log
- organization chart screen exists and reads from master data
- master data now supports:
  - create / edit / delete user
  - create / edit / delete department
  - create / edit / delete position
  - vendor master
  - ERP reference master

## Remaining Work

Main items still open in the plan:

No unchecked Phase 0-5 infrastructure item is left in `development-plan.md`.

Business features still not implemented:
- template-driven dynamic request form
  - form still does not fully hide/show fields or columns live by template
- output print layout by template
- richer org-chart-first workflow refactor if business wants to move away from current hybrid model
- local register flow is still lightweight and not tied to rich master-data workflows
- UX polish remains for:
  - Master Data
  - Organization Chart
  - Create Payment Request
  - Finance Review screens

## Repo Layout

```text
.
|-- api/
|-- db/
|-- docs/
|-- web/
|-- worker/
|-- docker-compose.yml
`-- README.md
```

## Local Run

```bash
docker compose up -d
```

Services:

  - web: `http://localhost:3001`
  - api: `http://localhost:18081`
  - postgres: `localhost:5433`
  - redis: `localhost:6380`
- minio api: `http://localhost:9000`
- minio console: `http://localhost:9001`

Force refresh web and api:

```bash
docker compose up -d --force-recreate web api
```

## Test Accounts

- `requester1@example.com / 1234`
- `approver1@example.com / 1234`
- `financeops@example.com / 1234`
- `sysadmin@example.com / 1234`
- `auditor1@example.com / 1234`

Notes:

- `sysadmin` can manage approval setup.
- `auditor` is view-only and can access audit logs.

If Docker/PostgreSQL was already running before the auditor seed change, apply:

```bash
docker compose exec -T postgres psql -U payment_app -d payment_request < db/manual/2026-03-26_seed_auditor.sql
```

If Docker/PostgreSQL was already running before the `department + position + user` refactor, apply:

```bash
docker compose exec -T postgres psql -U payment_app -d payment_request < db/manual/2026-03-26_positions_refactor.sql
```

## Important Commands

Backend:

```bash
node --test api/tests/*.mjs
```

Worker:

```bash
node --test worker/tests/*.mjs
```

Frontend lint and build:

```bash
npm run lint
npm run build
```

## Important Files

### Backend

- [api/src/server.mjs](../api/src/server.mjs)
  Main HTTP routes
- [api/src/security/authorization.mjs](../api/src/security/authorization.mjs)
  Permission, request visibility, attachment visibility, and field masking rules
- [api/src/data/postgresRepository.mjs](../api/src/data/postgresRepository.mjs)
  PostgreSQL persistence, workflow resolution, template persistence
- [api/src/data/fixtureRepository.mjs](../api/src/data/fixtureRepository.mjs)
  Fixture mode for tests, template defaults
- [api/src/data/defaultTemplates.mjs](../api/src/data/defaultTemplates.mjs)
  Default template definitions
- [db/init/001_core.sql](../db/init/001_core.sql)
  Core schema
- [db/init/002_seed.sql](../db/init/002_seed.sql)
  Seed data and role permissions

### Frontend

- [web/src/AuthProvider.tsx](../web/src/AuthProvider.tsx)
  Local auth test flow
- [web/src/api/paymentRequests.ts](../web/src/api/paymentRequests.ts)
  Request, approval, ERP, audit, and workflow preview client
- [web/src/api/approvalSetup.ts](../web/src/api/approvalSetup.ts)
  Approval setup client
- [web/src/api/masterData.ts](../web/src/api/masterData.ts)
  Master data, vendor, ERP reference, and sync client
- [web/src/api/templates.ts](../web/src/api/templates.ts)
  Request template admin client
- [web/src/ApprovalSetup.tsx](../web/src/ApprovalSetup.tsx)
  Approval setup screen with direct user mapping and local step order
- [web/src/MasterData.tsx](../web/src/MasterData.tsx)
  User, department, position, role, and line-manager setup
- [web/src/OrganizationChart.tsx](../web/src/OrganizationChart.tsx)
  Organization structure view from department + position + line manager data
- [web/src/ERPReferenceMaster.tsx](../web/src/ERPReferenceMaster.tsx)
  ERP reference list, bulk import, filters, and sync history
- [web/src/Templates.tsx](../web/src/Templates.tsx)
  Real template admin editor
- [web/src/CreatePaymentRequest.tsx](../web/src/CreatePaymentRequest.tsx)
  Draft create and submit with requester-derived department, ERP refs, workflow preview, template selection
- [web/src/PaymentRequestDetail.tsx](../web/src/PaymentRequestDetail.tsx)
  Detail actions, finance review actions, audit timeline, print, attachment preview/download
- [web/src/ERPIntegrationLog.tsx](../web/src/ERPIntegrationLog.tsx)
  Finance review, release, retry, readiness summary, error category, idempotency info

### Worker

- [worker/src/worker.mjs](../worker/src/worker.mjs)
  Polling, ERP processing, webhook publish
- [worker/src/policy.mjs](../worker/src/policy.mjs)
  Retry policy and error classification
- [worker/src/reconcile.mjs](../worker/src/reconcile.mjs)
  Reconcile logic for ERP anomalies

## Fragile Areas

### 1. Permissions

This is the highest-risk area. Any permission change needs:

- happy-path test
- access denied test
- wrong-role test
- same-department test when relevant
- delegated test when relevant

### 2. Approval Setup

`ApprovalSetup.tsx` previously flickered because `actorContext` was recreated on every render.
It was fixed with `useMemo`.

If that screen starts looping again, check:

- `useEffect` dependency arrays
- recreated objects/functions on render
- state reset loops after fetch

### 3. PostgreSQL Runtime vs Fixture Mode

Route tests pass in fixture mode by default. Runtime smoke tests on Docker/PostgreSQL still matter.

Do not trust fixture tests alone after changing:

- SQL queries
- transaction flow
- setup persistence
- audit log persistence
- worker reconcile queries

### 4. Department Approval Setup

`department_approval_setup` currently behaves as direct user mapping first:

- `reviewer_user_id`
- `hod_user_id`
- `fallback_user_id`

position-based fallback logic still exists in repository, but active business setup should be treated as direct-user-first.

If this area is cleaned up later:

- add an explicit migration
- add the right unique constraint
- then simplify repository upsert logic

### 5. Templates

Templates now affect runtime request behavior. When debugging request detail visibility:

- check `templateCode`
- check `templateFormSchema.fieldMasking`
- check `templateAttachmentRules.visibilityByType`

If a fixture request is behaving oddly, confirm it is enriched with a default template in `fixtureRepository`.

## Smoke Tests After Major Changes

1. Sign in as `requester1`
2. Create a draft request
3. Submit it
4. Sign in as the next approver and approve
5. Walk the full chain for a high-value request if workflow logic changed
6. Sign in as `financeops` and test release / hold / retry if ERP path changed
7. Sign in as `sysadmin` and verify `Approval Setup` if config path changed
8. Sign in as `auditor` and verify:
   - request list is visible
   - no mutation actions are available
   - `/api/audit-logs` and request audit timeline still work
9. Sign in as `sysadmin` and verify:
   - `Templates` page can create or update a template
   - `Create Request` can select the template
10. Sign in as requester/department viewer/finance and verify:
   - bank fields mask correctly
   - attachment visibility changes according to template

## Current Business Flow Notes

- all approval steps may reject
- every reject action must include a reason note
- reject without note is blocked in UI and API
- workflow scope should follow `workflow-business-rules.md` before adding new escalation or self-approval exceptions
- setup order is now:
  - create department
  - create position
  - create user
  - assign department + position + line manager
  - map reviewer / HOD / fallback by direct user mapping
- requester now selects a request template at create time
- template drives request visibility defaults and sensitive field/attachment behavior
- after business approval is complete, Finance reviews before ERP sync
- Finance should open request detail first, then choose:
  - `Approve Only`
  - `Reject`
  - `Approve & Release ERP`
  - `Hold Sync`

## Recommended Next Steps

1. Make create-request form truly dynamic by template
2. Add template-specific print/output layout
3. Continue polishing Master Data and Organization Chart UX
4. Revisit org-chart-first workflow refactor only after business confirms the model

## Git State

Recent baseline commits already pushed:

- `1f01940` `refactor app into web api worker stack`
- `a53e6d4` `docs: rewrite repository readme`
- `d83db3c` `docs: add handover notes`

State in this handover assumes a newer local commit after those baseline commits.
Night-shift dev should pull latest `master` or `main` before continuing.

See also:

- [business flow requirement](./business-flow-requirement.md)
