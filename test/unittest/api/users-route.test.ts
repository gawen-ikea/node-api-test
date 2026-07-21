import type { Session } from 'next-auth';
import type { DtoUser } from '@/schema/db-schema';
import type { MockedFunction } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/auth/auth-core', () => ({
  auth: vi.fn(),
}));

vi.mock('@/data/db-auth', () => ({
  createDtoUser: vi.fn(),
  findDtoUserByEmail: vi.fn(),
  findDtoUsers: vi.fn(),
}));

import { auth as nextAuth } from '@/auth/auth-core';
import { createDtoUser, findDtoUserByEmail, findDtoUsers } from '@/data/db-auth';
import { GET, POST } from '@/app/api/users/route';

const auth = nextAuth as unknown as MockedFunction<() => Promise<Session | null>>;

const JSON_API_MEDIA_TYPE = 'application/vnd.api+json';
const USERS_URL = 'http://localhost/api/users';

const adminSession: Session = {
  expires: '2099-01-01T00:00:00.000Z',
  user: {
    email: 'admin@example.com',
    name: 'Admin User',
    role: 'ADMIN',
  },
};

const regularUserSession: Session = {
  expires: '2099-01-01T00:00:00.000Z',
  user: {
    email: 'member@example.com',
    name: 'Member User',
    role: 'USER',
  },
};

function makeUser(overrides: Partial<DtoUser> = {}): DtoUser {
  return {
    id: 'user-id',
    email: 'member@example.com',
    name: 'Member User',
    emailVerified: new Date('2026-01-02T03:04:05.000Z'),
    role: 'USER',
    image: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    accounts: [],
    ...overrides,
  };
}

function getRequest(url = USERS_URL, accept = JSON_API_MEDIA_TYPE): Request {
  return new Request(url, {
    headers: { Accept: accept },
  });
}

function postRequest(body: unknown, contentType = JSON_API_MEDIA_TYPE): Request {
  return new Request(USERS_URL, {
    method: 'POST',
    headers: {
      Accept: JSON_API_MEDIA_TYPE,
      'Content-Type': contentType,
    },
    body: JSON.stringify(body),
  });
}

function creationDocument(email = 'new.user@example.com') {
  return {
    data: {
      type: 'users',
      id: email,
      attributes: {
        email,
        password: 'correct-horse-battery-staple',
        name: 'New User',
        role: 'USER',
      },
    },
  };
}

async function jsonBody(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

describe('GET /api/users', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns a JSON:API user collection for an administrator', async () => {
    const users = [makeUser(), makeUser({ id: 'admin-id', email: 'admin@example.com', role: 'ADMIN' })];
    vi.mocked(auth).mockResolvedValue(adminSession);
    vi.mocked(findDtoUsers).mockResolvedValue(users);

    const response = await GET(getRequest());
    const document = await jsonBody(response);

    expect(response.status, JSON.stringify(document)).toBe(200);
    expect(response.headers.get('content-type')).toBe(JSON_API_MEDIA_TYPE);
    expect(findDtoUsers).toHaveBeenCalledOnce();
    expect(document).toMatchObject({
      links: { self: USERS_URL },
      data: [
        {
          type: 'users',
          id: 'member@example.com',
          attributes: {
            email: 'member@example.com',
            emailVerified: '2026-01-02T03:04:05.000Z',
            name: 'Member User',
            role: 'USER',
          },
        },
        {
          type: 'users',
          id: 'admin@example.com',
          attributes: { role: 'ADMIN' },
        },
      ],
    });
  });

  it('applies a JSON:API sparse fieldset', async () => {
    const url = `${USERS_URL}?fields%5Busers%5D=name`;
    vi.mocked(auth).mockResolvedValue(adminSession);
    vi.mocked(findDtoUsers).mockResolvedValue([makeUser()]);

    const response = await GET(getRequest(url));
    const document = (await jsonBody(response)) as {
      data: Array<{ attributes: Record<string, unknown> }>;
    };

    expect(response.status, JSON.stringify(document)).toBe(200);
    expect(document.data[0].attributes).toEqual({ name: 'Member User' });
  });

  it('returns 401 when there is no authenticated user', async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const response = await GET(getRequest());
    const document = await jsonBody(response);

    expect(response.status).toBe(401);
    expect(document).toMatchObject({
      errors: [{ status: '401', code: 'unauthorized', title: 'Unauthorized' }],
    });
    expect(findDtoUsers).not.toHaveBeenCalled();
  });

  it('returns 403 when an authenticated user is not an administrator', async () => {
    vi.mocked(auth).mockResolvedValue(regularUserSession);

    const response = await GET(getRequest());
    const document = await jsonBody(response);

    expect(response.status).toBe(403);
    expect(document).toMatchObject({
      errors: [{ status: '403', code: 'forbidden', title: 'Forbidden' }],
    });
    expect(findDtoUsers).not.toHaveBeenCalled();
  });
});

describe('POST /api/users', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('creates a user and returns a JSON:API resource with a Location header', async () => {
    const email = 'new.user@example.com';
    const createdUser = makeUser({ id: 'new-user-id', email, name: 'New User' });
    vi.mocked(findDtoUserByEmail).mockResolvedValue(null);
    vi.mocked(createDtoUser).mockResolvedValue(createdUser);

    const response = await POST(postRequest(creationDocument(email)));
    const document = await jsonBody(response);

    expect(response.status).toBe(201);
    expect(response.headers.get('content-type')).toBe(JSON_API_MEDIA_TYPE);
    expect(response.headers.get('location')).toBe(`http://localhost/api/user/${encodeURIComponent(email)}`);
    expect(findDtoUserByEmail).toHaveBeenCalledWith(email);
    expect(createDtoUser).toHaveBeenCalledWith({
      email,
      password: 'correct-horse-battery-staple',
      name: 'New User',
      role: 'USER',
    });
    expect(document).toMatchObject({
      links: { self: `http://localhost/api/user/${encodeURIComponent(email)}` },
      data: {
        type: 'users',
        id: email,
        attributes: { email, name: 'New User', role: 'USER' },
      },
    });
  });

  it('returns 409 when the user already exists', async () => {
    vi.mocked(findDtoUserByEmail).mockResolvedValue(makeUser({ email: 'new.user@example.com' }));

    const response = await POST(postRequest(creationDocument()));
    const document = await jsonBody(response);

    expect(response.status).toBe(409);
    expect(document).toMatchObject({
      errors: [
        {
          status: '409',
          code: 'user_already_exists',
          source: { pointer: '/data/attributes/email' },
        },
      ],
    });
    expect(createDtoUser).not.toHaveBeenCalled();
  });

  it('rejects an invalid creation document before accessing the database', async () => {
    const document = creationDocument();
    delete (document.data.attributes as Partial<typeof document.data.attributes>).password;

    const response = await POST(postRequest(document));

    expect(response.status).toBe(422);
    expect(await jsonBody(response)).toHaveProperty('errors');
    expect(findDtoUserByEmail).not.toHaveBeenCalled();
    expect(createDtoUser).not.toHaveBeenCalled();
  });

  it('returns 415 for a non-JSON:API request media type', async () => {
    const response = await POST(postRequest(creationDocument(), 'application/json'));

    expect(response.status).toBe(415);
    expect(await jsonBody(response)).toMatchObject({
      errors: [{ status: '415' }],
    });
    expect(findDtoUserByEmail).not.toHaveBeenCalled();
  });
});
