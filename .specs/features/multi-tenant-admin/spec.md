# Multi-Tenant Admin Specification

> Forward-looking spec for the **next** feature up in Trello's Phase 0 (cards #75, #76, #186, #187, #188, plus the Phase-2 admin endpoints #193, #200 and the Phase-5 tests #202 that depend on it). Not started — no code exists against this yet. The design decisions below are not new; they were already made in `HANDOFF.md` §7 ("Addendum — admin roles are in scope") and on the Trello board. This spec formalizes them into EARS-testable criteria instead of re-litigating them.

## Problem Statement

The app is growing an admin-only tab for managing the catalog. Today `users.type` is only `admin | client`, and `admin` implicitly means "admin of everything" — there is no concept of which business/workshop (tenant) a user or product belongs to. Before cart/orders tables exist (which would need a painful data migration to retrofit), the project needs: a `tenant_id` on `products`, a two-level admin model (super admin vs. per-tenant admin), and an authorization primitive that replaces today's all-or-nothing `requireAdmin`.

## Goals

- [ ] Every `products` row (and future `orders`/`carts` rows) is scoped to a tenant.
- [ ] A `super_admin` (lead developer) can act on any tenant; a `tenant_admin` (business owner) can only act on their own tenant(s).
- [ ] Every route currently gated by `requireAdmin` is re-gated by tenant-aware authorization without silently widening access.
- [ ] The client can tell whether to show the Admin tab from `GET /profile` alone, no extra round trip.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Tenant sign-up / self-service tenant creation | HANDOFF.md §6 open question #5 answered: tenants are owner-provisioned, not self-serve. |
| `GET /admin/products` and `PATCH /products/{id}/stock` request/response shapes | Tracked as their own Trello cards (#193, #200); they consume this feature's authorization primitive but are designed separately. |
| Cart/orders tenant scoping | Comes after this feature by design (AD-004) — those tables don't exist yet. |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Two admin levels | `users.type` gains `super_admin`; a new `tenant_admins` table (`id, tenant_id, user_id, role: owner\|manager, timestamps, deleted_at`, unique on `(tenant_id, user_id)` among live rows) grants tenant-scoped admin | HANDOFF.md §7, already decided | y |
| Authorization primitive | `requireAdmin(userId)` is **replaced** by `requireTenantAdmin(userId, tenantId)`. Super admin always passes; a tenant admin passes only for their own tenant; anything else is `403`. | HANDOFF.md §7 | y |
| Where `tenantId` comes from | Always the JWT claim, never the request body or query string | HANDOFF.md §7 — explicit security requirement to prevent a client from asserting its own tenant | y |
| JWT/profile shape | JWT gains `role` and `tenantId` claims; `GET /profile` gains `role`, `adminOf`, `isSuperAdmin` | HANDOFF.md §7 | y |
| Tokens issued before this change | Absent `role` claim is treated as `client` | HANDOFF.md §7 — backward compatibility for tokens already in the wild | y |
| Migration ordering | Land before `cart-and-orders` (Phase 3), never after | HANDOFF.md §7 — retrofitting tenant scoping onto transactional tables later is far more expensive | y |
| A tenant admin who administers more than one tenant | JWT carries `adminOf: string[]` (every tenant id the user administers) instead of a single `tenantId`; `requireTenantAdmin(userId, tenantId)` allows when `isSuperAdmin` or `tenantId ∈ adminOf` — no DB call needed on the hot path. `tenantId` for a resource-scoped mutation is read from the resource's own `tenant_id` column, never the client; for an ambiguous tenant-scoped listing, a client-supplied `tenantId` is accepted only as a selector and is cross-checked against `adminOf` before use — it is never trusted on its own | AD-006 in `.specs/STATE.md` — keeps one token usable across every tenant a manager administers, avoids a login/switch-tenant flow, and preserves the "never trust a client-supplied tenant" property from AC 5 below by only ever using client input to *select within* the token's own authorized set | y |

**Open questions:** none carried over from HANDOFF/Trello. Two implicit-requirement gaps surfaced while writing this spec; one is resolved below, one is logged as a real open question:

- **Products created before this migration have no `tenant_id`.** Backfill strategy (single default tenant for all existing rows? require a manual assignment?) is not decided. Chosen default: backfill every existing `products` row to one "default"/legacy tenant owned by the super admin, so no product silently disappears from every tenant-scoped query the day this ships. Confirmed: n — flag before implementing the migration.
- **A user administering more than one tenant** — resolved, see AD-006 in `.specs/STATE.md` and the updated P2 story below. Confirmed: y.

---

## User Stories

### P1: Scope products to a tenant ⭐ MVP

**User Story**: As the system, I want every product to belong to exactly one tenant, so a future tenant-scoped query never leaks another tenant's catalog.

**Why P1**: Every other story in this feature depends on the column existing.

**Acceptance Criteria**:

1. The system SHALL add a `tenant_id` column to `products`, not nullable after backfill.
2. WHEN the migration runs THEN the system SHALL backfill every existing `products` row to the default/legacy tenant (see Assumptions).
3. WHILE any query reads or writes `products` THEN the system SHALL scope it by `tenant_id` (super admin queries excepted, see P2).

**Independent Test**: After migration, every row in `products` has a non-null `tenant_id`; a query filtered by a different tenant's id returns zero of the pre-existing rows.

---

### P1: Two-level admin authorization ⭐ MVP

**User Story**: As a tenant admin, I want to manage only my own tenant's catalog, and as the super admin, I want to manage every tenant's, so access matches who actually owns what.

**Why P1**: This is the actual security boundary the Admin tab depends on.

**Acceptance Criteria**:

1. WHEN `requireTenantAdmin(userId, tenantId)` is called for a user whose `type = 'super_admin'` THEN the system SHALL allow the action regardless of `tenantId`.
2. WHEN `requireTenantAdmin(userId, tenantId)` is called for a user with a live `tenant_admins` row matching that `tenantId` THEN the system SHALL allow the action.
3. IF `requireTenantAdmin(userId, tenantId)` is called for any other user (no matching tenant-admin row, not super admin) THEN the system SHALL return `403`.
4. IF the calling user's session is invalid or the account is soft-deleted THEN the system SHALL return `401` before evaluating tenant membership (matches `requireAdmin`'s existing precedence).
5. The system SHALL derive `tenantId` for `requireTenantAdmin` either from the resource being acted on (its own `tenant_id` column) or from the verified JWT's `adminOf` claim — a client-supplied `tenantId` from `params`/`query`/`body` MAY be used to *select* which of the caller's own tenants a listing applies to, but MUST be checked against `adminOf` before use and MUST NEVER be trusted to grant access on its own (see AD-006).
6. WHEN every existing `requireAdmin(userId)` call site (`CreateProductController`, `UpdateProductController`, `DeleteProductController`, `UploadProductImageController`, `DeleteUserController`'s admin branch) is migrated THEN the system SHALL NOT grant access to any caller who would have failed the old check, and SHALL NOT deny access to the super admin who would have passed it.

**Independent Test**: Two tenants, two tenant admins, one super admin. Tenant admin A can mutate tenant A's products, gets `403` on tenant B's; super admin can mutate both.

---

### P2: Expose role and tenant on session and profile

**User Story**: As a client app, I want to know from my session/profile whether I'm an admin and of what, so I can decide whether to render the Admin tab without an extra call.

**Why P2**: Needed before iOS can gate the tab (Trello #194), but the authorization boundary (P1) is the part that actually protects data.

**Acceptance Criteria**:

1. WHEN a JWT is issued (login, signup, Google auth) for a user with `type = 'super_admin'` THEN the token SHALL include `isSuperAdmin: true` and an empty `adminOf`.
2. WHEN a JWT is issued for a user with one or more live `tenant_admins` rows THEN the token SHALL include `adminOf: string[]` listing every tenant id that user administers (one entry per live row, so a manager of two tenants gets both in the same token).
3. WHEN a JWT has no `role`/`adminOf` claim (issued before this feature) THEN every consumer SHALL treat the caller as `client`.
4. WHEN an authenticated user calls `GET /profile` THEN the response SHALL include `role`, `adminOf` (tenant ids, mirroring the JWT claim), and `isSuperAdmin`.

**Independent Test**: Decode a freshly issued JWT for a tenant admin of two tenants and find both ids in `adminOf`; call `GET /profile` and see the same list.

---

## Edge Cases

- IF a `tenant_admins` row is soft-deleted (revoking access) while the user holds a still-valid JWT THEN the system SHALL — tokens are stateless JWTs with no server-side revocation list, so access persists until the token expires. Same limitation `auth`'s logout already has; not a new gap, just inherited.
- IF the super admin is also given a `tenant_admins` row for a specific tenant (redundant) THEN the system SHALL still allow the action via the `type = 'super_admin'` check — no conflict, but the redundant row does nothing.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| TENANT-01 | P1: Scope products to a tenant | Pending | Pending |
| TENANT-02 | P1: Scope products to a tenant | Pending | Pending |
| TENANT-03 | P1: Scope products to a tenant | Pending | Pending |
| TENANT-04 | P1: Two-level admin authorization | Pending | Pending |
| TENANT-05 | P1: Two-level admin authorization | Pending | Pending |
| TENANT-06 | P1: Two-level admin authorization | Pending | Pending |
| TENANT-07 | P2: Expose role and tenant | Pending | Pending |

**Coverage:** 7 total, 0 mapped to tasks yet (Design/Tasks phase not run — do that when this feature is actually picked up; it's Large/Complex per the auto-sizing table, given the auth + state-transition + migration-ordering dimensions).

---

## Success Criteria

- [ ] No existing `requireAdmin` call site is left ungated once this ships — a grep for `requireAdmin` after migration should return zero results outside its own now-deleted definition.
- [ ] A tenant admin can never read or mutate another tenant's products, verified by an integration test per Trello #202.
- [ ] iOS can gate the Admin tab from `GET /profile` alone.
