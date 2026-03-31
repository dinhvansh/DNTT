# ERP Readiness Task Checklist

## Goal
- Reduce ERP push failures caused by missing or invalid master data such as vendor code, expense type, and GL account.
- Move these failures to a pre-release validation step before finance releases a request to ERP.

## Scope
- ERP reference master for:
  - `expense_type`
  - `gl_account`
  - `cost_center`
  - `project`
- Public read-only API for request form consumption
- Admin sync API for ERP reference upsert
- Finance-side readiness validation before `Approve & Release ERP`

## Delivered
- [x] Add DB tables `erp_reference_values` and `erp_sync_runs`
- [x] Seed ERP reference master data for fixture and PostgreSQL
- [x] Add runtime SQL patch for existing local database
- [x] Add repository support to list and sync ERP reference values
- [x] Add admin sync API `POST /api/setup/erp-reference-data/sync`
- [x] Add public read-only API `GET /api/erp-reference-data`
- [x] Add request readiness API `GET /api/payment-requests/:id/erp-readiness`
- [x] Block `release-to-erp` when readiness validation fails
- [x] Switch request form expense type to ERP master dropdown
- [x] Switch request form GL code to ERP master dropdown
- [x] Add cost center and project selection to request detail
- [x] Persist ERP expense type code in detail metadata for strict backend validation
- [x] Add finance/request detail UI card for readiness check
- [x] Disable `Approve & Release ERP` button when readiness result is known and invalid
- [x] Add backend tests for ERP reference APIs
- [x] Add backend tests for readiness fail and readiness pass release flow
- [x] Add finance queue readiness summary in `ERP Integration Log`
- [x] Add `error_category` and `idempotency_key` to ERP jobs UI
- [x] Add ERP reference bulk import, export CSV, and recent sync history UI
- [x] Add requester-side `Approval Preview` with controlled line manager override
- [x] Apply line manager override only at submit time and snapshot the final chain
- [x] Exclude the overridden original line manager from visibility and approval scope

## Validation Rules
- Vendor code must exist and be active in vendor master
- At least one detail line must exist
- Every detail line must have a valid ERP expense type
- Every detail line must have a valid active GL account
- Every detail line must have a valid active cost center
- Every detail line must have a valid active project code

## Current Limits
- Only `Line Manager` can be overridden from requester UI
- Override does not persist on draft save yet; it is applied only on submit
- Returned requests do not reopen line-manager override editing in this phase; resubmit uses the current workflow rule set without requester-side override changes
- `Reviewer / HOD / CFO / CEO` override is intentionally blocked in this phase

## Recommended Next Steps
- [x] Add admin UI for ERP reference sync and review
- [x] Add cost center and project fields to request detail
- [x] Validate cost center and project in ERP readiness
- [x] Add idempotency key to ERP payload dispatch
- [x] Add explicit transient vs business-error classification in worker logs
- [x] Show readiness result summary in finance worklist rows
- [x] Extend self-approval skip coverage to requester = reviewer / cfo / ceo
- [x] Decide whether returned requests can edit and resubmit line manager override

## Local Runtime Steps
1. Apply runtime patch:
   - `docker compose exec -T postgres psql -U payment_app -d payment_request < db/manual/2026-03-27_erp_reference_master.sql`
2. Recreate services:
   - `docker compose up -d --force-recreate api web worker`
3. Test flow:
   - create request with valid vendor + expense type + GL code
   - approve through business chain
   - open detail as finance
   - run `ERP Readiness Check`
   - release to ERP
