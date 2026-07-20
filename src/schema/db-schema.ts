import {z} from "zod";

export const DtoAccountSchema = z.object({
  userId: z.string(),
  type: z.string(),
  provider: z.string(),
  providerAccountId: z.string(),
  expiresAt: z.number().optional(),
  tokenType: z.string().optional(),
  scope: z.string().optional(),
  idToken: z.string().optional(),
  sessionState: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type DtoAccount = z.infer<typeof DtoAccountSchema>;

export const DtoUserSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  email: z.string().email(),
  emailVerified: z.date().optional(),
  role: z.enum(["USER", "ADMIN"]),
  image: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  accounts: z.array(DtoAccountSchema),
});
export type DtoUser = z.infer<typeof DtoUserSchema>;
