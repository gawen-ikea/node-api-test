import { z } from 'zod';

export const DtoAccountSchema = z.object({
  userId: z.string(),
  type: z.string(),
  provider: z.string(),
  providerAccountId: z.string(),
  expiresAt: z.number().nullish(),
  tokenType: z.string().nullish(),
  scope: z.string().nullish(),
  idToken: z.string().nullish(),
  sessionState: z.string().nullish(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type DtoAccount = z.infer<typeof DtoAccountSchema>;

export const DtoUserSchema = z.object({
  id: z.string(),
  name: z.string().min(1).nullish(),
  email: z.email(),
  emailVerified: z.date().nullish(),
  role: z.enum(['USER', 'ADMIN']),
  image: z.string().nullish(),
  createdAt: z.date(),
  updatedAt: z.date(),
  accounts: z.array(DtoAccountSchema).nullish(),
});
export type DtoUser = z.infer<typeof DtoUserSchema>;
