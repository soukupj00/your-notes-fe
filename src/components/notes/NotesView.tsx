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

/** How an open starts; `id: null` starts a draft. Whether one is open is the URL's (ADR 0014). */
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
 * The one-shot half of an open, kept out of the URL so a reload cannot re-fire it (CLAUDE.md,
 * Data layer). `for` scopes it to its note, so Back onto a different note cannot inherit it.
 */
type OpenIntent = {
  for: string;
  isDraft: boolean;
  initialBody?: string;
  autoplayFirstAudio?: boolean;
  capture?: CaptureKind;
  files?: File[];
};

/** Behind `/`, `/archive`, `/trash` and `/tag/$id`; routes supply only scope and title. */
export function NotesView({
  scope,
  title,
  toolbar,
  showCapture = false,
}: {
  scope: NoteFeedScope;
  title: string;
  /** View-specific actions, e.g. Empty trash. */
  toolbar?: ReactNode;
  showCapture?: boolean;
}) {
  const { t } = useTranslation();
  const headingRef = useFocusOnMount<HTMLHeadingElement>();
  const { openNoteId, openNote, closeNote, dismissMissingNote } = useOpenNote();
  const [intent, setIntent] = useState<OpenIntent | null>(null);

  // The id is minted at open, not on first save, so the URL never swaps under a typing user
  // (CLAUDE.md, Data layer).
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

  // A cold load, a forward tap or a shared link opens plain.
  const active = intent?.for === openNoteId ? intent : null;

  return (
    <div className="relative">
      {/* Visually hidden, but still the focus target a navigation lands on. */}
      <h1 ref={headingRef} tabIndex={-1} className="sr-only">
        {title}
      </h1>

      {/* One node in two positions, a row on desktop and a floating pill on mobile:
          rendering it twice would duplicate the controls. */}
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
              <DialogContent
                showCloseButton={false}
                // Leaves focus where the open came from, so the editor that
                // replaces this can record it and hand it back on close.
                onOpenAutoFocus={(event) => event.preventDefault()}
                className="flex items-center justify-center"
              >
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
            // Stable for the life of an open, so this key cannot remount the editor mid-edit.
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
