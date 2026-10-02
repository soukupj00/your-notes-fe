import Fuse, { type IFuseOptions } from 'fuse.js';
import { stripHtml } from '@/lib/utils.ts';
import type { Note } from '@/models.ts';

export type NoteSearchEntry = {
  note: Note;
  tagNames: string[];
};

/** `body` is the editor HTML as plain text, checklists included, so markup never matches. */
type NoteSearchDoc = {
  header: string;
  description: string;
  body: string;
  tagNames: string[];
  note: Note;
};

/**
 * A title hit means more than a passing mention; the description has no UI yet, so it is last.
 * Without `ignoreLocation` Fuse only scores near a field's start and misses deep matches.
 */
const FUSE_OPTIONS: IFuseOptions<NoteSearchDoc> = {
  keys: [
    { name: 'header', weight: 0.5 },
    { name: 'body', weight: 0.25 },
    { name: 'tagNames', weight: 0.15 },
    { name: 'description', weight: 0.1 },
  ],
  threshold: 0.35,
  ignoreLocation: true,
  minMatchCharLength: 2,
};

function toDoc({ note, tagNames }: NoteSearchEntry): NoteSearchDoc {
  return {
    header: note.header ?? '',
    description: note.description ?? '',
    body: stripHtml(note.body),
    tagNames,
    note,
  };
}

/** Build once per data change, not per keystroke: building walks every note, matching does not. */
export function createNoteSearchIndex(entries: NoteSearchEntry[]): Fuse<NoteSearchDoc> {
  return new Fuse(entries.map(toDoc), FUSE_OPTIONS);
}

/** A blank query is not a search, so it returns `[]`. */
export function searchNotes(index: Fuse<NoteSearchDoc>, query: string): Note[] {
  const trimmed = query.trim();
  if (!trimmed) return [];
  return index.search(trimmed).map((result) => result.item.note);
}
