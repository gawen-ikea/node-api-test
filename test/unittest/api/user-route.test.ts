import type { MockedFunction } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Role } from '@/generated/prisma/enums';
import type { Session } from 'next-auth';
import type { DtoUser } from '@/schema/db-schema';

vi.mock('@/auth/auth-core', () => ({
  auth: vi.fn(),
}));

vi.mock('@/data/db-auth', () => ({
  deleteUserByEmail: vi.fn(),
  deleteUserById: vi.fn(),
  findDtoUserByEmail: vi.fn(),
  findDtoUserById: vi.fn(),
  modifyUserByEmail: vi.fn(),
  modifyUserById: vi.fn(),
}));

import { auth as nextAuth } from '@/auth/auth-core';
import { deleteUserById, findDtoUserById, modifyUserById } from '@/data/db-auth';
import { DELETE, GET, PATCH } from '@/app/api/user/[uid]/route';

const auth = nextAuth as unknown as MockedFunction<() => Promise<Session | null>>;

const JSON_API_MEDIA_TYPE = 'application/vnd.api+json';

const SAMPLE_USER_EMAIL = 'member@example.com';
const SAMPLE_USER_ID = 'sample-user-id';
const SAMPLE_USER_URL = `http://localhost/api/user/${SAMPLE_USER_ID}`;
const SAMPLE_USER_DTO: DtoUser = {
  id: SAMPLE_USER_ID,
  email: SAMPLE_USER_EMAIL,
  name: 'Member User',
  emailVerified: null,
  role: 'USER',
  image: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const SAMPLE_ADMIN_EMAIL = 'admin@example.com';
const SAMPLE_ADMIN_ID = 'admin-user-id';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const SAMPLE_ADMIN_URL = `http://localhost/api/user/${SAMPLE_ADMIN_ID}`;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const SAMPLE_ADMIN_DTO: DtoUser = {
  id: SAMPLE_ADMIN_ID,
  email: SAMPLE_ADMIN_EMAIL,
  name: 'Admin User',
  emailVerified: null,
  role: 'ADMIN',
  image: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const SAMPLE_OTHER_EMAIL = 'other@example.com';
const SAMPLE_OTHER_ID = 'other-user-id';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const SAMPLE_OTHER_URL = `http://localhost/api/user/${SAMPLE_OTHER_ID}`;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const SAMPLE_OTHER_DTO: DtoUser = {
  id: SAMPLE_OTHER_ID,
  email: SAMPLE_OTHER_EMAIL,
  name: 'Other User',
  emailVerified: null,
  role: 'USER',
  image: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

function session(id: string, email: string, role: Role = 'USER'): Session {
  return {
    expires: '2099-01-01T00:00:00.000Z',
    user: {
      id,
      email,
      name: email,
      role,
      image: null,
    },
  };
}

function makeUser(overrides: Partial<DtoUser> = {}): DtoUser {
  return {
    ...SAMPLE_USER_DTO,
    ...overrides,
  };
}

function request(url: string, method: 'GET' | 'PATCH' | 'DELETE', body?: unknown): Request {
  return new Request(url, {
    method,
    headers: {
      Accept: JSON_API_MEDIA_TYPE,
      ...(body === undefined ? {} : { 'Content-Type': JSON_API_MEDIA_TYPE }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function routeContext(uid = SAMPLE_USER_ID) {
  return { params: Promise.resolve({ uid }) };
}

function modificationDocument(attributes: { name?: string; role?: 'USER' | 'ADMIN' }, id = SAMPLE_USER_ID) {
  return {
    data: {
      type: 'users',
      id,
      attributes,
    },
  };
}

describe('GET /api/user/[uid]', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns a user profile to its owner with USER role', async () => {
    vi.mocked(auth).mockResolvedValue(session(SAMPLE_USER_ID, SAMPLE_USER_EMAIL, 'USER'));
    vi.mocked(findDtoUserById).mockResolvedValue(makeUser());

    const response = await GET(request(SAMPLE_USER_URL, 'GET'), routeContext(SAMPLE_USER_ID));
    const document = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe(JSON_API_MEDIA_TYPE);
    expect(findDtoUserById).toHaveBeenCalledWith(SAMPLE_USER_ID);
    expect(document).toMatchObject({
      links: { self: SAMPLE_USER_URL },
      data: {
        type: 'users',
        id: SAMPLE_USER_ID,
        attributes: { email: SAMPLE_USER_EMAIL, name: 'Member User', role: 'USER' },
      },
    });
  });

  it('returns a user profile to its owner with selected fields', async () => {
    const url = `${SAMPLE_USER_URL}?fields%5Busers%5D=name,role`;
    vi.mocked(auth).mockResolvedValue(session(SAMPLE_USER_ID, SAMPLE_USER_EMAIL, 'USER'));
    vi.mocked(findDtoUserById).mockResolvedValue(SAMPLE_USER_DTO);

    const response = await GET(request(url, 'GET'), routeContext(SAMPLE_USER_ID));
    const document = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe(JSON_API_MEDIA_TYPE);
    expect(findDtoUserById).toHaveBeenCalledWith(SAMPLE_USER_ID);
    expect(document).toMatchObject({
      links: { self: url },
      data: {
        type: 'users',
        id: SAMPLE_USER_ID,
        attributes: { name: 'Member User', role: 'USER' },
      },
    });
    expect(document.data.attributes).toEqual({ name: 'Member User', role: 'USER' });

    const nameUrl = `${SAMPLE_USER_URL}?fields%5Busers%5D=name`;
    const nameRsp = await GET(request(nameUrl, 'GET'), routeContext(SAMPLE_USER_ID));
    const nameDocument = await nameRsp.json();

    expect(nameRsp.status).toBe(200);
    expect(nameRsp.headers.get('content-type')).toBe(JSON_API_MEDIA_TYPE);
    expect(findDtoUserById).toHaveBeenCalledWith(SAMPLE_USER_ID);
    expect(nameDocument).toMatchObject({
      links: { self: nameUrl },
      data: {
        type: 'users',
        id: SAMPLE_USER_ID,
        attributes: { name: 'Member User' },
      },
    });
    expect(nameDocument.data.attributes).toEqual({ name: 'Member User' });
  });

  it('returns a user profile to its owner with selected fields and non-existing fields', async () => {
    const url = `${SAMPLE_USER_URL}?fields%5Busers%5D=name,doesNotExist`;
    vi.mocked(auth).mockResolvedValue(session(SAMPLE_USER_ID, SAMPLE_USER_EMAIL, 'USER'));
    vi.mocked(findDtoUserById).mockResolvedValue(makeUser());

    const response = await GET(request(url, 'GET'), routeContext(SAMPLE_USER_ID));
    const document = await response.json();

    expect(response.status).toBe(400);
    expect(response.headers.get('content-type')).toBe(JSON_API_MEDIA_TYPE);
    expect(findDtoUserById).toHaveBeenCalledWith(SAMPLE_USER_ID);
    expect(document).toMatchObject({
      errors: [
        {
          status: '400',
          code: 'unknown_resource_field',
          source: { parameter: 'fields[users]' },
        },
      ],
    });
  });

  it('returns a user profile to its owner with selected fields and filters', async () => {
    const url = `${SAMPLE_USER_URL}?fields%5Busers%5D=name&filter%5Brole%5D=USER`;
    vi.mocked(auth).mockResolvedValue(session(SAMPLE_USER_ID, SAMPLE_USER_EMAIL, 'USER'));
    vi.mocked(findDtoUserById).mockResolvedValue(makeUser());

    const response = await GET(request(url, 'GET'), routeContext(SAMPLE_USER_ID));
    const document = await response.json();

    expect(response.status).toBe(400);
    expect(response.headers.get('content-type')).toBe(JSON_API_MEDIA_TYPE);
    expect(findDtoUserById).toHaveBeenCalledWith(SAMPLE_USER_ID);
    expect(document).toMatchObject({
      errors: [
        {
          status: '400',
          code: 'invalid_type',
          title: "'filter' parameter is not supported",
          source: { parameter: 'filter' },
        },
      ],
    });
  });

  it('returns a user profile to its owner with ADMIN role', async () => {
    vi.mocked(auth).mockResolvedValue(session(SAMPLE_USER_ID, SAMPLE_USER_EMAIL, 'ADMIN'));
    vi.mocked(findDtoUserById).mockResolvedValue(
      makeUser({
        role: 'ADMIN',
      }),
    );

    const response = await GET(request(SAMPLE_USER_URL, 'GET'), routeContext(SAMPLE_USER_ID));
    const document = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe(JSON_API_MEDIA_TYPE);
    expect(findDtoUserById).toHaveBeenCalledWith(SAMPLE_USER_ID);
    expect(document).toMatchObject({
      links: { self: SAMPLE_USER_URL },
      data: {
        type: 'users',
        id: SAMPLE_USER_ID,
        attributes: { email: SAMPLE_USER_EMAIL, name: 'Member User', role: 'ADMIN' },
      },
    });
  });

  it('allows an administrator to retrieve another user', async () => {
    vi.mocked(auth).mockResolvedValue(session(SAMPLE_ADMIN_ID, SAMPLE_ADMIN_EMAIL, 'ADMIN'));
    vi.mocked(findDtoUserById).mockResolvedValue(makeUser());

    const response = await GET(request(SAMPLE_USER_URL, 'GET'), routeContext(SAMPLE_USER_ID));

    expect(response.status).toBe(200);
    expect(findDtoUserById).toHaveBeenCalledWith(SAMPLE_USER_ID);
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const response = await GET(request(SAMPLE_USER_URL, 'GET'), routeContext());
    const document = await response.json();

    expect(response.status).toBe(401);
    expect(document).toMatchObject({
      errors: [{ status: '401', code: 'unauthorized' }],
    });
    expect(findDtoUserById).not.toHaveBeenCalled();
  });

  it('returns 403 when a regular user requests another profile', async () => {
    vi.mocked(auth).mockResolvedValue(session(SAMPLE_OTHER_ID, SAMPLE_OTHER_EMAIL, 'USER'));

    const response = await GET(request(SAMPLE_USER_URL, 'GET'), routeContext());
    const document = await response.json();

    expect(response.status).toBe(403);
    expect(document).toMatchObject({
      errors: [{ status: '403', code: 'forbidden' }],
    });
    expect(findDtoUserById).not.toHaveBeenCalled();
  });

  it('returns 404 when the target user does not exist', async () => {
    vi.mocked(auth).mockResolvedValue(session(SAMPLE_USER_ID, SAMPLE_USER_EMAIL, 'USER'));
    vi.mocked(findDtoUserById).mockResolvedValue(null);

    const response = await GET(request(SAMPLE_USER_URL, 'GET'), routeContext(SAMPLE_USER_ID));
    const document = await response.json();

    expect(response.status).toBe(404);
    expect(document).toMatchObject({
      errors: [{ status: '404', code: 'not_found' }],
    });
  });
});

describe('PATCH /api/user/[uid]', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('allows a user to update their own name', async () => {
    vi.mocked(auth).mockResolvedValue(session(SAMPLE_USER_ID, SAMPLE_USER_EMAIL, 'USER'));
    vi.mocked(findDtoUserById).mockResolvedValue(makeUser());
    vi.mocked(modifyUserById).mockResolvedValue(makeUser({ name: 'Updated Name' }));

    const response = await PATCH(
      request(SAMPLE_USER_URL, 'PATCH', modificationDocument({ name: 'Updated Name' })),
      routeContext(SAMPLE_USER_ID),
    );
    const document = await response.json();

    expect(response.status).toBe(200);
    expect(findDtoUserById).toHaveBeenCalledWith(SAMPLE_USER_ID);
    expect(modifyUserById).toHaveBeenCalledWith(SAMPLE_USER_ID, {
      name: 'Updated Name',
      role: undefined,
    });
    expect(document).toMatchObject({
      data: {
        type: 'users',
        id: SAMPLE_USER_ID,
        attributes: { name: 'Updated Name' },
      },
    });
  });

  it('allows an administrator to update another user role', async () => {
    vi.mocked(auth).mockResolvedValue(session(SAMPLE_ADMIN_ID, SAMPLE_ADMIN_EMAIL, 'ADMIN'));
    vi.mocked(findDtoUserById).mockResolvedValue(makeUser());
    vi.mocked(modifyUserById).mockResolvedValue(makeUser({ role: 'ADMIN' }));

    const response = await PATCH(
      request(SAMPLE_USER_URL, 'PATCH', modificationDocument({ role: 'ADMIN' })),
      routeContext(SAMPLE_USER_ID),
    );

    expect(response.status).toBe(200);
    expect(modifyUserById).toHaveBeenCalledWith(SAMPLE_USER_ID, {
      name: undefined,
      role: 'ADMIN',
    });
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const response = await PATCH(
      request(SAMPLE_USER_URL, 'PATCH', modificationDocument({ name: 'Updated Name' })),
      routeContext(SAMPLE_USER_ID),
    );

    expect(response.status).toBe(401);
    expect(modifyUserById).not.toHaveBeenCalled();
  });

  it('returns 403 when a regular user updates another profile', async () => {
    vi.mocked(auth).mockResolvedValue(session(SAMPLE_OTHER_ID, SAMPLE_OTHER_EMAIL, 'USER'));

    const response = await PATCH(
      request(SAMPLE_USER_URL, 'PATCH', modificationDocument({ name: 'Updated Name' })),
      routeContext(SAMPLE_USER_ID),
    );

    expect(response.status).toBe(403);
    expect(findDtoUserById).not.toHaveBeenCalled();
    expect(modifyUserById).not.toHaveBeenCalled();
  });

  it('returns 400 when the document id does not match the URL', async () => {
    vi.mocked(auth).mockResolvedValue(session(SAMPLE_USER_ID, SAMPLE_USER_EMAIL, 'USER'));

    const response = await PATCH(
      request(SAMPLE_USER_URL, 'PATCH', modificationDocument({ name: 'Updated Name' }, 'different@example.com')),
      routeContext(),
    );
    const document = await response.json();

    expect(response.status).toBe(400);
    expect(document).toMatchObject({
      errors: [{ status: '400', code: 'bad_request' }],
    });
    expect(findDtoUserById).not.toHaveBeenCalled();
  });

  it('returns 403 when a regular user attempts to change their role', async () => {
    vi.mocked(auth).mockResolvedValue(session(SAMPLE_USER_ID, SAMPLE_USER_EMAIL, 'USER'));

    const response = await PATCH(
      request(SAMPLE_USER_URL, 'PATCH', modificationDocument({ role: 'ADMIN' })),
      routeContext(SAMPLE_USER_ID),
    );
    const document = await response.json();

    expect(response.status).toBe(403);
    expect(document).toMatchObject({
      errors: [{ status: '403', code: 'forbidden' }],
    });
    expect(findDtoUserById).not.toHaveBeenCalled();
  });

  it('returns 404 when the target user does not exist', async () => {
    vi.mocked(auth).mockResolvedValue(session(SAMPLE_USER_ID, SAMPLE_USER_EMAIL, 'USER'));
    vi.mocked(findDtoUserById).mockResolvedValue(null);

    const response = await PATCH(
      request(SAMPLE_USER_URL, 'PATCH', modificationDocument({ name: 'Updated Name' })),
      routeContext(),
    );
    const document = await response.json();

    expect(response.status).toBe(404);
    expect(document).toMatchObject({
      errors: [{ status: '404', code: 'not_found' }],
    });
    expect(modifyUserById).not.toHaveBeenCalled();
  });

  it('rejects an empty attributes object', async () => {
    vi.mocked(auth).mockResolvedValue(session(SAMPLE_USER_ID, SAMPLE_USER_EMAIL, 'USER'));

    const response = await PATCH(
      request(SAMPLE_USER_URL, 'PATCH', modificationDocument({})),
      routeContext(SAMPLE_USER_ID),
    );
    const document = await response.json();

    expect(response.status).toBe(422);
    expect(document).toHaveProperty('errors');
    expect(findDtoUserById).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/user/[uid]', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('allows an administrator to delete another user', async () => {
    vi.mocked(auth).mockResolvedValue(session(SAMPLE_ADMIN_ID, SAMPLE_ADMIN_EMAIL, 'ADMIN'));
    vi.mocked(deleteUserById).mockResolvedValue();

    const response = await DELETE(request(SAMPLE_USER_URL, 'DELETE'), routeContext(SAMPLE_USER_ID));
    const document = await response.text();

    expect(response.status).toBe(204);
    expect(document).toBe('');
    expect(deleteUserById).toHaveBeenCalledWith(SAMPLE_USER_ID);
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const response = await DELETE(request(SAMPLE_USER_URL, 'DELETE'), routeContext());

    expect(response.status).toBe(401);
    expect(deleteUserById).not.toHaveBeenCalled();
  });

  it('returns 403 when a regular user tries to delete a user', async () => {
    vi.mocked(auth).mockResolvedValue(session(SAMPLE_OTHER_ID, SAMPLE_OTHER_EMAIL, 'USER'));

    const response = await DELETE(request(SAMPLE_USER_URL, 'DELETE'), routeContext());

    expect(response.status).toBe(403);
    expect(deleteUserById).not.toHaveBeenCalled();
  });

  it('returns 403 when an administrator tries to delete their own account', async () => {
    vi.mocked(auth).mockResolvedValue(session(SAMPLE_USER_ID, SAMPLE_USER_EMAIL, 'ADMIN'));

    const response = await DELETE(request(SAMPLE_USER_URL, 'DELETE'), routeContext(SAMPLE_USER_ID));

    expect(response.status).toBe(403);
    expect(deleteUserById).not.toHaveBeenCalled();
  });
});
