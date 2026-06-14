import { and, isNull, ne } from 'drizzle-orm';
import { db } from '../db';
import { productsTable } from '../db/schema';
import type { HttpRequest, HttpResponse } from '../types/Http';
import { badRequest, ok } from '../utils/http';

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 20;

export class GetPopularProductsController {
  static async handle({ queryParams }: HttpRequest): Promise<HttpResponse> {
    const rawLimit = queryParams.limit;
    let limit = DEFAULT_LIMIT;
    if (rawLimit !== undefined && rawLimit !== '') {
      const parsed = parseInt(String(rawLimit), 10);
      if (isNaN(parsed) || parsed < 1) {
        return badRequest({ error: 'limit must be a positive integer.' });
      }
      limit = Math.min(parsed, MAX_LIMIT);
    }

    const products = await db.query.productsTable.findMany({
      columns: {
        id: true,
        sku: true,
        name: true,
        sellingPrice: true,
        discountRate: true,
        stockQuantity: true,
        slug: true,
        description: true,
        images: true,
        status: true,
        thickness: true,
        salesCount: true,
        createdAt: true,
      },
      where: and(isNull(productsTable.deletedAt), ne(productsTable.status, 'inactive')),
    });

    // Group variants by SKU: aggregate sales_count across variants, keep the
    // oldest variant as the catalog representative.
    type Variant = typeof products[number];
    const groups = new Map<string, { rep: Variant; totalSales: number }>();
    for (const product of products) {
      const existing = groups.get(product.sku);
      if (existing) {
        existing.totalSales += product.salesCount;
        if (product.createdAt < existing.rep.createdAt) existing.rep = product;
      } else {
        groups.set(product.sku, { rep: product, totalSales: product.salesCount });
      }
    }

    const sorted = [...groups.values()].sort((a, b) => {
      if (b.totalSales !== a.totalSales) return b.totalSales - a.totalSales;
      return b.rep.createdAt.getTime() - a.rep.createdAt.getTime();
    });

    const result = sorted.slice(0, limit).map(({ rep: product }) => {
      const sellingPrice = parseFloat(product.sellingPrice);
      const discountRate = parseFloat(product.discountRate ?? '0');
      const finalPrice = +(sellingPrice * (1 - discountRate)).toFixed(2);

      return {
        id: product.id,
        sku: product.sku,
        name: product.name,
        slug: product.slug,
        description: product.description,
        images: product.images,
        stock_quantity: product.stockQuantity,
        status: product.status,
        pricing: {
          selling_price: sellingPrice,
          discount_rate: discountRate,
          final_price: finalPrice,
        },
        specifications: {
          thickness: product.thickness,
        },
      };
    });

    return ok({ products: result });
  }
}
