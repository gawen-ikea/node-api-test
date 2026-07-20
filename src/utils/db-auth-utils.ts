import bcrypt from 'bcryptjs';
import type { CredentialCreationRequest } from '@/schema/api-schema';
import { prisma } from '@/service/db-service';
import { DtoUser, DtoUserSchema } from '@/schema/db-schema';

function parseDtoUser(dbUser: unknown): DtoUser {
  const dtoUserValidation = DtoUserSchema.safeParse(dbUser);
  if (!dtoUserValidation.success) {
    console.error(`Error validating user data: ${dtoUserValidation.error}`);
    throw new Error('Invalid user data from database');
  }

  return dtoUserValidation.data;
}

export async function findDtoUsers(): Promise<DtoUser[]> {
  const dbUsers = await prisma.user.findMany({
    include: {
      accounts: true,
    },
  });

  return dbUsers.map(parseDtoUser);
}

export async function createDtoUser(request: CredentialCreationRequest): Promise<DtoUser> {
  const password = await bcrypt.hash(request.password, 12);
  const dbUser = await prisma.user.create({
    data: {
      email: request.email,
      name: request.name,
      password,
      role: request.role,
    },
    include: {
      accounts: true,
    },
  });

  return parseDtoUser(dbUser);
}

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

  return parseDtoUser(dbUser);
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
