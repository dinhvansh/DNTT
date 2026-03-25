# Development Plan

## Scope
- Current goal: move the project to `React + API + Worker + PostgreSQL + Docker` and stop extending Firebase for new business flows.
- Scope follows the updated solution document: one Payment Request domain, fixed workflow, record-level visibility, Finance Release before ERP sync, mandatory audit trail.

## Architecture
- `web`: React/Vite UI, refactor screen by screen to backend APIs.
- `api`: business CRUD, workflow actions, permissions, visibility, audit.
- `worker`: ERP queue processing, retry, reconcile.
- `postgres`: source of truth for transactional data.
- `redis`: queue and background job coordination.
- `minio`: attachment and object storage.

## Rules Of Work
- Every business change must pass the checklist below before it is treated as done.
- Frontend must not write sensitive business data directly.
- Every permission rule needs a negative test, not only a happy-path test.
- Business status and ERP status must remain separate.
- ERP jobs are created only after `Release to ERP`.

## Delivery Phases

### Phase 0. Foundation
- [x] Create delivery plan document
- [x] Create initial Docker stack
- [x] Create core PostgreSQL schema
- [x] Create authorization and visibility module with tests
- [x] Refactor repo layout to clearly split `web`, `api`, `worker`
- [x] Normalize env templates for local and UAT

### Phase 1. Security And Permissions First
- [x] Map role and permission concepts into schema and seed data
- [x] Apply `need-to-know` visibility on request read APIs
- [x] Apply action permissions for submit, approve, reject, return, cancel
- [x] Apply permissions for `release_to_erp`, `hold_erp_sync`, `retry_erp_push`
- [x] Create admin approval setup APIs for department mapping and global CFO/CEO config
- [ ] Complete test matrix for same department, cross department, delegated approver, finance operations, admin, auditor

### Phase 2. Payment Request MVP
- [x] Create draft request
- [x] Save request header
- [x] Save detail lines
- [x] Save attachment metadata
- [x] Submit request
- [x] Approval inbox
- [x] Request detail timeline shell

### Phase 3. Workflow Engine
- [x] Resolve chain `Line Manager -> Reviewer -> HOD -> CFO -> CEO`
- [x] Deduplicate approver
- [x] CFO and CEO threshold logic
- [x] Delegation within validity window
- [x] Workflow instance snapshot skeleton
- [x] Return and resubmit flow

### Phase 4. ERP Release And Integration
- [x] `Approved -> Waiting Finance Release`
- [x] Finance worklist
- [x] `Release to ERP`
- [x] `Hold Sync`
- [x] Create integration job on finance release
- [x] Worker retry policy
- [x] ERP logs and manual retry UI

### Phase 5. Hardening
- [ ] Full audit coverage
- [ ] Reconcile job
- [x] Seed data for UAT-style permission checks
- [ ] Backup and restore PostgreSQL
- [ ] Docker image build for UAT and production

## Mandatory Checklist For Each Change
- [ ] Business requirement mapped back to the solution document
- [ ] Permission impact reviewed
- [ ] Positive test added or updated
- [ ] Access denied test added or updated
- [ ] Wrong-role test added or updated
- [ ] Same-department visibility test added when relevant
- [ ] Delegated access test added when relevant
- [ ] Audit or logging added for sensitive actions
- [ ] Docs or checklist updated

## Permission Test Matrix
- [x] Requester can view own request
- [x] Unrelated user is blocked in `related_only`
- [x] Same-department user can view `related_and_same_department` with permission
- [x] Same-department user is still blocked in `related_only`
- [x] Delegated approver can approve within validity window
- [x] Delegated approver receives `allowedActions.approve` and `allowedActions.reject`
- [x] Expired delegation loses approval access
- [x] Finance Operations can `release_to_erp` in the correct status
- [x] Business approver cannot `release_to_erp` by default
- [x] ERP retry remains limited to Finance Operations or ERP Integration Admin
- [x] Admin can view all requests
- [x] Approve action advances request to next step or final approved state
- [x] Reject action closes request and clears pending approvers
- [x] Release to ERP creates `integration_jobs` and `audit_logs`
- [x] Hold Sync keeps request in finance queue with proper permission checks
- [x] ERP jobs list only appears for finance/admin scoped actors
- [x] Retry action is blocked for actors without `retry_erp_push`
- [x] Worker processes pending ERP jobs and writes `erp_push_logs`
- [x] Worker schedules automatic retries before `manual_review_required`
- [x] Approver can return a request and requester alone can resubmit it

## Current Iteration
- [x] Lock architecture to Docker + PostgreSQL
- [x] Create core schema to continue backend implementation
- [x] Build first permission module and baseline tests
- [x] Move UI read path from Firebase to API client
- [x] Implement `GET /healthz`
- [x] Implement `GET /api/payment-requests/:id` with authorization
- [x] Implement `GET /api/payment-requests` with authorization
- [x] Implement `GET /api/my-approvals`
- [x] Implement `POST /api/payment-requests`
- [x] Implement `POST /api/payment-requests/:id/approve`
- [x] Implement `POST /api/payment-requests/:id/reject`
- [x] Implement `POST /api/payment-requests/:id/release-to-erp`
- [x] Split runtime PostgreSQL repository from fixture repository for tests
- [x] Seed permission matrix data and verify runtime on PostgreSQL
- [x] Persist approve, reject, and release transitions in fixture and PostgreSQL repositories
- [x] Return actor-specific `allowedActions` and wire frontend action buttons to backend APIs
- [x] Verify PostgreSQL runtime flow `create -> approve -> release-to-erp`
- [x] Confirm runtime `integration_jobs` and `audit_logs`
- [x] Replace blocked Google sign-in path with local register/sign-in flow for testing
- [x] Implement finance release queue, hold-sync action, ERP jobs list, and retry action
- [x] Implement worker polling, ERP job processing, auto-retry backoff, and push logs
- [x] Implement return and resubmit actions across authorization, API, repository, and detail UI
- [x] Move frontend app into `web/` and keep root as workspace entrypoint
- [x] Split env templates by runtime and narrow root env to Docker overrides
- [x] Persist attachment metadata from create form through API and PostgreSQL repository
- [x] Align request lifecycle to `Draft -> Pending Approval` with explicit submit action
- [x] Resolve configured approval chain with deduplicate and CFO/CEO thresholds
- [x] Wire Approval Setup screen to backend APIs for department and global approver config

## Latest Verification
- [x] `node --test api/tests/*.mjs`
- [x] `npm run lint`
- [x] `npm run build`
- [x] Docker stack up with `web`, `api`, `worker`, `postgres`, `redis`, `minio`
- [x] Runtime PostgreSQL smoke test for create, approve, and release-to-ERP
- [x] Runtime worker smoke test for ERP success and failed-with-retry paths
- [x] Root workspace commands proxy correctly to `web/` after repo split
- [x] `return/resubmit` covered in API test suite
- [x] Attachment metadata validated on create route and rendered on request detail
- [x] Runtime PostgreSQL smoke test for `draft -> submit -> first approver`
- [x] Runtime PostgreSQL smoke test for ordered `LM -> Reviewer -> HOD -> CFO -> CEO` chain
- [x] Runtime PostgreSQL smoke test for approval setup read, create department, and save department/global approver config
