# Auth Specification

> Retroactive spec — this feature already shipped (Trello list "ENTREGUES EM 2026.1"). Written from the current implementation (`src/controllers/{SignUp,Login,GoogleAuth,Logout,DeleteUser}Controller.ts`) to give it a traceable record instead of leaving it undocumented.

## Problem Statement

Resellers need an account to browse the catalog and (eventually) place orders, and the workshop owner needs to be able to sign in as an admin. The app supports both password-based accounts and Google sign-in.

## Goals

- [x] A reseller can create an account with email/password or Google, and log back in.
- [x] A user can end their session and permanently deactivate their account.
- [x] An admin can deactivate any user's account, not only their own.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Password reset / forgot password | Needs AWS SES, not provisioned. Tracked separately (Trello #95-97), not part of this spec. |
| Sign in with Apple | Planned (Trello #92, #94) but not started. |
| Multi-tenant / role-aware auth (`super_admin`, `tenant_admin`) | Superseded by AD-004 in `.specs/STATE.md` — will replace the `admin`/`client` model described here. Tracked in `multi-tenant-admin`. |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Password minimum length | 8 characters, enforced by Zod on signup | Matches `SignUpController`'s schema (`password: z.string().min(8, ...)`) | y |
| Google-only accounts | `password` column is nullable; login rejects with a pointer to `/auth/google` if null | Matches `LoginController`'s explicit check | y |
| Self-service delete vs admin delete | Both allowed: `DELETE /users/me` for self, admin can delete via `params.userId`/`params.id`, but `serverless.yml` only wires the `/me` route today | Matches `DeleteUserController`'s logic, which already supports a target id the route doesn't expose yet (Trello #103) | y |

**Open questions:** none — all resolved above.

---

## User Stories

### P1: Sign up and log in ⭐ MVP

**User Story**: As a reseller, I want to create an account with my email and password (or with Google) and log back in later, so that my cart/orders are tied to my identity.

**Why P1**: Nothing else in the app works without an authenticated user.

**Acceptance Criteria**:

1. WHEN a client calls `POST /signup` with a unique email, a password of at least 8 characters, and no existing CPF/CNPJ conflict THEN the system SHALL create the user, hash the password with bcrypt, and return `201` with an `accessToken`.
2. IF `POST /signup` is called with an email, CPF, or CNPJ that already belongs to a live (non-deleted) user THEN the system SHALL return `409 Conflict` and SHALL NOT create a row.
3. IF `POST /signup` body fails schema validation (missing name, invalid email, password under 8 characters) THEN the system SHALL return `400` with field-level errors and SHALL NOT create a row.
4. WHEN a client calls `POST /login` with an email and password that match a live user with a password set THEN the system SHALL return `200` with a fresh `accessToken`.
5. IF `POST /login` is called with an email that does not match any live user, or a wrong password THEN the system SHALL return `401` with a generic "Invalid email or password" message (never revealing which field was wrong).
6. IF `POST /login` is called for an account created via Google (`password` is null) THEN the system SHALL return `401` pointing the caller to `/auth/google`.
7. WHEN a client calls `POST /auth/google` with a valid Google ID token THEN the system SHALL find-or-create the user by `google_sub` and return an `accessToken`.

**Independent Test**: Sign up with a fresh email, then log in with the same credentials and receive a token; attempt login with a wrong password and get `401`.

---

### P2: End a session and deactivate an account

**User Story**: As a user, I want to log out and, if I choose, permanently delete my account, so that I control my data.

**Why P2**: Not required to demo the MVP signup/login flow, but required before the app can be considered complete.

**Acceptance Criteria**:

1. WHEN an authenticated user calls `POST /logout` THEN the system SHALL return `200` (session invalidation is client-side — the API is stateless JWT, there is no server-side token blacklist).
2. WHEN an authenticated user calls `DELETE /users/me` THEN the system SHALL soft-delete their own row (`deleted_at` set) and return `200`.
3. WHEN an authenticated **admin** calls the delete-user path with a target `userId` different from their own THEN the system SHALL soft-delete the target user — but note this path is not yet exposed by `serverless.yml` (only `/users/me` is routed today; see Trello #103).
4. IF a non-admin calls delete for a `userId` other than their own THEN the system SHALL return `403`.
5. IF the target user is already soft-deleted or does not exist THEN the system SHALL return `404`.

**Independent Test**: Log in, call `DELETE /users/me`, then attempt to log in again with the same credentials and get `401` (deleted users are filtered out of `isNull(deletedAt)` reads).

---

## Edge Cases

- IF a soft-deleted user's email is reused for a new signup THEN the system SHALL still reject it as taken — `conflictIfUserPropertyExists` does not filter by `deletedAt`, so a deleted account's email/CPF/CNPJ stays reserved forever. **This is a real gap, not a designed behavior** — flag it if account deletion needs to free up the email for reuse.
- IF the JWT is missing, malformed, or expired on any protected route THEN the system SHALL return `401` (enforced by `parseProtectedEvent`, outside this controller layer).

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| AUTH-01 | P1: Sign up and log in | — | Verified (shipped) |
| AUTH-02 | P1: Sign up and log in | — | Verified (shipped) |
| AUTH-03 | P1: Sign up and log in | — | Verified (shipped) |
| AUTH-04 | P2: End a session / deactivate | — | Verified (shipped) |
| AUTH-05 | P2: End a session / deactivate | — | Pending (route not exposed — Trello #103) |

**Coverage:** 5 total, 0 mapped to a formal `tasks.md` (retroactive spec, no Design/Tasks phase run), 1 unmapped ⚠️ (AUTH-05, blocked on routing work).

---

## Success Criteria

- [x] A reseller can go from zero to an authenticated session via either signup or Google, in one call.
- [ ] An admin can deactivate any account by id once Trello #103 exposes the route.
