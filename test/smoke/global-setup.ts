import { cleanupSmokeUsers } from './support/database';

export default async function globalSetup(): Promise<void> {
  await cleanupSmokeUsers();
}
