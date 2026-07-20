# Node API Test

## Architecture

- Next.js v16 and typescript
- auth.js
- prisma as ORM

## Running the project

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

- Run the following command to start the project:

```bash
pnpm dev
```
