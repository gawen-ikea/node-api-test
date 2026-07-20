import { auth } from '@/auth/auth-core';
import { errorMessage, restErrorResponse, restSuccessResponse } from '@/utils/api-utils';
import { deleteUserByEmail, findDtoUserByEmail } from '@/utils/db-auth-utils';
import { serializeJsonApi } from '@/schema/entity-serializer';
import { nanoid } from 'nanoid';

/**
 * Get the details of a user by email.
 * @param request
 * @param params
 * @constructor
 */
export async function GET(request: Request, { params }: { params: Promise<{ email: string }> }) {
  const { email } = await params;

  // Validate accept header
  const acceptHeader = request.headers.get('Accept');
  if (!acceptHeader || !acceptHeader.includes('application/vnd.api+json')) {
    return restErrorResponse(406);
  }

  // Authentication check
  const curSession = await auth();
  const curUser = curSession?.user;
  if (!curUser) {
    return restErrorResponse(401, { code: 'unauthorized', title: 'Unauthorized' });
  }

  if (curUser.role !== 'ADMIN' && curUser.email !== email) {
    return restErrorResponse(403, { code: 'forbidden', title: 'Forbidden' });
  }

  // Fetch full user information from the database
  try {
    const targetUser = await findDtoUserByEmail(email);
    if (!targetUser) {
      return restErrorResponse(404, { code: 'not_found', title: 'User not found', detail: `User ${email} not found` });
    }

    const serializedUser = serializeJsonApi('users', targetUser, {
      links: {
        self: request.url,
      },
    });

    return restSuccessResponse(JSON.stringify(serializedUser), serializedUser.getStatus());
  } catch (error: unknown) {
    const errorId = nanoid();
    console.error(`error[${errorId}] Error fetching user data: ${errorMessage(error)}`);
    return restErrorResponse(500, { detail: `errorId: ${errorId}` });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ email: string }> }) {
  const { email } = await params;

  // Validate accept header
  const acceptHeader = request.headers.get('Accept');
  if (!acceptHeader || !acceptHeader.includes('application/vnd.api+json')) {
    return restErrorResponse(406);
  }

  // Authentication check
  const curSession = await auth();
  const curUser = curSession?.user;
  if (!curUser) {
    return restErrorResponse(401, { code: 'unauthorized', title: 'Unauthorized' });
  }

  // Authorization check: Only ADMIN can delete other users, and users cannot delete themselves
  if (curUser.role !== 'ADMIN' || curUser.email === email) {
    return restErrorResponse(403, { code: 'forbidden', title: 'Forbidden' });
  }

  // Delete user
  try {
    await deleteUserByEmail(email);
    return restSuccessResponse('', 204); // No Content
  } catch (error: unknown) {
    const errorId = nanoid();
    console.error(`error[${errorId}] Error deleting user: ${errorMessage(error)}`);
    return restErrorResponse(500, { detail: `errorId: ${errorId}` });
  }
}
