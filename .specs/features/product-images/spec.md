# Product Images Specification

> Retroactive spec for the feature just shipped this session (Trello #114, #115, #205 — PRs #2/#5, #3, #4). Grounded in `src/controllers/UploadProductImageController.ts`, `src/queues/ProcessProductImage.ts`, `src/services/StorageService.ts`, and the `UploadsBucket`/`UploadsBucketPolicy` resources in `serverless.yml`.

## Problem Statement

Products need real photos before either app's catalog is worth looking at (HANDOFF.md §4.7: "the database has almost no product data"). Admins need a way to attach images to a product, and both apps need those images to actually load.

## Goals

- [x] An admin can upload an image for a specific product.
- [x] The uploaded image gets attached to the product's `images` array asynchronously.
- [x] Product images are publicly readable by any client, without auth.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Image resizing/compression | `docs/IMAGE_UPLOAD_STRATEGY.md` flags this; tracked separately (Trello #170, `sharp` in the SQS consumer). |
| Deterministic image ordering (which image is "main") | Tracked separately (Trello #210) — today, ordering is simply array-append order, which is only deterministic if uploads are serialized. |
| Removing/reordering an already-attached image | Not designed; no endpoint exists. |
| Making the direct-to-S3 profile-image route consistent with this (API-only) pattern | Tracked as Trello #206 — a change to `user-profile`, not this feature. |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Upload path | Through the API only (no presigned-direct-to-S3 variant) | AD-002 in `.specs/STATE.md` | y |
| Max file size | 4 MB, same ceiling as profile images | `MAX_FILE_SIZE_BYTES` in `UploadProductImageController.ts:22`, with the comment explaining the base64/Lambda-payload math | y |
| Allowed content types | `png, jpeg, jpg, heic, webp` | `ALLOWED_CONTENT_TYPES` in `UploadProductImageController.ts:11-17` (one more type than profile images: `webp`) | y |
| Public-read scope | Only the `product-images/` S3 prefix, via bucket policy | AD-003 in `.specs/STATE.md` | y |
| SQS delivery semantics | At-least-once; consumer must be idempotent | `ProcessProductImage.ts` guards the array append with `NOT ... @> ...` so a re-delivered message doesn't duplicate the URL | y |
| Orphaned uploads (product deleted between upload and SQS processing) | Consumer deletes the S3 object and logs, does not error | `ProcessProductImage.ts:23-27` | y |

**Open questions:** none — this is a retroactive spec of already-merged, already-reviewed code; any real open question would be a new change request, not a spec gap.

---

## User Stories

### P1: Upload a product image ⭐ MVP

**User Story**: As the workshop owner (admin), I want to attach a photo to a product, so resellers can see what they're ordering.

**Why P1**: This is the whole point of the feature — everything else is support machinery for this one action.

**Acceptance Criteria**:

1. WHEN an admin calls `POST /products/{productId}/images` (multipart, ≤ 4 MB, content-type in the allowed set) for a live product THEN the system SHALL store the file at `product-images/{productId}/{uuid}.{ext}` and return `200` with the resulting `image` URL.
2. IF the caller is not an admin THEN the system SHALL return `401` (no/invalid session) or `403` (authenticated, not admin) before touching the file.
3. IF the file exceeds 4 MB THEN the system SHALL return `400` and SHALL NOT call S3.
4. IF `productId` does not match a live (non-soft-deleted) product THEN the system SHALL return `404` and SHALL NOT call S3.
5. IF the content type is not in `{png, jpeg, jpg, heic, webp}` THEN the system SHALL return `400` with a field-level error.

**Independent Test**: As admin, `POST` a valid image for an existing product id and get back an `image` URL; retry with a random uuid as `productId` and get `404`.

---

### P1: Attach the image to the product asynchronously

**User Story**: As the system, I want to update `products.images` only after the object safely lands in S3, so the API response doesn't have to wait on a database write in the upload's hot path.

**Why P1**: Without this, the uploaded image is stored but never shows up anywhere.

**Acceptance Criteria**:

1. WHEN an object is created under `product-images/` THEN S3 SHALL notify the `ProductImagesQueue`, and the `processProductImage` consumer SHALL append the object's URL to that product's `images` jsonb array.
2. WHILE the same SQS message is redelivered (at-least-once delivery) the system SHALL NOT duplicate the URL in `images` (idempotent append, guarded by a `NOT jsonb @> jsonb` check).
3. IF the product referenced by the S3 key no longer exists or is soft-deleted THEN the consumer SHALL delete the orphaned S3 object and SHALL NOT write to the database.

**Independent Test**: Upload an image, then poll `GET /products/sku/{sku}` (or `GET /admin/products` once it exists) until the new URL appears in `images`; manually redeliver the SQS message and confirm no duplicate.

---

### P1: Serve product images publicly

**User Story**: As either app, I want to load a product image URL directly (`<img src>` / `AsyncImage`), without sending an auth header, so rendering the catalog doesn't need a signed-URL round trip per image.

**Why P1**: An unreadable image URL makes the whole feature useless — this is exactly what Trello #205 fixed.

**Acceptance Criteria**:

1. The system SHALL allow anonymous `s3:GetObject` on any key under `product-images/*` via the `UploadsBucketPolicy` bucket policy.
2. The system SHALL NOT allow anonymous read on any other prefix (e.g. `profile-images/`) — `BlockPublicAcls`/`IgnorePublicAcls` stay enabled; only `BlockPublicPolicy`/`RestrictPublicBuckets` are relaxed, and the policy statement is scoped to one prefix.

**Independent Test**: `curl` a `product-images/...` URL with no credentials and get `200`; `curl` a `profile-images/...` URL with no credentials and get `403`.

---

## Edge Cases

- IF two uploads for the same product are in flight at once THEN the system SHALL preserve both — the SQL-level `||` append (not a JS read-modify-write) means concurrent SQS deliveries don't clobber each other (`ProcessProductImage.ts:36-48`).
- IF the uploaded file's declared `contentType` doesn't match its actual bytes THEN the system SHALL — **not validated**; the API trusts the multipart `Content-Type` header. Acceptable for now (admin-only, trusted uploader), flagged here rather than silently assumed safe forever.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| IMG-01 | P1: Upload a product image | — | Verified (shipped, PL-114) |
| IMG-02 | P1: Attach the image asynchronously | — | Verified (shipped, PL-115) |
| IMG-03 | P1: Serve product images publicly | — | Verified (shipped, PL-205) |

**Coverage:** 3 total, 0 mapped to a formal `tasks.md` (shipped without one — Medium-scope work, per the auto-sizing table). 0 unmapped.

---

## Success Criteria

- [x] An admin can go from "no photo" to "photo visible via a plain URL" in one upload, with no manual S3 console step.
- [x] Product images survive at-least-once SQS delivery without duplicating.
