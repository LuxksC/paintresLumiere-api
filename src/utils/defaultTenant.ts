import { eq } from 'drizzle-orm';
import { db } from '../db';
import { tenantsTable } from '../db/schema';

// Interim only: real tenant resolution (subdomain/header, tenant sign-up) is out of scope
// until [Backend] Escopo de tenant nas queries existentes (Trello #76). Until then, every new
// user/product is associated with the single seed tenant created by the 0007 migration.
const DEFAULT_TENANT_SLUG = 'paintres-lumiere';

export async function getDefaultTenantId(): Promise<string> {
  const tenant = await db.query.tenantsTable.findFirst({
    columns: { id: true },
    where: eq(tenantsTable.slug, DEFAULT_TENANT_SLUG),
  });

  if (!tenant) {
    throw new Error(`Default tenant "${DEFAULT_TENANT_SLUG}" not found — has the seed migration run?`);
  }

  return tenant.id;
}
