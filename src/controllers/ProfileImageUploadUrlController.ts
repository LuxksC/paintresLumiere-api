import { randomUUID } from 'crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { StorageService } from '../services/StorageService';
import type { ProtectedHttpRequest, HttpResponse } from '../types/Http';
import { badRequest, ok, unauthorized } from '../utils/http';

const ALLOWED_CONTENT_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/heic'] as const;
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const EXTENSION_MAP: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/heic': 'heic',
};

const schema = z.object({
  userId: z.string().uuid('Invalid user id'),
  contentType: z.enum(ALLOWED_CONTENT_TYPES, {
    errorMap: () => ({
      message: `contentType must be one of: ${ALLOWED_CONTENT_TYPES.join(', ')}`,
    }),
  }),
});

export class ProfileImageUploadUrlController {
  static async handle({ userId, queryParams }: ProtectedHttpRequest): Promise<HttpResponse> {
    const { success, error, data } = schema.safeParse({
      userId,
      contentType: queryParams.contentType,
    });

    if (!success) {
      return badRequest({ errors: error.flatten().fieldErrors });
    }

    const user = await db.query.usersTable.findFirst({
      columns: { id: true, googleSub: true },
      where: and(eq(usersTable.id, data.userId), isNull(usersTable.deletedAt)),
    });

    if (!user) {
      return unauthorized({ error: 'Invalid or inactive account.' });
    }

    if (user.googleSub) {
      return badRequest({
        error: 'Accounts linked to Google use the profile picture provided by Google.',
      });
    }

    const ext = EXTENSION_MAP[data.contentType];
    const key = `profile-images/${data.userId}/${randomUUID()}.${ext}`;

    const presigned = await StorageService.getPresignedUpload({
      bucket: process.env.UPLOADS_BUCKET!,
      key,
      contentType: data.contentType,
      maxFileSizeBytes: MAX_FILE_SIZE_BYTES,
    });

    return ok(presigned);
  }
}
