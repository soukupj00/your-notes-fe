import { db } from '@/db/db.ts';
import type { Note } from '@/models.ts';
import { useLiveQuery } from 'dexie-react-hooks';

export function useNotes() {
  const notes: Note[] | undefined = useLiveQuery(async () => {
    return db.notes.toArray();
  }, []);

  return notes ?? [];
}
