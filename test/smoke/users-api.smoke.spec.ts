import { expect, test } from '@playwright/test';

import { createUser, JSON_API_MEDIA_TYPE, signIn, SMOKE_PASSWORD, uniqueSmokeEmail } from './support/api';

test.describe('users API smoke tests', () => {
  test('rejects unauthenticated reads of protected user resources', async ({ request }) => {
    const collectionResponse = await request.get('/api/users');
    expect(collectionResponse.status()).toBe(401);
    expect(collectionResponse.headers()['content-type']).toBe(JSON_API_MEDIA_TYPE);

    const resourceResponse = await request.get('/api/user/nonexistent-smoke-user');
    expect(resourceResponse.status()).toBe(401);
    expect(resourceResponse.headers()['content-type']).toBe(JSON_API_MEDIA_TYPE);
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

  test('lets a member read and update only their own profile', async ({ request }) => {
    const member = await createUser(request, {
      email: uniqueSmokeEmail('member'),
      name: 'Smoke Member User',
      role: 'USER',
    });
    const otherUser = await createUser(request, {
      email: uniqueSmokeEmail('other'),
      name: 'Smoke Other User',
      role: 'USER',
    });

    const sessionUser = await signIn(request, { email: member.attributes.email });
    expect(sessionUser).toMatchObject({ id: member.id, role: 'USER' });

    const ownProfileResponse = await request.get(`/api/user/${encodeURIComponent(member.id)}`);
    expect(ownProfileResponse.status()).toBe(200);
    await expect(ownProfileResponse.json()).resolves.toMatchObject({
      data: {
        id: member.id,
        type: 'users',
        attributes: { email: member.attributes.email, role: 'USER' },
      },
    });

    const otherProfileResponse = await request.get(`/api/user/${encodeURIComponent(otherUser.id)}`);
    expect(otherProfileResponse.status()).toBe(403);

    const updateResponse = await request.patch(`/api/user/${encodeURIComponent(member.id)}`, {
      headers: {
        'Content-Type': JSON_API_MEDIA_TYPE,
      },
      data: {
        data: {
          type: 'users',
          id: member.id,
          attributes: {
            name: 'Updated Smoke Member',
          },
        },
      },
    });
    expect(updateResponse.status()).toBe(200);
    await expect(updateResponse.json()).resolves.toMatchObject({
      data: {
        id: member.id,
        attributes: { name: 'Updated Smoke Member' },
      },
    });

    const collectionResponse = await request.get('/api/users');
    expect(collectionResponse.status()).toBe(403);
  });

  test('lets an administrator list users and delete another user', async ({ request }) => {
    const administrator = await createUser(request, {
      email: uniqueSmokeEmail('admin'),
      name: 'Smoke Admin User',
      role: 'ADMIN',
    });
    const member = await createUser(request, {
      email: uniqueSmokeEmail('delete'),
      name: 'Smoke Delete User',
      role: 'USER',
    });

    const sessionUser = await signIn(request, { email: administrator.attributes.email });
    expect(sessionUser).toMatchObject({ id: administrator.id, role: 'ADMIN' });

    const collectionResponse = await request.get('/api/users?sort=email&page%5Bsize%5D=100');
    expect(collectionResponse.status()).toBe(200);
    const collectionDocument = (await collectionResponse.json()) as {
      data: Array<{ id: string }>;
      meta: { page: { total: number } };
    };
    expect(collectionDocument.data.map(({ id }) => id)).toEqual(expect.arrayContaining([administrator.id, member.id]));
    expect(collectionDocument.meta.page.total).toBeGreaterThanOrEqual(2);

    const deleteResponse = await request.delete(`/api/user/${encodeURIComponent(member.id)}`);
    expect(deleteResponse.status()).toBe(204);
    expect(await deleteResponse.text()).toBe('');

    const deletedProfileResponse = await request.get(`/api/user/${encodeURIComponent(member.id)}`);
    expect(deletedProfileResponse.status()).toBe(404);
  });
});
