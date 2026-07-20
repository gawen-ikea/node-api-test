import bcrypt from 'bcryptjs';
import { prisma } from '@/service/db-service';
import { DtoUser, DtoUserSchema } from '@/schema/db-schema';

export async function findDtoUserByEmail(email: string): Promise<DtoUser | null> {
  const dbUser = await prisma.user.findUnique({
    where: { email },
    include: {
      accounts: true,
    },
  });

  if (!dbUser) {
    return null;
  }

  const dtoUserValidation = DtoUserSchema.safeParse(dbUser);
  if (!dtoUserValidation.success) {
    console.error(`Error validating user data: ${dtoUserValidation.error}`);
    throw new Error('Invalid user data from database');
  }

  return dtoUserValidation.data;
}

export async function authorizeUserByEmailAndPassword(email: string, password: string): Promise<DtoUser | null> {
  const dbUser = await prisma.user.findUnique({
    where: { email },
    include: {
      accounts: true,
    },
  });
  if (!dbUser) {
    return null;
  }

  if (!dbUser.password) {
    // User does not allow password authentication (e.g., OAuth-only user)
    return null;
  }

  const passworMatch = await bcrypt.compare(password, dbUser.password);
  if (!passworMatch) {
    return null;
  }

  return findDtoUserByEmail(email);
}

export async function deleteUserByEmail(email: string): Promise<void> {
  await prisma.user.delete({
    where: { email },
  });
}
