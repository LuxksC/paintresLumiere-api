import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../db';
import { productsTable } from '../db/schema';
import type { ProtectedHttpRequest, HttpResponse } from '../types/Http';
import { badRequest, notFound, ok } from '../utils/http';
import { requireAdmin } from '../utils/requireAdmin';

export class DeleteProductController {
  static async handle({ userId, params }: ProtectedHttpRequest): Promise<HttpResponse> {
    const adminError = await requireAdmin(userId);
    if (adminError) return adminError;

    const { id } = params;
    if (!id) return badRequest({ error: 'Product id is required.' });

    const existing = await db.query.productsTable.findFirst({
      columns: { id: true },
      where: and(eq(productsTable.id, id), isNull(productsTable.deletedAt)),
    });

    if (!existing) return notFound({ error: 'Product not found.' });

    await db
      .update(productsTable)
      .set({ deletedAt: new Date(), status: 'inactive', updatedAt: new Date() })
      .where(eq(productsTable.id, id));

    return ok({ message: 'Product deleted successfully.' });
  }
}
