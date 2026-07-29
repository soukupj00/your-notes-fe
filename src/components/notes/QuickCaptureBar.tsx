import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { EditingState } from '@/components/notes/NotesView.tsx';
import { QUICK_CAPTURE_ACTIONS } from '@/components/notes/quickCaptureActions.ts';
import { Button } from '@/components/ui/button.tsx';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.tsx';

/**
 * Mobile quick capture: one `＋` that expands into the five ways to start a
 * note. A Popover rather than hand-rolled state, so tap-outside and Esc close
 * it and focus is managed for free (Slice 4 adds the Motion transition).
 */
export function QuickCaptureBar({ onStart }: { onStart: (editing: EditingState) => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center pb-[env(safe-area-inset-bottom)] sm:hidden">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            size="icon"
            aria-label={t('notes.capture.open')}
            className="mb-3 size-14 rounded-full shadow-lg"
          >
            <Plus className="size-6" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          side="top"
          sideOffset={12}
          className="w-auto border-0 bg-transparent p-0 shadow-none"
        >
          <ul className="flex flex-col items-end gap-2">
            {QUICK_CAPTURE_ACTIONS.map(({ key, Icon, labelKey, editing }) => (
              <li key={key}>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setOpen(false);
                    onStart(editing);
                  }}
                  className="rounded-full shadow-md"
                >
                  <Icon className="size-5" aria-hidden />
                  {t(labelKey)}
                </Button>
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>
    </div>
  );
}
