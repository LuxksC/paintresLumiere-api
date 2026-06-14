import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { productsTable } from '../db/schema';
import type { ProtectedHttpRequest, HttpResponse } from '../types/Http';
import { badRequest, notFound, ok } from '../utils/http';
import { requireAdmin } from '../utils/requireAdmin';
import { generateSlug } from '../utils/string';

const schema = z.object({
  name: z.string().min(1).optional(),
  sku: z.string().min(1).optional(),
  category: z.enum(['names', 'numbers', 'images', 'letters']).optional(),
  selling_price: z.number().positive().optional(),
  color: z.enum(['gold', 'silver', 'bronze', 'rose', 'transparent', 'black']).optional(),
  description: z.string().optional(),
  stock_quantity: z.number().int().min(0).optional(),
  discount_rate: z.number().min(0).max(1).optional(),
  production_cost: z.number().positive().optional(),
  thickness: z.number().positive().optional(),
  barcode: z.string().max(14).optional(),
  status: z.enum(['active', 'inactive', 'out_of_stock']).optional(),
  height: z.number().positive().optional(),
  width: z.number().positive().optional(),
  length: z.number().positive().optional(),
  dimensions_unit: z.string().max(10).optional(),
});

export class UpdateProductController {
  static async handle({ userId, body, params }: ProtectedHttpRequest): Promise<HttpResponse> {
    const adminError = await requireAdmin(userId);
    if (adminError) return adminError;

    const { id } = params;
    if (!id) return badRequest({ error: 'Product id is required.' });

    const { success, error, data } = schema.safeParse(body);
    if (!success) return badRequest({ errors: error.flatten().fieldErrors });

    const existing = await db.query.productsTable.findFirst({
      columns: { id: true },
      where: and(eq(productsTable.id, id), isNull(productsTable.deletedAt)),
    });

    if (!existing) return notFound({ error: 'Product not found.' });

    const updates: Record<string, unknown> = { updatedAt: new Date() };

    if (data.name) {
      updates.name = data.name;
      updates.slug = generateSlug(data.name);
    }
    if (data.sku) updates.sku = data.sku;
    if (data.category) updates.category = data.category;
    if (data.selling_price !== undefined) updates.sellingPrice = data.selling_price.toString();
    if (data.color) updates.color = data.color;
    if (data.description !== undefined) updates.description = data.description;
    if (data.stock_quantity !== undefined) updates.stockQuantity = data.stock_quantity;
    if (data.discount_rate !== undefined) updates.discountRate = data.discount_rate.toString();
    if (data.production_cost !== undefined) updates.productionCost = data.production_cost.toString();
    if (data.thickness !== undefined) updates.thickness = data.thickness;
    if (data.barcode !== undefined) updates.barcode = data.barcode;
    if (data.status) updates.status = data.status;
    if (data.height !== undefined) updates.height = data.height;
    if (data.width !== undefined) updates.width = data.width;
    if (data.length !== undefined) updates.length = data.length;
    if (data.dimensions_unit) updates.dimensionsUnit = data.dimensions_unit;

    await db
      .update(productsTable)
      .set(updates)
      .where(eq(productsTable.id, id));

    return ok({ message: 'Product updated successfully.' });
  }
}
