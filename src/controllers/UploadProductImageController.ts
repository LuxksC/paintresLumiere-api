import { randomUUID } from 'crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { productsTable } from '../db/schema';
import { StorageService } from '../services/StorageService';
import type { HttpResponse, ProtectedHttpRequest } from '../types/Http';
import { badRequest, notFound, ok } from '../utils/http';
import { requireAdmin } from '../utils/requireAdmin';

const ALLOWED_CONTENT_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/heic',
  'image/webp',
] as const;

// 4 MB — same ceiling as the profile image upload. The client never talks to S3 directly, so every
// byte crosses the Lambda, whose event payload is capped at 6 MB with the binary arriving
// base64-encoded (~33% overhead): 4 MB × 1.33 ≈ 5.33 MB + headers, staying under the hard limit.
const MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024;

const EXTENSION_MAP: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/heic': 'heic',
  'image/webp': 'webp',
};

const schema = z.object({
  productId: z.string().uuid('Invalid product id'),
  contentType: z.enum(ALLOWED_CONTENT_TYPES, {
    errorMap: () => ({
      message: `File type must be one of: ${ALLOWED_CONTENT_TYPES.join(', ')}`,
    }),
  }),
});

// A multipart request carries a file Buffer instead of a JSON body, so `body` and `queryParams`
// are not part of it — only the pieces of ProtectedHttpRequest that apply are picked up.
type Request = Pick<ProtectedHttpRequest, 'userId' | 'params'> & {
  file: Buffer;
  contentType: string;
};

export class UploadProductImageController {
  static async handle({ userId, params, file, contentType }: Request): Promise<HttpResponse> {
    const adminError = await requireAdmin(userId);
    if (adminError) return adminError;

    const { productId } = params;

    if (file.length > MAX_FILE_SIZE_BYTES) {
      return badRequest({
        error: `File exceeds the maximum allowed size of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB.`,
      });
    }

    const { success, error, data } = schema.safeParse({ productId, contentType });

    if (!success) {
      return badRequest({ errors: error.flatten().fieldErrors });
    }

    const product = await db.query.productsTable.findFirst({
      columns: { id: true },
      where: and(eq(productsTable.id, data.productId), isNull(productsTable.deletedAt)),
    });

    if (!product) return notFound({ error: 'Product not found.' });

    const ext = EXTENSION_MAP[data.contentType];
    const key = `product-images/${data.productId}/${randomUUID()}.${ext}`;

    await StorageService.putObject(process.env.UPLOADS_BUCKET!, key, file, data.contentType);

    const image = StorageService.getObjectUrl(process.env.UPLOADS_BUCKET!, key);

    // The URL is appended to products.images by the processProductImage queue consumer, mirroring
    // how profile images are handled. It is returned here so the caller knows the final location.
    return ok({ image });
  }
}
