import { JsonApiError } from '@jsonapi-serde/server/common';
import { getAcceptableMediaTypes } from '@jsonapi-serde/server/http';

import { auth, ExtendedSessionUser } from '@/auth/auth-core';
import { apiJsonErrorResponse, apiJsonDocumentResponse, standardErrorResponse } from '@/utils/api-utils';
import { deleteUserById, findDtoUserById, modifyUserById } from '@/data/db-auth';
import { parseUserListQuery, parseUserModifyRequest, serializeJsonApi } from '@/schema/entity-serializer';

type UserRouteParams = {
  request: Request;
  params: Promise<{ uid: string }>;
  routeFunc: (params: {
    currentUser: ExtendedSessionUser | null | undefined;
    request: Request;
    uid: string;
  }) => Promise<Response>;
};

export async function userRouteHandler({ request, params, routeFunc }: UserRouteParams): Promise<Response> {
  const { uid } = await params;

  try {
    getAcceptableMediaTypes(request.headers.get('accept') ?? '');

    const curSession = await auth();
    const currentUser = curSession?.user;

    return await routeFunc({ currentUser, request, uid });
  } catch (error: unknown) {
    return standardErrorResponse(error);
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
  uid: string;
}) {
  const { currentUser, request, uid } = params;
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

  if (currentUser.role !== 'ADMIN' && currentUser.id !== uid) {
    return apiJsonErrorResponse(
      new JsonApiError({
        status: '403',
        code: 'forbidden',
        title: 'Forbidden',
        detail: 'You do not have permission to retrieve the profile of this user.',
      }),
    );
  }

  const targetUser = await findDtoUserById(uid);
  if (!targetUser) {
    return apiJsonErrorResponse(
      new JsonApiError({
        status: '404',
        code: 'not_found',
        title: 'User not found',
        detail: `User ${uid} not found`,
      }),
    );
  }

  // parse request parameters
  const options = parseUserListQuery(new URL(request.url).searchParams);

  const serializedUser = serializeJsonApi('users', targetUser, {
    fields: options.fields,
    links: {
      self: request.url,
    },
  });
  return apiJsonDocumentResponse(serializedUser);
}

/**
 * Only allow ADMIN to modify other users' profiles. Users can modify their own profile.
 * Only allow ADMIN to change roles. Users can change their own name and password.
 * Sample request: PATCH /api/user/{uid}
 * @param params
 * @returns
 */
async function modifyUserProfileRouteHandler(params: {
  currentUser: ExtendedSessionUser | null | undefined;
  request: Request;
  uid: string;
}) {
  const { currentUser, request, uid } = params;
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

  if (currentUser.role !== 'ADMIN' && currentUser.id !== uid) {
    return apiJsonErrorResponse(
      new JsonApiError({
        status: '403',
        code: 'forbidden',
        title: 'Forbidden',
        detail: 'You do not have permission to retrieve the profile of this user.',
      }),
    );
  }

  const isAdmin = currentUser.role === 'ADMIN';
  const body = await request.text();
  const modifyRequest = parseUserModifyRequest({
    body,
    contentType: request.headers.get('Content-Type') ?? '',
  });

  /*
   * JSON:API requires the resource identifier in the request body.
   * Ensure it refers to the same resource as the URL.
   */
  if (modifyRequest.id !== uid) {
    throw new JsonApiError({
      status: '400',
      code: 'bad_request',
      title: 'Bad Request',
      detail: 'The resource identifier in the request body does not match the URL.',
      source: {
        pointer: request.url,
      },
    });
  }

  /*
   * Only allow ADMIN to modify ROLE attribute
   */
  if (modifyRequest.attributes.role && !isAdmin) {
    throw new JsonApiError({
      status: '403',
      code: 'forbidden',
      title: 'Forbidden',
      detail: 'You do not have permission to modify the role attribute.',
    });
  }

  /*
   * Find the user in the database
   */
  const dbUser = await findDtoUserById(uid);
  if (!dbUser) {
    throw new JsonApiError({
      status: '404',
      code: 'not_found',
      title: 'Not Found',
      detail: 'The user does not exist.',
    });
  }

  /**
   * Update the user profile
   */
  const newUser = await modifyUserById(uid, {
    name: modifyRequest.attributes.name,
    role: modifyRequest.attributes.role,
  });

  const rspDocument = serializeJsonApi('users', newUser, {
    status: 200,
    links: {
      self: request.url,
    },
  });

  return apiJsonDocumentResponse(rspDocument);
}

/**
 * Delete a user profile
 * @param params
 * @returns
 */
async function deleteUserRouteHandler(params: {
  currentUser: ExtendedSessionUser | null | undefined;
  request: Request;
  uid: string;
}) {
  const { currentUser, request, uid } = params;
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

  if (currentUser.role !== 'ADMIN' || currentUser.id === uid) {
    return apiJsonErrorResponse(
      new JsonApiError({
        status: '403',
        code: 'forbidden',
        title: 'Forbidden',
        detail: 'You do not have permission to delete this user.',
      }),
    );
  }

  // Find the user in the database
  const dbUser = await findDtoUserById(uid);
  if (!dbUser) {
    return apiJsonErrorResponse(
      new JsonApiError({
        status: '404',
        code: 'not_found',
        title: 'Not Found',
        detail: 'The user does not exist.',
      }),
    );
  }

  await deleteUserById(uid);
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
export async function GET(request: Request, { params }: { params: Promise<{ uid: string }> }) {
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
export async function DELETE(request: Request, { params }: { params: Promise<{ uid: string }> }) {
  return userRouteHandler({ request, params, routeFunc: deleteUserRouteHandler });
}

/**
 * Modify a user's profile.
 * Sample request: PATCH /api/user/{id}
 * @param request - The incoming HTTP request object.
 * @param {{ params: Promise<{ uid: string }> }} param1 - An object containing the route parameters, specifically the id of the user to modify.
 * @returns {Promise<Response>} - A promise that resolves to an HTTP response indicating the result of the modify operation.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ uid: string }> }) {
  return userRouteHandler({ request, params, routeFunc: modifyUserProfileRouteHandler });
}
