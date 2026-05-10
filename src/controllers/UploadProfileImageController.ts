import { randomUUID } from 'crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { StorageService } from '../services/StorageService';
import type { HttpResponse } from '../types/Http';
import { badRequest, ok, unauthorized } from '../utils/http';

const ALLOWED_CONTENT_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/heic'] as const;

// 4 MB — safe ceiling for Lambda's 6 MB event payload limit (binary is base64-encoded in the event,
// which adds ~33% overhead: 4 MB × 1.33 ≈ 5.33 MB + headers, stays under the 6 MB hard limit)
const MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024;

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
      message: `File type must be one of: ${ALLOWED_CONTENT_TYPES.join(', ')}`,
    }),
  }),
});

type Request = {
  userId: string;
  file: Buffer;
  contentType: string;
};

export class UploadProfileImageController {
  static async handle({ userId, file, contentType }: Request): Promise<HttpResponse> {
    if (file.length > MAX_FILE_SIZE_BYTES) {
      return badRequest({
        error: `File exceeds the maximum allowed size of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB.`,
      });
    }

    const { success, error, data } = schema.safeParse({ userId, contentType });

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

    await StorageService.putObject(process.env.UPLOADS_BUCKET!, key, file, data.contentType);

    const region = process.env.AWS_REGION ?? 'sa-east-1';
    const image = `https://${process.env.UPLOADS_BUCKET}.s3.${region}.amazonaws.com/${key}`;

    return ok({ image });
  }
}
