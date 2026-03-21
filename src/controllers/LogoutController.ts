import type { ProtectedHttpRequest, HttpResponse } from '../types/Http';
import { ok } from '../utils/http';

/**
 * Logout is handled by the client discarding the access token.
 * This endpoint just confirms the request was authenticated and
 * was created for future implementations on logout if needed ;
 */
export class LogoutController {
  static async handle(_request: ProtectedHttpRequest): Promise<HttpResponse> {
    return ok({ message: 'Logged out successfully. Please discard the token on the client.' });
  }
}
