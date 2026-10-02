import { describe, expect, it } from 'vitest';
import { AttachmentKind, LocalDateTime, NoteState, ReminderRepeat } from '@/contract/index.ts';
import { reminderOf } from '@/lib/reminder.ts';
import { ATTACHMENT_KINDS, NOTE_STATES, REMINDER_REPEATS } from '@/models.ts';

// The vendored contract says it mirrors `models.ts`; this is what makes that true.
describe('the contract mirrors models.ts', () => {
  it('agrees on every enum, in order', () => {
    expect(NoteState.options).toEqual([...NOTE_STATES]);
    expect(ReminderRepeat.options).toEqual([...REMINDER_REPEATS]);
    expect(AttachmentKind.options).toEqual([...ATTACHMENT_KINDS]);
  });

  it('agrees on the shape of a Reminder time', () => {
    const good = '2030-03-04T09:00';
    const clock = new Date('2030-03-04T08:00');
    expect(LocalDateTime.safeParse(good).success).toBe(true);
    expect(reminderOf({ remindAt: good }, clock)).toEqual({ remindAt: good, repeat: undefined });

    for (const bad of ['2030-03-04T09:00:00', '2030-03-04 09:00', '2030-3-4T9:00', '']) {
      expect(LocalDateTime.safeParse(bad).success).toBe(false);
      expect(reminderOf({ remindAt: bad }, clock)).toBeUndefined();
    }
  });
});
