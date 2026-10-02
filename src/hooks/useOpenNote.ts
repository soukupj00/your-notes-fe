import { useCanGoBack, useNavigate, useRouter, useSearch } from '@tanstack/react-router';
import { useCallback } from 'react';
import type { NoteSearchParams } from '@/lib/note-search-params.ts';

/**
 * Which note is open, kept in the URL so the platform back button closes it
 * ([ADR 0014](../../docs/adr/0014-the-open-note-lives-in-the-url.md)).
 */
export function useOpenNote() {
  const { note } = useSearch({ strict: false }) as NoteSearchParams;
  const navigate = useNavigate();
  const router = useRouter();
  const canGoBack = useCanGoBack();

  /** Opening is navigation: it pushes, so back closes the note. */
  const openNote = useCallback(
    (id: string) => {
      void navigate({ to: '.', search: (prev: NoteSearchParams) => ({ ...prev, note: id }) });
    },
    [navigate]
  );

  const closeNote = useCallback(() => {
    // Pop the entry opening the note pushed, so the editor leaves no trace in
    // history. Replacing instead would leave two identical feed entries
    // stacked, and the user's *next* back press would appear to do nothing.
    if (canGoBack) {
      router.history.back();
      return;
    }
    // Nothing to pop: the note was opened cold, from a shared link or a reload.
    // Clearing the param in place is the only way back to the feed that does
    // not leave the app entirely.
    void navigate({
      to: '.',
      search: (prev: NoteSearchParams) => ({ ...prev, note: undefined }),
      replace: true,
    });
  }, [canGoBack, navigate, router]);

  /**
   * Drops a `note` that points at nothing, without touching history. Reachable: closing an empty
   * draft purges it, so going forward or reloading a stale tab lands on a missing note.
   */
  const dismissMissingNote = useCallback(() => {
    void navigate({
      to: '.',
      search: (prev: NoteSearchParams) => ({ ...prev, note: undefined }),
      replace: true,
    });
  }, [navigate]);

  return { openNoteId: note ?? null, openNote, closeNote, dismissMissingNote };
}
