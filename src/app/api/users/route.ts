import { auth } from '@/auth/auth-core';
import { Prisma } from '@/generated/prisma/client';
import { CredentialCreationRequestSchema } from '@/schema/api-schema';
import { parseUserQuery, serializeJsonApi } from '@/schema/entity-serializer';
import { createDtoUser, findDtoUsers } from '@/utils/db-auth-utils';
import { acceptsJsonApi, errorMessage, jsonApiDocumentResponse, restErrorResponse } from '@/utils/api-utils';
import { JsonApiError } from '@jsonapi-serde/server/common';
import { parseResourceRequest } from '@jsonapi-serde/server/request';
import { nanoid } from 'nanoid';

/**
 * Get the collection of users.
 */
export async function GET(request: Request) {
  if (!acceptsJsonApi(request)) {
    return restErrorResponse(406);
  }

  const curSession = await auth();
  const curUser = curSession?.user;
  if (!curUser) {
    return restErrorResponse(401);
  }

  if (curUser.role !== 'ADMIN') {
    return restErrorResponse(403);
  }

  try {
    const query = parseUserQuery(new URL(request.url).searchParams);
    const users = await findDtoUsers();
    const document = serializeJsonApi('users', users, {
      fields: query.fields,
      links: {
        self: request.url,
      },
    });

    return jsonApiDocumentResponse(document);
  } catch (error: unknown) {
    if (error instanceof JsonApiError) {
      return jsonApiDocumentResponse(error.toDocument());
    }

    const errorId = nanoid();
    console.error(`error[${errorId}] Error fetching users: ${errorMessage(error)}`);
    return restErrorResponse(500, { detail: `errorId: ${errorId}` });
  }
}

/**
 * Create a credential user.
 */
export async function POST(request: Request) {
  if (!acceptsJsonApi(request)) {
    return restErrorResponse(406);
  }

  const curSession = await auth();
  const curUser = curSession?.user;
  if (!curUser) {
    return restErrorResponse(401);
  }

  if (curUser.role !== 'ADMIN') {
    return restErrorResponse(403);
  }

  try {
    const resource = parseResourceRequest(
      {
        body: await request.text(),
        contentType: request.headers.get('Content-Type') ?? undefined,
      },
      {
        type: 'users',
        attributesSchema: CredentialCreationRequestSchema,
      },
    );
    const createdUser = await createDtoUser(resource.attributes);
    const userUrl = new URL(`/api/users/${encodeURIComponent(createdUser.email)}`, request.url).toString();
    const document = serializeJsonApi('users', createdUser, {
      status: 201,
      links: {
        self: userUrl,
      },
    });

    return jsonApiDocumentResponse(document, { Location: userUrl });
  } catch (error: unknown) {
    if (error instanceof JsonApiError) {
      return jsonApiDocumentResponse(error.toDocument());
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return jsonApiDocumentResponse(
        new JsonApiError({
          status: '409',
          code: 'user_already_exists',
          title: 'User already exists',
          detail: 'A user with this email already exists',
          source: { pointer: '/data/attributes/email' },
        }).toDocument(),
      );
    }

    const errorId = nanoid();
    console.error(`error[${errorId}] Error creating user: ${errorMessage(error)}`);
    return restErrorResponse(500, { detail: `errorId: ${errorId}` });
  }
}
