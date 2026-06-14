import { and, asc, isNull, ne } from 'drizzle-orm';
import { db } from '../db';
import { productsTable } from '../db/schema';
import type { HttpRequest, HttpResponse } from '../types/Http';
import { ok } from '../utils/http';

export class GetProductsController {
  static async handle(_req: HttpRequest): Promise<HttpResponse> {
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
      },
      where: and(isNull(productsTable.deletedAt), ne(productsTable.status, 'inactive')),
      orderBy: [asc(productsTable.createdAt)],
    });

    // Dedupe by SKU — the oldest variant (first in the ordered query) becomes
    // the catalog representative for that SKU.
    const seen = new Set<string>();
    const unique = products.filter(product => {
      if (seen.has(product.sku)) return false;
      seen.add(product.sku);
      return true;
    });

    const result = unique.map(product => {
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
