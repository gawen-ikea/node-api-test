import { expect, test } from '@playwright/test';

import {
  createUser,
  JSON_API_MEDIA_TYPE,
  signIn,
  SMOKE_PASSWORD,
  type SmokeUserResource,
  uniqueSmokeEmail,
} from '../../support/api';

type UsersCollectionDocument = {
  data: SmokeUserResource[];
  links: {
    self: string;
    first: string;
    last: string;
    prev: string | null;
    next: string | null;
  };
  meta: {
    page: {
      number: number;
      size: number;
      total: number;
      totalPages: number;
    };
  };
};

test.describe('/api/users POST tests', () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  test('create a user with USER role and a user with ADMIN role', async ({ request }) => {
    // PLACEHOLDER
  });

  test('creates a user and rejects a duplicate email', async ({ request }) => {
    const email = uniqueSmokeEmail('create');
    const user = await createUser(request, {
      email,
      name: 'Smoke Create User',
      role: 'USER',
    });

    expect(user.id).toBeTruthy();

    const duplicateResponse = await request.post('/api/users', {
      headers: {
        'Content-Type': JSON_API_MEDIA_TYPE,
      },
      data: {
        data: {
          type: 'users',
          attributes: {
            email,
            password: SMOKE_PASSWORD,
            name: 'Smoke Duplicate User',
            role: 'USER',
          },
        },
      },
    });

    expect(duplicateResponse.status()).toBe(409);
    await expect(duplicateResponse.json()).resolves.toMatchObject({
      errors: [{ code: 'user_already_exists', status: '409' }],
    });
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  test('create a user with one charactor name, or missing other fields', async ({ request }) => {
    // PLACEHOLDER
  });
});

test.describe('/api/users GET tests', () => {
  test('rejects an unauthenticated collection request', async ({ request }) => {
    const response = await request.get('/api/users');

    expect(response.status()).toBe(401);
    expect(response.headers()['content-type']).toBe(JSON_API_MEDIA_TYPE);
  });

  test('forbids a member from listing users', async ({ request }) => {
    const member = await createUser(request, {
      email: uniqueSmokeEmail('list-member'),
      name: 'Smoke List Member',
      role: 'USER',
    });

    await signIn(request, { email: member.attributes.email });

    const response = await request.get('/api/users');
    expect(response.status()).toBe(403);
  });

  test('lets an administrator list users', async ({ request }) => {
    const administrator = await createUser(request, {
      email: uniqueSmokeEmail('list-admin'),
      name: 'Smoke List Admin',
      role: 'ADMIN',
    });
    const member = await createUser(request, {
      email: uniqueSmokeEmail('list-user'),
      name: 'Smoke Listed User',
      role: 'USER',
    });

    const sessionUser = await signIn(request, { email: administrator.attributes.email });
    expect(sessionUser).toMatchObject({ id: administrator.id, role: 'ADMIN' });

    const response = await request.get('/api/users?sort=email&page%5Bsize%5D=100');
    expect(response.status()).toBe(200);

    const document = (await response.json()) as {
      data: Array<{ id: string }>;
      meta: { page: { total: number } };
    };
    expect(document.data.map(({ id }) => id)).toEqual(expect.arrayContaining([administrator.id, member.id]));
    expect(document.meta.page.total).toBeGreaterThanOrEqual(2);
  });

  test('lets an administrator filter users by role', async ({ request }) => {
    const administrator = await createUser(request, {
      email: uniqueSmokeEmail('filter-admin'),
      name: 'Smoke Filter Admin',
      role: 'ADMIN',
    });
    const member = await createUser(request, {
      email: uniqueSmokeEmail('filter-member'),
      name: 'Smoke Filter Member',
      role: 'USER',
    });

    await signIn(request, { email: administrator.attributes.email });

    const response = await request.get('/api/users?filter%5Brole%5D=USER&page%5Bsize%5D=100');
    expect(response.status()).toBe(200);

    const document = (await response.json()) as UsersCollectionDocument;
    expect(document.data.length).toBeGreaterThan(0);
    expect(document.data.every(({ attributes }) => attributes.role === 'USER')).toBe(true);
    expect(document.data.map(({ id }) => id)).toContain(member.id);
    expect(document.data.map(({ id }) => id)).not.toContain(administrator.id);
    expect(document.meta.page.total).toBe(document.data.length);
  });

  test('lets an administrator sort users by email', async ({ request }) => {
    const administrator = await createUser(request, {
      email: uniqueSmokeEmail('email-sort-admin'),
      name: 'Smoke Email Sort Admin',
      role: 'ADMIN',
    });
    const users = await Promise.all(
      ['a', 'b', 'c'].map((suffix) =>
        createUser(request, {
          email: uniqueSmokeEmail(`sort-email-${suffix}`),
          name: `Smoke Email ${suffix.toUpperCase()}`,
          role: 'USER',
        }),
      ),
    );

    await signIn(request, { email: administrator.attributes.email });

    const response = await request.get('/api/users?sort=email&page%5Bsize%5D=100');
    expect(response.status()).toBe(200);

    const document = (await response.json()) as UsersCollectionDocument;
    const createdUserIds = new Set(users.map(({ id }) => id));
    const receivedEmails = document.data
      .filter(({ id }) => createdUserIds.has(id))
      .map(({ attributes }) => attributes.email);
    const expectedEmails = users.map(({ attributes }) => attributes.email).toSorted();

    expect(receivedEmails).toEqual(expectedEmails);
  });

  test('lets an administrator sort users by role', async ({ request }) => {
    const administrator = await createUser(request, {
      email: uniqueSmokeEmail('role-sort-admin'),
      name: 'Smoke Role Sort Admin',
      role: 'ADMIN',
    });
    const member = await createUser(request, {
      email: uniqueSmokeEmail('role-sort-member'),
      name: 'Smoke Role Sort Member',
      role: 'USER',
    });

    await signIn(request, { email: administrator.attributes.email });

    const response = await request.get('/api/users?sort=role&page%5Bsize%5D=100');
    expect(response.status()).toBe(200);

    const document = (await response.json()) as UsersCollectionDocument;
    const receivedIds = document.data.map(({ id }) => id);
    expect(receivedIds).toEqual(expect.arrayContaining([administrator.id, member.id]));

    const roleRank = { USER: 0, ADMIN: 1 } as const;
    const receivedRoles = document.data.map(({ attributes }) => attributes.role);
    expect(receivedRoles).toEqual(receivedRoles.toSorted((left, right) => roleRank[left] - roleRank[right]));
  });

  test('create 10 users then let an administrator get 5 users at page 2', async ({ request }) => {
    const administrator = await createUser(request, {
      email: uniqueSmokeEmail('page-admin'),
      name: 'Smoke Page Admin',
      role: 'ADMIN',
    });
    await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        createUser(request, {
          email: uniqueSmokeEmail(`page-user-${index}`),
          name: `Smoke Page User ${index}`,
          role: 'USER',
        }),
      ),
    );

    await signIn(request, { email: administrator.attributes.email });

    const response = await request.get('/api/users?sort=-createdAt&page%5Bnumber%5D=2&page%5Bsize%5D=5');
    expect(response.status()).toBe(200);

    const document = (await response.json()) as UsersCollectionDocument;
    expect(document.data).toHaveLength(5);
    expect(document.meta.page).toEqual({
      number: 2,
      size: 5,
      total: expect.any(Number),
      totalPages: expect.any(Number),
    });
    expect(document.meta.page.total).toBeGreaterThanOrEqual(11);
    expect(document.meta.page.totalPages).toBe(Math.ceil(document.meta.page.total / 5));
    expect(new URL(document.links.prev!).searchParams.get('page[number]')).toBe('1');
    expect(new URL(document.links.next!).searchParams.get('page[number]')).toBe('3');
  });
});
