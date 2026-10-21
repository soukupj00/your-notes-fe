import { Pin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LifecycleButtons } from '@/components/cards/LifecycleButtons.tsx';
import { NoteColorButton } from '@/components/color-picker/NoteColorButton.tsx';
import { ShareButton } from '@/components/notes/ShareButton.tsx';
import { ReminderButton } from '@/components/reminders/ReminderButton.tsx';
import { NoteTagsBar } from '@/components/tags/NoteTagsBar.tsx';
import { IconTooltip } from '@/components/ui/tooltip.tsx';
import { useReducedMotion } from '@/hooks/useReducedMotion.ts';
import type { NoteDraft } from '@/lib/draft.ts';
import { noteControlButton } from '@/lib/note-controls.ts';
import type { Reminder } from '@/lib/reminder.ts';
import { cn } from '@/lib/utils.ts';
import type { NoteState } from '@/models.ts';

interface NoteEditorBarProps {
  /** The open Note; labels and shares earn its row through it when they need one. */
  draft: NoteDraft;
  color?: string;
  pinned: boolean;
  state: NoteState;
  onColorChange: (color?: string) => void;
  onPinToggle: () => void;
  /** Each leaves the Note: the editor closes and the move toasts its undo. */
  onArchive: () => void;
  onRestore: () => void;
  onTrash: () => void;
  reminder?: Reminder;
  /** Hands the Reminder to the calendar and saves it; false when the user backed out. */
  onReminderSet: (next: Reminder) => Promise<boolean>;
  onReminderClear: () => void;
}

/** Not sticky: the format toolbar is the only chrome that stays above the keyboard. */
export function NoteEditorBar({
  draft,
  color,
  pinned,
  state,
  onColorChange,
  onPinToggle,
  onArchive,
  onRestore,
  onTrash,
  reminder,
  onReminderSet,
  onReminderClear,
}: NoteEditorBarProps) {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  // Pinning means nothing outside the Active state, and the server shows nobody a trashed Note.
  const pinnable = state === 'active';
  const shareable = state !== 'trashed';

  return (
    /* Two columns, so adding a label never moves the controls; on a narrow phone the controls
       wrap below the labels' fixed basis instead of squeezing them. */
    <div data-slot="note-editor-bar" className="flex flex-wrap items-start gap-2">
      <NoteTagsBar draft={draft} className="min-w-0 flex-1 basis-32" />

      <div className="ml-auto flex shrink-0 items-center gap-0.5">
        {shareable && <ShareButton draft={draft} className={noteControlButton(reducedMotion)} />}

        <ReminderButton
          reminder={reminder}
          onSet={onReminderSet}
          onClear={onReminderClear}
          className={noteControlButton(reducedMotion)}
        />

        <NoteColorButton
          value={color}
          onChange={onColorChange}
          className={noteControlButton(reducedMotion)}
        />

        {pinnable && (
          <IconTooltip label={t(pinned ? 'notes.unpin' : 'notes.pin')}>
            <button
              type="button"
              aria-label={t(pinned ? 'notes.unpin' : 'notes.pin')}
              aria-pressed={pinned}
              onClick={onPinToggle}
              className={noteControlButton(
                reducedMotion,
                // Pinned is chrome, so it takes the accent, like the card's pin.
                pinned &&
                  'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground'
              )}
            >
              <Pin className={cn('size-4', pinned && 'fill-current')} aria-hidden />
            </button>
          </IconTooltip>
        )}

        <LifecycleButtons
          state={state}
          onArchive={onArchive}
          onRestore={onRestore}
          onTrash={onTrash}
          className={noteControlButton(reducedMotion)}
        />
      </div>
    </div>
  );
}
