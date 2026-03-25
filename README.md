<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Payment Request Workspace

This repository is now split by runtime responsibility:

- `web/`: React/Vite frontend
- `api/`: business API
- `worker/`: ERP integration worker
- `db/`: PostgreSQL schema and seed scripts
- `docs/`: delivery plan and notes

## Env Templates

- Root `.env.example`: Docker orchestration overrides only
- `web/.env.example`: frontend runtime
- `api/.env.example`: API runtime
- `worker/.env.example`: worker runtime

## Run Locally

**Prerequisites:** Node.js and Docker

1. Start the full stack:
   `docker compose up -d`
2. Open the frontend:
   `http://localhost:3000`
3. Demo login:
   `sysadmin@example.com / 1234`

## Current Attachment Scope

- Request create flow now persists attachment metadata with each payment request.
- Binary upload to MinIO is still pending. This phase stores file name, type, path hint, and size for review and audit.

## Useful Commands

- Frontend lint:
  `npm run lint`
- Frontend build:
  `npm run build`
- API tests:
  `npm run api:test`
- Worker tests:
  `npm run worker:test`
