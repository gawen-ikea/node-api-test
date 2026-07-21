import bcrypt from 'bcryptjs';
import { cacheLife, cacheTag, revalidateTag } from 'next/cache';

import type { CredentialCreationRequest } from '@/schema/api-schema';
import { prisma } from '@/service/db-service';
import { DtoUser, DtoUserSchema } from '@/schema/db-schema';
import { customAlphabet } from 'nanoid';

const SETTING_PASSWORD_SALT_ROUNDS = 12;

const CACHE_TAG_USERS = 'users';

const credentialUserIdGenerator = customAlphabet('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 12);

function parseDtoUser(dbUser: unknown): DtoUser {
  const dtoUserValidation = DtoUserSchema.safeParse(dbUser);
  if (!dtoUserValidation.success) {
    console.error(`Error validating user data: ${dtoUserValidation.error}`);
    throw new Error('Invalid user data from database');
  }

  return dtoUserValidation.data;
}

export async function listAllDtoUsers(): Promise<DtoUser[]> {
  'use cache';
  cacheLife({ stale: 60 });
  cacheTag(CACHE_TAG_USERS);
  const dbUsers = await prisma.user.findMany({
    include: {
      accounts: true,
    },
  });

  return dbUsers.map(parseDtoUser);
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
  const password = await bcrypt.hash(request.password, SETTING_PASSWORD_SALT_ROUNDS);
  const uid = credentialUserIdGenerator();
  const dbUser = await prisma.user.create({
    data: {
      id: uid,
      email: request.email,
      name: request.name,
      password,
      role: request.role,
    },
  });
  revalidateTag(CACHE_TAG_USERS, 'max');

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

export async function findDtoUserById(id: string): Promise<DtoUser | null> {
  const dbUser = await prisma.user.findFirst({
    where: { id },
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

  const passwordMatch = await bcrypt.compare(password, dbUser.password);
  if (!passwordMatch) {
    return null;
  }

  return findDtoUserByEmail(email);
}

export async function deleteUserByEmail(email: string): Promise<void> {
  await prisma.user.delete({
    where: { email },
  });
  revalidateTag(CACHE_TAG_USERS, 'max');
}

export async function deleteUserById(uid: string): Promise<void> {
  await prisma.user.delete({
    where: { id: uid },
  });
  revalidateTag(CACHE_TAG_USERS, 'max');
}

export async function modifyUserByEmail(
  email: string,
  updates: Partial<Pick<DtoUser, 'name' | 'role'>>,
): Promise<DtoUser | null> {
  const { name, role } = updates;
  if (name === undefined && role === undefined) {
    throw new Error('At least one attribute must be provided for update');
  }

  const newUser = await prisma.user.update({
    where: {
      email,
    },
    data: {
      ...updates,
    },
  });
  revalidateTag(CACHE_TAG_USERS, 'max');
  return parseDtoUser(newUser);
}

export async function modifyUserById(
  uid: string,
  updates: Partial<Pick<DtoUser, 'name' | 'role'>>,
): Promise<DtoUser | null> {
  const { name, role } = updates;
  if (name === undefined && role === undefined) {
    throw new Error('At least one attribute must be provided for update');
  }

  const newUser = await prisma.user.update({
    where: {
      id: uid,
    },
    data: {
      ...updates,
    },
  });
  revalidateTag(CACHE_TAG_USERS, 'max');
  return parseDtoUser(newUser);
}
