# Business Flow Requirement

## 1. Purpose

This document defines the current MVP business flow for the `Payment Request` module.

It is intended for:

- business review
- QA and UAT
- developer handover
- future enhancement work

## 2. Core Roles

### Requester

Requester can:

- create a request
- save a draft
- edit own draft
- submit own draft
- view own requests
- resubmit a returned request
- cancel own request only in `draft` or `returned`

### Business Approver

The business approval chain is fixed:

- `Line Manager`
- `Reviewer`
- `HOD`
- `CFO`
- `CEO`

Each active approver can:

- view the request assigned to the current step
- approve
- reject
- return for revision

### Finance Operations

Finance Operations is the post-approval control layer.

Finance can:

- review approved requests before ERP sync
- open the full request detail from the finance queue
- `Approve Only`
- `Reject`
- `Approve & Release ERP`
- `Hold Sync`
- retry ERP jobs
- view ERP logs and responses

### Admin

Admin can:

- manage users, departments, positions, and line-manager mapping
- manage approval setup
- view all requests
- view audit logs

### Auditor

Auditor can:

- view requests
- view audit logs
- not mutate business data

## 3. Main Status Model

### Business Status

- `draft`
- `pending_approval`
- `returned`
- `rejected`
- `approved`
- `cancelled`

### ERP Sync Status

- `not_ready`
- `waiting_finance_release`
- `hold_by_finance`
- `pending`
- `processing`
- `success`
- `failed`
- `manual_review_required`

## 4. Business Flow

### 4.0 Master Data And Approval Setup

The setup order is:

1. create `department`
2. create `position`
3. create `user`
4. assign `user -> department + position + line manager`
5. configure approval setup by position

Rules:

- requester department is derived from user profile
- requester does not manually choose department on the request form
- line manager comes from user profile
- reviewer and HOD come from department approval setup by position
- CFO and CEO come from global position mapping
- only local steps `line_manager / reviewer / hod` may change order
- `cfo` and `ceo` stay at the end as conditional final approvals

### 4.1 Create Draft

Requester enters:

- header data
- detail lines
- attachment metadata

System result:

- business status = `draft`
- ERP sync status = `not_ready`

### 4.2 Submit

Requester submits the draft.

Submit is valid only when:

- the actor is the requester
- at least one detail line exists
- header total matches detail total
- required fields are present
- required attachment metadata is present

System result:

- resolve approver chain
- apply threshold rules
- apply deduplicate rule
- create workflow snapshot
- activate first pending step
- business status = `pending_approval`
- ERP sync status remains `not_ready`
- write audit log

### 4.3 Business Approval

The request moves through the configured chain:

- `Line Manager`
- `Reviewer`
- `HOD`
- `CFO` when threshold applies
- `CEO` when threshold applies

At every active step, the approver can:

- `Approve`
- `Reject`
- `Return`

#### Approve

System result:

- close current step
- move to next step
- if final step is done:
  - business status = `approved`
  - ERP sync status = `waiting_finance_release`

#### Return

System result:

- business status = `returned`
- approval stops
- requester can edit and resubmit

#### Reject

Reject is allowed at all approval steps.

Mandatory rule:

- reject must include a non-empty reason note
- reject without note is blocked in UI
- reject without note is blocked in API

System result:

- business status = `rejected`
- approval stops
- ERP sync status stays `not_ready`
- reject reason is stored in workflow step action note
- reject reason is stored in audit log

## 5. Finance Review Flow

Finance review starts only after business approval is complete.

Entry condition:

- business status = `approved`
- ERP sync status = `waiting_finance_release`

Finance must be able to inspect request detail before action.

### 5.1 Approve Only

Meaning:

- finance confirms the request package is acceptable
- ERP is not released yet

System result:

- ERP sync status = `hold_by_finance`
- request remains under finance control
- write audit log `finance_approve`

### 5.2 Approve & Release ERP

Meaning:

- finance approves the request and immediately releases it to ERP

System result:

- create integration job in the same transaction
- ERP sync status = `pending`
- write release audit log

### 5.3 Reject

Meaning:

- finance rejects the request after finance review
- the request is closed and will not proceed to ERP

Mandatory rule:

- finance reject must include a non-empty reason note

System result:

- business status = `rejected`
- ERP sync status = `not_ready`
- write audit log `finance_reject`
- store reject reason in audit note

### 5.4 Hold Sync

Meaning:

- finance blocks ERP release temporarily

System result:

- ERP sync status = `hold_by_finance`
- do not create integration job
- write hold audit log

## 6. ERP Processing Flow

After finance releases the request:

1. integration job is created
2. worker picks the job
3. ERP sync status becomes `processing`
4. worker pushes payload to ERP
5. worker updates result:
   - `success`
   - `failed`
   - or `manual_review_required`
6. worker writes ERP push log

Retry behavior:

- automatic retry for temporary failures
- manual retry for authorized finance/admin actors

## 7. Approval Chain Rules

### Threshold Rules

- `CFO` step is enabled when request total reaches CFO threshold
- `CEO` step is enabled when request total reaches CEO threshold

### Deduplicate Rules

If the same person appears in multiple steps:

- keep the highest-priority step
- lower duplicate steps are skipped

Priority:

- `CEO`
- `CFO`
- `HOD`
- `Reviewer`
- `Line Manager`

### Delegation Rules

Delegation changes only the acting approver.

Delegation does not change:

- workflow structure
- original approver ownership
- audit responsibility

## 8. Visibility Rules

Default visibility is `need-to-know`.

A user can view a request when at least one is true:

- user is the requester
- user is in the workflow chain
- user is the active delegate of the current approver
- user has finance scope and the request visibility allows it
- user is admin or auditor with broader visibility
- same-department visibility is enabled and the actor has the required permission

## 9. Mandatory Validation Rules

### Form

- at least one detail line
- valid total calculation
- required fields present
- required attachment metadata present before submit

### Action

- submit only by requester
- cancel only by requester in `draft` or `returned`
- approve only by current approver or valid delegate
- return only by current approver or valid delegate
- reject only by current approver or valid delegate
- reject requires note
- finance actions only by finance-scoped actors

## 10. Required Audit Coverage

The system must log:

- create request
- submit
- approve
- reject with reject reason
- return
- resubmit
- cancel
- finance approve
- release to ERP
- hold sync
- retry ERP job
- department approval setup changes
- global approver config changes
- master data changes

## 11. Acceptance Scenarios

### Requester

- create draft
- submit draft
- cancel draft
- resubmit returned request

### Approver

- approve at active step
- return at active step
- reject at active step
- reject without note is blocked
- reject with note succeeds
- finance reject without note is blocked
- finance reject with note succeeds

### Finance

- open detail from finance queue
- approve only
- reject with reason
- approve and release ERP
- hold sync
- retry failed ERP job

### Permission

- unrelated actor is blocked
- same-department actor is allowed only when configured
- auditor is view-only
- admin can manage setup

## 12. Current Test Accounts

- `requester1@example.com / 1234`
- `approver1@example.com / 1234`
- `financeops@example.com / 1234`
- `sysadmin@example.com / 1234`
- `auditor1@example.com / 1234`
