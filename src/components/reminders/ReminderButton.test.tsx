import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { toLocalInput } from '@/lib/reminder.ts';
import { ReminderButton } from './ReminderButton.tsx';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const open = async () => userEvent.click(screen.getByRole('button', { name: 'reminders.button' }));

// userEvent.type cannot drive a date or time input in jsdom; change is the
// event the component listens for.
const choose = (date: string, time: string) => {
  fireEvent.change(screen.getByLabelText('reminders.date'), { target: { value: date } });
  fireEvent.change(screen.getByLabelText('reminders.time'), { target: { value: time } });
};

describe('ReminderButton', () => {
  it('reads as pressed only while a Reminder is set', () => {
    const { rerender } = render(<ReminderButton onSet={vi.fn()} onClear={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'reminders.button' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    rerender(
      <ReminderButton
        reminder={{ remindAt: '2030-03-04T09:00' }}
        onSet={vi.fn()}
        onClear={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: 'reminders.button' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('will not hand off until a time is chosen', async () => {
    render(<ReminderButton onSet={vi.fn()} onClear={vi.fn()} />);
    await open();
    expect(screen.getByRole('button', { name: 'reminders.addToCalendar' })).toBeDisabled();
  });

  it('hands off the chosen time and repeat, then closes', async () => {
    const onSet = vi.fn().mockResolvedValue(true);
    render(<ReminderButton onSet={onSet} onClear={vi.fn()} />);
    await open();

    choose('2030-03-04', '09:00');
    await userEvent.selectOptions(screen.getByLabelText('reminders.repeat'), 'weekly');
    await userEvent.click(screen.getByRole('button', { name: 'reminders.addToCalendar' }));

    expect(onSet).toHaveBeenCalledWith({ remindAt: '2030-03-04T09:00', repeat: 'weekly' });
    await waitFor(() => expect(screen.queryByLabelText('reminders.time')).not.toBeInTheDocument());
  });

  // Firefox's datetime-local reported nothing until its date was picked too, so
  // a user who only set the time handed off nothing (feedback B2).
  it('starts a new Reminder on today, so choosing only a time is enough', async () => {
    const onSet = vi.fn().mockResolvedValue(true);
    render(<ReminderButton onSet={onSet} onClear={vi.fn()} />);
    await open();
    const today = toLocalInput(new Date()).slice(0, 10);
    expect(screen.getByLabelText('reminders.date')).toHaveValue(today);

    fireEvent.change(screen.getByLabelText('reminders.time'), { target: { value: '23:59' } });
    await userEvent.click(screen.getByRole('button', { name: 'reminders.addToCalendar' }));
    expect(onSet).toHaveBeenCalledWith({ remindAt: `${today}T23:59`, repeat: undefined });
  });

  it('sends no repeat for a one-shot', async () => {
    const onSet = vi.fn().mockResolvedValue(true);
    render(<ReminderButton onSet={onSet} onClear={vi.fn()} />);
    await open();
    choose('2030-03-04', '09:00');
    await userEvent.click(screen.getByRole('button', { name: 'reminders.addToCalendar' }));
    expect(onSet).toHaveBeenCalledWith({ remindAt: '2030-03-04T09:00', repeat: undefined });
  });

  it('stays open when the hand-off was cancelled', async () => {
    render(<ReminderButton onSet={vi.fn().mockResolvedValue(false)} onClear={vi.fn()} />);
    await open();
    choose('2030-03-04', '09:00');
    await userEvent.click(screen.getByRole('button', { name: 'reminders.addToCalendar' }));
    expect(await screen.findByLabelText('reminders.time')).toBeInTheDocument();
  });

  it('opens on the stored Reminder, offers to update it, and can clear it', async () => {
    const onClear = vi.fn();
    render(
      <ReminderButton
        reminder={{ remindAt: '2030-03-04T09:00', repeat: 'daily' }}
        onSet={vi.fn()}
        onClear={onClear}
      />
    );
    await open();
    expect(screen.getByLabelText('reminders.date')).toHaveValue('2030-03-04');
    expect(screen.getByLabelText('reminders.time')).toHaveValue('09:00');
    expect(screen.getByLabelText('reminders.repeat')).toHaveValue('daily');
    expect(screen.getByRole('button', { name: 'reminders.updateCalendar' })).toBeEnabled();

    await userEvent.click(screen.getByRole('button', { name: 'reminders.clear' }));
    expect(onClear).toHaveBeenCalled();
  });

  it('offers no Clear when there is nothing to clear', async () => {
    render(<ReminderButton onSet={vi.fn()} onClear={vi.fn()} />);
    await open();
    expect(screen.queryByRole('button', { name: 'reminders.clear' })).not.toBeInTheDocument();
  });
});
