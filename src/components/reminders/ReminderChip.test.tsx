import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReminderChip } from './ReminderChip.tsx';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, string>) =>
      vars ? `${key}|${Object.values(vars).join('|')}` : key,
    i18n: { language: 'en-GB' },
  }),
}));

const now = new Date(2030, 2, 4, 12, 0);

describe('ReminderChip', () => {
  it('names itself for assistive tech and shows the time', () => {
    render(<ReminderChip reminder={{ remindAt: '2030-03-05T09:00' }} now={now} />);
    const chip = screen.getByTestId('reminder-chip');
    expect(chip).toHaveAccessibleName(/^reminders\.chip\|.*09:00/);
    expect(chip).toHaveTextContent('09:00');
    expect(chip).toHaveAttribute('data-past', 'false');
  });

  it('is struck through once a one-shot has passed, and says so in its name', () => {
    render(<ReminderChip reminder={{ remindAt: '2030-03-04T09:00' }} now={now} />);
    const chip = screen.getByTestId('reminder-chip');
    expect(chip).toHaveAttribute('data-past', 'true');
    // The strike is pixels only; the name is the whole of what a screen reader
    // gets, so the past state has to be in it.
    expect(chip).toHaveAccessibleName(/^reminders\.chipPast\|/);
  });

  it('says how it repeats, and is never past', () => {
    render(
      <ReminderChip reminder={{ remindAt: '2020-01-01T09:00', repeat: 'weekly' }} now={now} />
    );
    const chip = screen.getByTestId('reminder-chip');
    expect(chip).toHaveTextContent('reminders.repeats.weekly');
    expect(chip).toHaveAttribute('data-past', 'false');
  });
});
