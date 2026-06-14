import { z } from 'zod';
import { db } from '../db';
import { productsTable } from '../db/schema';
import type { ProtectedHttpRequest, HttpResponse } from '../types/Http';
import { badRequest, created } from '../utils/http';
import { requireAdmin } from '../utils/requireAdmin';
import { generateSlug } from '../utils/string';

const schema = z.object({
  sku: z.string().min(1, 'SKU is required'),
  name: z.string().min(1, 'Name is required'),
  category: z.enum(['names', 'numbers', 'images', 'letters']),
  selling_price: z.number().positive('Selling price must be positive'),
  color: z.enum(['gold', 'silver', 'bronze', 'rose', 'transparent', 'black']),
  description: z.string().optional(),
  stock_quantity: z.number().int().min(0).optional(),
  discount_rate: z.number().min(0).max(1).optional(),
  production_cost: z.number().positive().optional(),
  thickness: z.number().positive().default(3),
  barcode: z.string().max(14).optional(),
  status: z.enum(['active', 'inactive', 'out_of_stock']).optional(),
  height: z.number().positive().optional(),
  width: z.number().positive().optional(),
  length: z.number().positive().optional(),
  dimensions_unit: z.string().max(10).optional(),
});

export class CreateProductController {
  static async handle({ userId, body }: ProtectedHttpRequest): Promise<HttpResponse> {
    const adminError = await requireAdmin(userId);
    if (adminError) return adminError;

    const { success, error, data } = schema.safeParse(body);
    if (!success) return badRequest({ errors: error.flatten().fieldErrors });

    const slug = generateSlug(data.name);

    const [product] = await db
      .insert(productsTable)
      .values({
        sku: data.sku,
        name: data.name,
        slug,
        category: data.category,
        sellingPrice: data.selling_price.toString(),
        color: data.color,
        ...(data.description ? { description: data.description } : {}),
        ...(data.stock_quantity !== undefined ? { stockQuantity: data.stock_quantity } : {}),
        ...(data.discount_rate !== undefined ? { discountRate: data.discount_rate.toString() } : {}),
        ...(data.production_cost !== undefined ? { productionCost: data.production_cost.toString() } : {}),
        thickness: data.thickness,
        ...(data.barcode ? { barcode: data.barcode } : {}),
        ...(data.status ? { status: data.status } : {}),
        ...(data.height !== undefined ? { height: data.height } : {}),
        ...(data.width !== undefined ? { width: data.width } : {}),
        ...(data.length !== undefined ? { length: data.length } : {}),
        ...(data.dimensions_unit ? { dimensionsUnit: data.dimensions_unit } : {}),
      })
      .returning({ id: productsTable.id, slug: productsTable.slug });

    if (!product) return badRequest({ error: 'Failed to create product.' });

    return created({ id: product.id, slug: product.slug });
  }
}
