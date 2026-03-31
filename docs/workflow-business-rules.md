# Workflow Business Rules

## 1. Purpose

This document locks the current workflow business rules for the `Payment Request` module.

It is intended to:

- reduce ad-hoc workflow changes
- define the current MVP approval logic clearly
- distinguish what is already supported vs what is deferred
- guide future refactor work toward an org-chart-first model

## 2. Workflow Design Principle

The workflow must stay controlled, auditable, and predictable.

Current design principle:

- fixed payment workflow stages
- limited configuration only
- no free-form workflow builder
- no self-approval
- no hidden approver substitution

The system currently works as a controlled hybrid:

- `Line Manager` comes from user reporting data
- `Reviewer` and `HOD` come from department approval setup
- `CFO` and `CEO` come from global setup and thresholds

This hybrid model is the active MVP behavior.

The target direction for future refactor is:

- more `org-chart-first`
- cleaner organization setup
- less user-by-user workflow mapping

## 3. Current Workflow Stages

The current business approval flow is:

1. `Line Manager`
2. `Reviewer`
3. `HOD`
4. `CFO` when threshold applies
5. `CEO` when threshold applies

After business approval:

6. `Finance Review`
7. `ERP Processing`

Important distinction:

- `Finance Review` is not part of the business approval chain
- it is a post-approval control layer before ERP sync

## 4. Current Sources Of Approver Resolution

### 4.1 Line Manager

Resolved from the requester's user profile.

Source:

- `users.line_manager_id`

### 4.2 Reviewer

Resolved from department approval setup.

Current supported setup:

- direct user mapping per department

### 4.3 HOD

Resolved from department approval setup.

Current supported setup:

- direct user mapping per department

### 4.4 CFO / CEO

Resolved from global approver config.

Sources:

- `global_approver_config.cfo_user_id`
- `global_approver_config.ceo_user_id`
- threshold amounts

## 5. Current Mandatory Rules

### 5.1 No Self-Approval

The requester must never approve their own request.

Rule:

- if a resolved approver is the requester, that step is skipped

Examples:

- requester is the line manager -> skip `Line Manager`
- requester is the HOD -> skip `HOD`
- requester is the CFO -> skip `CFO`
- requester is the CEO -> skip `CEO`

### 5.2 Deduplicate Approvers

If the same person appears in more than one step:

- keep only the highest-priority step
- lower duplicated steps are skipped

Priority order:

1. `CEO`
2. `CFO`
3. `HOD`
4. `Reviewer`
5. `Line Manager`

### 5.3 Reject Requires Note

At every approval step:

- reject is allowed
- reject requires a non-empty reason note

The same rule applies to:

- business approvers
- finance review

### 5.4 Department-Derived Request Ownership

Requester department is derived from the user profile.

Rule:

- requester does not choose department manually on the request form

## 6. Reviewer Rule

`Reviewer` is currently treated as a configurable step.

Business interpretation:

- some departments may require reviewer
- some departments may not

Current MVP recommendation:

- reviewer may be omitted by setup
- if reviewer is not configured for a department, workflow can continue without it

This is preferred over forcing fake reviewer assignments.

## 7. Chain Resolution Failure Rule

If the system cannot resolve any valid approver chain after:

- applying current configuration
- applying self-approval skip
- applying deduplication

then the request must not be submitted.

System behavior:

- block submit
- return a business error
- user or admin must fix setup

Current rule:

- no automatic `N+2`
- no automatic escalation to upper manager
- no hidden fallback unless explicitly configured

## 8. Finance Review Rules

Finance review starts only when:

- business status = `approved`
- ERP sync status = `waiting_finance_release`

Finance actions:

- `Approve Only`
- `Reject`
- `Approve & Release ERP`
- `Hold Sync`

Rules:

- finance reject requires note
- finance must be able to open request detail before acting
- ERP readiness must pass before release

## 9. ERP Readiness Rules

Before `Approve & Release ERP`, the request should pass ERP readiness validation.

Current readiness areas:

- vendor exists and is active
- expense type exists and is active
- GL code exists and is active
- cost center exists and is active
- project exists and is active
- detail fields are structurally present

If readiness fails:

- do not release to ERP
- show the blocking issues clearly to finance

## 10. Line Manager Override Rule

Current supported override scope:

- requester may override only the `Line Manager` step before submit

Rules:

- requester sees backend-resolved default flow preview
- only `Line Manager` is editable
- reason is mandatory if override is used
- override candidate must be valid according to backend rule
- original line manager does not receive the request after override
- final workflow is decided by backend at submit time, not by UI alone

Not currently supported:

- override `Reviewer`
- override `HOD`
- override `CFO`
- override `CEO`
- reorder workflow freely

Returned request rule in current phase:

- if a request is returned, requester may edit business data and resubmit
- requester does not reopen or re-edit `Line Manager` override during resubmit from detail flow
- override remains a submit-time control on the create form only in this phase

## 11. Organization Chart Direction

The current system is not yet fully org-chart-first.

However, future direction is:

- clearer organization structure
- cleaner `reports to` chain
- more intuitive department ownership

Current stable baseline for workflow is still:

- hybrid approver resolution
- not full hierarchy traversal

Deferred for future phase:

- `N+2`
- manager-of-HOD escalation
- multi-level hierarchy traversal
- one-person-multi-department org graph semantics beyond direct department mapping

## 12. What We Explicitly Do Not Support In This Phase

The following are out of scope for the current MVP workflow:

- free-form workflow builder
- arbitrary step creation by admins
- free user override of any approver
- automatic `N+2` escalation
- implicit upper-manager escalation for HOD
- board-level or committee approvals
- attachment-level approval routing

## 13. Recommended Admin Setup Rules

To keep the system stable:

1. every requester should have a valid `line_manager_id`
2. every department should define whether `Reviewer` is used
3. every department should have a valid `HOD`
4. global `CFO` and `CEO` should always be configured
5. if a department intentionally has no reviewer, that must be reflected in setup rather than worked around manually

## 14. Recommended Next Refactor

The next refactor should happen in this order:

1. improve `Master Data` and `Organization Chart` UX
2. make organization ownership and reporting lines clearer
3. decide whether workflow remains hybrid or moves further toward org-chart-first
4. only then consider advanced hierarchy rules like `N+2`

This prevents the codebase from growing by exception-handling one workflow edge case at a time.
