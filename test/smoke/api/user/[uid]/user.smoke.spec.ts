import { expect, test, type APIRequestContext } from '@playwright/test';

import { createUser, JSON_API_MEDIA_TYPE, signIn, uniqueSmokeEmail } from '../../../support/api';

function patchUser(request: APIRequestContext, userId: string, attributes: Record<string, unknown>) {
  return request.patch(`/api/user/${encodeURIComponent(userId)}`, {
    headers: {
      'Content-Type': JSON_API_MEDIA_TYPE,
    },
    data: {
      data: {
        type: 'users',
        id: userId,
        attributes,
      },
    },
  });
}

test.describe('/api/user/[uid] GET tests', () => {
  test('let a user with USER role to fetch own profile', async ({ request }) => {
    const member = await createUser(request, {
      email: uniqueSmokeEmail('get-member'),
      name: 'Smoke Get Member',
      role: 'USER',
    });

    await signIn(request, { email: member.attributes.email });

    const response = await request.get(`/api/user/${encodeURIComponent(member.id)}`);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toBe(JSON_API_MEDIA_TYPE);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        type: 'users',
        id: member.id,
        attributes: {
          email: member.attributes.email,
          name: member.attributes.name,
          role: 'USER',
        },
      },
    });
  });

  test('let a user with ADMIN role to fetch own profile', async ({ request }) => {
    const administrator = await createUser(request, {
      email: uniqueSmokeEmail('get-admin'),
      name: 'Smoke Get Admin',
      role: 'ADMIN',
    });

    await signIn(request, { email: administrator.attributes.email });

    const response = await request.get(`/api/user/${encodeURIComponent(administrator.id)}`);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toBe(JSON_API_MEDIA_TYPE);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        type: 'users',
        id: administrator.id,
        attributes: {
          email: administrator.attributes.email,
          name: administrator.attributes.name,
          role: 'ADMIN',
        },
      },
    });
  });

  test('let a user with ADMIN role to fetch other user profile', async ({ request }) => {
    const administrator = await createUser(request, {
      email: uniqueSmokeEmail('get-other-admin'),
      name: 'Smoke Other Admin',
      role: 'ADMIN',
    });
    const member = await createUser(request, {
      email: uniqueSmokeEmail('get-other-member'),
      name: 'Smoke Other Member',
      role: 'USER',
    });

    await signIn(request, { email: administrator.attributes.email });

    const response = await request.get(`/api/user/${encodeURIComponent(member.id)}`);
    expect(response.status()).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        type: 'users',
        id: member.id,
        attributes: { email: member.attributes.email, role: 'USER' },
      },
    });
  });

  test('reject a user with USER role to fetch other user profile', async ({ request }) => {
    const member = await createUser(request, {
      email: uniqueSmokeEmail('forbidden-member'),
      name: 'Smoke Forbidden Member',
      role: 'USER',
    });
    const otherUser = await createUser(request, {
      email: uniqueSmokeEmail('forbidden-other'),
      name: 'Smoke Forbidden Other',
      role: 'USER',
    });

    await signIn(request, { email: member.attributes.email });

    const response = await request.get(`/api/user/${encodeURIComponent(otherUser.id)}`);
    expect(response.status()).toBe(403);
    expect(response.headers()['content-type']).toBe(JSON_API_MEDIA_TYPE);
    await expect(response.json()).resolves.toMatchObject({
      errors: [{ status: '403', code: 'forbidden' }],
    });
  });

  test('rejects an unauthenticated profile request', async ({ request }) => {
    const response = await request.get('/api/user/nonexistent-smoke-user');

    expect(response.status()).toBe(401);
    expect(response.headers()['content-type']).toBe(JSON_API_MEDIA_TYPE);
  });

  test('let a user with USER role to fetch own profile with role field only', async ({ request }) => {
    const member = await createUser(request, {
      email: uniqueSmokeEmail('role-field-member'),
      name: 'Smoke Role Field Member',
      role: 'USER',
    });

    await signIn(request, { email: member.attributes.email });

    const response = await request.get(`/api/user/${encodeURIComponent(member.id)}?fields%5Busers%5D=role`);
    expect(response.status()).toBe(200);
    const document = (await response.json()) as {
      data: { id: string; type: string; attributes: Record<string, unknown> };
    };
    expect(document.data).toMatchObject({ id: member.id, type: 'users' });
    expect(document.data.attributes).toEqual({ role: 'USER' });
  });

  test('rejects a user with USER role to fetch own profile and sort by email', async ({ request }) => {
    const member = await createUser(request, {
      email: uniqueSmokeEmail('invalid-sort-member'),
      name: 'Smoke Invalid Sort Member',
      role: 'USER',
    });

    await signIn(request, { email: member.attributes.email });

    const response = await request.get(`/api/user/${encodeURIComponent(member.id)}?sort=email`);
    expect(response.status()).toBe(400);
    expect(response.headers()['content-type']).toBe(JSON_API_MEDIA_TYPE);
    await expect(response.json()).resolves.toMatchObject({
      errors: [
        {
          status: '400',
          code: 'invalid_type',
          title: "'sort' parameter is not supported",
          source: { parameter: 'sort' },
        },
      ],
    });
  });
});

test.describe('/api/user/[uid] PATCH tests', () => {
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

  test('let an admin to change his own profile to USER role', async ({ request }) => {
    const administrator = await createUser(request, {
      email: uniqueSmokeEmail('demote-admin'),
      name: 'Smoke Demote Admin',
      role: 'ADMIN',
    });

    await signIn(request, { email: administrator.attributes.email });

    const response = await patchUser(request, administrator.id, { role: 'USER' });
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toBe(JSON_API_MEDIA_TYPE);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        type: 'users',
        id: administrator.id,
        attributes: { role: 'USER' },
      },
    });
  });

  test('reject a member to change his own profile to ADMIN role', async ({ request }) => {
    const member = await createUser(request, {
      email: uniqueSmokeEmail('promote-member'),
      name: 'Smoke Promote Member',
      role: 'USER',
    });

    await signIn(request, { email: member.attributes.email });

    const response = await patchUser(request, member.id, { role: 'ADMIN' });
    expect(response.status()).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      errors: [{ status: '403', code: 'forbidden' }],
    });
  });

  test('reject a member to change his name to a single character', async ({ request }) => {
    const member = await createUser(request, {
      email: uniqueSmokeEmail('short-name-member'),
      name: 'Smoke Short Name Member',
      role: 'USER',
    });

    await signIn(request, { email: member.attributes.email });

    const response = await patchUser(request, member.id, { name: 'A' });
    expect(response.status()).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      errors: [
        {
          status: '422',
          code: 'too_small',
          source: { pointer: '/data/attributes/name' },
        },
      ],
    });
  });

  test('reject a member to change other user profile', async ({ request }) => {
    const member = await createUser(request, {
      email: uniqueSmokeEmail('cross-update-member'),
      name: 'Smoke Cross Update Member',
      role: 'USER',
    });
    const otherUser = await createUser(request, {
      email: uniqueSmokeEmail('cross-update-other'),
      name: 'Smoke Cross Update Other',
      role: 'USER',
    });

    await signIn(request, { email: member.attributes.email });

    const response = await patchUser(request, otherUser.id, { name: 'Forbidden Update' });
    expect(response.status()).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      errors: [{ status: '403', code: 'forbidden' }],
    });
  });

  test('reject an ADMIN to change others user name to one character', async ({ request }) => {
    const administrator = await createUser(request, {
      email: uniqueSmokeEmail('short-name-admin'),
      name: 'Smoke Short Name Admin',
      role: 'ADMIN',
    });
    const member = await createUser(request, {
      email: uniqueSmokeEmail('short-name-target'),
      name: 'Smoke Short Name Target',
      role: 'USER',
    });

    await signIn(request, { email: administrator.attributes.email });

    const response = await patchUser(request, member.id, { name: 'A' });
    expect(response.status()).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      errors: [
        {
          status: '422',
          code: 'too_small',
          source: { pointer: '/data/attributes/name' },
        },
      ],
    });
  });

  test('reject an unauthenticated user to change any profile', async ({ request }) => {
    const member = await createUser(request, {
      email: uniqueSmokeEmail('unauthenticated-update'),
      name: 'Smoke Unauthenticated Update',
      role: 'USER',
    });

    const response = await patchUser(request, member.id, { name: 'Unauthorized Update' });
    expect(response.status()).toBe(401);
    expect(response.headers()['content-type']).toBe(JSON_API_MEDIA_TYPE);
    await expect(response.json()).resolves.toMatchObject({
      errors: [{ status: '401', code: 'unauthorized' }],
    });
  });
});

test.describe('/api/user/[uid] DELETE tests', () => {
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
