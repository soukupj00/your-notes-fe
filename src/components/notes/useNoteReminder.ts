import { type Dispatch, type SetStateAction, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNoteActions } from '@/hooks/data/useNoteActions.ts';
import type { NoteDraft } from '@/lib/draft.ts';
import { handOff } from '@/lib/hand-off.ts';
import type { Reminder } from '@/lib/reminder.ts';
import { buildReminderIcs, reminderFile } from '@/lib/reminder-ics.ts';

/** The two writes behind the editor's bell (ADR 0021; CLAUDE.md, Reminders). */
export function useNoteReminder(
  draft: NoteDraft,
  /** What is typed so far, for the event's title and description. */
  content: () => { header: string; body: string },
  setReminder: Dispatch<SetStateAction<Reminder | undefined>>
) {
  const { t } = useTranslation();
  const { updateNote } = useNoteActions();

  // Fields are written only after the calendar took the file, and the bell lights only after
  // the write (CLAUDE.md, Reminders). The Draft earns its row first because the event's UID is the
  // Note's id; that takes milliseconds, well inside the tap activation `navigator.share` needs.
  const handleReminderSet = useCallback(
    async (next: Reminder): Promise<boolean> => {
      const id = await draft.ensureSaved();
      const typed = content();
      const ics = buildReminderIcs({
        noteId: id,
        header: typed.header,
        body: typed.body,
        reminder: next,
        origin: window.location.origin,
        fallbackTitle: t('reminders.fallbackTitle'),
      });
      if ((await handOff(reminderFile(ics))) === 'cancelled') return false;
      try {
        await updateNote(id, { remindAt: next.remindAt, repeat: next.repeat });
      } catch (error) {
        // Same answer as a dismissed share: the bell stays unlit and the popover open, ready to
        // retry. Logged, not rethrown, because the caller is a click handler.
        console.error('useNoteReminder: failed to record the Reminder', error);
        return false;
      }
      setReminder(next);
      return true;
    },
    [draft, content, updateNote, setReminder, t]
  );

  const handleReminderClear = useCallback(async () => {
    const id = await draft.ensureSaved();
    await updateNote(id, { remindAt: undefined, repeat: undefined });
    setReminder(undefined);
  }, [draft, updateNote, setReminder]);

  return { handleReminderSet, handleReminderClear };
}
