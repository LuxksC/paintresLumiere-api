import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { usersTable } from '../db/schema';
import type { ProtectedHttpRequest, HttpResponse } from '../types/Http';
import { badRequest, ok, unauthorized } from '../utils/http';

const schema = z.object({
  userId: z.string().uuid('Invalid user id'),
});

export class ProfileController {
  static async handle({ userId }: ProtectedHttpRequest): Promise<HttpResponse> {
    const { success, error } = schema.safeParse({ userId });

    if (!success) {
      return badRequest({ errors: error.flatten().fieldErrors });
    }

    const user = await db.query.usersTable.findFirst({
      columns: {
        id: true,
        type: true,
        name: true,
        lastname: true,
        phone: true,
        email: true,
        cpf: true,
        cnpj: true,
        image: true,
      },
      where: and(eq(usersTable.id, userId), isNull(usersTable.deletedAt)),
    });

    if (!user) {
      return unauthorized({ error: 'Invalid or inactive account.' });
    }

    return ok(user);
  }
}
