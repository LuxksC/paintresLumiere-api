import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { forbidden, unauthorized } from './http';
import type { HttpResponse } from '../types/Http';

export async function requireAdmin(userId: string): Promise<HttpResponse | null> {
  const user = await db.query.usersTable.findFirst({
    columns: { type: true },
    where: and(eq(usersTable.id, userId), isNull(usersTable.deletedAt)),
  });

  if (!user) return unauthorized({ error: 'Invalid or inactive account.' });
  if (user.type !== 'admin') return forbidden({ error: 'Admin access required.' });
  return null;
}
