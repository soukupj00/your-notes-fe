import Fuse, { type IFuseOptions } from 'fuse.js';
import { stripHtml } from '@/lib/utils.ts';
import type { Note } from '@/models.ts';

/** A note plus the names of the tags linked to it - everything search indexes. */
export type NoteSearchEntry = {
  note: Note;
  tagNames: string[];
};

/**
 * The flattened document Fuse actually scores. `body` is the editor HTML
 * reduced to plain text (checklists included - they are body content since the
 * lifecycle model dropped `Note.checklist`), so markup can never match.
 */
type NoteSearchDoc = {
  header: string;
  description: string;
  body: string;
  tagNames: string[];
  note: Note;
};

/**
 * Weights encode "a title hit means more than a passing mention": header first,
 * then the visible body, then the labels, with the (still UI-less) description
 * last. `ignoreLocation` matters as much as the threshold - without it Fuse
 * only scores near the start of a field, so a match deep in a long note would
 * be missed.
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

/**
 * Build the index once per data change, not once per keystroke - construction
 * walks every note, matching does not. Callers memoise this on the live query
 * and call `searchNotes` on every query change.
 */
export function createNoteSearchIndex(entries: NoteSearchEntry[]): Fuse<NoteSearchDoc> {
  return new Fuse(entries.map(toDoc), FUSE_OPTIONS);
}

/** Relevance-ranked notes for a query. A blank query is not a search - `[]`. */
export function searchNotes(index: Fuse<NoteSearchDoc>, query: string): Note[] {
  const trimmed = query.trim();
  if (!trimmed) return [];
  return index.search(trimmed).map((result) => result.item.note);
}
