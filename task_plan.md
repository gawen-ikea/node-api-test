# Task Plan: JSON:API User Creation

## Goal

Implement an admin-only `POST /api/users` endpoint that accepts and returns JSON:API documents and safely persists credential users.

## Current Phase

Complete

## Phases

### Phase 1: Requirements & Discovery

- [x] Inspect the existing collection route, schemas, database helpers, and working tree
- [x] Read the bundled Next.js request-body guidance
- [x] Inspect the installed JSON:API parser's content-type and validation behavior
- **Status:** complete

### Phase 2: Design

- [x] Define the JSON:API request and response shapes
- [x] Define authentication, hashing, duplicate-email, and validation behavior
- **Status:** complete

### Phase 3: Implementation

- [x] Add credential-user persistence with password hashing
- [x] Add POST parsing, authorization, error handling, and 201 response
- [x] Add Location-header support to JSON:API document responses
- **Status:** complete

### Phase 4: Verification

- [x] Run formatting, lint, type-check, and production build
- [x] Smoke-test reachable HTTP error paths
- [x] Review the final diff for unrelated changes
- **Status:** complete

### Phase 5: Delivery

- [x] Summarize behavior and verification for the user
- **Status:** complete

## Key Questions

1. Who may create users? Existing collection access is admin-only and the input permits selecting a role, so creation must also be admin-only.
2. How should malformed requests be reported? Use the installed JSON:API parser so media-type, JSON syntax, type mismatch, and attribute errors become JSON:API error documents.

## Decisions Made

| Decision                                              | Rationale                                                             |
| ----------------------------------------------------- | --------------------------------------------------------------------- |
| Accept `data.type = users` with credential attributes | Matches JSON:API resource creation and the existing credential schema |
| Return 201 plus Location and the created resource     | JSON:API creation semantics                                           |
| Hash passwords before Prisma persistence              | Passwords must never be stored or serialized in plaintext             |
| Return 409 for duplicate email                        | A unique-email collision conflicts with current resource state        |

## Errors Encountered

| Error                                                | Attempt | Resolution                                                                                        |
| ---------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------- |
| Local smoke server reported missing Auth.js secret   | 1       | Limited live checks to pre-auth 406/401 behavior; production build and static checks remain valid |
| Planning-file patch context changed after formatting | 1       | Re-read the formatted sections and applied a context-correct patch                                |

## Notes

- Preserve the user's existing uncommitted GET implementation and related shared changes.
