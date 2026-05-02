import { OAuth2Client } from 'google-auth-library';

const client = new OAuth2Client();

// What google returns to my API
export type GoogleUserFromIdToken = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  givenName?: string;
  familyName?: string;
};

export async function verifyGoogleIdToken(
  idToken: string
): Promise<GoogleUserFromIdToken> {
  const audiences = [
    process.env.GOOGLE_IOS_CLIENT_ID,
    process.env.GOOGLE_ANDROID_CLIENT_ID,
  ].filter((id): id is string => Boolean(id?.trim()));

  if (audiences.length === 0) {
    throw new Error('Missing GOOGLE_IOS_CLIENT_ID / GOOGLE_ANDROID_CLIENT_ID');
  }

  const ticket = await client.verifyIdToken({
    idToken,
    audience: audiences,
  });

  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email) {
    throw new Error('Invalid Google token payload');
  }

  return {
    sub: payload.sub,
    email: payload.email,
    emailVerified: Boolean(payload.email_verified),
    name: payload.name,
    givenName: payload.given_name,
    familyName: payload.family_name,
  };
}
