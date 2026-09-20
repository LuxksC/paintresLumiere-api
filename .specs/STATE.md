# STATE

## Decisions

### AD-001
- **Decision**: `products` stores one row per SKU **variant** (color × dimensions), not one row per SKU with a variant array/JSON column.
- **Reason**: Variants differ enough (color, dimensions, stock, barcode) that modelling them as full rows keeps queries and stock tracking simple with plain Drizzle/SQL, at the cost of duplicating `sku`/`name`/`description` across rows.
- **Trade-off**: Every SKU-level read (`GET /products`, `GET /products/popular`) must explicitly dedupe to one representative row per SKU; only `GET /products/sku/{sku}` returns the full variant set. Any new SKU-level endpoint has to remember this rule.
- **Scope**: `product-catalog`, and any future feature that reads `products` by SKU (cart/orders will need to resolve a specific variant row, not just a SKU).
- **Date**: 2026-06-14
- **Status**: active

### AD-002
- **Decision**: Product image uploads go **only through the API** (`POST /products/{productId}/images`, multipart, buffered in the Lambda, then `PutObject` from the backend). Profile images still expose *both* a through-API route (`POST /profile/image`) and a legacy presigned-POST-direct-to-S3 route (`GET /profile/image/upload-url`) — product images deliberately did not add the direct-to-S3 variant.
- **Reason**: Centralizes validation (content-type, 4 MB cap) and authorization (admin-only) in the API instead of trusting S3 POST-policy conditions alone; `docs/IMAGE_UPLOAD_STRATEGY.md` already flagged the direct-to-S3 path as something to move away from.
- **Trade-off**: Caps uploadable images at ~4 MB (base64 overhead pushes the real Lambda payload to ~5.33 MB, under the 6 MB hard limit). Card **#206** on Trello tracks removing the still-live direct-to-S3 profile-image route so every upload eventually goes through the API.
- **Scope**: `product-images` now; will supersede the direct-to-S3 route in `user-profile`'s image upload once #206 lands.
- **Date**: 2026-09-20
- **Status**: active

### AD-003
- **Decision**: Public read access to uploaded images is granted by an S3 **bucket policy scoped to the `product-images/` prefix only** (`Principal: '*'`, `s3:GetObject`), not by making the bucket globally public or switching to CloudFront/signed URLs. `BlockPublicAcls`/`IgnorePublicAcls` stay on; only `BlockPublicPolicy`/`RestrictPublicBuckets` are relaxed.
- **Reason**: Product images are catalog content that must render in both apps without auth; profile images and any future non-catalog prefix must stay private.
- **Trade-off**: Every new "should this be public" prefix needs its own policy statement — there is no single public/private toggle on the bucket. `serverless.yml` (`UploadsBucketPolicy`) is the source of truth for which prefixes are public.
- **Scope**: `product-images`, and any future S3 prefix that needs public read (e.g. a CDN swap would replace this decision, not extend it).
- **Date**: 2026-09-20
- **Status**: active

### AD-004
- **Decision**: Multi-tenancy and two-level admin authorization are in scope for this project. `users.type` gains a `super_admin` value; a separate `tenant_admins` table (`tenant_id`, `user_id`, `role: owner|manager`) grants per-tenant admin. `requireAdmin(userId)` is replaced by `requireTenantAdmin(userId, tenantId)`, and `tenantId` is only ever read from the JWT, never from body/query.
- **Reason**: The product now serves multiple resellers/workshops, each with their own admin(s), answering HANDOFF.md's old open question ("is multi-tenancy an actual goal?") — yes.
- **Trade-off**: Every admin-gated mutation written against the old `requireAdmin` needs to migrate; tokens issued before this change carry no `role` claim and must be treated as `client`. Doing this before the cart/orders tables exist (current plan) avoids a data migration on transactional tables later.
- **Scope**: cross-cutting — `multi-tenant-admin`, and every future feature with an admin-only or tenant-scoped mutation (`product-catalog`'s admin routes, future cart/orders/payments).
- **Date**: 2026-09-06
- **Status**: active

### AD-005
- **Decision**: Mercado Pago / Pagar.me / other payment providers were dropped in favor of **Asaas** for pix, boleto (carnê) and credit card.
- **Reason**: Project-owner decision (Trello card **#74**, "Abrir conta e sandbox no Asaas") — resolves HANDOFF.md's old open question #2.
- **Trade-off**: The entire payments integration surface (client, webhook signature scheme, idempotency keys, status mapping) is Asaas-shaped; switching providers later means redoing Phase 4 of the roadmap, not just swapping a config value.
- **Scope**: future `payments` feature (Phase 4 — not yet started; the Asaas account/sandbox itself isn't open yet, so no code exists against this decision).
- **Date**: 2026-09-08
- **Status**: active

### AD-006
- **Decision**: A tenant admin's JWT and `GET /profile` response carry `adminOf: string[]` — every tenant id that user administers — instead of a single `tenantId` claim. `requireTenantAdmin(userId, tenantId)` allows when `isSuperAdmin` or `tenantId ∈ adminOf`. `tenantId` for a mutation comes from the resource itself (its `tenant_id` column); for an ambiguous tenant-scoped listing, a client-supplied `tenantId` is accepted only as a selector, cross-checked against `adminOf`, never trusted on its own.
- **Reason**: HANDOFF §7 / Trello's tenant-admin design didn't specify what happens when one manager administers more than one tenant. An array claim lets one token work across every tenant a user administers, with no login/switch-tenant flow, while still never letting a client assert access to a tenant it doesn't already hold.
- **Trade-off**: The JWT grows with the number of tenants a user administers (fine at the expected scale — a handful of tenants per manager, not hundreds) and every `requireTenantAdmin` call site must check array membership instead of equality.
- **Scope**: `multi-tenant-admin`, and any future tenant-scoped route (cart/orders/payments) that reads admin scope from the session.
- **Date**: 2026-09-20
- **Status**: active

## Handoff

- **Feature**: none in progress — idle between weekend sessions
- **Phase / Task**: Trello "Phase 0 — Housekeeping" (board: Paintres Lumière, list Backlog). Product-images work (`product-images` feature) just shipped; remaining Phase 0 backend items are next.
- **Completed**: product image upload endpoint (PL-114), SQS consumer to attach images (PL-115), public-read bucket policy (PL-205) — all merged (PRs #2/#5, #3, #4)
- **In-progress**: none
- **Next step**: Pick the next Phase 0 backend item in Trello board order — tenant schema/migration (card #75), then query scoping (#76), then move the committed JWT out of `bruno/paintres-lumiere-api/environments/Local.bru` (#78). See `.specs/features/multi-tenant-admin/spec.md` for the tenant/role work.
- **Blockers**: Asaas account/sandbox not opened yet (blocks Phase 4 payments, see AD-005); AWS SES not provisioned (blocks forgot/reset-password, Trello #95-97); Google Cloud OAuth client not created (blocks iOS Google Sign-In wiring, Trello #77) — all three are owner/infra actions, not code.
- **Uncommitted files**: none (only `HANDOFF.md`, untracked, being replaced by this file)
- **Branch**: `PL-205/feat/ls/public-read-product-images` — already merged into `main` via PR #4; this local branch is stale and safe to delete after `git checkout main && git pull`
