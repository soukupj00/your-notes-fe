import { ListChecks, SquarePen } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NoteContent } from '@/components/NoteContent.tsx';
import { EMPTY_CHECKLIST_BODY, NoteEditorDialog } from '@/components/notes/NoteEditorDialog.tsx';
import { ViewModeToggle } from '@/components/notes/ViewModeToggle.tsx';
import { Button } from '@/components/ui/button.tsx';
import { useAttachmentActions } from '@/hooks/data/useAttachmentActions.ts';

// `null` = closed. Otherwise: `id` is the note being edited (null = new draft);
// `initialBody` seeds a new draft (e.g. a checklist from quick-capture).
type EditingState = { id: string | null; initialBody?: string } | null;

export function NotesHome() {
  const { t } = useTranslation();
  const [editing, setEditing] = useState<EditingState>(null);
  const { collectMissingNoteOrphans } = useAttachmentActions();

  // Global safety net: reclaim attachment rows whose owning Note vanished
  // (crash / discarded-draft), beyond the dialog's own note-scoped sweep.
  // `collectMissingNoteOrphans` is memoized, so this runs once on mount.
  useEffect(() => {
    void collectMissingNoteOrphans();
  }, [collectMissingNoteOrphans]);

  const startNote = () => setEditing({ id: null });
  const startChecklist = () => setEditing({ id: null, initialBody: EMPTY_CHECKLIST_BODY });

  return (
    <div className="relative">
      {/* Desktop: "Take a note…" bar + layout toggle. */}
      <div className="mx-auto mb-6 hidden max-w-lg items-center gap-2 sm:flex">
        <button
          type="button"
          onClick={startNote}
          className="flex-1 rounded-lg border bg-background px-4 py-3 text-left text-muted-foreground shadow-sm transition-shadow hover:shadow"
        >
          {t('notes.createPlaceholder')}
        </button>
        <ViewModeToggle />
      </div>

      {/* Mobile: layout toggle sits above the feed (capture moves to the bottom bar). */}
      <div className="mb-2 flex justify-end sm:hidden">
        <ViewModeToggle />
      </div>

      <NoteContent onSelect={(id) => setEditing({ id })} />

      {/* Mobile quick-capture bar: note + checklist. Photo/mic land in M3. */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center pb-[env(safe-area-inset-bottom)] sm:hidden">
        <div className="mb-3 flex items-center gap-1 rounded-full border bg-background px-2 py-1.5 shadow-lg">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={startNote}
            aria-label={t('notes.create')}
          >
            <SquarePen className="size-5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={startChecklist}
            aria-label={t('notes.newChecklist')}
          >
            <ListChecks className="size-5" />
          </Button>
        </div>
      </div>

      {editing && (
        <NoteEditorDialog
          key={editing.id ?? 'new'}
          noteId={editing.id}
          initialBody={editing.initialBody}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
