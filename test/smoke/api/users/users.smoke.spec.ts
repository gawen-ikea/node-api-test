import { expect, test } from '@playwright/test';

import { createUser, JSON_API_MEDIA_TYPE, signIn, SMOKE_PASSWORD, uniqueSmokeEmail } from '../../support/api';

test.describe('/api/users POST tests', () => {
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  test('lets an administrator filter users by role', async ({ request }) => {
    // PLACEHOLDER
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  test('lets an administrator sort users by email', async ({ request }) => {
    // PLACEHOLDER
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  test('lets an administrator sort users by role', async ({ request }) => {
    // PLACEHOLDER
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  test('create 10 users then let an administrator get 5 users at page 2', async ({ request }) => {
    // PLACEHOLDER
  });
});
