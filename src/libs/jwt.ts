import { type JwtPayload, sign, verify } from 'jsonwebtoken';

export function signAccessToken(userId: string): string {
  const accessToken = sign({ sub: userId }, process.env.JWT_SECRET ?? '', {
    expiresIn: '3d',
  });

  return accessToken;
}

export function validateAccessToken(token: string): string | null {
  try {
    const { sub } = verify(token, process.env.JWT_SECRET ?? '') as JwtPayload;
    return (sub as string) ?? null;
  } catch {
    return null;
  }
}
