# Node API Test

## Architecture

- Next.js v16 and typescript
- auth.js
- prisma as ORM

## API

- `POST /api/users` creates credential users and is intentionally public for the current test application.
- `GET /api/users` allows an administrator to list credential users.
- `GET /api/user/[uid]` fetch user's own profile or allow an administrator to fetch another user's profile.
- `PATCH /api/user/[uid]` allows users to update their name fields; only administrators may change name and roles or update another user.
- `DELETE /api/user/[uid]` allows an administrator to delete another user, but not their own account.

## Source layout and responsibilities

- `src/app/api/**/route.ts`: HTTP concerns, authentication/authorization, request parsing, response status, headers, links, and JSON:API documents.
- `src/auth/`: Auth.js configuration and route authorization. Session users carry `id`, `email`, and `role`.
- `src/schema/`: Zod schemas.
- `src/schema/entity-serializer.ts`: JSON:API request parsing, query validation, sparse fields, filters, sorting, pagination, and response serialization.
- `src/data/`: all user database operations, password hashing, DTO validation, stable query ordering, and cache invalidation after writes.
- `src/service/`: the shared services.
- `src/utils/`: the utilities.
- `prisma/schema.prisma`: the editable database schema. `src/generated/prisma/` is generated output; never edit it by hand. Run `pnpm build:prisma` after schema changes.

## Running the project in development

### Prerequisites - setup db

- Create a `.env` file in the scripts/dev-db directory and add the following environment variables:

```bash
NAT_DB_USER=
NAT_DB_PASSWORD=
NAT_DB_NAME=
NAT_DB_PORT=
```

- Run docker-compose up -d to start the database container.

```bash
cd scripts/dev-db
docker compose up -d
cd ../..
```

- Run the following command to create a secret and use it in the .env file for the NAT_AUTH_SECRET variable

```bash
npx auth secret
```

- Create a .env file in the root directory and add the following environment variables:

```bash
NAT_DATABASE_URL="postgres://${NAT_DB_USER}:${NAT_DB_PASSWORD}@localhost:${NAT_DB_PORT}/${NAT_DB_NAME}"
NAT_AUTH_SECRET=
```

-- Prepare the database by running the following command:

```bash
pnpm install && pnpm build:prisma && pnpm db:push
```

### Run the project

Run the following command to start the project:

```bash
pnpm dev
```

## Testing

Run the isolated route-handler unit tests with Vitest:

```bash
pnpm test:unit
```

Run the Playwright API smoke suite against the real configured development database:

```bash
docker compose -f scripts/dev-db/compose.yaml up -d
pnpm build:prisma
pnpm db:push
pnpm test:smoke
```

Playwright starts the Next.js development server automatically, exercises the API over HTTP, authenticates through Auth.js, and cleans up accounts ending in `@smoke.node-api-test.invalid` before and after the run. The current API-only suite does not require Playwright browser binaries.

Do not run the smoke suite with `NAT_DATABASE_URL` pointing at a production database. The setup and teardown intentionally delete users in the reserved smoke-test email domain.

Run every automated suite or open the last HTML smoke report with:

```bash
pnpm test:smoke:report
```
