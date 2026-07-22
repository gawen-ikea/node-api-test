import { cleanupSmokeUsers } from './support/database';

export default async function globalTeardown(): Promise<void> {
  await cleanupSmokeUsers();
}
