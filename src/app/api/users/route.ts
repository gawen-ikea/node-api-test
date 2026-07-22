import { auth } from '@/auth/auth-core';
import { JsonApiError } from '@jsonapi-serde/server/common';
import { getAcceptableMediaTypes } from '@jsonapi-serde/server/http';

import { parseUsersCreationRequest, parseUsersListQuery, serializeJsonApi } from '@/schema/entity-serializer';
import { countDtoUsers, createDtoUser, findDtoUserByEmail, findDtoUsers } from '@/data/db-auth';
import { apiJsonDocumentResponse, apiJsonErrorResponse, standardErrorResponse } from '@/utils/api-utils';

function getPageUrl(requestUrl: string, pageNumber: number, pageSize: number): string {
  const url = new URL(requestUrl);
  url.searchParams.set('page[number]', `${pageNumber}`);
  url.searchParams.set('page[size]', `${pageSize}`);
  return url.toString();
}

/**
 * Get the collection of users.
 */
export async function GET(request: Request) {
  try {
    getAcceptableMediaTypes(request.headers.get('accept') ?? '');
    const curSession = await auth();
    const currentUser = curSession?.user;
    if (!currentUser) {
      return apiJsonErrorResponse(
        new JsonApiError({
          status: '401',
          code: 'unauthorized',
          title: 'Unauthorized',
          detail: 'You are not authorized to access this resource',
        }),
      );
    }

    if (currentUser.role !== 'ADMIN') {
      return apiJsonErrorResponse(
        new JsonApiError({
          status: '403',
          code: 'forbidden',
          title: 'Forbidden',
          detail: 'You do not have permission to access this resource',
        }),
      );
    }

    const query = parseUsersListQuery(new URL(request.url).searchParams);
    const users = await findDtoUsers({
      filter: query.filter,
      sort: query.sort,
      page: query.page,
    });
    const total = await countDtoUsers({
      filter: query.filter,
    });
    const totalPages = Math.ceil(total / query.page.size);
    const lastPage = Math.max(totalPages, 1);
    const document = serializeJsonApi('users', users, {
      fields: query.fields,
      links: {
        self: request.url,
        first: getPageUrl(request.url, 1, query.page.size),
        last: getPageUrl(request.url, lastPage, query.page.size),
        prev: query.page.number > 1 ? getPageUrl(request.url, query.page.number - 1, query.page.size) : null,
        next: query.page.number < totalPages ? getPageUrl(request.url, query.page.number + 1, query.page.size) : null,
      },
      meta: {
        page: {
          number: query.page.number,
          size: query.page.size,
          total,
          totalPages,
        },
      },
    });

    return apiJsonDocumentResponse(document);
  } catch (error: unknown) {
    return standardErrorResponse(error);
  }
}

/**
 * Create a credential user.
 * Testing purpose: I make this API as public for now, but in production, it should be protected by admin role.
 */
export async function POST(request: Request) {
  try {
    getAcceptableMediaTypes(request.headers.get('accept') ?? '');
    const body = await request.text();

    const creationRequest = parseUsersCreationRequest({
      body,
      contentType: request.headers.get('Content-Type') ?? undefined,
    });

    /*
     * Check the existing user
     */
    const existingUser = await findDtoUserByEmail(creationRequest.attributes.email);
    if (existingUser) {
      return apiJsonErrorResponse(
        new JsonApiError({
          status: '409',
          code: 'user_already_exists',
          title: 'User already exists',
          detail: 'A user with this email already exists',
          source: { pointer: '/data/attributes/email' },
        }),
      );
    }

    const createdUser = await createDtoUser(creationRequest.attributes);
    const userUrl = new URL(`/api/user/${encodeURIComponent(createdUser.id)}`, request.url).toString();
    const document = serializeJsonApi('users', createdUser, {
      status: 201,
      links: {
        self: userUrl,
      },
    });

    return apiJsonDocumentResponse(document, { Location: userUrl });
  } catch (error: unknown) {
    return standardErrorResponse(error);
  }
}
