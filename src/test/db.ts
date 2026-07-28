import { db } from '@/db/db.ts';

/** Clear every application table so test cleanup follows future schema changes automatically. */
export async function clearNotesDb(): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
  });
}
