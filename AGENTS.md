# Repository guide

## Project overview

- This is a pnpm-based Next.js 16 App Router API written in strict TypeScript.
- Authentication uses Auth.js credentials with JWT sessions. Persistence uses Prisma 7 with PostgreSQL and `@prisma/adapter-pg`.
- The HTTP API uses JSON:API documents and the `application/vnd.api+json` media type.
- Use the `@/` alias for imports rooted at `src/`.

## Source layout and responsibilities

- `src/app/api/**/route.ts`: HTTP concerns, authentication/authorization, request parsing, response status, headers, links, and JSON:API documents.
- `src/auth/`: Auth.js configuration and route authorization. Session users carry `id`, `email`, and `role`.
- `src/schema/`: Zod schemas.
- `src/schema/entity-serializer.ts`: JSON:API request parsing, query validation, sparse fields, filters, sorting, pagination, and response serialization.
- `src/data/`: all user database operations, password hashing, DTO validation, stable query ordering, and cache invalidation after writes.
- `src/service/`: the shared services.
- `src/utils/`: the utilities.
- `prisma/schema.prisma`: the editable database schema. `src/generated/prisma/` is generated output; never edit it by hand. Run `pnpm build:prisma` after schema changes.

Keep route handlers thin and preserve these boundaries. Parse untrusted API and database data through the existing Zod/JSON:API helpers instead of casting it. Return errors through the shared response helpers so every response retains JSON:API shape and content type. Database writes that affect users must continue to invalidate the `users` cache tag.

## API behavior to preserve

- `POST /api/users` creates credential users and is intentionally public for the current test application.
- `GET /api/users` requires an authenticated administrator and supports the validated sparse-field, role-filter, multi-sort, and pagination options in `parseUsersListQuery`.
- `GET /api/user/[uid]` allows an administrator or the matching user.
- `PATCH /api/user/[uid]` allows users to update their own permitted fields; only administrators may change roles or update another user.
- `DELETE /api/user/[uid]` allows an administrator to delete another user, but not their own account.
- JSON:API resource type is `users`. PATCH document IDs must match the URL `uid`.

When changing permissions, validation, query behavior, serialization, response headers, or status codes, update both the isolated unit coverage and the HTTP smoke coverage.

## Local setup and commands

Use the development database described in `README.md`. The root `.env` must provide:

```bash
NAT_DATABASE_URL="postgres://${NAT_DB_USER}:${NAT_DB_PASSWORD}@localhost:${NAT_DB_PORT}/${NAT_DB_NAME}"
NAT_AUTH_SECRET=
```

The database container uses `scripts/dev-db/.env`. Typical setup and checks are:

```bash
docker compose -f scripts/dev-db/compose.yaml up -d
pnpm install
pnpm build:prisma
pnpm db:push
pnpm dev
pnpm lint
pnpm build
```

Do not commit secrets or real credentials from either `.env` file.

## Testing

### Unit tests

- Unit tests live under `test/unittest/**/*.test.ts` and run in Vitest's Node environment.
- They call route handlers directly with Web `Request` objects and mock Auth.js and `@/data/db-auth`; keep them isolated from PostgreSQL and the running Next.js server.
- Declare `vi.mock(...)` before importing the route module. Reset mocks between tests.
- Assert the status, JSON:API content type, body, important headers such as `Location`, dependency arguments, and that rejected requests do not reach data functions.

Run all unit tests or a focused file with:

```bash
pnpm test:unit
pnpm test:unit -- test/unittest/api/users/users-route.test.ts
pnpm test:coverage
```

### Smoke tests

- Smoke tests live under `test/smoke/**/*.smoke.spec.ts`. Playwright starts `pnpm dev`, sends real HTTP requests, uses Auth.js sign-in, and accesses the configured PostgreSQL database.
- This is an API-only Playwright project; no browser binary is required. It runs with one worker and is intentionally not fully parallel.
- Reuse helpers in `test/smoke/support/api.ts` for JSON:API requests, user creation, unique emails, and credential sign-in.
- Every smoke-created account must use a unique email ending in `@smoke.node-api-test.invalid` so global setup and teardown can remove it safely.

Never run smoke tests with `NAT_DATABASE_URL` pointing to production or any database whose matching smoke-domain users must be retained. Setup and teardown deliberately execute a database delete for the reserved email suffix.

Prepare the development database, then run:

```bash
docker compose -f scripts/dev-db/compose.yaml up -d
pnpm build:prisma
pnpm db:push
pnpm test:smoke
pnpm test:smoke:report
```

Do not edit or commit generated test output in `test/smoketest-results/`, `playwright-report/`, or `coverage/`.

## Completion checklist

- Add or update tests at the layer affected by the change; use both layers for externally visible API behavior.
- Run the narrowest relevant tests while iterating, then `pnpm test:unit` and `pnpm lint` before handoff.
- Run `pnpm test:smoke` for API, Auth.js, Prisma, or database integration changes when a safe development database is available.
- Run `pnpm build:prisma` after Prisma schema changes and `pnpm build` for Next.js configuration, routing, caching, or production-build-sensitive changes.
- Keep generated clients, reports, secrets, and unrelated user changes out of the patch.
