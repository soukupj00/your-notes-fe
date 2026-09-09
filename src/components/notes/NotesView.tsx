import { lazy, type ReactNode, Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CaptureKind } from '@/components/editor/editor.tsx';
import { NoteContent } from '@/components/NoteContent.tsx';
import { DesktopCaptureBar } from '@/components/notes/DesktopCaptureBar.tsx';
import { FLOATING_BOTTOM_BAR } from '@/components/notes/floatingBottomBar.ts';
import { QuickCaptureBar } from '@/components/notes/QuickCaptureBar.tsx';
import { TagFilterBar } from '@/components/tags/TagFilterBar.tsx';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog.tsx';
import { Spinner } from '@/components/ui/Spinner.tsx';
import type { NoteFeedScope } from '@/hooks/data/useNoteFeed.ts';
import { useFocusOnMount } from '@/hooks/useFocusOnMount.ts';
import { useOpenNote } from '@/hooks/useOpenNote.ts';
import { cn } from '@/lib/utils.ts';

const NoteEditorDialog = lazy(() =>
  import('@/components/notes/NoteEditorDialog.tsx').then((module) => ({
    default: module.NoteEditorDialog,
  }))
);

/**
 * A request to open the editor. `id` is the note to edit, or null to start a
 * new draft; `initialBody` seeds that draft (e.g. a checklist from quick
 * capture); `autoplayFirstAudio` carries the "opened via an audio chip" intent
 * through to the editor.
 *
 * It has no "closed" case any more. It used to be the editor's *state* and so
 * included `null`; since ADR 0014 the URL says whether a note is open, and this
 * only ever describes a start.
 */
export type NoteOpenRequest = {
  id: string | null;
  initialBody?: string;
  autoplayFirstAudio?: boolean;
  /** Media capture to auto-start on open (from quick capture). */
  capture?: CaptureKind;
  /** Files chosen by a picker Start, inserted once the editor is ready. */
  files?: File[];
};

/**
 * The one-shot half of an open, kept in React state rather than the URL.
 *
 * Identity belongs in the address bar; *intent* does not. "Start the camera",
 * "autoplay the first clip" and "seed an empty checklist" all describe a single
 * gesture, and a reload of `?note=x` must not re-fire the camera or replay the
 * audio. `for` scopes the intent to the note it was made about, so a back
 * button that lands on a different note cannot inherit it.
 */
type OpenIntent = {
  for: string;
  isDraft: boolean;
  initialBody?: string;
  autoplayFirstAudio?: boolean;
  capture?: CaptureKind;
  files?: File[];
};

/**
 * The shared feed view behind `/`, `/archive`, `/trash` and `/tag/$id`. The
 * route supplies the scope and the (screen-reader-only) title; everything else
 * - card list, quick capture, editor dialog - is identical, so the views cannot
 * drift. The layout toggle and sort control live in the Navbar's search bar.
 */
export function NotesView({
  scope,
  title,
  toolbar,
  showCapture = false,
}: {
  scope: NoteFeedScope;
  title: string;
  /** View-specific actions (e.g. Empty trash): a row on desktop, a floating
   *  pill in the quick-capture slot on mobile. */
  toolbar?: ReactNode;
  showCapture?: boolean;
}) {
  const { t } = useTranslation();
  const headingRef = useFocusOnMount<HTMLHeadingElement>();
  const { openNoteId, openNote, closeNote, dismissMissingNote } = useOpenNote();
  const [intent, setIntent] = useState<OpenIntent | null>(null);

  // A note's id is minted here, at open, rather than by `createNote` on the
  // first keystroke. That is what lets the URL be right from the first frame:
  // the alternative is `?note=new` swapped for `?note=<uuid>` mid-typing, and
  // since the id is this dialog's React key *and* its load-effect dependency,
  // the swap would remount the editor under the user's cursor.
  const start = (editing: NoteOpenRequest) => {
    const id = editing.id ?? crypto.randomUUID();
    setIntent({
      for: id,
      isDraft: editing.id == null,
      initialBody: editing.initialBody,
      autoplayFirstAudio: editing.autoplayFirstAudio,
      capture: editing.capture,
      files: editing.files,
    });
    openNote(id);
  };

  // Intent only applies to the note it was made about; anything else - a cold
  // load, a forward tap, a shared link - opens plain.
  const active = intent?.for === openNoteId ? intent : null;

  return (
    <div className="relative">
      {/* The heading is visually gone but still the route's focus target: a
          navigation has to land somewhere, and stranding focus on the link that
          was clicked is what `useFocusOnMount` exists to prevent. */}
      <h1 ref={headingRef} tabIndex={-1} className="sr-only">
        {title}
      </h1>

      {/* View-specific actions (e.g. Empty trash). One node, two positions: a
          right-aligned row above the feed on desktop, and the quick-capture
          bar's floating pill on mobile, where there is no longer a title row to
          hang it from. Rendering it twice would duplicate the controls. */}
      {toolbar && (
        <div
          className={cn(
            FLOATING_BOTTOM_BAR,
            'justify-center sm:static sm:mb-4 sm:justify-end sm:px-0 sm:pb-0'
          )}
        >
          <div className="flex items-center gap-2 rounded-full border bg-background px-2 py-1.5 shadow-lg sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
            {toolbar}
          </div>
        </div>
      )}

      {showCapture && <DesktopCaptureBar onStart={start} />}

      <TagFilterBar />

      <NoteContent
        scope={scope}
        onSelect={(id, opts) => start({ id, autoplayFirstAudio: opts?.autoplayFirstAudio })}
      />

      {showCapture && <QuickCaptureBar onStart={start} />}

      {openNoteId && (
        <Suspense
          fallback={
            <Dialog open>
              <DialogContent showCloseButton={false} className="flex items-center justify-center">
                <DialogTitle className="sr-only">{t('notes.loadingEditor')}</DialogTitle>
                <DialogDescription className="sr-only">
                  {t('notes.loadingEditor')}
                </DialogDescription>
                <div className="flex items-center gap-2" role="status" aria-busy>
                  <Spinner className="size-6" />
                  <span>{t('notes.loadingEditor')}</span>
                </div>
              </DialogContent>
            </Dialog>
          }
        >
          <NoteEditorDialog
            // The id never changes for the life of an open, so this key cannot
            // remount the editor mid-edit.
            key={openNoteId}
            noteId={active?.isDraft ? null : openNoteId}
            draftId={openNoteId}
            initialBody={active?.initialBody}
            autoplayFirstAudio={active?.autoplayFirstAudio}
            initialCapture={active?.capture}
            initialFiles={active?.files}
            onClose={closeNote}
            onNoteMissing={dismissMissingNote}
          />
        </Suspense>
      )}
    </div>
  );
}
