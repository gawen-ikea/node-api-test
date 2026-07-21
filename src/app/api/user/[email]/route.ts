import { nanoid } from 'nanoid';
import { JsonApiError } from '@jsonapi-serde/server/common';

import { auth, ExtendedSessionUser } from '@/auth/auth-core';
import {
  apiJsonErrorResponse,
  apiJsonDocumentResponse,
  errorMessage,
  restJsonErrorResponse,
  restSuccessResponse,
} from '@/utils/api-utils';
import { deleteUserByEmail, findDtoUserByEmail } from '@/data/db-auth';
import { serializeJsonApi } from '@/schema/entity-serializer';

type UserRouteParams = {
  request: Request;
  params: Promise<{ email: string }>;
  routeFunc: (params: {
    currentUser: ExtendedSessionUser | null | undefined;
    request: Request;
    email: string;
  }) => Promise<Response>;
};

export async function userRouteHandler({ request, params, routeFunc }: UserRouteParams): Promise<Response> {
  const { email } = await params;

  // Validate JSON:API acceptance
  if (!request.headers.get('Accept')?.includes('application/vnd.api+json')) {
    return restJsonErrorResponse(406, { code: 'not_acceptable', title: 'Not Acceptable' });
  }

  try {
    const curSession = await auth();
    const curUser = curSession?.user;

    return await routeFunc({ currentUser: curUser, request, email });
  } catch (error: unknown) {
    if (error instanceof Error || error instanceof JsonApiError) {
      return apiJsonErrorResponse(error as Error | JsonApiError);
    } else {
      const errorId = nanoid();
      console.error(`error[${errorId}] Unexpected error during authentication: ${errorMessage(error)}`);
      return apiJsonErrorResponse(new Error('Unexpected error during authentication'), {
        status: 500,
        detail: `errorId: ${errorId}`,
      });
    }
  }
}

/**
 * Get the profile of a user by email.
 * @param params
 * @returns
 */
async function getUserProfileRouteHandler(params: {
  currentUser: ExtendedSessionUser | null | undefined;
  request: Request;
  email: string;
}) {
  const { currentUser, request, email } = params;
  if (!currentUser) {
    return apiJsonErrorResponse(
      new JsonApiError({
        status: '401',
        code: 'unauthorized',
        title: 'Unauthorized',
        detail: 'You must be authenticated to access this resource.',
      }),
    );
  }

  if (currentUser.role !== 'ADMIN' && currentUser.email !== email) {
    return apiJsonErrorResponse(
      new JsonApiError({
        status: '403',
        code: 'forbidden',
        title: 'Forbidden',
        detail: 'You do not have permission to retrieve the profile of this user.',
      }),
    );
  }

  const targetUser = await findDtoUserByEmail(email);
  if (!targetUser) {
    return apiJsonErrorResponse(
      new JsonApiError({
        status: '404',
        code: 'not_found',
        title: 'User not found',
        detail: `User ${email} not found`,
      }),
    );
  }

  const serializedUser = serializeJsonApi('users', targetUser, {
    links: {
      self: request.url,
    },
  });
  return apiJsonDocumentResponse(serializedUser);
}

async function modifyUserProfileRouteHandler(params: {
  currentUser: ExtendedSessionUser | null | undefined;
  request: Request;
  email: string;
}) {
  const { currentUser, request, email } = params;
}

/**
 * Delete a user profile
 * @param params
 * @returns
 */
async function deleteUserRouteHandler(params: {
  currentUser: ExtendedSessionUser | null | undefined;
  request: Request;
  email: string;
}) {
  const { currentUser, request, email } = params;
  if (!currentUser) {
    return apiJsonErrorResponse(
      new JsonApiError({
        status: '401',
        code: 'unauthorized',
        title: 'Unauthorized',
        detail: 'You must be authenticated to access this resource.',
      }),
    );
  }

  if (currentUser.role !== 'ADMIN' || currentUser.email === email) {
    return apiJsonErrorResponse(
      new JsonApiError({
        status: '403',
        code: 'forbidden',
        title: 'Forbidden',
        detail: 'You do not have permission to delete this user.',
      }),
    );
  }

  await deleteUserByEmail(email);
  return apiJsonDocumentResponse(
    serializeJsonApi('users', null, {
      status: 204,
      links: {
        self: request.url,
      },
    }),
  );
}
/**
 * Get the profile of a user by email.
 * Sample request: GET /api/user/{email}
 * @param {Request} request - The incoming HTTP request object.
 * @param {{ params: Promise<{ email: string }> }} param1 - An object containing the route parameters, specifically the email of the user to fetch.
 * @returns {Promise<Response>} - A promise that resolves to an HTTP response containing the user details in JSON:API format or an error response.
 * @constructor
 */
export async function GET(request: Request, { params }: { params: Promise<{ email: string }> }) {
  return userRouteHandler({ request, params, routeFunc: getUserProfileRouteHandler });
}

/**
 * Delete a user profile
 * Sample request: DELETE /api/user/{email}
 *
 * @param {Request} request - The incoming HTTP request object.
 * @param {{ params: Promise<{ email: string }> }} param1 - An object containing the route parameters, specifically the email of the user to delete.
 * @returns {Promise<Response>} - A promise that resolves to an HTTP response indicating the result of the delete operation.
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ email: string }> }) {
  return userRouteHandler({ request, params, routeFunc: deleteUserRouteHandler });
}

/**
 * Modify a user's profile.
 * Sample request: PATCH /api/user/{email}
 * @param request - The incoming HTTP request object.
 * @param {{ params: Promise<{ email: string }> }} param1 - An object containing the route parameters, specifically the email of the user to modify.
 * @returns {Promise<Response>} - A promise that resolves to an HTTP response indicating the result of the modify operation.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ email: string }> }) {
  return userRouteHandler({ request, params, routeFunc: modifyUserProfileRouteHandler });
}
