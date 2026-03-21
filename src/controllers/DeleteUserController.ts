import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../db';
import { usersTable } from '../db/schema';
import type { ProtectedHttpRequest, HttpResponse } from '../types/Http';
import { forbidden, notFound, ok, unauthorized } from '../utils/http';

export class DeleteUserController {
  static async handle({
    userId: authUserId,
    params,
  }: ProtectedHttpRequest): Promise<HttpResponse> {
    const targetUserId =
      (params.userId as string | undefined) ??
      (params.id as string | undefined) ??
      authUserId;

    const authUser = await db.query.usersTable.findFirst({
      columns: { type: true },
      where: and(eq(usersTable.id, authUserId), isNull(usersTable.deletedAt)),
    });

    if (!authUser) {
      return unauthorized({ error: 'Invalid or inactive account.' });
    }

    const isAdmin = authUser.type === 'admin';
    const isSelf = authUserId === targetUserId;

    if (!isAdmin && !isSelf) {
      return forbidden({
        error: 'You do not have permission to delete this user.',
      });
    }

    const now = new Date();
    const updated = await db
      .update(usersTable)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(eq(usersTable.id, targetUserId), isNull(usersTable.deletedAt)))
      .returning({ id: usersTable.id });

    if (updated.length === 0) {
      return notFound({ error: 'User not found or already deleted.' });
    }

    return ok({ message: 'User deleted successfully.' });
  }
}
