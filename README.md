# DNTT Payment Request Workspace

Workspace này triển khai module `Payment Request` theo hướng:

- `web`: React + Vite
- `api`: Node.js business API
- `worker`: background worker cho ERP integration
- `postgres`: dữ liệu nghiệp vụ
- `redis`: queue coordination
- `minio`: object storage cho attachment
- `docker-compose`: môi trường dev/UAT cục bộ

Hệ thống đang bám theo tài liệu nghiệp vụ ở [tai_lieu_giai_phap_payment_request_eoffice.md](./tai_lieu_giai_phap_payment_request_eoffice.md) và tiến độ kỹ thuật ở [docs/development-plan.md](./docs/development-plan.md).

## Cấu trúc repo

```text
.
|-- api/        # API, authorization, workflow, tests
|-- db/         # schema + seed PostgreSQL
|-- docs/       # development plan
|-- web/        # React frontend
|-- worker/     # ERP worker + retry policy
|-- docker-compose.yml
`-- README.md
```

## Trạng thái hiện tại

Đã có:

- local sign in / register để test nhanh
- tạo draft payment request
- submit request
- approve / reject / return / resubmit / cancel
- workflow cố định `Line Manager -> Reviewer -> HOD -> CFO -> CEO`
- deduplicate approver
- delegation trong validity window
- visibility record-level theo `need-to-know`
- finance release queue
- `Release to ERP` / `Hold Sync`
- ERP job list + manual retry
- worker auto retry policy
- approval setup thật:
  - tạo phòng ban
  - set reviewer / HOD / fallback theo phòng ban
  - set global CFO / CEO + threshold

Chưa hoàn tất:

- upload binary thật lên MinIO
- full audit coverage
- reconcile job
- backup / restore
- hardening production

## Yêu cầu môi trường

- Docker Desktop
- Node.js 22+ nếu muốn chạy lệnh ngoài container

## Chạy nhanh bằng Docker

```bash
docker compose up -d
```

Các service mặc định:

- Web: `http://localhost:3000`
- API: `http://localhost:8080`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`
- MinIO API: `http://localhost:9000`
- MinIO Console: `http://localhost:9001`

Nếu cần recreate sạch web/api:

```bash
docker compose up -d --force-recreate web api
```

## Tài khoản test

- `requester1@example.com / 1234`
- `approver1@example.com / 1234`
- `financeops@example.com / 1234`
- `sysadmin@example.com / 1234`

`sysadmin` có quyền vào `Approval Setup`.

## Luồng test nhanh

### 1. Request flow

1. Đăng nhập `requester1@example.com`
2. Vào `Payment Requests` hoặc `New Request`
3. Tạo request và `Save Draft`
4. Mở detail và `Submit`

### 2. Approval flow

1. Đăng nhập approver phù hợp
2. Vào `My Approvals`
3. Thử `Approve`, `Reject`, hoặc `Return`

### 3. Finance / ERP flow

1. Sau final approval, request sang `Waiting Finance Release`
2. Đăng nhập `financeops@example.com`
3. Vào `ERP Integration Log`
4. Thử `Release to ERP`, `Hold Sync`, `Retry`

### 4. Approval setup flow

1. Đăng nhập `sysadmin@example.com`
2. Vào `Approval Setup`
3. Tạo department mới nếu cần
4. Chọn reviewer / HOD / fallback
5. Set global CFO / CEO threshold

## Env templates

- root [.env.example](./.env.example): override cho Docker
- [web/.env.example](./web/.env.example): env cho frontend
- [api/.env.example](./api/.env.example): env cho API
- [worker/.env.example](./worker/.env.example): env cho worker

## Lệnh hữu ích

```bash
npm run lint
npm run build
npm run api:test
npm run worker:test
```

## Test đã dùng thường xuyên

```bash
node --test api/tests/*.mjs
node --test worker/tests/*.mjs
```

Các test đang tập trung mạnh vào:

- permission âm / dương
- visibility theo role và department
- delegated approver
- finance release / retry
- workflow chain
- approval setup APIs

## Một số quyết định kiến trúc

- frontend không ghi trực tiếp dữ liệu nghiệp vụ nhạy cảm
- business status tách riêng ERP sync status
- ERP chỉ tạo job sau `Release to ERP`
- workflow là khung cố định, không có builder tự do ở phase hiện tại
- approval config theo phòng ban, không tạo flow riêng cho từng phòng ban

## Tài liệu liên quan

- nghiệp vụ: [tai_lieu_giai_phap_payment_request_eoffice.md](./tai_lieu_giai_phap_payment_request_eoffice.md)
- tiến độ triển khai: [docs/development-plan.md](./docs/development-plan.md)

