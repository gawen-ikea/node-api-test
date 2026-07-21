import { z } from 'zod';
import { EntitySerializer, SerializeBuilder } from '@jsonapi-serde/server/response';
import { createQueryParser, parseResourceRequest } from '@jsonapi-serde/server/request';
import { DtoUser } from '@/schema/db-schema';
import { CredentialCreationRequestSchema, CredentialUpdateRequestSchema } from '@/schema/api-schema';

type ParseResourceRequestContext = Parameters<typeof parseResourceRequest>[0];

const userSerializer: EntitySerializer<DtoUser> = {
  getId: (user: DtoUser) => user.id,

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
    idSchema: z.string(),
    attributesSchema: CredentialUpdateRequestSchema,
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
    attributesSchema: CredentialCreationRequestSchema,
  });
}
