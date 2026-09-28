import { Pin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NoteColorButton } from '@/components/color-picker/NoteColorButton.tsx';
import { ShareButton } from '@/components/notes/ShareButton.tsx';
import { ReminderButton } from '@/components/reminders/ReminderButton.tsx';
import { NoteTagsBar } from '@/components/tags/NoteTagsBar.tsx';
import { useReducedMotion } from '@/hooks/useReducedMotion.ts';
import { noteControlButton } from '@/lib/note-controls.ts';
import type { Reminder } from '@/lib/reminder.ts';
import { cn } from '@/lib/utils.ts';

interface NoteEditorBarProps {
  /** The note's id, or null for a draft that has not been persisted yet. */
  noteId: string | null;
  /** Persists the draft on demand and returns its id (the dialog's save queue). */
  ensureNoteId: () => Promise<string>;
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
 * The editor's note bar: the moves that belong to the note as an object rather
 * than to the text being typed.
 *
 * It carries **labels, a Share Link, a Reminder, colour and pin, and nothing
 * else**. Archive
 * and trash are deliberately absent: the card's foot rail is visible at rest on
 * every input type (revised 2026-07-31), so an editor-side copy would duplicate
 * a control that is already one tap away. The test that separates them is whether
 * an action can apply to a note that has no card yet - a draft captured from the
 * FAB can be coloured, labelled and pinned, but archiving or trashing it means
 * nothing. A Reminder passes the same test - a draft captured from the FAB can
 * be given one (ADR 0021), and so can a Share Link, which saves the draft first.
 *
 * It is not sticky. The editor's format toolbar is the only fixed chrome on
 * mobile, because formatting is a typing move and these are not; a second bar
 * above the keyboard would cost permanent vertical space on the scarce axis.
 */
export function NoteEditorBar({
  noteId,
  ensureNoteId,
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
    /* Two columns rather than one wrapping row: the labels block takes the
       flexible side and grows downward as pills wrap, while the controls stay
       level with the "＋ Label" trigger on the first line. A wrapping row put
       them on a third line below the pills, so adding a label moved every
       control on the bar. */
    <div data-slot="note-editor-bar" className="flex items-start gap-2">
      <NoteTagsBar noteId={noteId} ensureNoteId={ensureNoteId} className="min-w-0 flex-1" />

      <div className="flex shrink-0 items-center gap-0.5">
        {shareable && (
          <ShareButton
            noteId={noteId}
            ensureNoteId={ensureNoteId}
            className={noteControlButton(reducedMotion)}
          />
        )}

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
          <button
            type="button"
            aria-label={t(pinned ? 'notes.unpin' : 'notes.pin')}
            aria-pressed={pinned}
            onClick={onPinToggle}
            className={noteControlButton(
              reducedMotion,
              // Pinned reads as chrome, so it takes the accent - the same
              // signal as the card's pin and the active rail item.
              pinned &&
                'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground'
            )}
          >
            <Pin className={cn('size-4', pinned && 'fill-current')} aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}
