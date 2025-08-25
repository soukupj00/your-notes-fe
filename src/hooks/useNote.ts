import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/db';
import type { Note } from '@/models';

export function useNote(id: string) {
  const note: Note | null | undefined = useLiveQuery(async () => {
    if (!id) return null;
    return db.notes.get(id);
  }, [id]);

  return note;
}
