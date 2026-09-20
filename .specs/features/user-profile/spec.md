# User Profile Specification

> Retroactive spec for what's shipped (`GET /profile`, both profile-image upload routes) plus the one piece that's specified but not built yet (editing profile fields). Grounded in `src/controllers/{Profile,ProfileImageUploadUrl,UploadProfileImage}Controller.ts` and `src/queues/ProcessProfileImage` equivalent.

## Problem Statement

A reseller needs to see and maintain their own account info (name, contact, avatar) inside the app. Today they can view it and change their avatar; they cannot yet edit name/phone/CPF/CNPJ — the iOS "Edit Profile" row exists but has nothing to call.

## Goals

- [x] A user can fetch their own profile, including avatar URL.
- [x] A user can set/replace their profile picture, either via a direct-to-S3 presigned upload or a through-API upload.
- [ ] A user can edit their name, lastname, phone, CPF, CNPJ.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Editing email | Email is the login identifier; changing it needs a verification flow not designed yet. |
| Role/tenant fields on the profile response (`role`, `adminOf`, `isSuperAdmin`) | Belongs to `multi-tenant-admin` (AD-004) — will extend this endpoint's response once that lands, not part of this spec. |
| Deleting the account | Covered by `auth` (`DELETE /users/me`). |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Google-linked accounts and profile pictures | Both upload routes reject with `400` if `googleSub` is set — Google accounts keep the Google-provided picture | Matches `ProfileImageUploadUrlController`/`UploadProfileImageController`; also HANDOFF.md notes Google picture URLs are never refreshed after first sign-in (separate gap, Trello backlog #174) | y |
| Two upload paths coexisting | Keep both (`GET /profile/image/upload-url` direct-to-S3, `POST /profile/image` through-API) until Trello #206 removes the direct-to-S3 one | AD-002 in `.specs/STATE.md` | y |
| Scope of "edit profile" (Trello #90) | name, lastname, phone, cpf, cnpj — same fields signup accepts, minus email/password | No card description beyond the field list HANDOFF.md §4.2 implies; treat as the default until designed | n — confirm when #90 is actually picked up |

**Open questions:** the exact edit-profile validation rules (e.g. can CPF be changed after signup, uniqueness re-check) are deferred to when Trello #90 is designed — logged above, not invented here.

---

## User Stories

### P1: View my profile ⭐ MVP

**User Story**: As a reseller, I want to see my own profile data, so the app can render my name/avatar.

**Why P1**: Every screen that shows "you" depends on this.

**Acceptance Criteria**:

1. WHEN an authenticated user calls `GET /profile` THEN the system SHALL return `200` with `id, type, name, lastname, phone, email, cpf, cnpj, image` for their own live account.
2. IF the JWT's user no longer exists or is soft-deleted THEN the system SHALL return `401`.

**Independent Test**: Log in, call `GET /profile`, confirm the returned `id` matches the logged-in user.

---

### P1: Set a profile picture ⭐ MVP

**User Story**: As a reseller, I want to upload an avatar, so my profile feels personal.

**Why P1**: Already shipped; documented here for traceability.

**Acceptance Criteria**:

1. WHEN a non-Google user calls `GET /profile/image/upload-url` with a `contentType` in `{png, jpeg, jpg, heic}` THEN the system SHALL return a presigned S3 POST (`url`, `fields`, `key`) scoped to `profile-images/{userId}/` with a 5 MB content-length condition.
2. WHEN a non-Google user calls `POST /profile/image` (multipart, ≤ 4 MB) with an allowed content type THEN the system SHALL store the file via the API and return the resulting `image` URL.
3. IF either route is called by a user whose `googleSub` is set THEN the system SHALL return `400` ("Accounts linked to Google use the profile picture provided by Google.").
4. WHEN an object lands under `profile-images/` (via either route) THEN the SQS-triggered consumer SHALL update `users.image` and delete the user's previous image object.
5. IF `POST /profile/image`'s file exceeds 4 MB THEN the system SHALL return `400` before touching S3.

**Independent Test**: Upload a picture via `POST /profile/image`, then `GET /profile` and see the new `image` URL; repeat for a Google-linked account and get `400` on both routes.

---

### P2: Edit my profile

**User Story**: As a reseller, I want to correct my name, phone, or document numbers after signup, so the app reflects who I actually am.

**Why P2**: Blocks the iOS "Edit Profile" row (a real, visible dead end today) but isn't required to demo the MVP profile view/avatar flow.

**Acceptance Criteria**:

1. WHEN an authenticated user calls `PUT /profile` (not yet implemented) with any of `name, lastname, phone, cpf, cnpj` THEN the system SHALL update only the provided fields and return the updated profile.
2. IF the new `cpf`/`cnpj` already belongs to a different live user THEN the system SHALL return `409`, mirroring `SignUpController`'s conflict check.

**Independent Test**: Not implementable yet — endpoint does not exist (Trello #90).

---

## Edge Cases

- IF a Google account's picture changes on Google's side THEN the system SHALL keep serving the stale URL stored at first sign-in (known gap, out of scope here, tracked separately as Trello #174).

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| PROFILE-01 | P1: View my profile | — | Verified (shipped) |
| PROFILE-02 | P1: Set a profile picture | — | Verified (shipped) |
| PROFILE-03 | P1: Set a profile picture | — | Verified (shipped) |
| PROFILE-04 | P2: Edit my profile | — | Pending (Trello #90, not started) |

**Coverage:** 4 total, 0 mapped to a formal `tasks.md`, 1 unmapped ⚠️ (PROFILE-04).

---

## Success Criteria

- [x] A user can view and re-set their avatar without leaving the app.
- [ ] The iOS "Edit Profile" row has a real endpoint to call.
