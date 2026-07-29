import type { ReactNode } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CaptureKind } from '@/components/editor/editor.tsx';
import { NoteContent } from '@/components/NoteContent.tsx';
import { NoteEditorDialog } from '@/components/notes/NoteEditorDialog.tsx';
import { QuickCaptureBar } from '@/components/notes/QuickCaptureBar.tsx';
import { DESKTOP_QUICK_CAPTURE_ACTIONS } from '@/components/notes/quickCaptureActions.ts';
import { ViewModeToggle } from '@/components/notes/ViewModeToggle.tsx';
import { TagFilterBar } from '@/components/tags/TagFilterBar.tsx';
import { Button } from '@/components/ui/button.tsx';
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
  /** Media capture to auto-start on open (from quick capture). */
  capture?: CaptureKind;
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
        <div className="mx-auto mb-6 hidden max-w-lg items-center gap-1 rounded-lg border bg-background pr-2 shadow-sm transition-shadow hover:shadow sm:flex">
          <button
            type="button"
            onClick={() => setEditing({ id: null })}
            className="flex-1 px-4 py-3 text-left text-muted-foreground"
          >
            {t('notes.createPlaceholder')}
          </button>
          {/* Same five starts as the mobile speed-dial, minus plain text - the
              bar itself is the text one. */}
          {DESKTOP_QUICK_CAPTURE_ACTIONS.map(({ key, Icon, labelKey, editing: initial }) => (
            <Button
              key={key}
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t(labelKey)}
              onClick={() => setEditing(initial)}
            >
              <Icon className="size-4" />
            </Button>
          ))}
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
          initialCapture={editing.capture}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
