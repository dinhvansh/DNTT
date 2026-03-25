# Handover

## Mục tiêu dự án

Repo này đang chuyển từ prototype Firebase sang kiến trúc:

- `web`: React/Vite
- `api`: Node business API
- `worker`: ERP integration worker
- `postgres`: source of truth
- `redis`: queue coordination
- `minio`: object storage
- `docker-compose`: môi trường dev/UAT local

Phạm vi hiện tại bám theo:

- [tai_lieu_giai_phap_payment_request_eoffice.md](../tai_lieu_giai_phap_payment_request_eoffice.md)
- [development-plan.md](./development-plan.md)

## Trạng thái hiện tại

Đã làm xong phần lớn của Phase 1 đến Phase 4:

- local auth để test nhanh, bỏ chốt Google sign-in cũ
- create draft request
- save header, detail, attachment metadata
- submit request
- approve / reject / return / resubmit / cancel
- workflow chain:
  - `Line Manager -> Reviewer -> HOD -> CFO -> CEO`
- deduplicate approver
- delegation trong validity window
- record-level visibility theo `need-to-know`
- finance release queue
- `Release to ERP`
- `Hold Sync`
- integration jobs + ERP logs + manual retry
- worker retry policy
- approval setup thật:
  - tạo department
  - set reviewer / HOD / fallback
  - set global CFO / CEO + threshold

## Những phần còn dở

Theo plan, phần đáng làm tiếp theo:

1. `Complete test matrix for same department, cross department, delegated approver, finance operations, admin, auditor`
2. `Full audit coverage`
3. `Reconcile job`
4. `Backup and restore PostgreSQL`
5. `Docker image build for UAT and production`

Ngoài ra còn các phần nghiệp vụ nâng cao chưa làm:

- upload binary attachment thật lên MinIO
- attachment-level visibility
- field masking
- template config nâng cao
- master data thật cho user/department quản trị đầy đủ

## Cấu trúc repo

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

## Cách chạy local

```bash
docker compose up -d
```

Service:

- web: `http://localhost:3000`
- api: `http://localhost:8080`
- postgres: `localhost:5432`
- redis: `localhost:6379`
- minio api: `http://localhost:9000`
- minio console: `http://localhost:9001`

Nếu muốn reload sạch web/api:

```bash
docker compose up -d --force-recreate web api
```

## Tài khoản test

- `requester1@example.com / 1234`
- `approver1@example.com / 1234`
- `financeops@example.com / 1234`
- `sysadmin@example.com / 1234`

`sysadmin` có quyền `manage_department_setup`.

## Lệnh test quan trọng

Backend:

```bash
node --test api/tests/*.mjs
```

Worker:

```bash
node --test worker/tests/*.mjs
```

Frontend lint/build:

```bash
npm run lint
npm run build
```

## Các file quan trọng

### Backend

- [api/src/server.mjs](../api/src/server.mjs)
  API routes chính
- [api/src/security/authorization.mjs](../api/src/security/authorization.mjs)
  rule permission và visibility
- [api/src/data/postgresRepository.mjs](../api/src/data/postgresRepository.mjs)
  business persistence thật trên PostgreSQL
- [api/src/data/fixtureRepository.mjs](../api/src/data/fixtureRepository.mjs)
  fixture mode cho test route
- [db/init/001_core.sql](../db/init/001_core.sql)
  schema
- [db/init/002_seed.sql](../db/init/002_seed.sql)
  seed data và role permissions

### Frontend

- [web/src/AuthProvider.tsx](../web/src/AuthProvider.tsx)
  local auth test flow
- [web/src/api/paymentRequests.ts](../web/src/api/paymentRequests.ts)
  client cho request/approval/ERP
- [web/src/api/approvalSetup.ts](../web/src/api/approvalSetup.ts)
  client cho approval setup
- [web/src/ApprovalSetup.tsx](../web/src/ApprovalSetup.tsx)
  màn hình approval setup thật
- [web/src/CreatePaymentRequest.tsx](../web/src/CreatePaymentRequest.tsx)
  create draft + submit
- [web/src/PaymentRequestDetail.tsx](../web/src/PaymentRequestDetail.tsx)
  detail actions
- [web/src/ERPIntegrationLog.tsx](../web/src/ERPIntegrationLog.tsx)
  finance release / retry

### Worker

- [worker/src/worker.mjs](../worker/src/worker.mjs)
  polling + process ERP jobs
- [worker/src/policy.mjs](../worker/src/policy.mjs)
  retry policy

## Những chỗ dễ vỡ

### 1. Permission

Đây là vùng rủi ro cao nhất. Mọi thay đổi permission cần:

- happy-path test
- access denied test
- wrong-role test
- same-department test nếu liên quan
- delegated test nếu liên quan

### 2. Approval Setup

`ApprovalSetup.tsx` từng bị nháy liên tục do `actorContext` bị tạo mới mỗi render. Hiện đã fix bằng `useMemo`.

Nếu màn này lại có dấu hiệu reload vô hạn, kiểm tra trước:

- dependency array của `useEffect`
- object/function có bị tạo mới mỗi render không
- state có đang reset vòng lặp không

### 3. PostgreSQL runtime vs fixture mode

Test route mặc định đang pass trên fixture mode, nhưng smoke test runtime cần kiểm riêng trên Docker/PostgreSQL.

Đừng chỉ tin test fixture nếu đổi query SQL hoặc persistence flow.

### 4. Department approval setup

Bảng `department_approval_setup` hiện không có unique key trên `department_id`, nên repository đang làm `select existing -> update/insert` thay vì `ON CONFLICT (department_id)`.

Nếu sau này muốn cleanup, có thể:

- thêm unique constraint phù hợp
- viết migration rõ ràng
- rồi mới đổi code sang upsert chuẩn

## Smoke test nên chạy sau mỗi nhịp lớn

1. đăng nhập `requester1`
2. tạo request draft
3. submit
4. đăng nhập approver để approve
5. đi hết chain cho request lớn nếu sửa workflow logic
6. đăng nhập `financeops` để release/hold/retry nếu sửa ERP path
7. đăng nhập `sysadmin` để kiểm tra `Approval Setup` nếu sửa config path

## Thứ tự nên làm tiếp

Khuyến nghị cho người tiếp theo:

1. hoàn tất `Permission Test Matrix` còn thiếu, nhất là `auditor`
2. phủ `audit_logs` cho các config action còn thiếu
3. làm `reconcile job`
4. làm `Master Data` thật cho user/department nếu muốn bỏ seed-config thủ công
5. sau đó mới mở rộng template/attachment upload

## Git / nhánh

Lần bàn giao này code đã được push lên:

- `origin/main`
- `origin/master`

README đã được viết lại ở commit gần nhất cùng với handover này.

