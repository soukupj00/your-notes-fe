import { lazy, type ReactNode, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
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
import type { Intent } from '@/lib/intent.ts';
import { cn } from '@/lib/utils.ts';

const NoteEditorDialog = lazy(() =>
  import('@/components/notes/NoteEditorDialog.tsx').then((module) => ({
    default: module.NoteEditorDialog,
  }))
);

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
  const { openNoteId, opened, openNote, closeNote, dismissMissingNote } = useOpenNote();
  // A Start begins a draft, a Card opens its Note; either may carry an Intent.
  const start = (intent?: Intent) => openNote(null, intent);

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

      <NoteContent scope={scope} openNoteId={openNoteId} onSelect={openNote} />

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
            noteId={openNoteId}
            isNew={opened?.isNew}
            intent={opened?.intent}
            onClose={closeNote}
            onNoteMissing={dismissMissingNote}
          />
        </Suspense>
      )}
    </div>
  );
}
