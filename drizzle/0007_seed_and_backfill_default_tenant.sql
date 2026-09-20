-- Seed the legacy/default tenant and backfill every pre-existing row before tenant_id
-- becomes NOT NULL in the next migration. "document" (CNPJ) is left null — fill it in
-- manually if/when the real workshop CNPJ is available; it isn't required to be NOT NULL.
INSERT INTO "tenants" ("name", "slug")
VALUES ('Paintres Lumière', 'paintres-lumiere')
ON CONFLICT ("slug") DO NOTHING;
--> statement-breakpoint
UPDATE "users"
SET "tenant_id" = (SELECT "id" FROM "tenants" WHERE "slug" = 'paintres-lumiere')
WHERE "tenant_id" IS NULL;
--> statement-breakpoint
UPDATE "products"
SET "tenant_id" = (SELECT "id" FROM "tenants" WHERE "slug" = 'paintres-lumiere')
WHERE "tenant_id" IS NULL;
