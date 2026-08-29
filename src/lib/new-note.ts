import { v4 as uuid } from 'uuid';
import type { Note } from '@/models.ts';

/**
 * Builds a Note row from a partial, without persisting it. Shared by
 * `useNoteActions.createNote` and the Tour's Prop seed, so there is one place
 * that knows the defaults.
 *
 * An id may be supplied rather than minted: a note's id goes into the URL the
 * moment its editor opens, before there is anything worth persisting
 * (ADR 0014). `trashedAt` is carried through so a note seeded straight into the
 * trash still has the timestamp the purge sweep keys off.
 */
export function newNote(data: Partial<Note>): Note {
  const now = new Date().toISOString();
  return {
    id: data.id ?? uuid(),
    header: data.header ?? '',
    description: data.description ?? '',
    body: data.body ?? '',
    state: data.state ?? 'active',
    pinnedAt: data.pinnedAt,
    color: data.color,
    trashedAt: data.trashedAt,
    createdAt: now,
    updatedAt: now,
  };
}
