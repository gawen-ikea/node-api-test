import { z } from 'zod';

export const CredentialAuthorizeRequestSchema = z.object({
  email: z.email(),
  password: z.string(),
});

export type CredentialAuthorizeRequest = z.infer<typeof CredentialAuthorizeRequestSchema>;

export const CredentialCreationRequestSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
  name: z.string().min(4),
  role: z.enum(['USER', 'ADMIN']),
});

export type CredentialCreationRequest = z.infer<typeof CredentialCreationRequestSchema>;

export const CredentialUpdateRequestSchema = z
  .object({
    name: z.string().min(4).optional(),
    role: z.enum(['USER', 'ADMIN']).optional(),
  })
  .refine((attributes) => attributes.name !== undefined || attributes.role !== undefined, {
    message: 'At least one attribute must be provided',
  });
export type CredentialUpdateRequest = z.infer<typeof CredentialUpdateRequestSchema>;
