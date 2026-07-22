import { expect, test } from '@playwright/test';

import { createUser, JSON_API_MEDIA_TYPE, signIn, uniqueSmokeEmail } from '../../../support/api';

test.describe('/api/user/[uid] smoke tests', () => {
  test('rejects an unauthenticated profile request', async ({ request }) => {
    const response = await request.get('/api/user/nonexistent-smoke-user');

    expect(response.status()).toBe(401);
    expect(response.headers()['content-type']).toBe(JSON_API_MEDIA_TYPE);
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
  });

  test('lets an administrator delete another user', async ({ request }) => {
    const administrator = await createUser(request, {
      email: uniqueSmokeEmail('delete-admin'),
      name: 'Smoke Delete Admin',
      role: 'ADMIN',
    });
    const member = await createUser(request, {
      email: uniqueSmokeEmail('delete-member'),
      name: 'Smoke Delete Member',
      role: 'USER',
    });

    const sessionUser = await signIn(request, { email: administrator.attributes.email });
    expect(sessionUser).toMatchObject({ id: administrator.id, role: 'ADMIN' });

    const deleteResponse = await request.delete(`/api/user/${encodeURIComponent(member.id)}`);
    expect(deleteResponse.status()).toBe(204);
    expect(await deleteResponse.text()).toBe('');

    const deletedProfileResponse = await request.get(`/api/user/${encodeURIComponent(member.id)}`);
    expect(deletedProfileResponse.status()).toBe(404);
  });
});
