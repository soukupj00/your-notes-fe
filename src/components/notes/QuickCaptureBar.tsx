import { ListChecks, SquarePen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { EMPTY_CHECKLIST_BODY } from '@/components/notes/NoteEditorDialog.tsx';
import type { EditingState } from '@/components/notes/NotesView.tsx';
import { Button } from '@/components/ui/button.tsx';

/** Mobile quick-capture bar: start a note or a checklist. */
export function QuickCaptureBar({ onStart }: { onStart: (editing: EditingState) => void }) {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center pb-[env(safe-area-inset-bottom)] sm:hidden">
      <div className="mb-3 flex items-center gap-1 rounded-full border bg-background px-2 py-1.5 shadow-lg">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onStart({ id: null })}
          aria-label={t('notes.create')}
        >
          <SquarePen className="size-5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onStart({ id: null, initialBody: EMPTY_CHECKLIST_BODY })}
          aria-label={t('notes.newChecklist')}
        >
          <ListChecks className="size-5" />
        </Button>
      </div>
    </div>
  );
}
