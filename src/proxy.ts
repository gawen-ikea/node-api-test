import { auth } from '@/auth/auth-core';

export { auth as proxy };

export const config = {
  // Run on application routes, but skip auth API routes, Next.js internals, and
  // static assets. Without a matcher, Proxy runs on every request (including
  // `_next/static`, image optimization, and public files), needlessly invoking
  // auth logic on assets.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
