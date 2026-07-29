import type { ReactNode } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NoteContent } from '@/components/NoteContent.tsx';
import { NoteEditorDialog } from '@/components/notes/NoteEditorDialog.tsx';
import { QuickCaptureBar } from '@/components/notes/QuickCaptureBar.tsx';
import { ViewModeToggle } from '@/components/notes/ViewModeToggle.tsx';
import { TagFilterBar } from '@/components/tags/TagFilterBar.tsx';
import type { NoteFeedScope } from '@/hooks/data/useNoteFeed.ts';
import { useFocusOnMount } from '@/hooks/useFocusOnMount.ts';

// `null` = closed. Otherwise: `id` is the note being edited (null = new draft);
// `initialBody` seeds a new draft (e.g. a checklist from quick-capture);
// `autoplayFirstAudio` carries the "opened via an audio chip" intent through
// to the dialog/editor (best-effort autoplay on open).
export type EditingState = {
  id: string | null;
  initialBody?: string;
  autoplayFirstAudio?: boolean;
} | null;

/**
 * The shared feed view behind `/`, `/archive`, `/trash` and `/tag/$id`. The
 * route supplies the scope and the heading; everything else - layout toggle,
 * card list, editor dialog - is identical, so the views cannot drift.
 */
export function NotesView({
  scope,
  title,
  toolbar,
  showCapture = false,
}: {
  scope: NoteFeedScope;
  title: string;
  /** View-specific actions rendered beside the heading (e.g. Empty trash). */
  toolbar?: ReactNode;
  showCapture?: boolean;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState<EditingState>(null);
  const headingRef = useFocusOnMount<HTMLHeadingElement>();

  return (
    <div className="relative">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="font-semibold text-2xl focus-visible:outline-none"
        >
          {title}
        </h1>
        <div className="flex items-center gap-2">
          {toolbar}
          <ViewModeToggle />
        </div>
      </div>

      {showCapture && (
        <div className="mx-auto mb-6 hidden max-w-lg sm:block">
          <button
            type="button"
            onClick={() => setEditing({ id: null })}
            className="w-full rounded-lg border bg-background px-4 py-3 text-left text-muted-foreground shadow-sm transition-shadow hover:shadow"
          >
            {t('notes.createPlaceholder')}
          </button>
        </div>
      )}

      <TagFilterBar />

      <NoteContent
        scope={scope}
        onSelect={(id, opts) => setEditing({ id, autoplayFirstAudio: opts?.autoplayFirstAudio })}
      />

      {showCapture && <QuickCaptureBar onStart={setEditing} />}

      {editing && (
        <NoteEditorDialog
          key={editing.id ?? 'new'}
          noteId={editing.id}
          initialBody={editing.initialBody}
          autoplayFirstAudio={editing.autoplayFirstAudio}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
