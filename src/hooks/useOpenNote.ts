import { useCanGoBack, useNavigate, useRouter, useSearch } from '@tanstack/react-router';
import { useCallback } from 'react';
import type { NoteSearchParams } from '@/lib/note-search-params.ts';

/**
 * Which note is open, read from and written to the URL
 * ([ADR 0014](../../docs/adr/0014-the-open-note-lives-in-the-url.md)).
 *
 * The same reasoning as the search box in slice 2: an open note is a place the
 * user navigated to, so it belongs in the address bar. What it buys is the
 * platform back button - the editor is a full-screen sheet on a phone, and
 * while it lived in `useState` the system back gesture navigated the router out
 * from under it instead of closing it.
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
   * Drop a `note` that points at nothing, without touching history.
   *
   * Reachable in normal use: closing an empty draft purges it (or never creates
   * it), so the entry the user just came from now names a note that does not
   * exist. Tapping forward, or reloading a stale tab, lands on it.
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
