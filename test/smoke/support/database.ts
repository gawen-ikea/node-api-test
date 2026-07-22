import 'dotenv/config';

import { Client } from 'pg';

export const SMOKE_EMAIL_DOMAIN = '@smoke.node-api-test.invalid';

export async function cleanupSmokeUsers(): Promise<void> {
  const connectionString = process.env.NAT_DATABASE_URL;
  if (!connectionString) {
    throw new Error('NAT_DATABASE_URL is required to clean up Playwright smoke-test users');
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    await client.query('DELETE FROM "users" WHERE RIGHT("email", LENGTH($1)) = $1', [SMOKE_EMAIL_DOMAIN]);
  } finally {
    await client.end();
  }
}
