import { type Dispatch, type RefObject, type SetStateAction, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNoteActions } from '@/hooks/data/useNoteActions.ts';
import { handOff } from '@/lib/hand-off.ts';
import type { Reminder } from '@/lib/reminder.ts';
import { buildReminderIcs, reminderFile } from '@/lib/reminder-ics.ts';

/**
 * The two writes behind the editor's bell (ADR 0021).
 *
 * They live beside `NoteEditorDialog` rather than inside it because the rule
 * below is the whole feature, and the dialog is already the app's longest file.
 * The dialog keeps what it already owns - the Reminder field beside colour and
 * pin, the id, and the two mirrors of the text the save chain maintains.
 */
export function useNoteReminder(
  ensureNoteId: () => Promise<string>,
  headerRef: RefObject<string>,
  bodyRef: RefObject<string>,
  setReminder: Dispatch<SetStateAction<Reminder | undefined>>
) {
  const { t } = useTranslation();
  const { updateNote } = useNoteActions();

  // Setting IS handing off (ADR 0021): the fields are written only after the
  // calendar has been given the file, and a dismissed share sheet writes
  // nothing. The draft is persisted first because the event's UID and its link
  // back are the Note's id - a few milliseconds, well inside the tap's
  // transient activation, which `navigator.share` needs.
  //
  // The bell is lit last, after the write rather than before it: colour and pin
  // are optimistic because the tap should answer instantly, but here the user
  // has already waited on a share sheet and the button is `busy` throughout, so
  // there is nothing to be optimistic about - and a lit bell over a write that
  // failed would promise an alarm that nothing recorded.
  //
  // An otherwise empty draft is still purged on close, as a coloured one is;
  // the calendar event then links to a Note that is gone and the app's
  // not-found path handles the link. Reminding yourself of nothing is rare
  // enough not to earn a rule of its own.
  const handleReminderSet = useCallback(
    async (next: Reminder): Promise<boolean> => {
      const id = await ensureNoteId();
      const ics = buildReminderIcs({
        noteId: id,
        header: headerRef.current,
        body: bodyRef.current,
        reminder: next,
        origin: window.location.origin,
        fallbackTitle: t('reminders.fallbackTitle'),
      });
      if ((await handOff(reminderFile(ics))) === 'cancelled') return false;
      try {
        await updateNote(id, { remindAt: next.remindAt, repeat: next.repeat });
      } catch (error) {
        // The same answer a dismissed share gets: the bell stays unlit and the
        // popover stays open, so the one thing the user can do about it - try
        // again - is where they left off. Reported rather than rethrown because
        // the caller is a click handler, and an unhandled rejection is not a UI.
        console.error('useNoteReminder: failed to record the Reminder', error);
        return false;
      }
      setReminder(next);
      return true;
    },
    [ensureNoteId, updateNote, headerRef, bodyRef, setReminder, t]
  );

  const handleReminderClear = useCallback(async () => {
    const id = await ensureNoteId();
    await updateNote(id, { remindAt: undefined, repeat: undefined });
    setReminder(undefined);
  }, [ensureNoteId, updateNote, setReminder]);

  return { handleReminderSet, handleReminderClear };
}
