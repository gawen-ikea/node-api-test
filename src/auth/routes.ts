import type { Session } from 'next-auth';

/**
 * Routes that are accessible with or without an authenticated session.
 *
 * Actions
 * -  Authenticated users - can access
 * -  Unauthenticated users - can access
 */
const publicRoutes = ['/', '/error', '/auth/signup'];

const publicRoutePrefixes = ['/api'];

/**
 * Authentication routes that redirect already authenticated users home.
 *
 * Actions
 * -  Authenticated users - redirect to home page
 * -  Unauthenticated users - can access
 */
const authenticationRoutes = ['/auth/login'];

export type AuthorizeByRouteResult =
  | {
      action: 'allow';
    }
  | {
      action: 'redirect';
      redirectTo: string;
    };

export function authorizeByRoute(pathName: string, auth: Session | null): AuthorizeByRouteResult {
  const isAuthenticated = !!auth;
  const isPublicRoute = publicRoutes.includes(pathName);
  const isPublicRoutePrefix = publicRoutePrefixes.some(
    (prefix) => pathName === prefix || pathName.startsWith(`${prefix}/`),
  );
  const isAuthenticationRoute = authenticationRoutes.includes(pathName);

  if (isPublicRoute || isPublicRoutePrefix) {
    return { action: 'allow' };
  }

  if (isAuthenticationRoute) {
    if (isAuthenticated) {
      return { action: 'redirect', redirectTo: '/' };
    } else {
      return { action: 'allow' };
    }
  }

  // Protected route
  if (isAuthenticated) {
    return { action: 'allow' };
  } else {
    // Keep this a relative URL (resolved against the request origin by the
    // caller). `new URL('/auth/login')` with no base would throw.
    const redirectTo = `/auth/login?redirect=${encodeURIComponent(pathName)}`;
    return { action: 'redirect', redirectTo };
  }
}
