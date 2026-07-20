# Findings & Decisions

## Requirements

- Add `POST /api/users` using JSON:API request and response documents.
- Preserve the existing `GET /api/users` implementation.
- Keep collection operations restricted to authenticated administrators.

## Research Findings

- Next.js 16 route handlers read request bodies with the standard Web `Request` APIs.
- The installed `@jsonapi-serde/server` package provides `parseResourceRequest`, which validates `Content-Type`, JSON syntax, the top-level document, resource type, and Zod attribute schemas.
- The existing `CredentialCreationRequestSchema` requires `email`, an 8+ character password, a 4+ character name, and a USER or ADMIN role.
- Prisma's User model has a unique email and stores an optional password; the serializer omits passwords from output.

## Technical Decisions

| Decision                                            | Rationale                                                             |
| --------------------------------------------------- | --------------------------------------------------------------------- |
| Parse the raw body text with `parseResourceRequest` | Preserves JSON:API-specific 400/409/415/422 error handling            |
| Require an admin session                            | Prevents unauthenticated callers from assigning themselves ADMIN      |
| Use bcrypt hashing in the database helper           | Keeps credential persistence encapsulated and plaintext out of Prisma |
| Serialize the created DTO with status 201           | Reuses the established JSON:API resource serializer                   |

## Issues Encountered

| Issue                                                     | Resolution                                                                              |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Existing GET work is uncommitted                          | Make only additive or narrowly scoped edits and avoid resets                            |
| Local server lacks the Auth.js secret expected by Auth.js | Verified pre-auth response paths only; did not mutate environment or auth configuration |

## Resources

- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`
- `node_modules/@jsonapi-serde/server/dist/request/body.d.ts`
- `node_modules/@jsonapi-serde/server/dist/request/body.js`

## Visual/Browser Findings

- None.
