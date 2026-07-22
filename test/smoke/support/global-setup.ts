import { cleanupSmokeUsers } from './database';

export default async function globalSetup(): Promise<void> {
  await cleanupSmokeUsers();
}
