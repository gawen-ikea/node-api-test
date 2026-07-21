import type { Session } from 'next-auth';
import type { DtoUser } from '@/schema/db-schema';
import type { MockedFunction } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/auth/auth-core', () => ({
  auth: vi.fn(),
}));

vi.mock('@/data/db-auth', () => ({
  deleteUserByEmail: vi.fn(),
  findDtoUserByEmail: vi.fn(),
  modifyUserByEmail: vi.fn(),
}));

import { auth as nextAuth } from '@/auth/auth-core';
import { deleteUserByEmail, findDtoUserByEmail, modifyUserByEmail } from '@/data/db-auth';
import { DELETE, GET, PATCH } from '@/app/api/user/[email]/route';

const auth = nextAuth as unknown as MockedFunction<() => Promise<Session | null>>;

const JSON_API_MEDIA_TYPE = 'application/vnd.api+json';
const TARGET_EMAIL = 'member@example.com';
const TARGET_URL = `http://localhost/api/user/${TARGET_EMAIL}`;

function session(email: string, role: 'USER' | 'ADMIN'): Session {
  return {
    expires: '2099-01-01T00:00:00.000Z',
    user: {
      email,
      name: email,
      role,
    },
  };
}

function makeUser(overrides: Partial<DtoUser> = {}): DtoUser {
  return {
    id: 'user-id',
    email: TARGET_EMAIL,
    name: 'Member User',
    emailVerified: null,
    role: 'USER',
    image: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    accounts: [],
    ...overrides,
  };
}

function request(method: 'GET' | 'PATCH' | 'DELETE', body?: unknown): Request {
  return new Request(TARGET_URL, {
    method,
    headers: {
      Accept: JSON_API_MEDIA_TYPE,
      ...(body === undefined ? {} : { 'Content-Type': JSON_API_MEDIA_TYPE }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function context(email = TARGET_EMAIL) {
  return { params: Promise.resolve({ email }) };
}

function modificationDocument(attributes: { name?: string; role?: 'USER' | 'ADMIN' }, id = TARGET_EMAIL) {
  return {
    data: {
      type: 'users',
      id,
      attributes,
    },
  };
}

async function jsonBody(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

describe('GET /api/user/[email]', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns a user profile to its owner', async () => {
    vi.mocked(auth).mockResolvedValue(session(TARGET_EMAIL, 'USER'));
    vi.mocked(findDtoUserByEmail).mockResolvedValue(makeUser());

    const response = await GET(request('GET'), context());
    const document = await jsonBody(response);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe(JSON_API_MEDIA_TYPE);
    expect(findDtoUserByEmail).toHaveBeenCalledWith(TARGET_EMAIL);
    expect(document).toMatchObject({
      links: { self: TARGET_URL },
      data: {
        type: 'users',
        id: TARGET_EMAIL,
        attributes: { email: TARGET_EMAIL, name: 'Member User', role: 'USER' },
      },
    });
  });

  it('allows an administrator to retrieve another user', async () => {
    vi.mocked(auth).mockResolvedValue(session('admin@example.com', 'ADMIN'));
    vi.mocked(findDtoUserByEmail).mockResolvedValue(makeUser());

    const response = await GET(request('GET'), context());

    expect(response.status).toBe(200);
    expect(findDtoUserByEmail).toHaveBeenCalledWith(TARGET_EMAIL);
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const response = await GET(request('GET'), context());

    expect(response.status).toBe(401);
    expect(await jsonBody(response)).toMatchObject({
      errors: [{ status: '401', code: 'unauthorized' }],
    });
    expect(findDtoUserByEmail).not.toHaveBeenCalled();
  });

  it('returns 403 when a regular user requests another profile', async () => {
    vi.mocked(auth).mockResolvedValue(session('other@example.com', 'USER'));

    const response = await GET(request('GET'), context());

    expect(response.status).toBe(403);
    expect(await jsonBody(response)).toMatchObject({
      errors: [{ status: '403', code: 'forbidden' }],
    });
    expect(findDtoUserByEmail).not.toHaveBeenCalled();
  });

  it('returns 404 when the target user does not exist', async () => {
    vi.mocked(auth).mockResolvedValue(session(TARGET_EMAIL, 'USER'));
    vi.mocked(findDtoUserByEmail).mockResolvedValue(null);

    const response = await GET(request('GET'), context());

    expect(response.status).toBe(404);
    expect(await jsonBody(response)).toMatchObject({
      errors: [{ status: '404', code: 'not_found' }],
    });
  });
});

describe('PATCH /api/user/[email]', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('allows a user to update their own name', async () => {
    vi.mocked(auth).mockResolvedValue(session(TARGET_EMAIL, 'USER'));
    vi.mocked(findDtoUserByEmail).mockResolvedValue(makeUser());
    vi.mocked(modifyUserByEmail).mockResolvedValue(makeUser({ name: 'Updated Name' }));

    const response = await PATCH(request('PATCH', modificationDocument({ name: 'Updated Name' })), context());
    const document = await jsonBody(response);

    expect(response.status).toBe(200);
    expect(findDtoUserByEmail).toHaveBeenCalledWith(TARGET_EMAIL);
    expect(modifyUserByEmail).toHaveBeenCalledWith(TARGET_EMAIL, {
      name: 'Updated Name',
      role: undefined,
    });
    expect(document).toMatchObject({
      data: {
        type: 'users',
        id: TARGET_EMAIL,
        attributes: { name: 'Updated Name' },
      },
    });
  });

  it('allows an administrator to update another user role', async () => {
    vi.mocked(auth).mockResolvedValue(session('admin@example.com', 'ADMIN'));
    vi.mocked(findDtoUserByEmail).mockResolvedValue(makeUser());
    vi.mocked(modifyUserByEmail).mockResolvedValue(makeUser({ role: 'ADMIN' }));

    const response = await PATCH(request('PATCH', modificationDocument({ role: 'ADMIN' })), context());

    expect(response.status).toBe(200);
    expect(modifyUserByEmail).toHaveBeenCalledWith(TARGET_EMAIL, {
      name: undefined,
      role: 'ADMIN',
    });
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const response = await PATCH(request('PATCH', modificationDocument({ name: 'Updated Name' })), context());

    expect(response.status).toBe(401);
    expect(modifyUserByEmail).not.toHaveBeenCalled();
  });

  it('returns 403 when a regular user updates another profile', async () => {
    vi.mocked(auth).mockResolvedValue(session('other@example.com', 'USER'));

    const response = await PATCH(request('PATCH', modificationDocument({ name: 'Updated Name' })), context());

    expect(response.status).toBe(403);
    expect(findDtoUserByEmail).not.toHaveBeenCalled();
    expect(modifyUserByEmail).not.toHaveBeenCalled();
  });

  it('returns 400 when the document id does not match the URL', async () => {
    vi.mocked(auth).mockResolvedValue(session(TARGET_EMAIL, 'USER'));

    const response = await PATCH(
      request('PATCH', modificationDocument({ name: 'Updated Name' }, 'different@example.com')),
      context(),
    );

    expect(response.status).toBe(400);
    expect(await jsonBody(response)).toMatchObject({
      errors: [{ status: '400', code: 'bad_request' }],
    });
    expect(findDtoUserByEmail).not.toHaveBeenCalled();
  });

  it('returns 403 when a regular user attempts to change their role', async () => {
    vi.mocked(auth).mockResolvedValue(session(TARGET_EMAIL, 'USER'));

    const response = await PATCH(request('PATCH', modificationDocument({ role: 'ADMIN' })), context());

    expect(response.status).toBe(403);
    expect(await jsonBody(response)).toMatchObject({
      errors: [{ status: '403', code: 'forbidden' }],
    });
    expect(findDtoUserByEmail).not.toHaveBeenCalled();
  });

  it('returns 404 when the target user does not exist', async () => {
    vi.mocked(auth).mockResolvedValue(session(TARGET_EMAIL, 'USER'));
    vi.mocked(findDtoUserByEmail).mockResolvedValue(null);

    const response = await PATCH(request('PATCH', modificationDocument({ name: 'Updated Name' })), context());

    expect(response.status).toBe(404);
    expect(await jsonBody(response)).toMatchObject({
      errors: [{ status: '404', code: 'not_found' }],
    });
    expect(modifyUserByEmail).not.toHaveBeenCalled();
  });

  it('rejects an empty attributes object', async () => {
    vi.mocked(auth).mockResolvedValue(session(TARGET_EMAIL, 'USER'));

    const response = await PATCH(request('PATCH', modificationDocument({})), context());

    expect(response.status).toBe(422);
    expect(await jsonBody(response)).toHaveProperty('errors');
    expect(findDtoUserByEmail).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/user/[email]', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('allows an administrator to delete another user', async () => {
    vi.mocked(auth).mockResolvedValue(session('admin@example.com', 'ADMIN'));
    vi.mocked(deleteUserByEmail).mockResolvedValue();

    const response = await DELETE(request('DELETE'), context());

    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
    expect(deleteUserByEmail).toHaveBeenCalledWith(TARGET_EMAIL);
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const response = await DELETE(request('DELETE'), context());

    expect(response.status).toBe(401);
    expect(deleteUserByEmail).not.toHaveBeenCalled();
  });

  it('returns 403 when a regular user tries to delete a user', async () => {
    vi.mocked(auth).mockResolvedValue(session('other@example.com', 'USER'));

    const response = await DELETE(request('DELETE'), context());

    expect(response.status).toBe(403);
    expect(deleteUserByEmail).not.toHaveBeenCalled();
  });

  it('returns 403 when an administrator tries to delete their own account', async () => {
    vi.mocked(auth).mockResolvedValue(session(TARGET_EMAIL, 'ADMIN'));

    const response = await DELETE(request('DELETE'), context());

    expect(response.status).toBe(403);
    expect(deleteUserByEmail).not.toHaveBeenCalled();
  });
});
