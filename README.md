# ERP SaaS Monorepo

Multi-tenant ERP SaaS for KSA SMBs.

## Stack
- **apps/web** — Next.js 14 (App Router) + Tailwind
- **apps/api** — NestJS 10 + Prisma + Passport JWT
- **packages/shared-types** — Zod-based DTO/contract package
- **PostgreSQL** (schema-per-tenant) + **Redis** (placeholder)
- **pnpm workspaces** + **Turborepo**

## Layout
```
.
├── apps/
│   ├── api/        # NestJS API
│   └── web/        # Next.js frontend
├── packages/
│   └── shared-types/
├── docker-compose.yml
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

## Quickstart

```bash
# 1. Install
corepack enable
pnpm install

# 2. Start Postgres + Redis
docker compose up -d

# 3. Migrate the public schema (creates users / tenants / tenant_members)
pnpm db:push

# 4. Run everything
pnpm dev
# - API:  http://localhost:4000/api
# - Web:  http://localhost:3000
```

## What's in this MVP
1. **JWT auth** — `POST /api/auth/signup`, `POST /api/auth/login`, `GET /api/auth/me`
2. **Tenant created on signup** — slug + dedicated Postgres schema (`tenant_<slug>`) provisioned automatically
3. **AsyncLocalStorage tenant context** — JWT → middleware → ALS → Prisma can switch `search_path` per request via `prisma.withTenantSchema(...)`
4. **Prisma** — `public` schema models for platform tables; per-tenant schemas created by `TenantProvisionerService`
5. **Frontend** — Next 14 login + signup + dashboard wired to the API

## Endpoints
| Method | Path | Auth |
|---|---|---|
| POST | `/api/auth/signup` | — |
| POST | `/api/auth/login` | — |
| GET  | `/api/auth/me` | Bearer |
| GET  | `/api/health` | — |

## Adding tenant-scoped queries (next step)
```ts
// inside any service
await this.prisma.withTenantSchema(async (tx) => {
  return tx.$queryRawUnsafe(`SELECT * FROM "_meta"`);
});
```
`withTenantSchema` reads the schema from `TenantContextService` (ALS) and
sets `SET LOCAL search_path` inside a transaction — fully isolated per request.

## Add a new business module
Create `apps/api/src/modules/<name>/` with `controller.ts` + `service.ts` +
`module.ts`, register it in `app.module.ts`, and use `prisma.withTenantSchema`
for all per-tenant data access. Add migrations to a per-tenant migration
runner (TODO for Phase 2).
