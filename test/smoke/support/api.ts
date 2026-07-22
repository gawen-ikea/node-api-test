import { randomUUID } from 'node:crypto';

import { expect, type APIRequestContext } from '@playwright/test';

import { SMOKE_EMAIL_DOMAIN } from './database';
import type { Role } from '../../../src/generated/prisma/enums';

export const JSON_API_MEDIA_TYPE = 'application/vnd.api+json';
export const SMOKE_PASSWORD = 'SmokeTestPassword123!';

export type SmokeUserResource = {
  type: 'users';
  id: string;
  attributes: {
    email: string;
    emailVerified: string | null;
    name: string;
    role: Role;
  };
};

type JsonApiResourceDocument = {
  data: SmokeUserResource;
};

type AuthSession = {
  user?: {
    id?: string;
    email?: string;
    role?: string;
  };
};

export function uniqueSmokeEmail(label: string): string {
  return `${label}-${randomUUID()}${SMOKE_EMAIL_DOMAIN}`;
}

export async function createUser(
  request: APIRequestContext,
  options: {
    email: string;
    name: string;
    role: Role;
    password?: string;
  },
): Promise<SmokeUserResource> {
  const response = await request.post('/api/users', {
    headers: {
      'Content-Type': JSON_API_MEDIA_TYPE,
    },
    data: {
      data: {
        type: 'users',
        attributes: {
          email: options.email,
          password: options.password ?? SMOKE_PASSWORD,
          name: options.name,
          role: options.role,
        },
      },
    },
  });

  expect(response.status(), await response.text()).toBe(201);
  expect(response.headers()['content-type']).toBe(JSON_API_MEDIA_TYPE);

  const document = (await response.json()) as JsonApiResourceDocument;
  expect(document.data).toMatchObject({
    type: 'users',
    attributes: {
      email: options.email,
      name: options.name,
      role: options.role,
    },
  });
  expect(response.headers().location).toContain(`/api/user/${encodeURIComponent(document.data.id)}`);

  return document.data;
}

export async function signIn(
  request: APIRequestContext,
  credentials: { email: string; password?: string },
): Promise<Required<AuthSession>['user']> {
  const csrfResponse = await request.get('/api/auth/csrf');
  const rspText = await csrfResponse.text();
  expect(csrfResponse.status(), rspText).toBe(200);
  const { csrfToken } = JSON.parse(rspText) as { csrfToken: string };
  expect(csrfToken).toBeTruthy();

  const callbackResponse = await request.post('/api/auth/callback/credentials', {
    headers: {
      'X-Auth-Return-Redirect': '1',
    },
    form: {
      email: credentials.email,
      password: credentials.password ?? SMOKE_PASSWORD,
      csrfToken,
      callbackUrl: '/',
    },
  });
  expect(callbackResponse.ok(), await callbackResponse.text()).toBe(true);

  const sessionResponse = await request.get('/api/auth/session');
  expect(sessionResponse.status(), await sessionResponse.text()).toBe(200);
  const session = (await sessionResponse.json()) as AuthSession;
  expect(session.user).toMatchObject({ email: credentials.email });

  return session.user!;
}
