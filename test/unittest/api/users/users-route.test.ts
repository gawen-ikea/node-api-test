import type { MockedFunction } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from 'next-auth';
import type { DtoUser } from '@/schema/db-schema';

vi.mock('@/auth/auth-core', () => ({
  auth: vi.fn(),
}));

vi.mock('@/data/db-auth', () => ({
  countDtoUsers: vi.fn(),
  createDtoUser: vi.fn(),
  findDtoUserByEmail: vi.fn(),
  findDtoUsers: vi.fn(),
}));

import { auth as nextAuth } from '@/auth/auth-core';
import { countDtoUsers, createDtoUser, findDtoUserByEmail, findDtoUsers } from '@/data/db-auth';
import { GET, POST } from '@/app/api/users/route';

const auth = nextAuth as unknown as MockedFunction<() => Promise<Session | null>>;

const JSON_API_MEDIA_TYPE = 'application/vnd.api+json';
const USERS_URL = 'http://localhost/api/users';

const adminSession: Session = {
  expires: '2099-01-01T00:00:00.000Z',
  user: {
    id: 'admin-id',
    email: 'admin@example.com',
    name: 'Admin User',
    role: 'ADMIN',
  },
};

const regularUserSession: Session = {
  expires: '2099-01-01T00:00:00.000Z',
  user: {
    id: 'user-id',
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

function getRequest(url = USERS_URL): Request {
  return new Request(url, {
    headers: { Accept: 'application/vnd.api+json' },
  });
}

function postRequest(url = USERS_URL, body: unknown): Request {
  return new Request(url, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json',
    },
    body: JSON.stringify(body),
  });
}

function creationNewDocument(email: string) {
  return {
    data: {
      type: 'users',
      attributes: {
        email,
        password: 'correct-horse-battery-staple',
        name: 'New User',
        role: 'USER',
      },
    },
  };
}

describe('GET /api/users', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns a JSON:API user collection for an administrator', async () => {
    const users = [makeUser(), makeUser({ id: 'admin-id', email: 'admin@example.com', role: 'ADMIN' })];
    vi.mocked(auth).mockResolvedValue(adminSession);
    vi.mocked(findDtoUsers).mockResolvedValue(users);
    vi.mocked(countDtoUsers).mockResolvedValue(2);

    const response = await GET(getRequest());
    const document = await response.json();

    expect(response.status, JSON.stringify(document)).toBe(200);
    expect(response.headers.get('content-type')).toBe(JSON_API_MEDIA_TYPE);
    expect(findDtoUsers).toHaveBeenCalledWith({
      filter: {},
      sort: [],
      page: { number: 1, size: 20 },
    });
    expect(countDtoUsers).toHaveBeenCalledWith({ filter: {} });
    expect(document).toMatchObject({
      links: { self: USERS_URL },
      meta: {
        page: { number: 1, size: 20, total: 2, totalPages: 1 },
      },
      data: [
        {
          type: 'users',
          id: 'user-id',
          attributes: {
            email: 'member@example.com',
            emailVerified: '2026-01-02T03:04:05.000Z',
            name: 'Member User',
            role: 'USER',
          },
        },
        {
          type: 'users',
          id: 'admin-id',
          attributes: { role: 'ADMIN' },
        },
      ],
    });
  });

  it('applies a JSON:API sparse fieldset', async () => {
    const url = `${USERS_URL}?fields%5Busers%5D=name`;
    vi.mocked(auth).mockResolvedValue(adminSession);
    vi.mocked(findDtoUsers).mockResolvedValue([makeUser()]);
    vi.mocked(countDtoUsers).mockResolvedValue(1);

    const response = await GET(getRequest(url));
    const document = await response.json();

    expect(response.status, JSON.stringify(document)).toBe(200);
    expect(document.data[0].attributes).toEqual({ name: 'Member User' });
  });

  it('applies filtering, multi-field sorting, and pagination', async () => {
    const url = `${USERS_URL}?filter%5Brole%5D=ADMIN&sort=-createdAt,name&page%5Bnumber%5D=2&page%5Bsize%5D=1`;
    const users = [makeUser({ id: 'admin-id', email: 'admin@example.com', role: 'ADMIN' })];
    vi.mocked(auth).mockResolvedValue(adminSession);
    vi.mocked(findDtoUsers).mockResolvedValue(users);
    vi.mocked(countDtoUsers).mockResolvedValue(3);

    const response = await GET(getRequest(url));
    const document = await response.json();

    expect(response.status, JSON.stringify(document)).toBe(200);
    expect(findDtoUsers).toHaveBeenCalledWith({
      filter: { role: 'ADMIN' },
      sort: [
        { field: 'createdAt', order: 'desc' },
        { field: 'name', order: 'asc' },
      ],
      page: { number: 2, size: 1 },
    });
    expect(countDtoUsers).toHaveBeenCalledWith({ filter: { role: 'ADMIN' } });
    expect(document.meta.page).toEqual({ number: 2, size: 1, total: 3, totalPages: 3 });

    expect(new URL(document.links.first).searchParams.get('page[number]')).toBe('1');
    expect(new URL(document.links.last).searchParams.get('page[number]')).toBe('3');
    expect(new URL(document.links.prev).searchParams.get('page[number]')).toBe('1');
    expect(new URL(document.links.next).searchParams.get('page[number]')).toBe('3');
    expect(new URL(document.links.next).searchParams.get('filter[role]')).toBe('ADMIN');
    expect(new URL(document.links.next).searchParams.get('sort')).toBe('-createdAt,name');
  });

  it.each([
    [`${USERS_URL}?filter%5Brole%5D=OWNER`, 'filter[role]'],
    [`${USERS_URL}?page%5Bnumber%5D=0`, 'page[number]'],
    [`${USERS_URL}?page%5Bsize%5D=101`, 'page[size]'],
    [`${USERS_URL}?sort=password`, 'sort'],
  ])('rejects an invalid collection query: %s', async (url, sourceParameter) => {
    vi.mocked(auth).mockResolvedValue(adminSession);

    const response = await GET(getRequest(url));
    const document = await response.json();

    expect(response.status).toBe(400);
    expect(document.errors[0].source).toEqual({ parameter: sourceParameter });
    expect(findDtoUsers).not.toHaveBeenCalled();
  });

  it('returns consistent pagination metadata and links for an empty collection', async () => {
    const url = `${USERS_URL}?page%5Bnumber%5D=300`;
    vi.mocked(auth).mockResolvedValue(adminSession);
    vi.mocked(findDtoUsers).mockResolvedValue([]);
    vi.mocked(countDtoUsers).mockResolvedValue(0);

    const response = await GET(getRequest(url));
    const document = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe(JSON_API_MEDIA_TYPE);
    expect(findDtoUsers).toHaveBeenCalledWith({
      filter: {},
      sort: [],
      page: { number: 300, size: 20 },
    });
    expect(countDtoUsers).toHaveBeenCalledWith({ filter: {} });
    expect(document.meta.page).toEqual({ number: 300, size: 20, total: 0, totalPages: 1 });
    expect(document.data).toEqual([]);
    expect(new URL(document.links.last).searchParams.get('page[number]')).toBe('1');
    expect(new URL(document.links.prev).searchParams.get('page[number]')).toBe('299');
    expect(document.links.next).toBeNull();
  });

  it('returns 400 when sorting by a field that does not exist', async () => {
    const url = `${USERS_URL}?sort=doesNotExist`;
    vi.mocked(auth).mockResolvedValue(adminSession);

    const response = await GET(getRequest(url));
    const document = await response.json();

    expect(response.status).toBe(400);
    expect(response.headers.get('content-type')).toBe(JSON_API_MEDIA_TYPE);
    expect(document).toMatchObject({
      errors: [
        {
          status: '400',
          code: 'invalid_sort_field',
          source: { parameter: 'sort' },
        },
      ],
    });
    expect(findDtoUsers).not.toHaveBeenCalled();
    expect(countDtoUsers).not.toHaveBeenCalled();
  });

  it('returns 400 when filtering by a role that does not exist', async () => {
    const url = `${USERS_URL}?filter%5Brole%5D=SUPER_ADMIN`;
    vi.mocked(auth).mockResolvedValue(adminSession);

    const response = await GET(getRequest(url));
    const document = await response.json();

    expect(response.status).toBe(400);
    expect(response.headers.get('content-type')).toBe(JSON_API_MEDIA_TYPE);
    expect(document).toMatchObject({
      errors: [
        {
          status: '400',
          code: 'invalid_value',
          source: { parameter: 'filter[role]' },
        },
      ],
    });
    expect(findDtoUsers).not.toHaveBeenCalled();
    expect(countDtoUsers).not.toHaveBeenCalled();
  });

  it('returns 401 when there is no authenticated user', async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const response = await GET(getRequest());
    const document = await response.json();

    expect(response.status).toBe(401);
    expect(document).toMatchObject({
      errors: [{ status: '401', code: 'unauthorized', title: 'Unauthorized' }],
    });
    expect(findDtoUsers).not.toHaveBeenCalled();
  });

  it('returns 403 when an authenticated user is not an administrator', async () => {
    vi.mocked(auth).mockResolvedValue(regularUserSession);

    const response = await GET(getRequest());
    const document = await response.json();

    expect(response.status).toBe(403);
    expect(document).toMatchObject({
      errors: [{ status: '403', code: 'forbidden', title: 'Forbidden' }],
    });
    expect(findDtoUsers).not.toHaveBeenCalled();
  });

  it('returns 500 when an exception happens during quering database', async () => {
    vi.mocked(auth).mockResolvedValue(adminSession);
    vi.mocked(findDtoUsers).mockRejectedValue(new Error('Database connection error'));

    const response = await GET(getRequest());
    const document = await response.json();

    expect(response.status).toBe(500);
    expect(response.headers.get('content-type')).toBe(JSON_API_MEDIA_TYPE);
    expect(document).toMatchObject({
      errors: [
        {
          status: '500',
          code: 'internal_server_error',
          title: 'Internal Server Error',
        },
      ],
    });
    expect(findDtoUsers).toHaveBeenCalledWith({
      filter: {},
      sort: [],
      page: { number: 1, size: 20 },
    });
    expect(countDtoUsers).not.toHaveBeenCalled();
  });
});

describe('POST /api/users', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('creates a user and returns a JSON:API resource with a Location header', async () => {
    const createdUser = makeUser({ email: 'new.user@example.com', name: 'New User' });
    vi.mocked(findDtoUserByEmail).mockResolvedValue(null);
    vi.mocked(createDtoUser).mockResolvedValue(createdUser);

    const response = await POST(postRequest(USERS_URL, creationNewDocument('new.user@example.com')));
    const document = await response.json();

    expect(response.status).toBe(201);
    expect(response.headers.get('content-type')).toBe(JSON_API_MEDIA_TYPE);
    expect(response.headers.get('location')).toBe(`http://localhost/api/user/${encodeURIComponent(document.data.id)}`);
    expect(findDtoUserByEmail).toHaveBeenCalledWith('new.user@example.com');
    expect(createDtoUser).toHaveBeenCalledWith({
      email: 'new.user@example.com',
      password: 'correct-horse-battery-staple',
      name: 'New User',
      role: 'USER',
    });
    expect(document).toMatchObject({
      links: { self: `http://localhost/api/user/${encodeURIComponent(document.data.id)}` },
      data: {
        type: 'users',
        id: document.data.id,
        attributes: { email: 'new.user@example.com', name: 'New User', role: 'USER' },
      },
    });
  });

  it('returns 409 when the user already exists', async () => {
    vi.mocked(findDtoUserByEmail).mockResolvedValue(makeUser({ email: 'new.user@example.com' }));

    const response = await POST(postRequest(USERS_URL, creationNewDocument('new.user@example.com')));
    const document = await response.json();

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
    const document = creationNewDocument('new.user@example.com');
    delete (document.data.attributes as Partial<typeof document.data.attributes>).password;

    const response = await POST(postRequest(USERS_URL, document));
    const received = await response.json();
    expect(response.status).toBe(422);
    expect(received).toHaveProperty('errors');
    expect(findDtoUserByEmail).not.toHaveBeenCalled();
    expect(createDtoUser).not.toHaveBeenCalled();
  });

  it('returns 500 when createDtoUser throws', async () => {
    vi.mocked(findDtoUserByEmail).mockResolvedValue(null);
    vi.mocked(createDtoUser).mockRejectedValue(new Error('Database connection error'));

    const response = await POST(postRequest(USERS_URL, creationNewDocument('new.user@example.com')));
    const received = await response.json();

    expect(response.status).toBe(500);
    expect(received).toMatchObject({
      errors: [{ status: '500' }],
    });
    expect(findDtoUserByEmail).toHaveBeenCalled();
    expect(createDtoUser).toHaveBeenCalled();
  });

  it('returns 500 when an exception happened with data query', async () => {
    vi.mocked(findDtoUserByEmail).mockRejectedValue(new Error('Database connection error'));
    const response = await POST(postRequest(USERS_URL, creationNewDocument('new.user@example.com')));
    const received = await response.json();
    expect(response.status).toBe(500);
    expect(received).toMatchObject({
      errors: [{ status: '500' }],
    });
    expect(findDtoUserByEmail).toHaveBeenCalled();
  });
});
