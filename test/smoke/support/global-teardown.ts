import { cleanupSmokeUsers } from './database';

export default async function globalTeardown(): Promise<void> {
  await cleanupSmokeUsers();
}
