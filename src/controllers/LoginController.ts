import { compare } from 'bcryptjs';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { usersTable } from '../db/schema';
import type { HttpRequest, HttpResponse } from '../types/Http';
import { badRequest, ok, unauthorized } from '../utils/http';
import { signAccessToken } from '../libs/jwt';

const schema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
});

export class LoginController {
  static async handle({ body }: HttpRequest): Promise<HttpResponse> {
    const { success, error, data } = schema.safeParse(body);

    if (!success) {
      return badRequest({ errors: error.flatten().fieldErrors });
    }

    const { email, password } = data;

    // Check if user exists by email
    const user = await db.query.usersTable.findFirst({
      columns: { id: true, password: true },
      where: and(eq(usersTable.email, email), isNull(usersTable.deletedAt)),
    });

    if (!user) {
      return unauthorized({ error: 'Invalid email or password.' });
    }

    // Check if password is correct
    const valid = await compare(password, user.password);
    if (!valid) {
      return unauthorized({ error: 'Invalid email or password.' });
    }

    const accessToken = signAccessToken(user.id);

    return ok({ accessToken });
  }
}
