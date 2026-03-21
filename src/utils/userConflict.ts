import type { SQL } from 'drizzle-orm';
import { db } from '../db';
import { usersTable } from '../db/schema';
import type { HttpResponse } from '../types/Http';
import { conflict } from './http';

export async function conflictIfUserPropertyExists(
  where: SQL,
  errorMessage: string
): Promise<HttpResponse | null> {
  const row = await db.query.usersTable.findFirst({
    columns: { id: true },
    where,
  });
  return row ? conflict({ error: errorMessage }) : null;
}
