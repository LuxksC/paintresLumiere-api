import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { StorageService } from '../services/StorageService';

export class ProcessProfileImage {
  static async process(bucket: string, key: string): Promise<void> {
    // key format: profile-images/{userId}/{uuid}.ext
    const userId = key.split('/')[1];

    if (!userId) {
      console.error(`Cannot extract userId from S3 key: ${key}`);
      return;
    }

    const user = await db.query.usersTable.findFirst({
      columns: { id: true, image: true },
      where: and(eq(usersTable.id, userId), isNull(usersTable.deletedAt)),
    });

    if (!user) {
      console.error(`User not found for profile image processing: ${userId}`);
      return;
    }

    if (user.image && StorageService.isS3Url(user.image, bucket)) {
      const oldKey = StorageService.extractS3Key(user.image);
      if (oldKey !== key) {
        await StorageService.deleteObject(bucket, oldKey);
      }
    }

    const region = process.env.AWS_REGION ?? 'sa-east-1';
    const imageUrl = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;

    await db
      .update(usersTable)
      .set({ image: imageUrl, updatedAt: new Date() })
      .where(eq(usersTable.id, userId));
  }
}
