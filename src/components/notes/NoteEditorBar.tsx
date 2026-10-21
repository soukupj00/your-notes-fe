import { Pin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
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

interface NoteEditorBarProps {
  /** The open Note; labels and shares earn its row through it when they need one. */
  draft: NoteDraft;
  color?: string;
  pinned: boolean;
  /** Pinning is meaningless outside the Active state, so the control is absent there. */
  pinnable: boolean;
  /** A trashed Note cannot be shared: the server shows nobody a trashed Note. */
  shareable: boolean;
  onColorChange: (color?: string) => void;
  onPinToggle: () => void;
  reminder?: Reminder;
  /** Hands the Reminder to the calendar and saves it; false when the user backed out. */
  onReminderSet: (next: Reminder) => Promise<boolean>;
  onReminderClear: () => void;
}

/**
 * Only actions that make sense on a draft with no card yet, so archive and trash stay on the
 * card's always-visible rail. Not sticky: the format toolbar is the only chrome that stays
 * above the keyboard.
 */
export function NoteEditorBar({
  draft,
  color,
  pinned,
  pinnable,
  shareable,
  onColorChange,
  onPinToggle,
  reminder,
  onReminderSet,
  onReminderClear,
}: NoteEditorBarProps) {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();

  return (
    /* Two columns, so adding a label never moves the controls. */
    <div data-slot="note-editor-bar" className="flex items-start gap-2">
      <NoteTagsBar draft={draft} className="min-w-0 flex-1" />

      <div className="flex shrink-0 items-center gap-0.5">
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
      </div>
    </div>
  );
}
