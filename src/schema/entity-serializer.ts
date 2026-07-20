import { DtoUser } from '@/schema/db-schema';
import { EntitySerializer, SerializeBuilder } from '@jsonapi-serde/server/response';
import { createQueryParser } from '@jsonapi-serde/server/request';

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

// const userQueryParser = createQueryParser({
//
// });
