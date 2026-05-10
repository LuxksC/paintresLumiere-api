import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { verifyGoogleIdToken } from '../libs/googleIdToken';
import { signAccessToken } from '../libs/jwt';
import { StorageService } from '../services/StorageService';
import type { HttpRequest, HttpResponse } from '../types/Http';
import { badRequest, conflict, ok, unauthorized } from '../utils/http';

const schema = z.object({
  idToken: z.string().min(1, 'idToken is required'),
});

export class GoogleAuthController {
  static async handle({ body }: HttpRequest): Promise<HttpResponse> {
    const { success, error, data } = schema.safeParse(body);

    if (!success) {
      return badRequest({ errors: error.flatten().fieldErrors });
    }

    if (
      !process.env.GOOGLE_IOS_CLIENT_ID?.trim() &&
      !process.env.GOOGLE_ANDROID_CLIENT_ID?.trim()
    ) {
      return badRequest({ error: 'Google sign-in is not configured.' });
    }

    let googleUser;
    try {
      googleUser = await verifyGoogleIdToken(data.idToken);
    } catch {
      return unauthorized({ error: 'Invalid Google token.' });
    }

    if (!googleUser.emailVerified) {
      return unauthorized({
        error: 'Google account email is not verified.',
      });
    }

    const email = googleUser.email.toLowerCase();
    const sub = googleUser.sub;

    const byGoogle = await db.query.usersTable.findFirst({
      columns: { id: true, googleSub: true },
      where: and(eq(usersTable.googleSub, sub), isNull(usersTable.deletedAt)),
    });

    if (byGoogle) {
      // find a active user with google token registered in database.
      return ok({ accessToken: signAccessToken(byGoogle.id) });
    }

    const byEmail = await db.query.usersTable.findFirst({
      columns: { id: true, googleSub: true, image: true },
      where: and(eq(usersTable.email, email), isNull(usersTable.deletedAt)),
    });

    if (byEmail) {
      if (byEmail.googleSub && byEmail.googleSub !== sub) {
        return conflict({
          error: 'This email is linked to another Google account.',
        });
      }

      const bucket = process.env.UPLOADS_BUCKET;
      const googlePicture = googleUser.picture?.trim() ?? null;
      const updateData: Record<string, unknown> = { googleSub: sub, updatedAt: new Date() };

      if (bucket && byEmail.image && StorageService.isS3Url(byEmail.image, bucket)) {
        // User had a profile image on S3 — delete it and switch to Google's picture
        await StorageService.deleteObject(bucket, StorageService.extractS3Key(byEmail.image));
        updateData.image = googlePicture;
      } else if (googlePicture && !byEmail.image) {
        updateData.image = googlePicture;
      }

      await db
        .update(usersTable)
        .set(updateData)
        .where(eq(usersTable.id, byEmail.id));

      return ok({ accessToken: signAccessToken(byEmail.id) });
    }

    // it does not find a user with the info given by google in the database.
    // Than -> create a new user with the info given by google.
    const name =
      googleUser.name?.trim() ||
      googleUser.givenName?.trim() ||
      email.split('@')[0];
    const lastname = googleUser.familyName?.trim();
    const picture = googleUser.picture?.trim();

    const [created] = await db
      .insert(usersTable)
      .values({
        name,
        ...(lastname ? { lastname } : {}),
        email,
        googleSub: sub,
        ...(picture ? { image: picture } : {}),
      })
      .returning({ id: usersTable.id });

    if (!created) {
      return badRequest({ error: 'Failed to create user.' });
    }

    return ok({ accessToken: signAccessToken(created.id) });
  }
}
