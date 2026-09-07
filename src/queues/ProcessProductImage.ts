import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '../db';
import { productsTable } from '../db/schema';
import { StorageService } from '../services/StorageService';

export class ProcessProductImage {
  static async process(bucket: string, key: string): Promise<void> {
    // key format: product-images/{productId}/{uuid}.ext
    const productId = key.split('/')[1];

    if (!productId) {
      console.error(`Cannot extract productId from S3 key: ${key}`);
      return;
    }

    const product = await db.query.productsTable.findFirst({
      columns: { id: true },
      where: and(eq(productsTable.id, productId), isNull(productsTable.deletedAt)),
    });

    // The upload landed for a product that no longer exists — drop the orphaned object so it does
    // not accumulate storage cost.
    if (!product) {
      console.error(`Product not found for image processing: ${productId}. Deleting orphaned object.`);
      await StorageService.deleteObject(bucket, key);
      return;
    }

    const imageUrl = StorageService.getObjectUrl(bucket, key);
    const asJsonArray = JSON.stringify([imageUrl]);

    // Appending in SQL rather than read-modify-write in JS: a product has many images and several
    // uploads can be in flight at once, so reading the array and writing it back would lose
    // concurrent appends. The NOT ... @> guard makes this idempotent, which matters because SQS
    // delivers at least once. Order is preserved — the first image is the main one.
    await db
      .update(productsTable)
      .set({
        images: sql`COALESCE(${productsTable.images}, '[]'::jsonb) || ${asJsonArray}::jsonb`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(productsTable.id, productId),
          isNull(productsTable.deletedAt),
          sql`NOT COALESCE(${productsTable.images}, '[]'::jsonb) @> ${asJsonArray}::jsonb`,
        ),
      );
  }
}
