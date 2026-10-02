import { v4 as uuid } from 'uuid';
import type { Note } from '@/models.ts';

/**
 * The one place that knows a Note's defaults. An id may be supplied because it enters the URL when
 * the editor opens (ADR 0014); `trashedAt` passes through for the purge sweep to key off.
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
    remindAt: data.remindAt,
    repeat: data.repeat,
    createdAt: now,
    updatedAt: now,
  };
}
