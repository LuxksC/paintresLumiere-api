import { eq } from 'drizzle-orm';
import { db } from '../db';
import { productsTable } from '../db/schema';
import type { HttpRequest, HttpResponse } from '../types/Http';
import { badRequest, notFound, ok } from '../utils/http';

export class GetProductBySkuController {
  static async handle({ params }: HttpRequest): Promise<HttpResponse> {
    const { sku } = params;
    if (!sku) return badRequest({ error: 'SKU is required.' });

    const products = await db.query.productsTable.findMany({
      columns: {
        id: true,
        name: true,
        images: true,
        slug: true,
        description: true,
        stockQuantity: true,
        category: true,
        sellingPrice: true,
        discountRate: true,
        color: true,
        height: true,
        width: true,
        length: true,
        thickness: true,
        dimensionsUnit: true,
        barcode: true,
        status: true,
      },
      where: eq(productsTable.sku, sku),
    });

    if (products.length === 0) return notFound({ error: 'No products found for the given SKU.' });

    const result = products.map(product => {
      const sellingPrice = parseFloat(product.sellingPrice);
      const discountRate = parseFloat(product.discountRate ?? '0');
      const finalPrice = +(sellingPrice * (1 - discountRate)).toFixed(2);

      return {
        id: product.id,
        name: product.name,
        slug: product.slug,
        description: product.description,
        images: product.images,
        stock_quantity: product.stockQuantity,
        category: product.category,
        barcode: product.barcode,
        status: product.status,
        pricing: {
          selling_price: sellingPrice,
          discount_rate: discountRate,
          final_price: finalPrice,
        },
        specifications: {
          color: product.color,
          dimensions: {
            height: product.height,
            width: product.width,
            length: product.length,
            thickness: product.thickness,
            unit: product.dimensionsUnit,
          },
        },
      };
    });

    return ok({ products: result });
  }
}
