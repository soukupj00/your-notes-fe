import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { toLocalInput } from '@/lib/reminder.ts';
import { ReminderButton } from './ReminderButton.tsx';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const open = async () => userEvent.click(screen.getByRole('button', { name: 'reminders.button' }));

// userEvent.type cannot drive a date input in jsdom; change is the event the
// component listens for.
const choose = async (date: string, time: string) => {
  const [hour, minute] = time.split(':');
  fireEvent.change(screen.getByLabelText('reminders.date'), { target: { value: date } });
  await userEvent.selectOptions(screen.getByLabelText('reminders.hour'), hour);
  await userEvent.selectOptions(screen.getByLabelText('reminders.minute'), minute);
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

    await choose('2030-03-04', '09:00');
    await userEvent.selectOptions(screen.getByLabelText('reminders.repeat'), 'weekly');
    await userEvent.click(screen.getByRole('button', { name: 'reminders.addToCalendar' }));

    expect(onSet).toHaveBeenCalledWith({ remindAt: '2030-03-04T09:00', repeat: 'weekly' });
    await waitFor(() => expect(screen.queryByLabelText('reminders.hour')).not.toBeInTheDocument());
  });

  // Firefox's datetime-local reported nothing until its date was picked too, so
  // a user who only set the time handed off nothing.
  it('starts a new Reminder on today, so choosing only a time is enough', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2030-03-04T10:00') });
    onTestFinished(() => {
      vi.useRealTimers();
    });
    const onSet = vi.fn().mockResolvedValue(true);
    render(<ReminderButton onSet={onSet} onClear={vi.fn()} />);
    await open();
    const today = toLocalInput(new Date()).slice(0, 10);
    expect(screen.getByLabelText('reminders.date')).toHaveValue(today);

    await userEvent.selectOptions(screen.getByLabelText('reminders.hour'), '23');
    await userEvent.click(screen.getByRole('button', { name: 'reminders.addToCalendar' }));
    expect(onSet).toHaveBeenCalledWith({ remindAt: `${today}T23:00`, repeat: undefined });
  });

  // The native time input drew AM/PM from the OS locale.
  it('offers a 24-hour clock in five-minute steps', async () => {
    render(<ReminderButton onSet={vi.fn()} onClear={vi.fn()} />);
    await open();
    const options = (name: string) =>
      Array.from(screen.getByLabelText(name).querySelectorAll('option:not([disabled])')).map(
        (option) => option.textContent
      );
    expect(options('reminders.hour')).toHaveLength(24);
    expect(options('reminders.hour').at(-1)).toBe('23');
    expect(options('reminders.minute')).toEqual([
      '00',
      '05',
      '10',
      '15',
      '20',
      '25',
      '30',
      '35',
      '40',
      '45',
      '50',
      '55',
    ]);
  });

  it('keeps a stored minute that falls between the steps', async () => {
    const onSet = vi.fn().mockResolvedValue(true);
    render(
      <ReminderButton reminder={{ remindAt: '2030-03-04T09:07' }} onSet={onSet} onClear={vi.fn()} />
    );
    await open();
    expect(screen.getByLabelText('reminders.minute')).toHaveValue('07');

    await userEvent.click(screen.getByRole('button', { name: 'reminders.updateCalendar' }));
    expect(onSet).toHaveBeenCalledWith({ remindAt: '2030-03-04T09:07', repeat: undefined });
  });

  it('will not hand off a one-off time that has passed, though a repeat may start there', async () => {
    render(
      <ReminderButton
        reminder={{ remindAt: '2020-01-01T08:00' }}
        onSet={vi.fn()}
        onClear={vi.fn()}
      />
    );
    await open();
    const update = screen.getByRole('button', { name: 'reminders.updateCalendar' });
    expect(update).toBeDisabled();
    expect(screen.getByText('reminders.past')).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('reminders.repeat'), 'weekly');
    expect(update).toBeEnabled();
    expect(screen.queryByText('reminders.past')).not.toBeInTheDocument();
  });

  it('sends no repeat for a one-shot', async () => {
    const onSet = vi.fn().mockResolvedValue(true);
    render(<ReminderButton onSet={onSet} onClear={vi.fn()} />);
    await open();
    await choose('2030-03-04', '09:00');
    await userEvent.click(screen.getByRole('button', { name: 'reminders.addToCalendar' }));
    expect(onSet).toHaveBeenCalledWith({ remindAt: '2030-03-04T09:00', repeat: undefined });
  });

  it('stays open when the hand-off was cancelled', async () => {
    render(<ReminderButton onSet={vi.fn().mockResolvedValue(false)} onClear={vi.fn()} />);
    await open();
    await choose('2030-03-04', '09:00');
    await userEvent.click(screen.getByRole('button', { name: 'reminders.addToCalendar' }));
    expect(await screen.findByLabelText('reminders.hour')).toBeInTheDocument();
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
    expect(screen.getByLabelText('reminders.hour')).toHaveValue('09');
    expect(screen.getByLabelText('reminders.minute')).toHaveValue('00');
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
