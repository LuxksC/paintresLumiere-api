# Product Catalog Specification

> Retroactive spec for the shipped catalog endpoints (Trello "ENTREGUES EM 2026.1": #14, #19, #20, #21, #69, #71) plus the two catalog gaps already tracked on the board (pagination #22, the SKU-detail soft-delete bug #209). Grounded in `src/controllers/{GetProducts,GetPopularProducts,GetProductBySku,CreateProduct,UpdateProduct,DeleteProduct}Controller.ts` and `src/db/schema.ts`.

## Problem Statement

Both apps need to browse and (as admin) manage a catalog where the same SKU can exist in multiple color/dimension variants (AD-001). Resellers need a public list and per-SKU detail; the workshop owner needs to create/update/retire products.

## Goals

- [x] Anyone can list the catalog and see one representative row per SKU.
- [x] Anyone can fetch every variant of a specific SKU.
- [x] An admin can create, update, and soft-delete products.
- [ ] The catalog list is paginated (currently returns everything, unbounded).

## Out of Scope

| Feature | Reason |
| --- | --- |
| Category listing endpoint, search/filter | Trello Phase 2 ("Catalog Polish": #106, #110) — not started. |
| `GET /admin/products` (every variant incl. inactive/out_of_stock, no dedupe) | Depends on `multi-tenant-admin` landing first (Trello #193). |
| `PATCH /products/{id}/stock` | Same dependency (Trello #200). |
| Deterministic image ordering | Trello #210 — separate, small fix once product-images has more real data to expose the bug. |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| SKU-dedupe tie-break | Oldest row (`orderBy: asc(createdAt)`, first-seen-wins in the dedupe filter) becomes the catalog representative | Matches `GetProductsController` exactly | y |
| `GET /products` hides `inactive` but shows `out_of_stock` | `ne(status, 'inactive')` only — `out_of_stock` still lists (with 0 stock) | Matches the controller's `where` clause | y |
| `GET /products/sku/{sku}` includes soft-deleted variants | **Known bug**, not a decision — the query has no `isNull(deletedAt)` filter (`GetProductBySkuController.ts:32`) | Confirmed by reading the source; tracked as Trello #209 | y (bug, not intended) |

**Open questions:** none — the one ambiguity found (soft-deleted variants leaking into SKU detail) is a confirmed bug, not an open design question.

---

## User Stories

### P1: Browse the catalog ⭐ MVP

**User Story**: As a reseller, I want to see the catalog and drill into a specific product's variants, so I can decide what to order.

**Why P1**: The Home and product-details screens on iOS depend entirely on this.

**Acceptance Criteria**:

1. WHEN any client calls `GET /products` THEN the system SHALL return one row per distinct SKU (oldest-created variant as representative), excluding `status = inactive` and soft-deleted rows, each with `pricing.final_price` computed as `selling_price × (1 - discount_rate)` rounded to 2 decimals.
2. WHEN any client calls `GET /products/popular` THEN the system SHALL return products ordered by `sales_count` under the same dedupe/visibility rules as `GET /products`.
3. WHEN any client calls `GET /products/sku/{sku}` with a SKU that has at least one row THEN the system SHALL return every variant row for that SKU (color, dimensions, stock, barcode included).
4. IF `GET /products/sku/{sku}` is called with a SKU that matches zero rows THEN the system SHALL return `404`.
5. IF `GET /products/sku/{sku}`'s only matching rows are soft-deleted THEN the system SHALL return `404` — **not yet true today**; see the confirmed bug above (Trello #209).

**Independent Test**: Create two variants sharing a SKU, confirm `GET /products` returns one row for that SKU while `GET /products/sku/{sku}` returns both.

---

### P1: Manage the catalog (admin) ⭐ MVP

**User Story**: As the workshop owner (admin), I want to create, update, and retire products, so the catalog reflects what's actually sellable.

**Why P1**: Without this, the catalog can never contain real data.

**Acceptance Criteria**:

1. WHEN an admin calls `POST /products` with a valid body THEN the system SHALL create a new product row and return `201`.
2. IF a non-admin (or unauthenticated caller) calls `POST /products`, `PUT /products/{id}`, or `DELETE /products/{id}` THEN the system SHALL return `401` (no/invalid session) or `403` (authenticated but not admin) per `requireAdmin`.
3. WHEN an admin calls `PUT /products/{id}` for a live product THEN the system SHALL update only the provided fields and return the updated row.
4. WHEN an admin calls `DELETE /products/{id}` for a live product THEN the system SHALL set `deleted_at` and `status = inactive` (soft delete, not a row removal) and return `200`.
5. IF `PUT` or `DELETE` targets an id that is missing or already soft-deleted THEN the system SHALL return `404`.

**Independent Test**: Create a product as admin, update its price, soft-delete it, then confirm it no longer appears in `GET /products`.

---

### P2: Paginate the catalog

**User Story**: As a client app, I want `GET /products` to return a bounded page, so the catalog can grow past a handful of items without a slow, unbounded response.

**Why P2**: Not urgent while the catalog has near-zero real data (Trello #16), but explicitly called out in HANDOFF.md as something to land *before* iOS builds infinite-scroll UI on the current response shape.

**Acceptance Criteria**:

1. WHEN a client calls `GET /products` with a `limit`/cursor (or `offset`) query param THEN the system SHALL return at most `limit` deduped rows plus a token/offset for the next page.
2. The system SHALL agree the exact param names and page-token shape with the iOS side before implementing, since it changes what iOS decodes (HANDOFF.md §5, Phase 1 item 6).

**Independent Test**: Not implementable yet — endpoint has no pagination (Trello #22).

---

## Edge Cases

- IF `sales_count` or `stock_quantity` is negative (should never happen if order/stock logic is correct once built) THEN the system SHALL — **undefined today**; no guard exists yet. Flag when the future `cart-and-orders` feature designs the stock-decrement transaction.
- IF a product's `images` array is empty THEN list/detail endpoints SHALL still return `200` with `images: []`, not fail.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| CATALOG-01 | P1: Browse the catalog | — | Verified (shipped) |
| CATALOG-02 | P1: Browse the catalog | — | Verified (shipped) |
| CATALOG-03 | P1: Browse the catalog | — | Verified (shipped) |
| CATALOG-04 | P1: Browse the catalog | — | Verified (shipped) |
| CATALOG-05 | P1: Browse the catalog | — | **Failing** — confirmed bug, Trello #209 |
| CATALOG-06 | P1: Manage the catalog (admin) | — | Verified (shipped) |
| CATALOG-07 | P2: Paginate the catalog | — | Pending (Trello #22, not started) |

**Coverage:** 7 total, 0 mapped to a formal `tasks.md` (retroactive spec), 2 need action ⚠️ (CATALOG-05 bug fix, CATALOG-07 new work).

---

## Success Criteria

- [x] Both apps can render a catalog and a product-detail screen against real endpoints.
- [ ] `GET /products/sku/{sku}` never returns a soft-deleted variant.
- [ ] `GET /products` is paginated before the catalog grows past what one Lambda response can carry comfortably.
