import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NoteContent } from '@/components/NoteContent.tsx';
import { NoteEditorDialog } from '@/components/notes/NoteEditorDialog.tsx';
import { Button } from '@/components/ui/button.tsx';

// `null` = closed; `{ id: null }` = new draft; `{ id }` = editing an existing note.
type EditingState = { id: string | null } | null;

export function NotesHome() {
  const { t } = useTranslation();
  const [editing, setEditing] = useState<EditingState>(null);

  return (
    <div className="relative">
      {/* Desktop: "Take a note…" bar that opens the editor. */}
      <div className="mx-auto mb-6 hidden max-w-lg sm:block">
        <button
          type="button"
          onClick={() => setEditing({ id: null })}
          className="w-full rounded-lg border bg-background px-4 py-3 text-left text-muted-foreground shadow-sm transition-shadow hover:shadow"
        >
          {t('notes.createPlaceholder')}
        </button>
      </div>

      <NoteContent onSelect={(id) => setEditing({ id })} />

      {/* Mobile: floating action button, clearing the fixed bottom bar. */}
      <Button
        type="button"
        size="icon"
        onClick={() => setEditing({ id: null })}
        aria-label={t('notes.create')}
        className="fixed right-4 bottom-20 z-40 size-14 rounded-full shadow-lg sm:hidden"
      >
        <Plus className="size-6" />
      </Button>

      {editing && (
        <NoteEditorDialog
          key={editing.id ?? 'new'}
          noteId={editing.id}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
