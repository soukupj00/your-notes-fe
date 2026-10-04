import { useCanGoBack, useNavigate, useRouter, useSearch } from '@tanstack/react-router';
import { useCallback, useEffect, useState } from 'react';
import type { Intent } from '@/lib/intent.ts';
import type { NoteSearchParams } from '@/lib/note-search-params.ts';
import { mintId } from '@/lib/rows.ts';

/**
 * The gesture behind the open Note. A Start's Note is new: its id is minted here, before any row
 * exists.
 */
export type OpenedNote = { id: string; isNew: boolean; intent?: Intent };

/**
 * Which note is open, kept in the URL so the platform back button closes it
 * ([ADR 0014](../../docs/adr/0014-the-open-note-lives-in-the-url.md)); how it was opened stays
 * here, in state, so a reload cannot repeat it.
 */
export function useOpenNote() {
  const { note } = useSearch({ strict: false }) as NoteSearchParams;
  const navigate = useNavigate();
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const [opened, setOpened] = useState<OpenedNote | null>(null);

  // A gesture lasts one open. The router is the record of the open ending, whichever way it did
  // (Done, Back, a dead id), so Forward onto the same note opens it plain.
  useEffect(
    () =>
      router.subscribe('onResolved', ({ toLocation }) => {
        if (!(toLocation.search as NoteSearchParams).note) setOpened(null);
      }),
    [router]
  );

  /**
   * Opening is navigation: it pushes, so back closes the note. `null` starts a draft, whose id is
   * minted now rather than on first save, so the URL never swaps under a typing user (ADR 0014).
   */
  const openNote = useCallback(
    (id: string | null, intent?: Intent) => {
      const target = id ?? mintId();
      setOpened({ id: target, isNew: id === null, intent });
      void navigate({ to: '.', search: (prev: NoteSearchParams) => ({ ...prev, note: target }) });
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

  return {
    openNoteId: note ?? null,
    // A cold load, a shared link or Forward has no gesture behind it.
    opened: opened?.id === note ? opened : null,
    openNote,
    closeNote,
    dismissMissingNote,
  };
}
