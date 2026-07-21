import { z } from 'zod';
import { EntitySerializer, SerializeBuilder } from '@jsonapi-serde/server/response';
import { createQueryParser, parseResourceRequest } from '@jsonapi-serde/server/request';
import { DtoUser } from '@/schema/db-schema';
import { CredentialCreationRequestSchema } from '@/schema/api-schema';

type ParseResourceRequestContext = Parameters<typeof parseResourceRequest>[0];

const userSerializer: EntitySerializer<DtoUser> = {
  getId: (user: DtoUser) => user.email,

  // The `serialize` method transforms a `DtoUser` object into a JSON API-compliant format. It includes the user's name, email, email verification status (formatted as an ISO string if present), and role. If the user's name is not available, it defaults to using the email as the name.
  serialize: (user: DtoUser) => ({
    attributes: {
      name: user.name ?? user.email,
      email: user.email,
      emailVerified: user.emailVerified ? user.emailVerified.toISOString() : null,
      role: user.role,
    },
  }),
};

export const serializeJsonApi = SerializeBuilder.new().add('users', userSerializer).build();

export const parseUserListQuery = createQueryParser({
  fields: {
    allowed: {
      users: ['name', 'role'],
    },
  },
});

export function parseUserModifyRequest(context: ParseResourceRequestContext) {
  return parseResourceRequest(context, {
    type: 'users',
    idSchema: z.email(),
    attributesSchema: z
      .object({
        name: z.string().min(4).optional(),
        role: z.enum(['USER', 'ADMIN']).optional(),
      })
      .refine((attributes) => attributes.name !== undefined || attributes.role !== undefined, {
        message: 'At least one attribute must be provided',
      }),
  });
}

export const parseUsersListQuery = createQueryParser({
  fields: {
    allowed: {
      users: ['name', 'role'],
    },
  },
  sort: {
    allowed: ['name', 'role', 'email', 'createdAt', 'updatedAt'],
  },
  filter: z
    .object({
      role: z.string().optional(),
    })
    .optional(),
  page: z
    .object({
      number: z.coerce.number().int().min(0).optional(),
      size: z.coerce.number().int().min(10).optional(),
    })
    .optional(),
});

export function parseUsersCreationRequest(context: ParseResourceRequestContext) {
  return parseResourceRequest(context, {
    type: 'users',
    idSchema: z.email(),
    attributesSchema: CredentialCreationRequestSchema,
  });
}
