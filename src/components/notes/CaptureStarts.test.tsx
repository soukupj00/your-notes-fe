import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CaptureStarts } from './CaptureStarts.tsx';
import { QUICK_CAPTURE_ACTIONS } from './quickCaptureActions.ts';
import { planCaptureBar, startsThatFit } from './useStartsThatFit.ts';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const actions = QUICK_CAPTURE_ACTIONS.slice(1, 6);
const labels = actions.map((action) => action.labelKey);
const MORE = 'notes.capture.more';

describe('startsThatFit', () => {
  it.each([
    ['room for all five', 5 * 44 + 4 * 4, 5],
    ['room for four slots', 4 * 44 + 3 * 4, 3],
    ['room for one slot', 44, 0],
    ['no room', -10, 0],
  ])('%s gives %s inline', (_, available, inline) => {
    expect(startsThatFit(available, 44, 4, 5)).toBe(inline);
  });
});

describe('planCaptureBar', () => {
  // Five 44px Starts with 4px gaps need 236px; the prompts are 90px resting, 170px longest.
  const prompts = { resting: 90, longest: 170 };
  it.each([
    ['the longest prompt fits beside every Start', 170 + 236, { rotate: true, fit: 5 }],
    ['only the resting one does', 90 + 236, { rotate: false, fit: 5 }],
    ['neither does', 90 + 4 * 44 + 3 * 4, { rotate: false, fit: 3 }],
  ])('when %s: %o', (_, room, plan) => {
    expect(planCaptureBar(room, prompts, 44, 4, 5)).toEqual(plan);
  });
});

describe('CaptureStarts', () => {
  it.each([0, 2, 4])(
    'puts the first %i inline and the rest, in order, in the menu',
    async (fit) => {
      const onPick = vi.fn();
      render(<CaptureStarts actions={actions} fit={fit} onPick={onPick} />);

      const inline = screen
        .getAllByRole('button')
        .map((button) => button.getAttribute('aria-label'));
      expect(inline).toEqual([...labels.slice(0, fit), MORE]);

      await userEvent.click(screen.getByRole('button', { name: MORE }));
      const menu = await screen.findByRole('menu');
      expect(
        within(menu)
          .getAllByRole('menuitem')
          .map((item) => item.textContent)
      ).toEqual(labels.slice(fit));

      await userEvent.click(within(menu).getAllByRole('menuitem')[0]);
      expect(onPick).toHaveBeenCalledWith(actions[fit]);
    }
  );

  it('shows no ⋯ when every Start fits', () => {
    render(<CaptureStarts actions={actions} fit={actions.length} onPick={vi.fn()} />);

    expect(screen.queryByRole('button', { name: MORE })).toBeNull();
    expect(screen.getAllByRole('button')).toHaveLength(actions.length);
  });
});
