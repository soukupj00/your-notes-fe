import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ReminderButton } from './ReminderButton.tsx';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const open = async () => userEvent.click(screen.getByRole('button', { name: 'reminders.button' }));

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

    // userEvent.type cannot drive a datetime-local in jsdom; change is the
    // event the component listens for.
    fireEvent.change(screen.getByLabelText('reminders.when'), {
      target: { value: '2030-03-04T09:00' },
    });
    await userEvent.selectOptions(screen.getByLabelText('reminders.repeat'), 'weekly');
    await userEvent.click(screen.getByRole('button', { name: 'reminders.addToCalendar' }));

    expect(onSet).toHaveBeenCalledWith({ remindAt: '2030-03-04T09:00', repeat: 'weekly' });
    await waitFor(() => expect(screen.queryByLabelText('reminders.when')).not.toBeInTheDocument());
  });

  it('sends no repeat for a one-shot', async () => {
    const onSet = vi.fn().mockResolvedValue(true);
    render(<ReminderButton onSet={onSet} onClear={vi.fn()} />);
    await open();
    fireEvent.change(screen.getByLabelText('reminders.when'), {
      target: { value: '2030-03-04T09:00' },
    });
    await userEvent.click(screen.getByRole('button', { name: 'reminders.addToCalendar' }));
    expect(onSet).toHaveBeenCalledWith({ remindAt: '2030-03-04T09:00', repeat: undefined });
  });

  it('stays open when the hand-off was cancelled', async () => {
    render(<ReminderButton onSet={vi.fn().mockResolvedValue(false)} onClear={vi.fn()} />);
    await open();
    fireEvent.change(screen.getByLabelText('reminders.when'), {
      target: { value: '2030-03-04T09:00' },
    });
    await userEvent.click(screen.getByRole('button', { name: 'reminders.addToCalendar' }));
    expect(await screen.findByLabelText('reminders.when')).toBeInTheDocument();
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
    expect(screen.getByLabelText('reminders.when')).toHaveValue('2030-03-04T09:00');
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
